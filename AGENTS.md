# DESMAS agent notes

Deep Space Management System: one Arduino kit, three worlds (Earth clinic, Moon base, Mars base + relay ship).

## Rules that matter

- Keep the MIT `LICENSE`. Do not delete project files for a “fresh start.”
- The board owns power decisions. When a live Arduino is connected, the UI displays `leds` from serial JSON and never recomputes them.
- The simulated kit may apply the same firmware rules so the demo works without hardware.
- Keep `XAI_API_KEY` on the Node server only.
- Label battery %, vaccine fridge °C, and other non-sensor values as estimates.
- Do not invent lunar-south-pole sunrise times unless they come from real illumination data.

## Stack

- Expo + React Native (`App.tsx`, `src/`). Do not add `.html` files or web `div` markup; use `View` / `Text` / `Pressable`.
- `server/`: Express, proxies xAI and JPL Horizons
- Firmware: Arduino Mega, 9600 baud JSON lines at 2 Hz
