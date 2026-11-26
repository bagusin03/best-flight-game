[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/bagusin03/best-flight-game/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/bagusin03/best-flight-game/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

# Skyrunner Flores — Island Ring Run

A complete, original flight game for the make.fun **Make the best flight game** bounty. It runs offline in a desktop browser from static files — no network request, no API, no library.

Fly the **Cendrawasih-1**, a single-engine prop plane, over the Flores Sea at dusk: through **8 golden rings** past patchwork fields, fishing villages and a smoking volcano, then land on **runway 07 at Flores Field**. Rings refill your fuel; a stall, the hillside or the sea ends the sortie. A perfect landing earns a bonus.

## How to play

- **Arrow keys / WASD** — pitch and bank
- **Shift / Ctrl** — throttle up / down
- **Mouse** — hold the left button and steer with the pointer
- **C** — chase / cockpit camera
- **P** — pause, **M** — sound on/off, **R** — restart
- **Space / click** — start

The HUD shows altitude, speed, heading, fuel, rings, score and time, with a live minimap of the course. The cockpit view has a lit artificial horizon, altimeter, airspeed, fuel gauge, throttle lever and compass. All sound (engine, wind, ring chimes, landing fanfare) is synthesised with WebAudio — no audio files.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

Screenshots are real renders of the game's own code (`?shot=start|play|cockpit|end&seed=7`, see `shots.json`).

## Layout

- `game/index.html` — the page
- `game/src/config.js` — tuning numbers and palette
- `game/src/random.js` — deterministic RNG and value noise
- `game/src/world.js` — the island, rings, runway, flight model
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised sound
- `game/src/render.js` — sky, terrain, plane, cockpit, HUD
- `game/src/shots.js` — screenshot scenes (autopilot)
- `game/src/main.js` — boot and game loop
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)

MIT licensed. Original idea, art, sounds and names — nothing copied from a commercial game.
