# Tomb Explorer (EE231001 Midterm Project) — C++11

| File | What it is |
|---|---|
| `StudID_Name_MP.cpp` | Basic version (submit as `StudID_Name_MP.cpp`) |
| `StudID_Name_MP_bonus.cpp` | Basic + Automatic Pathfinding Mode, command `r` (submit separately) |
| `report/StudID_Name_MP_report.html` / `.pdf` | Report draft (8 pages). **Not submission-ready until you fill the yellow fields** — see below |

**Rename both files** to your real student ID and name before submitting (e.g. `115061600_Name_MP.cpp`).

```bash
g++ -std=c++11 -Wall -Wextra -o PA_studID.out StudID_Name_MP.cpp         # basic
g++ -std=c++11 -Wall -Wextra -o PA_studID.out StudID_Name_MP_bonus.cpp   # bonus
./PA_studID.out
```

## Restrictions checklist
- **Recursion:** `searchBestValue()` — recursive DFS for the theoretical maximum value (§11).
- **No `struct`/`class`:** all state is in global arrays; cells are encoded as `row * 16 + col`.
- **No brute force:** BFS for reachability; DFS prunes branches that cannot beat the best value; the bonus
  planner is a BFS over *game states* (never enumerates paths).
- **AI use must be disclosed** (the PDF treats undisclosed AI help as plagiarism → 0 points). Both files carry a
  disclosure header with a `TODO (student)` line — fill it in truthfully and repeat it in the report.

## How the bonus planner works
State = (cell, weapons held, monsters defeated, items taken). Weight and value are functions of "items taken", and
steps used = BFS depth, so nothing else is stored (≤ 8.4 M possible states, ~10 ms in practice). Directions are
expanded in the mandatory order `s, w, d, a`; BFS reaches every state in the fewest steps and, within one depth, in
search order. So the first goal state with the highest value is also the shortest, and the first-found one.
The exit is terminal (entering it ends the expedition). Each treasure/drop is a take/leave branch, the planner records
which, and the replay follows that plan (`Item collected.` / `Auto mode left it here.`).

## Decisions where the PDF is silent (change these first if a test case disagrees)
1. **Wall roll.** The PDF says "40% wall" but not how to turn the RNG into a percentage. Implemented as
   `getRandomNum() % 100 < 40` (`WALL_PERCENT`, `generateWalls()`). The common alternative is `% 10 < 4`.
   *If your public test case's map differs from this program's, this is the line to change.*
2. **Prompts** are printed with a trailing space and no newline (`Seed: `, `Command [w/a/s/d]: `).
3. **Redisplay.** Map + status are printed before *every* command prompt, including after `Invalid command.`,
   wall bumps and border bumps. After a rejected `y/n` the `Take it [y/n]: ` prompt is repeated.
4. **End-of-move order.** Cell events (weapon / drop / treasure prompt) are handled first, then: exit reached → win
   (even on 0 stamina) → stamina 0 → lose. Hearts reaching 0 ends the game before the stamina check.
5. **Movement commands are lowercase only** (`W` is invalid); `y/n` accept both cases. Multi-character tokens are invalid.
6. **Negative seeds** are normalised into `[0, 2^31)` so `% 16` can never go negative.
7. **Bonus tie-break** between equal plans that differ only in take/leave: *take* is explored first.
   No blank line is printed between `Route:` and `Auto Step 1`.
8. If stdin ends mid-game the program just exits.

## How it was verified
Independent Python re-implementations of the game and of the planner (different algorithm: set-based layers +
backward marking of optimal states + greedy forward walk) were fed identical randomized input streams (invalid
commands, wall/border bumps, monster hits, y/n edge cases, `r` pressed mid-game after items/weapons/heart loss).
Transcripts matched byte-for-byte over 450 basic and 1 660 bonus games, also under ASan/UBSan.
Both files compile warning-free with `-Wall -Wextra -Wpedantic -Wshadow -Wconversion` (bonus verified after the
last edit; basic compiled clean as well).

## Finishing the report
`report/StudID_Name_MP_report.pdf` is a draft generated from `report/StudID_Name_MP_report.html`. Six places are highlighted in yellow
(`class="fill"`): student ID, name, result of the course's public test cases, your review of each code part, your own account of how you used
the AI, and your own reflections. Those must be your own, truthful words (the course treats undisclosed AI use as plagiarism).
1. Edit the HTML in a text editor (search for `class="fill"`, replace the whole `<span>` with your text).
2. Open it in Chrome/Edge → Print → *Save as PDF*, paper A4, enable *Background graphics*.
3. Save as `<StudentID>_<Name>_MP_report.pdf` (PDF only — the course rejects `.doc/.docx`).
