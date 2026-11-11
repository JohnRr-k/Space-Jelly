/*
 * EE231001 Introduction to Programming -- Midterm Project: Tomb Explorer
 * Basic version (no bonus).
 *
 * Build : g++ -std=c++11 -Wall -Wextra -o PA_studID.out StudID_Name_MP.cpp
 * Run   : ./PA_studID.out
 *
 * Course restrictions
 *   - Recursion : searchBestValue() is a recursive DFS (theoretical max value).
 *   - No struct / class anywhere; all state lives in plain global arrays.
 *   - No brute force: reachability uses BFS, and the DFS prunes branches that
 *     cannot beat the best value found so far.
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
// Treasure or monster drop at (row, col): ask the player until y/n is given.
void offerItem(int item, int row, int col) {
    cout << "You found " << itemName(item) << ".\n";
    cout << "Weight: " << itemWeight[item] << ", Value: " << itemValue[item] << "\n";

    string answer;
    while (true) {
        cout << "Take it [y/n]: ";
        if (!readToken(answer)) {
            endReason = INPUT_CLOSED;
            return;
        }
        if (answer == "y" || answer == "Y") {
            if (totalWeight + itemWeight[item] <= backpackCapacity) {
                itemTaken[item] = true;
                totalWeight += itemWeight[item];
                totalValue += itemValue[item];
                grid[row][col] = '.';
                cout << "Item collected.\n";
            } else {
                cout << "Your backpack is too heavy. You cannot take it.\n";
            }
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
// else costs 1 stamina and 1 step.
void handleMove(char cmd) {
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
        offerItem(item, nr, nc);
        if (endReason != RUNNING) return;               // input ended
    }

    if (cell == 'E') {                                  // reaching the exit always wins
        endReason = ESCAPED;
    } else if (stamina == 0) {
        cout << "You ran out of stamina.\n";
        endReason = NO_STAMINA;
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
        cout << "Command [w/a/s/d]: ";

        string cmd;
        if (!readToken(cmd)) return 0;
        if (cmd.size() == 1 && (cmd[0] == 'w' || cmd[0] == 'a' || cmd[0] == 's' || cmd[0] == 'd'))
            handleMove(cmd[0]);
        else
            cout << "Invalid command.\n";
    }
    if (endReason == INPUT_CLOSED) return 0;

    printMap();
    printStatus();
    printResult();
    return 0;
}
