/*
 * EE231001 Introduction to Programming -- Midterm Project: Tomb Explorer
 * BONUS version: basic game + Automatic Pathfinding Mode (command 'r').
 *
 * Build : g++ -std=c++11 -Wall -Wextra -o PA_studID.out StudID_Name_MP_bonus.cpp
 * Run   : ./PA_studID.out
 *
 * Course restrictions
 *   - Recursion : searchBestValue() is a recursive DFS (theoretical max value).
 *   - No struct / class anywhere; all state lives in plain global arrays/vectors.
 *   - No brute force: reachability uses BFS, the knapsack DFS prunes hopeless
 *     branches, and the auto-pathfinder is a BFS over *game states* (it never
 *     enumerates paths one by one).
 *
 * How the auto-pathfinder works (see planRoute)
 *   A game state is (position, weapons held, monsters defeated, items taken).
 *   Weight and value follow from "items taken", and the number of steps used is
 *   the BFS depth, so nothing else has to be stored. Every state is expanded
 *   once, directions in the order s, w, d, a. Because BFS reaches each state
 *   with the fewest steps and, within a depth, in search order, the first goal
 *   state with the highest value is also the shortest and the first-found one.
 *
 * AI-ASSISTANCE DISCLOSURE (required by the course)
 *   This file was drafted with an AI coding assistant (Claude Code), which
 *   wrote the whole program from the project PDF.
 *   TODO (student): replace this line with what you personally reviewed,
 *   changed and tested, and repeat it in your report.
 */

#include <iostream>
#include <iomanip>
#include <string>
#include <vector>
using namespace std;

// ============================================================ constants
const int MAP_SIZE = 16;
const int MAX_HEARTS = 3;
const int WALL_PERCENT = 40;        // a generated cell is a wall with this chance (%)
const int NUM_TREASURES = 6;
const int NUM_MONSTERS = 3;
const int NUM_ITEMS = NUM_TREASURES + NUM_MONSTERS;   // item 0..5 = treasures, 6..8 = Z/V/W drops
const long long RNG_MOD = 2147483648LL;

const char MONSTER_SYM[NUM_MONSTERS] = {'Z', 'V', 'W'};
const char WEAPON_SYM[NUM_MONSTERS]  = {'z', 'v', 'w'};
const char DROP_SYM[NUM_MONSTERS]    = {'a', 'b', 'c'};

// reasons a game can end (RUNNING = still playing)
const int RUNNING = 0, ESCAPED = 1, NO_HEARTS = 2, NO_STAMINA = 3, INPUT_CLOSED = 4;

// ============================================================ global state
char grid[MAP_SIZE][MAP_SIZE];          // the live dungeon
bool reachable[MAP_SIZE][MAP_SIZE];     // cells reachable from the start (BFS)
int distFromStart[MAP_SIZE][MAP_SIZE];  // BFS distance, -1 when unreachable
long long rngState;

int backpackCapacity;
int itemWeight[NUM_ITEMS];
int itemValue[NUM_ITEMS];

bool itemTaken[NUM_ITEMS];
bool hasWeapon[NUM_MONSTERS];
bool monsterDefeated[NUM_MONSTERS];
char origGrid[MAP_SIZE][MAP_SIZE];      // dungeon as generated (never modified); used by the planner
int playerRow = 0, playerCol = 0;
int hearts = MAX_HEARTS;
int stamina = 0, maxStamina = 0;
int stepCount = 0;
int totalValue = 0, totalWeight = 0;
int theoreticalMax = 0;
int endReason = RUNNING;

// ============================================================ small helpers
// Index of ch inside a 3-symbol table, or -1.
int indexInSet(const char set[], char ch) {
    for (int i = 0; i < NUM_MONSTERS; i++)
        if (set[i] == ch) return i;
    return -1;
}

// Item number (0..8) for a treasure/drop symbol on the map, or -1.
int itemIndexAt(char ch) {
    if (ch >= '1' && ch <= '6') return ch - '1';
    int drop = indexInSet(DROP_SYM, ch);
    return (drop >= 0) ? NUM_TREASURES + drop : -1;
}

string itemName(int item) {
    if (item < NUM_TREASURES) return "Treasure " + to_string(item + 1);
    return string("Monster ") + MONSTER_SYM[item - NUM_TREASURES] + " drop";
}

bool readToken(string &token) {
    if (cin >> token) return true;
    return false;
}

// ============================================================ random numbers
void seedRng(long long seed) {
    // the PDF formula, kept non-negative so a negative seed cannot break % 16
    rngState = ((seed % RNG_MOD) + RNG_MOD) % RNG_MOD;
}

int getRandomNum() {
    rngState = (rngState * 1103515245LL + 12345LL) % RNG_MOD;
    return (int)(rngState >> 16);
}

// ============================================================ dungeon generation
// Step 1 + 2: random walls/paths (row by row), then force the start and exit.
void generateWalls() {
    for (int r = 0; r < MAP_SIZE; r++)
        for (int c = 0; c < MAP_SIZE; c++)
            grid[r][c] = (getRandomNum() % 100 < WALL_PERCENT) ? '#' : '.';
    grid[0][0] = 'S';
    grid[MAP_SIZE - 1][MAP_SIZE - 1] = 'E';
}

// Step 3 + 4: BFS from (0,0). Fills reachable[][] / distFromStart[][] and
// returns D, the shortest distance to the exit (-1 if the exit is unreachable).
int runBfs() {
    const int DR[4] = {-1, 1, 0, 0};    // up, down, left, right
    const int DC[4] = {0, 0, -1, 1};
    int queue[MAP_SIZE * MAP_SIZE];
    int head = 0, tail = 0;

    for (int r = 0; r < MAP_SIZE; r++)
        for (int c = 0; c < MAP_SIZE; c++) {
            distFromStart[r][c] = -1;
            reachable[r][c] = false;
        }

    distFromStart[0][0] = 0;
    reachable[0][0] = true;
    queue[tail++] = 0;                  // a cell is stored as row * MAP_SIZE + col
    while (head < tail) {
        int cur = queue[head++];
        int r = cur / MAP_SIZE, c = cur % MAP_SIZE;
        for (int k = 0; k < 4; k++) {
            int nr = r + DR[k], nc = c + DC[k];
            if (nr < 0 || nr >= MAP_SIZE || nc < 0 || nc >= MAP_SIZE) continue;
            if (grid[nr][nc] == '#' || reachable[nr][nc]) continue;
            reachable[nr][nc] = true;
            distFromStart[nr][nc] = distFromStart[r][c] + 1;
            queue[tail++] = nr * MAP_SIZE + nc;
        }
    }
    return distFromStart[MAP_SIZE - 1][MAP_SIZE - 1];
}

// Step 5: draw random cells until one is reachable and still empty.
void placeObject(char symbol) {
    while (true) {
        int row = getRandomNum() % MAP_SIZE;
        int col = getRandomNum() % MAP_SIZE;
        if (reachable[row][col] && grid[row][col] == '.') {
            grid[row][col] = symbol;
            return;
        }
    }
}

// Generates dungeons from the same RNG stream until the exit is reachable,
// then places all objects. Returns D.
int buildDungeon() {
    int d;
    do {
        generateWalls();
        d = runBfs();
    } while (d < 0);

    const char order[] = "123456ZVWzvw";
    for (int i = 0; order[i] != '\0'; i++) placeObject(order[i]);

    for (int r = 0; r < MAP_SIZE; r++)
        for (int c = 0; c < MAP_SIZE; c++) origGrid[r][c] = grid[r][c];
    return d;
}

// ============================================================ theoretical maximum value
int bestValue;
int suffixGain[NUM_ITEMS + 1];          // suffixGain[i] = best gain still possible from items i..8

// Recursive DFS over "take / skip" for item idx onwards.
// A branch is dropped when even taking every remaining item cannot beat bestValue.
void searchBestValue(int idx, int weight, int value) {
    if (value > bestValue) bestValue = value;       // current choice is a valid selection
    if (idx == NUM_ITEMS) return;
    if (value + suffixGain[idx] <= bestValue) return;

    if (weight + itemWeight[idx] <= backpackCapacity)
        searchBestValue(idx + 1, weight + itemWeight[idx], value + itemValue[idx]);   // take
    searchBestValue(idx + 1, weight, value);                                          // skip
}

int computeTheoreticalMax() {
    suffixGain[NUM_ITEMS] = 0;
    for (int i = NUM_ITEMS - 1; i >= 0; i--)
        suffixGain[i] = suffixGain[i + 1] + (itemValue[i] > 0 ? itemValue[i] : 0);
    bestValue = 0;
    searchBestValue(0, 0, 0);
    return bestValue;
}

// ============================================================ output
void printMap() {
    string border(MAP_SIZE + 2, '#');
    cout << border << "\n";
    for (int r = 0; r < MAP_SIZE; r++) {
        cout << '#';
        for (int c = 0; c < MAP_SIZE; c++)
            cout << ((r == playerRow && c == playerCol) ? 'U' : grid[r][c]);
        cout << "#\n";
    }
    cout << border << "\n";
}

void printWeapons() {
    cout << "Weapons: ";
    for (int i = 0; i < NUM_MONSTERS; i++) {
        if (i > 0) cout << ' ';
        cout << WEAPON_SYM[i] << '[' << (hasWeapon[i] ? 'Y' : 'N') << ']';
    }
    cout << "\n";
}

void printStatus() {
    cout << "========== Status ==========\n";
    cout << "Hearts: " << hearts << " / " << MAX_HEARTS << "\n";
    cout << "Stamina: " << stamina << " / " << maxStamina << "\n";
    printWeapons();
    cout << "Total Value: " << totalValue << "\n";
    cout << "Backpack Weight: " << totalWeight << " / " << backpackCapacity << "\n";
    cout << "Steps: " << stepCount << "\n";
    cout << "============================\n";
}

void printResult() {
    const string line(36, '=');
    cout << line << "\n" << "Tomb Explorer Result\n" << line << "\n";
    if (endReason == ESCAPED)         cout << "You escaped the tomb.\n";
    else if (endReason == NO_HEARTS)  cout << "Game Over. You ran out of hearts.\n";
    else                              cout << "Game Over. You ran out of stamina.\n";

    double completeness = (theoreticalMax > 0) ? 100.0 * totalValue / theoreticalMax : 0.0;
    cout << "Final Value: " << totalValue << "\n";
    cout << "Theoretical Max Value: " << theoreticalMax << "\n";
    cout << "Mission Completeness: " << fixed << setprecision(1) << completeness << "%\n";
    cout << "Backpack Weight: " << totalWeight << " / " << backpackCapacity << "\n";
    cout << "Hearts: " << hearts << " / " << MAX_HEARTS << "\n";
    cout << "Stamina: " << stamina << " / " << maxStamina << "\n";
    printWeapons();
    cout << "Total Steps: " << stepCount << "\n";
    cout << line << "\n";
}

// ============================================================ gameplay
const int MANUAL = -1;      // autoChoice values: ask the player ...
const int AUTO_LEAVE = 0;   // ... or let the planned route decide
const int AUTO_TAKE = 1;

void collectItem(int item, int row, int col) {
    itemTaken[item] = true;
    totalWeight += itemWeight[item];
    totalValue += itemValue[item];
    grid[row][col] = '.';
    cout << "Item collected.\n";
}

// Treasure or monster drop at (row, col). In manual play ask the player until
// y/n is given; in auto mode follow the planner's decision without any prompt.
void offerItem(int item, int row, int col, int autoChoice) {
    cout << "You found " << itemName(item) << ".\n";
    cout << "Weight: " << itemWeight[item] << ", Value: " << itemValue[item] << "\n";

    if (autoChoice != MANUAL) {
        if (autoChoice == AUTO_TAKE && totalWeight + itemWeight[item] <= backpackCapacity)
            collectItem(item, row, col);
        else
            cout << "Auto mode left it here.\n";
        return;
    }

    string answer;
    while (true) {
        cout << "Take it [y/n]: ";
        if (!readToken(answer)) {
            endReason = INPUT_CLOSED;
            return;
        }
        if (answer == "y" || answer == "Y") {
            if (totalWeight + itemWeight[item] <= backpackCapacity)
                collectItem(item, row, col);
            else
                cout << "Your backpack is too heavy. You cannot take it.\n";
            return;
        }
        if (answer == "n" || answer == "N") {
            cout << "You left it here.\n";
            return;
        }
        cout << "Please enter y or n.\n";
    }
}

// One movement command (w/a/s/d): wall and border bumps are free, everything
// else costs 1 stamina and 1 step. autoChoice is MANUAL for typed commands, or
// the planner's take/leave decision while an automatic route is being replayed.
void handleMove(char cmd, int autoChoice) {
    int dr = 0, dc = 0;
    if (cmd == 'w') dr = -1;
    else if (cmd == 's') dr = 1;
    else if (cmd == 'a') dc = -1;
    else dc = 1;

    int nr = playerRow + dr, nc = playerCol + dc;
    if (nr < 0 || nr >= MAP_SIZE || nc < 0 || nc >= MAP_SIZE) {
        cout << "You cannot move outside the map.\n";
        return;
    }
    if (grid[nr][nc] == '#') {
        cout << "You hit a wall.\n";
        return;
    }

    stamina--;
    stepCount++;
    char cell = grid[nr][nc];
    int monster = indexInSet(MONSTER_SYM, cell);

    // monster without the right weapon: lose a heart, stay where we are
    if (monster >= 0 && !hasWeapon[monster]) {
        hearts--;
        cout << "Monster " << MONSTER_SYM[monster] << " blocked you.\n";
        cout << "You need weapon " << WEAPON_SYM[monster] << " and lost 1 heart.\n";
        if (hearts == 0) {
            cout << "You ran out of hearts.\n";
            endReason = NO_HEARTS;
        } else if (stamina == 0) {
            cout << "You ran out of stamina.\n";
            endReason = NO_STAMINA;
        }
        return;
    }

    playerRow = nr;
    playerCol = nc;

    if (monster >= 0) {                                 // defeated: its drop appears
        cout << "You defeated monster " << MONSTER_SYM[monster] << ".\n";
        monsterDefeated[monster] = true;
        cell = DROP_SYM[monster];
        grid[nr][nc] = cell;
    }

    int weapon = indexInSet(WEAPON_SYM, cell);
    if (weapon >= 0) {
        hasWeapon[weapon] = true;
        grid[nr][nc] = '.';
        cout << "You picked up weapon " << WEAPON_SYM[weapon] << ".\n";
    }

    int item = itemIndexAt(cell);
    if (item >= 0) {
        offerItem(item, nr, nc, autoChoice);
        if (endReason != RUNNING) return;               // input ended
    }

    if (cell == 'E') {                                  // reaching the exit always wins
        endReason = ESCAPED;
    } else if (stamina == 0) {
        cout << "You ran out of stamina.\n";
        endReason = NO_STAMINA;
    }
}

// ============================================================ BONUS: automatic pathfinding
const int PATH_DIRS = 4;
const char PATH_CMD[PATH_DIRS] = {'s', 'w', 'd', 'a'};     // mandatory search order
const int PATH_DR[PATH_DIRS]   = {1, -1, 0, 0};
const int PATH_DC[PATH_DIRS]   = {0, 0, 1, -1};

const int ITEM_MASKS = 1 << NUM_ITEMS;                      // 512 subsets of the 9 items
const int WEAPON_MASKS = 1 << NUM_MONSTERS;                 // 8 subsets of the 3 weapons
const int STATE_COUNT = MAP_SIZE * MAP_SIZE * WEAPON_MASKS * WEAPON_MASKS * ITEM_MASKS;

int weightOfMask[ITEM_MASKS];       // total weight / value of every item subset
int valueOfMask[ITEM_MASKS];

// BFS queue: parallel arrays, entry i describes one discovered state.
vector<int> qState;                 // packed state (see packState)
vector<int> qParent;                // queue index it was reached from (-1 for the start)
vector<int> qDepth;                 // steps taken so far
vector<char> qMove;                 // command that led here
vector<char> qTook;                 // 1 if an item was collected on that move
vector<unsigned char> seenState;    // visited flags, indexed by packed state

void fillMaskTables() {
    for (int mask = 0; mask < ITEM_MASKS; mask++) {
        weightOfMask[mask] = 0;
        valueOfMask[mask] = 0;
        for (int i = 0; i < NUM_ITEMS; i++)
            if ((mask >> i) & 1) {
                weightOfMask[mask] += itemWeight[i];
                valueOfMask[mask] += itemValue[i];
            }
    }
}

// state = cell | weapons held | monsters defeated | items taken, packed into 23 bits
int packState(int cell, int weapons, int defeated, int items) {
    return (((cell * WEAPON_MASKS + weapons) * WEAPON_MASKS + defeated) * ITEM_MASKS) + items;
}

// Records state `st` (reached from queue entry `parent`) if it is new.
// Returns true when it was new.
bool pushState(int st, int parent, int depth, char move, char took) {
    if (seenState[st]) return false;
    seenState[st] = 1;
    qState.push_back(st);
    qParent.push_back(parent);
    qDepth.push_back(depth);
    qMove.push_back(move);
    qTook.push_back(took);
    return true;
}

// Plans the best route from the CURRENT game state to the exit.
//   goal      : highest total value, then fewest steps, then first found in s,w,d,a order
//   limits    : the remaining stamina and the remaining backpack capacity
//   monsters  : entered only when their weapon is already held (or picked up on the way)
// On success fills route (move commands), took (one '1'/'0' per move: item
// collected on that move or not), value and weight, and returns true.
bool planRoute(string &route, string &took, int &value, int &weight) {
    fillMaskTables();
    seenState.assign(STATE_COUNT, 0);
    qState.clear(); qParent.clear(); qDepth.clear(); qMove.clear(); qTook.clear();

    int weapons = 0, defeated = 0, items = 0;
    for (int m = 0; m < NUM_MONSTERS; m++) {
        if (hasWeapon[m]) weapons |= 1 << m;
        if (monsterDefeated[m]) defeated |= 1 << m;
    }
    for (int i = 0; i < NUM_ITEMS; i++)
        if (itemTaken[i]) items |= 1 << i;
    pushState(packState(playerRow * MAP_SIZE + playerCol, weapons, defeated, items), -1, 0, ' ', 0);

    int bestIdx = -1, bestGoalValue = -1, bestDepth = 0;

    for (size_t head = 0; head < qState.size(); head++) {
        int st = qState[head];
        int depth = qDepth[head];
        int curItems = st % ITEM_MASKS;
        int curDefeated = (st / ITEM_MASKS) % WEAPON_MASKS;
        int curWeapons = (st / (ITEM_MASKS * WEAPON_MASKS)) % WEAPON_MASKS;
        int cell = st / (ITEM_MASKS * WEAPON_MASKS * WEAPON_MASKS);

        if (origGrid[cell / MAP_SIZE][cell % MAP_SIZE] == 'E') continue;   // the exit ends the run
        if (depth >= stamina) continue;                                    // out of stamina

        for (int k = 0; k < PATH_DIRS; k++) {
            int nr = cell / MAP_SIZE + PATH_DR[k];
            int nc = cell % MAP_SIZE + PATH_DC[k];
            if (nr < 0 || nr >= MAP_SIZE || nc < 0 || nc >= MAP_SIZE) continue;
            char sym = origGrid[nr][nc];
            if (sym == '#') continue;

            int nWeapons = curWeapons, nDefeated = curDefeated;
            int item = -1;                                  // item lying on that cell (if any)
            int monster = indexInSet(MONSTER_SYM, sym);
            int weapon = indexInSet(WEAPON_SYM, sym);
            if (monster >= 0) {
                if (!((curDefeated >> monster) & 1)) {
                    if (!((curWeapons >> monster) & 1)) continue;   // would lose a heart: never enter
                    nDefeated |= 1 << monster;
                }
                item = NUM_TREASURES + monster;             // its drop
            } else if (weapon >= 0) {
                nWeapons |= 1 << weapon;                    // weapons are always picked up
            } else if (sym >= '1' && sym <= '6') {
                item = sym - '1';
            }

            int nCell = nr * MAP_SIZE + nc;
            bool itemLeft = (item >= 0) && !((curItems >> item) & 1);

            // option 1: take the item (only if it fits), option 2: leave it
            for (int option = 0; option < 2; option++) {
                int nItems = curItems;
                char tookItem = 0;
                if (itemLeft) {
                    if (option == 0) {
                        if (weightOfMask[curItems] + itemWeight[item] > backpackCapacity) continue;
                        nItems |= 1 << item;
                        tookItem = 1;
                    }
                } else if (option == 1) {
                    break;                                  // no item here: a single option
                }

                int ns = packState(nCell, nWeapons, nDefeated, nItems);
                if (pushState(ns, (int)head, depth + 1, PATH_CMD[k], tookItem) && sym == 'E') {
                    int v = valueOfMask[nItems];
                    if (v > bestGoalValue || (v == bestGoalValue && depth + 1 < bestDepth)) {
                        bestGoalValue = v;
                        bestDepth = depth + 1;
                        bestIdx = (int)qState.size() - 1;
                    }
                }
            }
        }
    }

    if (bestIdx < 0) return false;

    // walk the parent links back to the start, then reverse
    route.clear();
    took.clear();
    for (int i = bestIdx; qParent[i] != -1; i = qParent[i]) {
        route += qMove[i];
        took += (qTook[i] ? '1' : '0');
    }
    string r(route.rbegin(), route.rend()), t(took.rbegin(), took.rend());
    route = r;
    took = t;
    value = bestGoalValue;
    weight = weightOfMask[qState[bestIdx] % ITEM_MASKS];
    return true;
}

// Command 'r': plan, announce, then replay the route one step at a time.
void runAutoMode() {
    cout << "Auto Pathfinding Mode\n";

    string route, took;
    int value = 0, weight = 0;
    if (!planRoute(route, took, value, weight)) {
        cout << "No route to the exit was found from the current state.\n";
        return;
    }
    cout << "Best reachable value: " << value << "\n";
    cout << "Expected backpack weight: " << weight << " / " << backpackCapacity << "\n";
    cout << "Route length: " << route.size() << "\n";
    cout << "Route: " << route << "\n";

    for (size_t i = 0; i < route.size() && endReason == RUNNING; i++) {
        cout << "Auto Step " << (i + 1) << " / " << route.size() << ": " << route[i] << "\n";
        handleMove(route[i], took[i] == '1' ? AUTO_TAKE : AUTO_LEAVE);
        if (endReason == RUNNING) {                     // the final map is printed by main
            printMap();
            printStatus();
        }
    }
}

// ============================================================ main
bool readSetup() {
    long long seed;
    cout << "Seed: ";
    if (!(cin >> seed)) return false;
    seedRng(seed);

    cout << "Backpack capacity: ";
    if (!(cin >> backpackCapacity)) return false;

    for (int i = 0; i < NUM_TREASURES; i++) {
        cout << "Treasure " << (i + 1) << " weight and value: ";
        if (!(cin >> itemWeight[i] >> itemValue[i])) return false;
    }
    for (int m = 0; m < NUM_MONSTERS; m++) {
        cout << "Monster " << MONSTER_SYM[m] << " drop weight and value: ";
        if (!(cin >> itemWeight[NUM_TREASURES + m] >> itemValue[NUM_TREASURES + m])) return false;
    }
    return true;
}

int main() {
    cout << "=============\nTomb Explorer\n=============\n";
    if (!readSetup()) return 0;

    int d = buildDungeon();
    maxStamina = (3 * d + 1) / 2;       // ceil(1.5 * D) in integer arithmetic
    stamina = maxStamina;
    theoreticalMax = computeTheoreticalMax();

    while (endReason == RUNNING) {
        printMap();
        printStatus();
        cout << "Command [w/a/s/d/r]: ";

        string cmd;
        if (!readToken(cmd)) return 0;
        if (cmd.size() == 1 && (cmd[0] == 'w' || cmd[0] == 'a' || cmd[0] == 's' || cmd[0] == 'd'))
            handleMove(cmd[0], MANUAL);
        else if (cmd == "r")
            runAutoMode();
        else
            cout << "Invalid command.\n";
    }
    if (endReason == INPUT_CLOSED) return 0;

    printMap();
    printStatus();
    printResult();
    return 0;
}
