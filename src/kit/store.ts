import { parseMessage } from "../serial/parse";
import { eventsFromTransition, readingAt, SIM_TICK_MS } from "./simulate";
import type { KitEvent, KitReading, KitSource, LinkStatus } from "./types";

const HISTORY = 60;
const LINES = 6;

type Listener = () => void;

type State = {
  source: KitSource;
  link: LinkStatus;
  since: number;
  lastAt: number;
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
    link: "simulated",
    since: started,
    lastAt: 0,
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

function simMayRun() {
  return state.source === "simulated" && (state.link === "simulated" || state.link === "error");
}

function startSim() {
  stopSim();
  timer = setInterval(() => {
    if (!simMayRun()) return;
    const reading = readingAt(Date.now() - started);
    applyReading(reading, JSON.stringify(reading));
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
  /** Port chosen, not open yet. Simulation pauses so it cannot race the board. */
  markConnecting() {
    if (state.link === "live" || state.link === "connected") return;
    state = { ...state, link: "connecting", notice: "" };
    emit();
  },
  /** Port is open. Still not "Arduino live" until a valid reading arrives. */
  markConnected() {
    state = { ...state, link: "connected", since: Date.now(), notice: "" };
    emit();
  },
  markStale() {
    if (state.link !== "live") return;
    state = { ...state, link: "stale" };
    emit();
  },
  /** USB dropped or the stream stopped. Keep the last board reading and do not start the simulation over it. */
  markDisconnected(notice = "") {
    if (state.source !== "serial") {
      state = { ...state, link: "simulated", notice };
      emit();
      return;
    }
    state = { ...state, link: "disconnected", notice };
    emit();
  },
  markError(notice: string) {
    const backToSim = state.source !== "serial";
    state = { ...state, link: backToSim ? "error" : "disconnected", notice };
    emit();
  },
  goLive() {
    kitStore.markConnected();
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
      link: "simulated",
      since: started,
      lastAt: 0,
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
    if (!text.startsWith("{")) return false;
    const parsed = parseMessage(text, prev);
    if (!parsed.ok) return false;
    if (parsed.type === "calibrated") {
      const event: KitEvent = {
        id: nextEventId++,
        at: Date.now(),
        kind: "INFO",
        message: `Recalibrated. Light ${Math.round(parsed.lbase)}, humidity ${Math.round(parsed.hbase)}%.`,
      };
      state = {
        ...state,
        events: [event, ...state.events].slice(0, 24),
        lines: [...state.lines, text].slice(-LINES),
        seq: state.seq + 1,
      };
      emit();
      return true;
    }
    const first = state.source !== "serial";
    const events = first
      ? [
          {
            id: nextEventId,
            at: Date.now(),
            kind: "INFO" as const,
            message: "Arduino connected. Readings are live.",
          },
        ]
      : eventsFromTransition(prev, parsed.reading, nextEventId);
    nextEventId += events.length;
    prev = parsed.reading;
    state = {
      ...state,
      source: "serial",
      link: "live",
      lastAt: Date.now(),
      reading: parsed.reading,
      history: [...(first ? [] : state.history), parsed.reading].slice(-HISTORY),
      events: [...events.reverse(), ...(first ? [] : state.events)].slice(0, 24),
      lines: [...(first ? [] : state.lines), text].slice(-LINES),
      seq: state.seq + 1,
      notice: "",
    };
    emit();
    return true;
  },
  setNotice(notice: string) {
    const link = notice === "" && state.link === "error" && state.source === "simulated" ? "simulated" : state.link;
    state = { ...state, notice, link };
    emit();
  },
};

export function serialLine(line: string) {
  kitStore.ingestLine(line);
}
