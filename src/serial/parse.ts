import type { KitReading, LedState } from "../kit/types";

const MAX_BUFFER = 8192;

export type ParsedLine =
  | { ok: true; type: "reading"; reading: KitReading }
  | { ok: true; type: "calibrated"; lbase: number; hbase: number; cut: number }
  | { ok: false; reason: string };

/** Pull complete JSON objects out of a serial buffer. Keeps a partial tail. */
export function pullMessages(buffer: string): { messages: string[]; rest: string } {
  const messages: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < buffer.length; i += 1) {
    const char = buffer[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        messages.push(buffer.slice(start, i + 1));
        start = -1;
      }
    }
  }

  let rest = depth > 0 && start >= 0 ? buffer.slice(start) : "";
  if (rest.length > MAX_BUFFER) rest = "";
  return { messages, rest };
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function flag(value: unknown): 0 | 1 | null {
  if (value === 0 || value === 1) return value;
  return null;
}

function ledAt(value: unknown): 0 | 1 | 2 | null {
  if (value === 0 || value === 1 || value === 2) return value;
  return null;
}

/**
 * Accept one firmware JSON object.
 * A dead DHT (hum null, or dht 0 with no numeric humidity) cannot raise a new alarm.
 * LED values are taken from the packet and never recomputed here.
 */
export function parseMessage(text: string, last: KitReading | null): ParsedLine {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "shape" };
  const record = parsed as Record<string, unknown>;

  if (record.event === "calibrated") {
    const lbase = finite(record.lbase);
    const hbase = finite(record.hbase);
    const cut = finite(record.cut);
    if (lbase === null || hbase === null || cut === null) return { ok: false, reason: "calibrated" };
    return { ok: true, type: "calibrated", lbase, hbase, cut };
  }

  if (!Array.isArray(record.leds) || record.leds.length !== 4) return { ok: false, reason: "leds" };
  const leds = record.leds.map(ledAt);
  if (leds.some((value) => value === null)) return { ok: false, reason: "leds" };

  const ms = finite(record.ms);
  const light = finite(record.light);
  const lbase = finite(record.lbase);
  const dark = finite(record.dark);
  const hbase = finite(record.hbase);
  const cut = finite(record.cut);
  const alarm = flag(record.alarm);
  const muted = flag(record.muted);
  const dht = flag(record.dht);
  if (
    ms === null ||
    light === null ||
    lbase === null ||
    dark === null ||
    hbase === null ||
    cut === null ||
    alarm === null ||
    muted === null ||
    dht === null ||
    dark < 0 ||
    dark > 100 ||
    light < 0
  ) {
    return { ok: false, reason: "fields" };
  }

  const humRaw = record.hum === null ? null : finite(record.hum);
  const tempRaw = record.temp === null ? null : finite(record.temp);
  if (record.hum !== null && humRaw === null) return { ok: false, reason: "hum" };
  if (record.temp !== null && tempRaw === null) return { ok: false, reason: "temp" };

  const humidityKnown = dht === 1 && humRaw !== null;
  const hum = humidityKnown ? humRaw : (last?.hum ?? humRaw ?? hbase);
  const temp = tempRaw ?? last?.temp ?? 0;
  const alarmBit: 0 | 1 = humidityKnown ? alarm : (last?.alarm ?? 0);

  return {
    ok: true,
    type: "reading",
    reading: {
      ms,
      light,
      lbase,
      dark,
      hum,
      hbase,
      cut,
      temp,
      alarm: alarmBit,
      muted,
      dht,
      leds: leds as LedState,
    },
  };
}
