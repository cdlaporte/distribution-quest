# Distribution Quest

A top-down dungeon crawler for reviewing **Intro to Stats B, Unit 3: Distributions**.
It runs in any browser, including Chromebooks, with nothing to install, and the whole
game fits on one screen with no scrolling.

Mr. Laporte (based on the *Study Hall Simulator* portrait) is your guide. He runs
in at the start, asks who you are again (students pick a boy or girl character), explains the quest,
shows up with tips and help along the way, and... well, you'll see what happens on Floor 5.

## Floors and sections

There are 5 floors, one for each section. Every floor ends with a boss whose attacks are
based on that section.

| Floor | Section | Boss |
|---|---|---|
| 1 · The Ranked Catacombs | **3.1 Percentiles** | **Rankenstein** is built from dotplot dots. He drops columns of dots like a dotplot. |
| 2 · The Flatlands | **3.2 Uniform distributions** | **The Uniform Monolith** is a living rectangle (a density curve). It fires walls of bullets with evenly spaced gaps and teleports to a uniformly random spot. |
| 3 · Standard Deviation Swamp | **3.3 z-scores** | **Zed, the Standardizer** teleports between the ±1σ and ±2σ rings and calls out his z-score. |
| 4 · The Bell Tower | **3.4 Normal distributions (Desmos)** | **The Great Bellringer** is a bronze bell-curve bell. Its volleys follow a normal distribution (dense in the middle, thin in the tails), and it zaps "shaded regions" of the floor. |
| 5 · The 68-95-99.7 Abyss | **3.5 The Empirical Rule** | **The Empirical Emperor** fires rings that cover 68%, then 95%, then 99.7% of the circle. |
| ★ | Everything | ??? (a twist ending) |

## How the math works

* **🔒 Stat Chests** (after some fights) and one **🏆 Golden Stat Chest** per floor give power-ups.
  About half of the after-fight chests are free **supply crates**, every floor has a free **vault**, and
  sometimes Mr. Laporte runs in and says "I got this one!" and solves a chest for you. Each floor asks
  roughly **3–4 questions**.
* **⛲ A Shrine of the Mean** (one per floor) heals you.
* **🔮 A shield rune** breaks a boss's shield (once per boss). The final fight has **no questions**.
* **Every question has one answer**: either a typed number or a multiple-choice pick (including
  interpretation questions and "which picture shows this shaded area?" questions).
* **Rounding is generous**: rounding up or down to a whole number is accepted for percents and
  percentiles, z-scores can be off by a few hundredths, and Desmos answers allow rounding.
* **Percentiles use "percent of values *below*"** (TPS style): 84 in
  34, 42, 51, 65, 69, 74, 78, 84, 85, 85, 86, 87 is the 58th percentile.
* **Section 3.4 is done in Desmos** in another tab. The problem window has an "Open Desmos"
  link, and the hints walk through `normaldist(μ, σ)` and `.inversecdf(p)`.
* Wrong answers never cost health. Students get several hints, and after 2 misses they can see
  the full worked solution, but then they must solve a fresh problem for the reward.
* A **perfect solve** (first try, no hints) earns a better reward.
* The first time a student sees each section, Mr. Laporte gives a one-line tip.

## Settings (students choose before playing)

* Turn any of 3.1–3.5 **on or off** (for example, skip a section they already feel confident about).
* **One section per floor** (Floor 1 = 3.1, …) or **mix them up** (random questions from the chosen
  sections on every floor). In per-floor mode, a floor whose section is turned off still has its
  theme and boss, but asks questions from the student's other sections.
* Extra practice (more Stat Chests) and sound on/off.

## Two class periods: saving

The game **saves automatically at the start of every floor** (in that browser's local storage).
Next class, students press **Continue** on the title screen.

If a student is defeated, they go back to the start of that floor. They lose the power-ups they found
on that floor (but keep everything from earlier floors), and **every problem they already solved on
that floor becomes a free solve** so they don't have to redo work. Dying in the final fight puts them
right back into the final fight.

## Teacher options (PIN 9631)

In **Settings → 🔐 Teacher options**, enter the PIN to:
* **Fill in answers**: every question still shows up, but the correct answer is already filled in, so
  you just press Enter. That way you can see the questions while playtesting quickly. Mr. Laporte still
  solves some chests for you, so you can see how often that happens. A red "TEACHER MODE" tag shows on
  screen while it's on, so you'll notice if it's left on.
* **Start on floor N** with a few random upgrades.

These are saved on that computer only. To change the PIN, open the browser console on the game page, run `DQ.pinHash('1234')` with the
new PIN, and paste the result into `PIN_HASH` in `js/game.js`.

The end screen shows the student's name, problems solved per section, play time, and a report code
like `F6-S38-A45-P27-WJS` (floor reached, solved, attempted, perfect, Win/Loss + initials)
that they can screenshot or paste into a Google Form.

## Just-for-fun mode

After a student beats the game, the end screen (and Settings) unlocks a **"just for fun"** toggle that
fills in the answers for them, the same way teacher mode does, so they can replay for fun. This doesn't
need the PIN, and those runs don't count problems as solved.

## Rooms, enemies and upgrades

Some fight rooms are **big rooms** (two screens wide or tall, or both). The camera pans with you, and
they hold more monsters.

Monsters get much tougher on each floor, and bosses take real effort. New monster types appear as you go
deeper, and Mr. Laporte gives a quick tip the first time you meet each one. Besides slimes, bats, skeleton
archers, boars, eyeballs and ghosts there are **Box Plot Knights** (their box-plot shield blocks shots
from the front), **Dice Cubes** (fire as many shots as the number they roll), **Sigma Spiders** (their
webs slow you), **Bell Bombers** (ring, then explode) and **Skew Wraiths** (dash in lopsided curves).
Floor 1 has the basics, Dice Cubes and eyeballs arrive on Floor 2, knights and ghosts on Floor 3, spiders
and bombers on Floor 4, and wraiths on Floor 5.

The most powerful (epic) power-ups show up less often, and each offer has at most one plain stat boost. Most power-ups have unique, visible effects, for example: Standard Deviation
Orbitals, Bell Curve Boomerang, Regression Laser, Bootstrap Clones, Random Walk Rockets, Chalk Trail,
Stem-and-Leaf Vines, Percentile Piñata, Pie Chart Buzzsaw, Tail Event meteors, A+ Grading crits,
Normal Nova, Z-Score Zapper, Empirical Aura and the Edamame Bean Blaster. Hover over any power-up in the
top bar to see what it does. Shop items show their effect when you walk up to them.

## Easter eggs and surprises

* **The Teachers' Lounge:** a hidden room behind a **glowing cracked wall** (with a little "STAFF?" sign)
  in a fight room on most floors. Shoot the cracks 3 times to open it. Mr. Laporte is inside and is not happy to see you. The
  **staff-only coffee machine** gives a choice of powerful STAFF upgrades (Faculty Coffee,
  Red Pen of Truth, Staff Lanyard, Sub Plans), the couch fully heals you, and there's a
  bulletin board and a fridge.
* **Edamame (single dried beans):** Mr. Laporte's bowl in the lounge, rare drops, and the
  vending machine. Each one heals and gives **Protein Power** (+50% damage). Eat 5 and
  **Eddie the Edamame** joins your party. There's also the **Edamame Bean Blaster** item.
  Typing `EDAMAME` (on the title screen, or once per run while playing) is a secret shortcut.
* **The freshman stampede (rare):** Mr. Laporte sprints through yelling that the freshmen from his study
  hall got out, and a loud, phone-glued herd of freshmen tramples every monster in the room.
* **"SECURITY!"** Sometimes Mr. Laporte bursts in, blows a whistle, and two security guards in red
  escort the toughest monster out by the arms.
* **Enemies who join you:** the lonely *Outlier* ghost or the last slime in a room sometimes
  waves a white flag. Walk up and press E to adopt it, and it fights alongside you. (If you shoot it,
  it runs off crying.)
* Mr. Laporte runs in with hearts when your health gets low, mimic chests run away screaming,
  every boss drops a hat (they stack), there's a talking vending machine, and the defeat messages are stats puns.
* **The twist:** the Empirical Emperor is a fake final boss. He drops **Secret Hair Tonic**, and Mr. Laporte
  drinks it, grows a towering golden mane, and becomes **SUPER MANE LAPORTE** for a psychedelic final
  battle with tonic dashes, pop-quiz paper airplane spirals, and "Mane Event" hair lasers. When you beat him, his hair falls out and he
  cries. Then he says he's proud of you, and that there's still a quiz on Friday.

## Review sheet (for students who'd rather not play)

`review/Unit3_Review.pdf` is a printable 5-page review sheet with 4 problems from each section
(calculations plus interpretation and shaded-area multiple choice), and `review/Unit3_Review_Key.pdf`
is the answer key with short worked solutions. Run `node review/build-review.js` to rebuild them, or
`SEED=7 node review/build-review.js` for a different set of problems.

## Controls

| Key | Action |
|---|---|
| W A S D | Move |
| Arrow keys, or hold the mouse button | Shoot |
| Space | Dash (you can't be hurt while dashing) |
| E | Interact: chests, shrines, shop, stairs, adopting friends |
| Enter / Space / click | Next line of dialogue (Esc skips) |
| P / Esc | Pause |
| M | Mute |

## Playing it

**Quickest:** download the repository as a ZIP, unzip it, and double-click `index.html`.

**For a class (recommended): host it free on GitHub Pages**
1. On GitHub, open the repository and go to **Settings → Pages**.
2. Under *Build and deployment*, set **Source: Deploy from a branch**, pick the branch and the
   `/ (root)` folder, then click **Save**.
3. After a minute or so, the game is live at `https://<your-username>.github.io/distribution-quest/`.

## Files

* `index.html`: page layout, menus, settings, the problem window, and styles
* `js/problems.js`: problem generators for 3.1–3.5 with hints, worked solutions, and diagrams
* `js/art.js`: all pixel art (Mr. Laporte's portrait and sprites, monsters, bosses, tilesets)
* `js/story.js`: everything Mr. Laporte and the bosses say (easy to edit!)
* `js/game.js`: the game (map generation, combat, bosses, items, cutscenes, saving)
* `tests/problems.test.js`: run `node tests/problems.test.js` to check thousands of generated problems
