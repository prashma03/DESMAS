import type { KitEvent, KitReading, LedState } from "./types";

const LBASE = 230;
const HBASE = 52;
const CUT = 62;
const LOOP_MS = 44_000;

type Keyframe = { t: number; dark: number; hum: number; temp: number };

const KEYFRAMES: Keyframe[] = [
  { t: 0, dark: 3, hum: 53.0, temp: 27.4 },
  { t: 6_000, dark: 8, hum: 53.1, temp: 27.4 },
  { t: 10_000, dark: 32, hum: 53.2, temp: 27.4 },
  { t: 12_000, dark: 49, hum: 53.3, temp: 27.4 },
  { t: 14_000, dark: 58, hum: 53.4, temp: 27.4 },
  { t: 18_000, dark: 62, hum: 58.0, temp: 27.5 },
  { t: 22_000, dark: 64, hum: 64.0, temp: 27.6 },
  { t: 26_000, dark: 60, hum: 81.0, temp: 27.9 },
  { t: 32_000, dark: 40, hum: 61.0, temp: 27.6 },
  { t: 36_000, dark: 20, hum: 53.0, temp: 27.4 },
  { t: 40_000, dark: 4, hum: 53.0, temp: 27.4 },
  { t: LOOP_MS, dark: 3, hum: 53.0, temp: 27.4 },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function at(loopMs: number): { dark: number; hum: number; temp: number } {
  const t = loopMs % LOOP_MS;
  let i = 0;
  while (i < KEYFRAMES.length - 1 && KEYFRAMES[i + 1].t < t) i += 1;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const u = (t - a.t) / Math.max(1, b.t - a.t);
  return {
    dark: lerp(a.dark, b.dark, u),
    hum: lerp(a.hum, b.hum, u),
    temp: lerp(a.temp, b.temp, u),
  };
}

function ledsFromDark(dark: number): LedState {
  const p1 = 1;
  const p4 = dark >= 30 ? 0 : 1;
  const p3 = dark >= 55 ? 0 : 1;
  // Firmware value 2: comms stays linked, and the blue LED blinks.
  const p2 = dark >= 85 ? 2 : 1;
  return [p1, p2, p3, p4];
}

export function readingAt(wallMs: number): KitReading {
  const sample = at(wallMs);
  const dark = Math.round(sample.dark);
  const light = LBASE + Math.round(dark * 1.4);
  const hum = Math.round(sample.hum * 10) / 10;
  const temp = Math.round(sample.temp * 10) / 10;
  const alarm: 0 | 1 = hum >= CUT ? 1 : 0;
  return {
    ms: wallMs,
    light,
    lbase: LBASE,
    dark,
    hum,
    hbase: HBASE,
    cut: CUT,
    temp,
    alarm,
    muted: 0,
    dht: 1,
    leds: ledsFromDark(dark),
  };
}

export function eventsFromTransition(
  prev: KitReading | null,
  next: KitReading,
  id: number,
): KitEvent[] {
  if (!prev) {
    return [
      {
        id,
        at: Date.now(),
        kind: "INFO",
        message: "Simulated kit running. Connect the Arduino for real readings.",
      },
    ];
  }

  const events: KitEvent[] = [];
  const now = Date.now();
  const push = (kind: KitEvent["kind"], message: string) => {
    events.push({ id: id + events.length, at: now, kind, message });
  };

  const wasNight = prev.dark >= 55;
  const isNight = next.dark >= 55;
  const p4Was = prev.leds[3];
  const p4Is = next.leds[3];
  const p3Was = prev.leds[2];
  const p3Is = next.leds[2];

  if (prev.leds[1] !== 2 && next.leds[1] === 2) {
    push("POWER", "Almost no light. Comms on low power.");
  }
  if (prev.leds[1] === 2 && next.leds[1] === 1) {
    push("POWER", "Comms back to full power.");
  }
  if (p4Was === 1 && p4Is === 0) {
    push("POWER", `Light falling (${next.dark}% dark). Turned off Comfort.`);
  }
  if (p3Was === 1 && p3Is === 0) {
    push("POWER", "Lunar night. Turned off Science too.");
  }
  if (p3Was === 0 && p3Is === 1) {
    push("POWER", "Light rising. Science is back on.");
  }
  if (wasNight && !isNight && p4Is === 1) {
    push("POWER", "Sunlight is back. All four systems are on.");
  }
  if (prev.alarm === 0 && next.alarm === 1) {
    push(
      "ALERT",
      `Hab humidity ${next.hum}%, above the ${next.cut}% cutoff. The buzzer is sounding.`,
    );
  }
  if (prev.alarm === 1 && next.alarm === 0) {
    push("OK", "Humidity is back under the cutoff.");
  }

  return events;
}

export const SIM_TICK_MS = 500;
export const SIM_LOOP_MS = LOOP_MS;
