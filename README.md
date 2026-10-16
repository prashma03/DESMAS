# DESMAS

Deep Space Management System — a power and fault manager for an off-grid clinic on Earth, an Artemis base on the Moon, and a future base plus relay ship at Mars. One Arduino kit drives all three views.

This repo is the HackHarvard 2026 web app: a dashboard that matches the design mockup, with a simulated kit until you connect a board over Web Serial (Chrome or Edge).

## Run

```bash
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`. Use **Connect Arduino** on a Mega streaming JSON at 9600 baud. Until then, a 44-second simulated loop covers the light sensor, then spikes humidity.

Planet look in the UI is stylized and credits Solar System Scope (CC BY 4.0, based on NASA imagery), as in the mockup.

## Stack

- Vite + React + TypeScript dashboard
- Shared readings store (simulated kit or Web Serial)
- Local AI-monitor copy and crew chat fallbacks from the project summary (Grok Voice / Horizons come later)
