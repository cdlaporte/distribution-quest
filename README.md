# Distribution Quest

A top-down dungeon crawler for reviewing **Intro to Stats B, Unit 3: Distributions**.
It runs in any browser, including Chromebooks, with nothing to install, and the whole
game fits on one screen with no scrolling.

Mr. Laporte (pixel-for-pixel the same as in *Study Hall Simulator*) is your guide. He runs
in at the start, explains the quest, shows up with tips and help along the way, and... well,
you'll see what happens on Floor 5.

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

* **🔒 Stat Chests** (after fights) and **🏆 Golden Stat Chests** give power-ups.
* **⛲ Shrines of the Mean** heal you.
* **🔮 Shield runes** break a boss's shield.
* Answers are mostly **typed numbers**, with reasonable rounding accepted. For example, 58.33% accepts
  58 or 58.3, z-scores accept two decimal places, and Desmos answers allow small rounding
  differences. Comparisons and interpretations ("whose catch was better?") are **multiple choice**.
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
Next class, students press **Continue** on the title screen. If they're defeated, they can retry
that floor and keep all of their power-ups.

The end screen shows the student's name, problems solved per section, play time, and a report code
like `F6-S38-A45-P27-WJS` (floor reached, solved, attempted, perfect, Win/Loss + initials)
that they can screenshot or paste into a Google Form.

## Easter eggs and surprises

* **The Teachers' Lounge:** a hidden room behind a **cracked wall** in a fight room. Shoot the
  cracks 3 times to open it. Mr. Laporte is inside and is not happy to see you. The
  **staff-only coffee machine** gives a choice of powerful STAFF upgrades (Faculty Coffee,
  Red Pen of Truth, Staff Lanyard, Sub Plans), the couch fully heals you, and there's a
  bulletin board and a fridge.
* **Edamame:** Mr. Laporte's bowl of edamame in the lounge, rare edamame drops, and edamame in the
  vending machine. Each one heals and gives **Protein Power** (+50% damage). Eat 5 and
  **Eddie the Edamame** joins your party. There's also the **Edamame Bean Blaster** item.
  Typing `EDAMAME` (on the title screen, or once per run while playing) is a secret shortcut.
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
