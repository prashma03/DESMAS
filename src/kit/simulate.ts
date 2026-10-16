import type { Reading } from "./types";
import { LOOP_MS } from "./types";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function ease(t: number) {
  return t * t * (3 - 2 * t);
}

/** 44s story: daylight → cover sensor → humidity spike → recover. */
export function simulateAt(ms: number): Reading {
  const t = ((ms % LOOP_MS) + LOOP_MS) % LOOP_MS / 1000;
  let dark = 3;
  let hum = 53;
  const temp = 27.4 + Math.sin(ms / 4000) * 0.15;
  const lbase = 230;
  const hbase = 52;
  const cut = 62;

  if (t < 8) {
    dark = lerp(2, 5, t / 8);
    hum = 53 + Math.sin(t) * 0.6;
  } else if (t < 16) {
    const u = ease((t - 8) / 8);
    dark = lerp(5, 52, u);
    hum = 53.2;
  } else if (t < 22) {
    const u = ease((t - 16) / 6);
    dark = lerp(52, 78, u);
    hum = lerp(53.2, 58, u);
  } else if (t < 30) {
    const u = ease((t - 22) / 8);
    dark = lerp(78, 72, u);
    hum = lerp(58, 81, u);
  } else if (t < 36) {
    const u = ease((t - 30) / 6);
    dark = lerp(72, 48, u);
    hum = lerp(81, 53, u);
  } else {
    const u = ease((t - 36) / 8);
    dark = lerp(48, 3, u);
    hum = 53 + Math.sin(t) * 0.4;
  }

  dark = clamp(dark, 0, 99);
  const light = Math.round(lbase + dark * 1.4);
  const p1 = 1;
  const p4 = dark >= 30 ? 0 : 1;
  const p3 = dark >= 55 ? 0 : 1;
  const p2 = dark >= 85 ? (Math.floor(ms / 800) % 2 === 0 ? 1 : 0) : 1;
  const alarm: 0 | 1 = hum >= cut ? 1 : 0;

  return {
    ms,
    light,
    lbase,
    dark: Math.round(dark),
    hum: Math.round(hum * 10) / 10,
    hbase,
    cut,
    temp: Math.round(temp * 10) / 10,
    alarm,
    muted: 0,
    dht: 1,
    leds: [p1, p2, p3, p4],
  };
}
