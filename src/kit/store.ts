import { eventsFromTransition, readingAt, SIM_TICK_MS } from "./simulate";
import type { KitEvent, KitReading, KitSource } from "./types";

const HISTORY = 60;

type Listener = () => void;

type State = {
  source: KitSource;
  reading: KitReading;
  history: KitReading[];
  events: KitEvent[];
};

let nextEventId = 1;
let prev: KitReading | null = null;
let started = Date.now();

function seed(): State {
  const reading = readingAt(0);
  prev = reading;
  const intro = eventsFromTransition(null, reading, nextEventId);
  nextEventId += intro.length;
  return {
    source: "simulated",
    reading,
    history: [reading],
    events: intro,
  };
}

let state: State = seed();
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

function applyReading(reading: KitReading) {
  const events = eventsFromTransition(prev, reading, nextEventId);
  nextEventId += events.length;
  prev = reading;
  state = {
    ...state,
    reading,
    history: [...state.history, reading].slice(-HISTORY),
    events: [...events.reverse(), ...state.events].slice(0, 24),
  };
  emit();
}

let timer: ReturnType<typeof setInterval> | undefined;

function startSim() {
  stopSim();
  timer = setInterval(() => {
    if (state.source !== "simulated") return;
    applyReading(readingAt(Date.now() - started));
  }, SIM_TICK_MS);
}

function stopSim() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

startSim();

export const kitStore = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot(): State {
    return state;
  },
};

export function serialLine(line: string) {
  try {
    const reading = JSON.parse(line) as KitReading;
    if (!Array.isArray(reading.leds) || reading.leds.length !== 4) return;
    if (state.source !== "serial") {
      state = { ...state, source: "serial" };
    }
    applyReading(reading);
  } catch {
    /* ignore partial lines */
  }
}
