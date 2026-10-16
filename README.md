# DESMAS

**Deep Space Management System** — a power and fault manager for places that cannot wait for help: an off-grid clinic on Earth, an Artemis base on the Moon, and a relay ship plus future base at Mars. One Arduino kit on the desk runs all three.

Built for HackHarvard 2026 (Hardware for Good + SpaceX AI / Make It Legendary).

The station UI is an **Expo / React Native** app (`View`, `Text`, `Pressable`). The kit simulator and Express API are unchanged.

## How it works

The Mega reads a photoresistor and DHT11, sheds loads in priority order, and streams one JSON line twice a second over USB. The app shows those readings on three world dashboards and an AI monitor. Until you plug in a board, a 44-second simulated kit plays the same story.

Priority (never recompute this in the app when hardware is live):

| Dark | What turns off |
| --- | --- |
| 30% | P4 Comfort / clinic fan |
| 55% | P3 Science / clinic lights (“lunar night”) |
| 85% | P2 Comms / radio (low power, blinks) |
| always | P1 Life support / vaccine fridge stays on |

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

That starts Expo (web) and the API at http://localhost:8787.

```bash
npx expo start
```

Then open Android, iOS, or web from the Expo menu.

Connect Arduino is stubbed in this slice; the simulated kit is live.

## Layout

| Path | Role |
| --- | --- |
| `App.tsx` + `src/` | Expo station UI |
| `server/` | Private API key, Grok routes (next), Mars delay |
| `firmware/` | Arduino sketch notes and pin map |

Planet textures, when added, should credit Solar System Scope, CC BY 4.0, based on NASA imagery.
