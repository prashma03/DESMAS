import { eventsFromTransition, readingAt, SIM_TICK_MS } from "./simulate";
import type { KitEvent, KitReading, KitSource } from "./types";

const HISTORY = 60;
const LINES = 6;

type Listener = () => void;

type State = {
  source: KitSource;
  since: number;
  reading: KitReading;
  history: KitReading[];
  events: KitEvent[];
  lines: string[];
  seq: number;
  notice: string;
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
    since: started,
    reading,
    history: [reading],
    events: intro,
    lines: [JSON.stringify(reading)],
    seq: 1,
    notice: "",
  };
}

let state: State = seed();
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

function applyReading(reading: KitReading, raw: string) {
  const events = eventsFromTransition(prev, reading, nextEventId);
  nextEventId += events.length;
  prev = reading;
  state = {
    ...state,
    reading,
    history: [...state.history, reading].slice(-HISTORY),
    events: [...events.reverse(), ...state.events].slice(0, 24),
    lines: [...state.lines, raw].slice(-LINES),
    seq: state.seq + 1,
  };
  emit();
}

let timer: ReturnType<typeof setInterval> | undefined;

function startSim() {
  stopSim();
  timer = setInterval(() => {
    if (state.source !== "simulated") return;
    const reading = readingAt(Date.now() - started);
    applyReading(reading, JSON.stringify(reading));
  }, SIM_TICK_MS);
}

function stopSim() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const bit = (v: unknown): 0 | 1 => (v ? 1 : 0);
const led = (v: unknown): 0 | 1 | 2 => (v === 0 ? 0 : v === 2 ? 2 : 1);

function fromBoard(j: Record<string, unknown>, last: KitReading | null): KitReading {
  const leds: unknown[] = Array.isArray(j.leds) ? j.leds : [];
  const hbase = num(j.hbase, last?.hbase ?? 52);
  return {
    ms: num(j.ms, 0),
    light: num(j.light, 0),
    lbase: num(j.lbase, last?.lbase ?? 0),
    dark: num(j.dark, 0),
    hum: num(j.hum, last ? last.hum : hbase),
    hbase,
    cut: num(j.cut, hbase + 10),
    temp: num(j.temp, last ? last.temp : 0),
    alarm: bit(j.alarm),
    muted: bit(j.muted),
    dht: bit(j.dht),
    leds: [led(leds[0]), led(leds[1]), led(leds[2]), led(leds[3])],
  };
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
  goLive() {
    prev = null;
    state = {
      ...state,
      source: "serial",
      since: Date.now(),
      history: [],
      events: [],
      lines: [],
      notice: "",
    };
    emit();
  },
  goSim(notice = "") {
    started = Date.now();
    prev = null;
    const reading = readingAt(0);
    prev = reading;
    const intro = eventsFromTransition(null, reading, nextEventId);
    nextEventId += intro.length;
    state = {
      source: "simulated",
      since: started,
      reading,
      history: [reading],
      events: intro,
      lines: [JSON.stringify(reading)],
      seq: state.seq + 1,
      notice,
    };
    emit();
  },
  ingestLine(line: string) {
    const text = line.trim();
    if (!text.startsWith("{")) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return;
    }
    const isReading = Array.isArray(parsed.leds);
    if (!isReading && parsed.event !== "calibrated") return;
    if (state.source !== "serial") kitStore.goLive();
    if (isReading) {
      applyReading(fromBoard(parsed, prev), text);
      return;
    }
    const hbase = Math.round(num(parsed.hbase, 0));
    const event: KitEvent = {
      id: nextEventId++,
      at: Date.now(),
      kind: "INFO",
      message: `Recalibrated. Light ${num(parsed.lbase, 0)}, humidity ${hbase}%.`,
    };
    state = {
      ...state,
      events: [event, ...state.events].slice(0, 24),
      lines: [...state.lines, text].slice(-LINES),
      seq: state.seq + 1,
    };
    emit();
  },
  setNotice(notice: string) {
    state = { ...state, notice };
    emit();
  },
};

export function serialLine(line: string) {
  kitStore.ingestLine(line);
}
