# Bluefall: project handoff

Everything needed to keep working on the game from another computer.

## What's in this folder

| Path | What it is |
|---|---|
| `game/bluefall.html` | **The game.** Double-click to play in any browser (needs internet the first time for fonts and the 3D library). |
| `game/bluefall-source.html` | The same game without the `<html>/<head>` wrapper. This is the file the changes were made on. |
| `songs/*.mp3` | The soundtrack rendered to MP3 (192 kbps, loudness-normalised). |
| `tools/` | The song renderer (`render.js`, `render/render.html`, `music10.js`). See "Re-rendering the songs" below. |
| `CONTINUE_HERE.md` | This file. |

The game is also published online (private to your account):
https://claude.ai/artifact/8BJKZSUzGaqVYsrGzoM9qX

## How to continue with Claude on the other PC

1. Open Claude (claude.ai or Claude Code) and start a new chat.
2. Attach `game/bluefall-source.html` and this `CONTINUE_HERE.md`.
3. Paste this message:

> I'm continuing work on my browser game Bluefall. CONTINUE_HERE.md describes everything built so far, my preferences and how the code is organised. bluefall-source.html is the current version. Please read both, then help me with: [what you want next]. When you change the game, send me back a full playable HTML file.

## The game today

A 3D endless downhill ball-rolling game (inspired by the genre of Slope, original design) built with three.js r128 in one HTML file. The UI is a VHS / neon 80s synthwave style, the music is generated live in the browser with the Web Audio API.

### Menus
- **Main menu:** two big tilted buttons, **ENDLESS** and **LEVELS** (←→ choose, Enter go).
- **Endless setup screen:** Start run, Mode, Difficulty, Colours, Steering, Trippy, Screen, Sound, Back.
- **Level select ("tape select"):** a tilted cascade of 8 level names, the selected one in rainbow wavy letters, a spinning magenta sunburst, a preview card (mini thumbnail, number, date, description, special rule, best score, grade, tempo, PLAY). The level's real world and its music preview live behind the menu. ↑↓ choose, ←→ difficulty, Enter play, O settings, Esc back. **All levels are open.**
- **Levels settings:** Difficulty, Steering, Trippy, Screen, Sound.
- **Endless and Levels keep separate saved settings** (localStorage keys `bluefall-cfg-endless`, `bluefall-cfg-levels`).
- Pause menu (Esc/P), results screen with grade S–D, stats and per-mode top-5 high scores.
- Level title cards: "LEVEL 03 / 08", name in wavy tearing letters, date and time, a line of text, blinking PLAY, tape-tracking band. Skippable.

### Modes (Endless side)
Endless, Time Attack (90 s, boost pads +2 s), Chaos (only busy traps, constant falling balls, trippy, ×2 points), Zen (no crashes, ghost on hit, respawn on fall, ×0.5 points).

### Difficulties
Easy ×0.75, Normal ×1, Hard ×1.5, Insane ×2.5 points. They change speed, trap density, unlock distances, falling-ball rate and jump recharge.

### The 8 levels
| # | Name | World | Special rule | Music mood |
|---|---|---|---|---|
| 1 | Midnight On-Ramp | night city skyline, retro sun | tutorial prompts | cool night-drive synthwave, 102 BPM |
| 2 | Glass Highway | see-through road in the clouds, glass shards | low gravity | light, happy, major key, bells, 94 BPM |
| 3 | Pinball District | neon rings, arcade | walls everywhere, bumpers | bouncy chiptune, 128 BPM |
| 4 | Sunset Slide | desert sun, pylons | tilted roads, crosswind | warm bittersweet dorian, 88 BPM |
| 5 | The Foundry | Rust theme, chimneys, sparks, smoke | heavy gravity, machinery | **heavy** industrial: heavy kit plus metal clanks, 134 BPM |
| 6 | Rockfall Canyon | rock walls | steep slope, rockfall | **heavy** tribal toms, harmonic minor, 132 BPM |
| 7 | Laser Arcade | Neon theme, grid floor, darkness | traps move to the beat | **heavy** rave, acid, trance-gate chops, 136 BPM |
| 8 | Meltdown | melting colours, grid | mirror zones (controls flip) | **heavy** frantic breakbeat, 144 BPM |

Each level has a finish line (chequered banner) and a progress bar.

**Showcase** (any level, from the level select: the SHOWCASE button or the C key): you can't die. Hitting a trap ghosts you through it, falling off puts you back on the track. With hands off the controls an autopilot (`autoSteer`) drives: it picks the clearest line ahead, aims for boost pads and jumps what it can't dodge. Showcase runs don't count for high scores.

**Coins & cases** (main menu → ◉ COINS · CASES & SKINS): gold coins on the track (lines of 3–5 in quiet stretches, along the safe lane of block rows, on ramp landings, after boost pads; not too many). Payout at the end of a run: coins picked up + level clear reward (40 + 20 × level number, × difficulty) + 100 the first time a level is cleared on that difficulty; Endless gives 1 coin per 100 m. Showcase earns nothing. Wallet in localStorage `bluefall-coins`.
Cases (in-game coins only): TAPE 100 (common 70 / rare 26 / epic 4), NEON 250 (rare 55 / epic 37 / legendary 8), MIDNIGHT 500 (epic 70 / legendary 30). Spinning reel opening, rarity reveal; duplicates refund 30%. Items (`ITEMS`): ball skins (Pool Eight, Checker, Grin, Cassette, Chrome, Neon Wire, Lava Core, Galaxy, Retro Sun), trails (Pink Haze, Mint, Ghost, Gold Dust, Fire, Rainbow), track colours for Endless (Vapor, Void, Blood, Gold Line; `locked: true` in `THEMES`). Equip ball/trail in the shop; colours in Endless → COLOURS. Inventory in localStorage `bluefall-inv`.

**Promo codes** (shop → PROMO CODE): type a code (redemption counts per browser in localStorage `bluefall-promos`). Codes are not stored in plain text: `PROMOS` is keyed by a fingerprint, `codeHash(code)` (FNV-1a of `'bluefall:' + code.trim().toLowerCase()`, base 36). A reward can give `coins` and/or `items` (item keys from `ITEMS`). Each entry can set `uses` (how many times it can be redeemed, default 1); used counts are kept per browser. Current code: the owner's secret code → 3000 coins, 10,000 uses (fingerprint `61yse8`). To add a code, compute its fingerprint with `codeHash` in the browser console and add an entry to `PROMOS`.

**Your Music** (Endless setup or Levels settings → YOUR MUSIC): the player loads audio files they own. LOAD SONGS takes many files at once and places each on the slot whose mood fits, by words in the file name (`SUGGEST` table: e.g. 'roller mobster' → Endless, 'inner animal' → Foundry, 'sentient' → Laser Arcade); unmatched files fill empty slots. Each slot (Menu, Endless, Chaos, Levels 1–8) can be changed (Enter) or cleared (←). SONGS: MY SONGS / BUILT-IN switch. Files are kept in this browser's IndexedDB only (`bluefall-music`), played through an `<audio>` element routed into the Web Audio mix. The game ships no copyrighted music.

### Gameplay features
- Momentum steering with sliding, slope-driven speed (downhill faster, uphill/ramps slower), heavy ball (strong gravity, bounce on hard landings, camera shake), rechargeable jump (Space / ↑ / W / on-screen button) and jump gates that refill it.
- Boost pads, combo multiplier (×2 to ×9) for boosts, close calls, jumping over or rolling under traps, dodging blasts. Score = (distance + bonus) × difficulty × mode.
- Traps: blocks, walls with a gap, slalom, pillars, sliders, lifts (2 and 3 lanes), squeezers, spinners and cross spinners, hammers, boulders rolling uphill, crumbling tiles, lasers, hurdles, pop-up walls, saw blades, pinball bumpers, crosswind, ice, swinging bridge, ramps, kickers, platforms, double and big jumps, drop-offs, hills, banked turns, narrow bridges, falling balls with a target ring and a small explosion.
- A fairness check removes any still block that would close the whole track; falling balls only land on wide, open, flat track.
- Trippy colours: Off / In zones / Always.
- 8 colour themes: Ice (blue and white, the original), Midnight, Mint, Sunset, Grape, Mono, Neon, Rust.
- Screen: Clean, Pixel, VHS.
- Effects: speed lines, floating particles, rings, screen flash, pop-up text, big VHS alerts (new high score, milestones, combos, trip zone, final stretch).

## Your preferences so far (useful for Claude)
- Started from: "like Slope, but blue and white".
- Wanted the ball to feel heavy, like Slope's handling, with a lower field of view.
- Wanted it busy and never empty: lots of obstacles and boosts, but **never impossible to pass**.
- Menus and pop-ups in a Hotline Miami (2) inspired VHS neon style, original art only.
- Music: dark synthwave in the spirit of Jasper Byrne's "Voyager" / Hotline Miami 2, **builds quickly** to a peak; each level has its own song and mood. Original music only, no copying of real songs.
- **Strong contrast between light and hard tracks.** Light: Main Menu, Level 1 (night drive), Level 2 (clouds, happy), Level 3 (chiptune), Level 4 (sunset). Hard ("heavy"): Endless (134 BPM), Chaos (142), Levels 5–8. Hard tracks should be heavy and rhythmic, heavier than a plain rave: layered distorted kick with sub boom, kick rolls in the build, rolling distorted bass, trance-gate chord chops, syncopated stabs, clap+snare, ghost snares, 16th hats, ride, tom fills. Song settings: `heavy: true`, `kit: 'heavy'`, `bass/bassTone: 'heavy'`, `chop: true`, `stabs: 3`.
- Always send back a full HTML file you can open.

## How the code is organised (`bluefall-source.html`)
One file: CSS at the top, HTML overlays (HUD, main menu, endless setup, results, pause, level select, levels settings, title card), then one script:
- **Constants and tables:** `MODES`, `DIFFS`, `LEVELS` (name, date, line, length, theme, difficulty, speed, falling balls, trippy, song, `env` world settings, trap `pool`), `THEMES`.
- **Music:** `SCALES`, `CH` chords, `BASSP`, `ARP`, `STABS`, `SONGS` (one entry per song: bpm, root, scale, progression, kit, bass, arp, lead, pad...), `ARCS` (song structure), and the `Sound` engine (`ensure`, `play(song, intensity)`, `muffle`, `setVolume`, `sfx`, `beats`). Intensity 0 = menu, 1 = title card, 2 = full run.
- **Settings:** `prof` (Endless and Levels profiles), `setOpt`, `useSide`.
- **Menus:** `OPT` (option rows), `ACTIONS` (buttons), `MENUS` (which rows each screen shows), `renderMenu`, `menuKey`.
- **Track:** `addSeg`, `buildSeg`, `pattern()` (picks a section from `PATTERNS`), helpers `addBlock`, `addSpinner`, `addHammer`, `addBoulder`, `makeTiles`, `addPad`, `addGate`, `addSaw`, `addBumper`, `addFinish`, `laneRows`, `leavesGap`.
- **Run flow:** `reset`, `start`, `goPlay`, `showIntro`, `openEndless`, `openLevels`, `toMenu`, `gameOver`, `finishRun`, `levelClear`.
- **Simulation and drawing:** `step` (physics, collisions, rewards), `animateWorld`, `placeBall`, `placeCamera`, `updateFx`, `updateTrip`.

## Re-rendering the songs
Needs Node.js, Playwright with Chromium, and ffmpeg.
```
cd tools
npm install playwright
npx playwright install chromium
node render.js 4
```
`4` is how many songs render at once. Finished MP3s go to `tools/songs/`. Files that already exist are skipped. To change a song, edit its entry in `SONGS` in `music10.js` (keep it in sync with the game file) and delete its MP3 before rendering again.
