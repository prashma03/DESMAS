import type { Reading } from "./types";

export function parseReading(line: string): Reading | null {
  try {
    const j = JSON.parse(line) as Partial<Reading>;
    if (
      typeof j.light !== "number" ||
      typeof j.hum !== "number" ||
      !Array.isArray(j.leds) ||
      j.leds.length !== 4
    ) {
      return null;
    }
    return {
      ms: Number(j.ms) || 0,
      light: j.light,
      lbase: Number(j.lbase) || 230,
      dark: Number(j.dark) || 0,
      hum: j.hum,
      hbase: Number(j.hbase) || 52,
      cut: Number(j.cut) || 62,
      temp: Number(j.temp) || 0,
      alarm: j.alarm ? 1 : 0,
      muted: j.muted ? 1 : 0,
      dht: j.dht ? 1 : 0,
      leds: [j.leds[0] ? 1 : 0, j.leds[1] ? 1 : 0, j.leds[2] ? 1 : 0, j.leds[3] ? 1 : 0],
    };
  } catch {
    return null;
  }
}

export async function connectArduino(onLine: (line: string) => void): Promise<() => void> {
  if (!navigator.serial) {
    throw new Error("Web Serial needs Chrome or Edge.");
  }
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });
  const decoder = new TextDecoderStream();
  const readable = port.readable;
  if (!readable) throw new Error("Port has no readable stream.");
  readable.pipeTo(decoder.writable).catch(() => undefined);
  const reader = decoder.readable.getReader();
  let buffer = "";
  let stopped = false;

  (async () => {
    while (!stopped) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (trimmed) onLine(trimmed);
      }
    }
  })().catch(() => undefined);

  return () => {
    stopped = true;
    reader.cancel().catch(() => undefined);
    port.close().catch(() => undefined);
  };
}
