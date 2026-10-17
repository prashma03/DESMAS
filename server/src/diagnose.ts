import type { Request, Response } from "express";
import { cannedFinding, inventory, type Evidence, type Finding, type Level, type Part, type WorldKey } from "../../src/findings.ts";
import type { KitReading } from "../../src/kit/types.ts";
import { grokChat, MissingKeyError } from "./grok.js";

const WORLDS = new Set<WorldKey>(["earth", "moon", "mars"]);
const LEVELS = new Set<Level>(["OK", "WATCH", "ALERT"]);
const TONES = new Set<Evidence["tone"]>(["alert", "watch", "ok", "info"]);

const PLACE: Record<WorldKey, string> = {
  moon: "the Artemis base at the lunar south pole (Hab A, science lab, comfort module, comms tower)",
  earth: "an off-grid clinic on Earth (vaccine fridge, radio, exam room lights, fan, store room)",
  mars: "a Mars relay ship that fixes its own faults, and the crewed future base below it",
};

const SYSTEMS: Record<WorldKey, string[]> = {
  moon: ["life support", "comms", "science", "comfort"],
  earth: ["vaccine fridge", "radio", "lights", "fan"],
  mars: ["life support", "comms", "science", "comfort"],
};

function worldOf(raw: unknown): WorldKey {
  return typeof raw === "string" && WORLDS.has(raw as WorldKey) ? (raw as WorldKey) : "moon";
}

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const led = (v: unknown): 0 | 1 | 2 => (v === 0 ? 0 : v === 2 ? 2 : 1);

function readingOf(raw: unknown): KitReading {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const leds = Array.isArray(r.leds) ? r.leds : [];
  return {
    ms: num(r.ms, 0),
    light: num(r.light, 0),
    lbase: num(r.lbase, 0),
    dark: num(r.dark, 0),
    hum: num(r.hum, 50),
    hbase: num(r.hbase, 50),
    cut: num(r.cut, 60),
    temp: num(r.temp, 0),
    alarm: r.alarm ? 1 : 0,
    muted: r.muted ? 1 : 0,
    dht: r.dht ? 1 : 0,
    leds: [led(leds[0]), led(leds[1]), led(leds[2]), led(leds[3])],
  };
}

function facts(w: WorldKey, r: KitReading) {
  const state = (v: number) => (v === 2 ? "low power" : v ? "on" : "off");
  return {
    lightSensorDarkPercent: Math.round(r.dark),
    humidityPercent: Math.round(r.hum),
    humidityNormalPercent: Math.round(r.hbase),
    humidityCutoffPercent: Math.round(r.cut),
    temperatureC: r.temp,
    humidityAlarm: r.alarm === 1,
    systems: Object.fromEntries(SYSTEMS[w].map((name, i) => [name, state(r.leds[i])])),
    sparePartsInStock: inventory(w),
  };
}

const RULES = `The power rules run on the station's own controller and are already applied: at 30% dark the lowest priority system turns off, at 55% the third turns off, at 85% comms drop to low power, and life support (or the vaccine fridge) never turns off. Never tell the crew to recompute them.
Use only the numbers in the readings. Never invent spare parts: only sparePartsInStock exists. Battery percent and vaccine fridge temperature are estimates if you mention them. Don't claim when the sun will rise.`;

export function parseFinding(text: string, w: WorldKey): Finding {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const raw = JSON.parse(json) as Record<string, unknown>;
  const level = String(raw.level ?? "").toUpperCase() as Level;
  if (!LEVELS.has(level)) throw new Error("level");
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (!title || !body) throw new Error("title");
  const evidence: Evidence[] = (Array.isArray(raw.evidence) ? raw.evidence : [])
    .slice(0, 4)
    .map((item) => {
      if (typeof item === "string") return { text: item, tone: "info" as const };
      if (item && typeof item === "object" && "text" in item) {
        const tone = String((item as { tone?: unknown }).tone ?? "info") as Evidence["tone"];
        return { text: String((item as { text: unknown }).text), tone: TONES.has(tone) ? tone : "info" };
      }
      return null;
    })
    .filter((item): item is Evidence => !!item && item.text.trim().length > 0);
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((step) => (typeof step === "string" ? step.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);
  const named = (Array.isArray(raw.parts) ? raw.parts : []).map((p) =>
    (typeof p === "string" ? p : typeof p === "object" && p && "name" in p ? String((p as { name: unknown }).name) : "").toLowerCase(),
  );
  const parts: Part[] = inventory(w).filter((part) => named.some((n) => n.includes(part.name.toLowerCase()) || (part.name.toLowerCase().includes(n) && n.length > 3)));
  return { level, title, body, evidence, steps, parts };
}

export async function diagnose(req: Request, res: Response) {
  const w = worldOf(req.body?.world);
  const r = readingOf(req.body?.reading);
  const rules = cannedFinding(w, r);
  const system = `You are the DESMAS AI monitor for ${PLACE[w]}. You read live sensor data from an Arduino kit and write one finding for the crew.
${RULES}
Reply with JSON only: {"level":"OK"|"WATCH"|"ALERT","title":string,"body":string (2 sentences),"evidence":[{"text":string,"tone":"alert"|"watch"|"ok"|"info"}] (2 to 3),"steps":string[] (empty when nothing needs doing, else 3 to 4 short imperative steps),"parts":string[] (names from sparePartsInStock only)}.`;
  const user = `Readings: ${JSON.stringify(facts(w, r))}
The built-in rule for these readings says: ${JSON.stringify({ ...rules, parts: rules.parts.map((p) => p.name) })}
Use it as a worked example: keep its facts, improve the wording only where the readings support it.`;
  try {
    const finding = parseFinding(await grokChat(system, user, 500), w);
    res.json({ ...finding, source: "grok" });
  } catch (err) {
    res.json({ ...rules, source: "rules", reason: err instanceof MissingKeyError ? "no-key" : "grok-failed" });
  }
}
