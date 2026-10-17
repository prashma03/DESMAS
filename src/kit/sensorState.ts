import type { KitReading } from "./types";
import { WORLDS } from "../worlds";
import inventory from "./inventory.json";
import { communicationAutonomy, type LinkMinutes } from "./autonomy";

export type SparePart = {
  id: string;
  name: string;
  qty: number;
  location: string;
};

function ledUi(n: number) {
  if (n === 2) return { on: true, state: "BLINKING" as const, led: 2 };
  if (n === 1) return { on: true, state: "ON" as const, led: 1 };
  return { on: false, state: "OFF" as const, led: 0 };
}

export type SensorState = {
  world: "earth" | "moon" | "mars";
  analog_note: string;
  darkness: number;
  dhtOk: boolean;
  humidity: number | null;
  cutoff: number;
  temperature: number | null;
  alarm: boolean;
  p1: { id: "P1"; name: string; on: boolean; state: string; led: number };
  p2: { id: "P2"; name: string; on: boolean; state: string; led: number };
  p3: { id: "P3"; name: string; on: boolean; state: string; led: number };
  p4: { id: "P4"; name: string; on: boolean; state: string; led: number };
  spareParts: SparePart[];
};

const PARTS = inventory as Record<"earth" | "moon" | "mars", SparePart[]>;

export function getSensorState(
  world: SensorState["world"],
  reading: KitReading,
): SensorState {
  const sys = WORLDS[world].systems;
  const dhtOk = reading.dht === 1;
  return {
    world,
    analog_note:
      world === "earth"
        ? "Desk Arduino labeled as the Earth clinic analog."
        : `World page is ${world}, but the Arduino is a desk analog — these are not ${world} instrument measurements.`,
    darkness: reading.dark,
    dhtOk,
    humidity: dhtOk ? reading.hum : null,
    cutoff: reading.cut,
    temperature: dhtOk ? reading.temp : null,
    alarm: dhtOk && reading.alarm === 1,
    p1: { id: "P1", name: sys[0].name, ...ledUi(reading.leds[0]) },
    p2: { id: "P2", name: sys[1].name, ...ledUi(reading.leds[1]) },
    p3: { id: "P3", name: sys[2].name, ...ledUi(reading.leds[2]) },
    p4: { id: "P4", name: sys[3].name, ...ledUi(reading.leds[3]) },
    spareParts: PARTS[world] ?? [],
  };
}

function flag01(n: unknown): n is 0 | 1 {
  return n === 0 || n === 1;
}

function finiteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function isKitReading(value: unknown): value is KitReading {
  if (!value || typeof value !== "object") return false;
  const r = value as KitReading;
  return (
    finiteNum(r.ms) &&
    finiteNum(r.light) &&
    finiteNum(r.lbase) &&
    finiteNum(r.dark) &&
    finiteNum(r.hum) &&
    finiteNum(r.hbase) &&
    finiteNum(r.cut) &&
    finiteNum(r.temp) &&
    flag01(r.alarm) &&
    flag01(r.muted) &&
    flag01(r.dht) &&
    Array.isArray(r.leds) &&
    r.leds.length === 4 &&
    r.leds.every((led) => led === 0 || led === 1 || led === 2)
  );
}

function askedAny(q: string, words: string[]) {
  return words.some((w) => q.includes(w));
}

export function offlineCrewAnswer(
  world: SensorState["world"],
  reading: KitReading,
  question: string,
  mars?: LinkMinutes | null,
): string {
  const s = getSensorState(world, reading);
  const decision = communicationAutonomy({ world, reading, mars });
  const q = question.toLowerCase();
  const parts = s.spareParts.map((p) => `${p.name} (${p.qty} at ${p.location})`).join("; ");
  const rails = `${s.p1.id} ${s.p1.name} ${s.p1.on ? "ON" : "OFF"}, ${s.p2.id} ${s.p2.name} ${s.p2.on ? "ON" : "OFF"}, ${s.p3.id} ${s.p3.name} ${s.p3.on ? "ON" : "OFF"}, ${s.p4.id} ${s.p4.name} ${s.p4.on ? "ON" : "OFF"}`;

  const wantHum = askedAny(q, ["humid", "moisture", "dht", "cutoff"]);
  const wantParts = askedAny(q, ["part", "spare", "inventory", "stock"]);
  const wantDark = askedAny(q, ["dark", "night", "solar", "storm", "light sensor"]);
  const wantTemp = askedAny(q, ["temp", "°c", "degree"]);
  const wantPower = askedAny(q, ["p1", "p2", "p3", "p4", "led", "fridge", "science", "comms", "fan", "power"]);
  const wantAlarm = askedAny(q, ["alarm", "buzzer"]);

  const bits: string[] = [];
  if (wantHum || wantAlarm || wantTemp) {
    if (!s.dhtOk) {
      bits.push("DHT11 fault: humidity and temperature are not valid measurements. Humidity alarm ignored.");
    } else {
      if (wantHum || wantAlarm) {
        bits.push(
          `Humidity ${s.humidity}%, cutoff ${s.cutoff}%, humidity alarm ${s.alarm ? "active" : "not active"}.`,
        );
      }
      if (wantTemp) {
        bits.push(`Temperature ${s.temperature} °C.`);
      }
    }
  }
  if (wantParts) {
    bits.push(`Spare parts: ${parts || "none listed"}.`);
  }
  if (wantDark) {
    bits.push(`Darkness ${s.darkness}%.`);
  }
  if (wantPower) {
    bits.push(rails + ".");
  }

  if (!bits.length) {
    bits.push(
      s.dhtOk
        ? `Humidity ${s.humidity}% (cutoff ${s.cutoff}%, alarm ${s.alarm ? "active" : "not active"}). Darkness ${s.darkness}%. Temperature ${s.temperature} °C. ${rails}.`
        : `DHT11 fault: humidity and temperature not valid. Darkness ${s.darkness}%. ${rails}.`,
    );
  }

  const local = decision.mode === "local-first" ? `${decision.summary} ${decision.recommendation} ` : "";
  return `${local}OFFLINE · not Grok · local sensor rules. ${bits.join(" ")}`;
}

export const GET_SENSOR_STATE_NAME = "get_sensor_state";
export const GET_INCIDENT_HISTORY_NAME = "get_incident_history";

export const GET_SENSOR_STATE_VOICE_TOOL = {
  type: "function" as const,
  name: GET_SENSOR_STATE_NAME,
  description:
    "Return the live Arduino/simulator kit reading: darkness, P1–P4 on/off, DHT11 status, humidity, cutoff, temperature, alarm, and spare-parts inventory. If dhtOk is false, do not quote humidity or temperature. Always call this before stating numbers.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export const GET_SENSOR_STATE_CHAT_TOOL = {
  type: "function" as const,
  function: {
    name: GET_SENSOR_STATE_NAME,
    description: GET_SENSOR_STATE_VOICE_TOOL.description,
    parameters: GET_SENSOR_STATE_VOICE_TOOL.parameters,
  },
};

export const GET_INCIDENT_HISTORY_VOICE_TOOL = {
  type: "function" as const,
  name: GET_INCIDENT_HISTORY_NAME,
  description:
    "Return the last N seconds of observed Arduino incident timeline (LED shed/recovery, humidity alarm, DHT invalid). Use for what happened, why systems shut down, and what to do next.",
  parameters: {
    type: "object",
    properties: {
      window_seconds: { type: "number", description: "Lookback window in seconds. Default 60, max 180." },
    },
    additionalProperties: false,
  },
};

export const CREW_VOICE_INSTRUCTIONS = `You are DESMAS, the onboard crew assistant. The Arduino Mega is the autonomous safety controller; you only explain readings and recommend actions. Never claim to switch P1–P4.
The sensor tool includes a decision object. If decision.mode is local-first, give local troubleshooting now and do not tell the crew to wait for Earth. Safety-critical hardware (humidity alarm or P1 life support) is always local-first, even when the round trip is only seconds. If decision.mode is earth-guided, Earth can advise that non-critical choice inside decision.responseWindowMin. One-way delay and round-trip delay are different; Earth needs the round trip to answer. decision.grokMaySwitchHardware is always false.
Call get_sensor_state for the current snapshot. Call get_incident_history when asked what happened, why systems shut down, or what to do next.
Policy: P1 never sheds. P4 sheds at 30% darkness, P3 at 55%, P2 blinks/low-power at 85%. Firmware hysteresis can restore below those trips; restore offsets are not measured.
The kit is a desk analog. Never describe Earth hardware readings as actual measurements on the Moon or Mars.
If source is SIMULATED, say so and do not narrate a fake live incident. If dhtOk is false, do not quote humidity or temperature.
Do not mention battery percent or unmeasured hardware failures. Keep answers short.`;
