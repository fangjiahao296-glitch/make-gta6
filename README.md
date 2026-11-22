# Solara Bay — A Sun-Soaked Getaway

An original open-world crime game for make.fun's **Make GTA 6** bounty
(`gta6-01`). Drive and walk around Solara Bay, a sun-soaked coastal city;
steal cars, outrun the police, and finish five jobs for Marta's crew to pay
off Leo Marin's debt. Everything here — the city, the characters, the cars,
the story, the art, the sounds and the music — is original. Nothing comes
from Rockstar Games or any other commercial game.

## Play

Serve `game/` with any static server (for example `node serve.ts`) and open
`http://localhost:8080` in a desktop browser. The game runs fully offline:
no network request, all code and the vendored three.js library are local
files, and all sound and music are synthesized with WebAudio.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk, run with Shift, drive |
| Mouse (click canvas to lock) | Look around |
| E | Enter a car, steal a parked or traffic car, get out |
| Space | Jump on foot, handbrake in a car |
| Left click | Shoot the pistol (on foot) |
| H | Horn |
| M | Mute |
| P / Esc | Pause |

## Systems

- **Open city**: an 8×8 block grid with roads, sidewalks, crosswalks, parks,
  parking lots, palms, lamps, billboards, a beach and the ocean, all built
  procedurally from a seed (`?seed=N` fixes the city and the traffic).
- **Traffic and pedestrians**: cars cruise the road grid and turn at
  intersections; people stroll the sidewalks.
- **Stealable cars**: parked cars and traffic cars can be taken (E). Getting
  spotted adds wanted heat.
- **Wanted level and police**: 0–5 stars. Police cars roll in, chase and ram;
  at 3+ stars foot cops join in. Lay low out of sight and the heat cools off.
  Getting caught or going down costs $200 and wakes you at the hospital.
- **Missions and story**: five jobs — First Wheels, The Pickup, Hot Pursuit,
  The Getaway, Harbor Heist — with a pulsing beacon, HUD objective, story
  cards and payouts from $500 to $5,000.
- **Combat**: a hitscan pistol with tracers and muzzle flash; armed guards
  and cops shoot back.
- **HUD and minimap**: cash, health, wanted stars, speed, mission objective,
  and a live top-down minimap (player, traffic, police, cash, beacon).
- **Start screen and save**: title screen with a live city behind it,
  Continue / New Game, pause menu, and automatic saving to localStorage
  (money, jobs done, position, health).

## Screenshots

`screenshots/` holds four real renders of the game in a browser, staged with
`?shot=start|drive|chase|mission` (see `shots.json`): the title screen, a
drive through the city, a wanted chase on foot, and the harbor shootout.

## Tech

- three.js r160, vendored as `game/vendor/three.module.min.js` (import map).
- ES modules under `game/src/`, one file per system: `city`, `vehicles`,
  `pedestrians`, `player`, `combat`, `wanted`, `missions`, `hud`, `audio`,
  `save`, `render`, `world`, `shots`, `main`.
- `main.ts` (Node 22, standard library only) copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`.

## Referral

Made with make.fun — build your own entry here:
https://make.fun/r/nhmk4wxa

## License

MIT — see LICENSE.
