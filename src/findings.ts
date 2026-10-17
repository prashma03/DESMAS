import { communicationAutonomy } from "./kit/autonomy";
import type { KitReading, WorldId } from "./kit/types";

export type WorldKey = Exclude<WorldId, "all">;
export type Level = "OK" | "WATCH" | "ALERT";
export type Evidence = { text: string; tone: "alert" | "watch" | "ok" | "info" };
export type Part = { name: string; detail: string; inStock: boolean };
export type Finding = {
  level: Level;
  title: string;
  body: string;
  evidence: Evidence[];
  steps: string[];
  parts: Part[];
};
export type EarthDelay = { oneWayMin: number; roundTripMin: number; au?: number };

export function stageOf(r: KitReading): 0 | 1 | 2 | 3 {
  if (r.leds[1] === 2) return 3;
  if (r.leds[2] === 0) return 2;
  if (r.leds[3] === 0) return 1;
  return 0;
}

export function diagnosisKey(world: WorldKey, r: KitReading) {
  return `${world}|${stageOf(r)}|${r.alarm}`;
}

const INVENTORY: Record<WorldKey, Part[]> = {
  moon: [{ name: "Spare fan module", detail: "2 in Storage B", inStock: true }],
  earth: [{ name: "Silica gel packs", detail: "1 box in the supply cupboard", inStock: true }],
  mars: [{ name: "Spare battery heater", detail: "1 at the base", inStock: true }],
};

export function inventory(world: WorldKey) {
  return INVENTORY[world];
}

function facts(r: KitReading) {
  const dark = Math.round(r.dark);
  return {
    stage: stageOf(r),
    alarm: r.alarm === 1,
    dark,
    solar: Math.max(0, 100 - dark),
    hum: Math.round(r.hum),
    hbase: Math.round(r.hbase),
    cut: Math.round(r.cut),
    temp: r.temp.toFixed(1),
  };
}

export function cannedFinding(world: WorldKey, r: KitReading): Finding {
  const { stage, alarm, dark, solar, hum, hbase, cut, temp } = facts(r);
  const rise: Evidence = { text: `Humidity ${hbase}% → ${hum}%`, tone: "alert" };
  const cutoff: Evidence = { text: `Cutoff ${cut}%`, tone: "watch" };

  if (world === "earth") {
    if (alarm) {
      return {
        level: "ALERT",
        title: "Humidity is rising in the vaccine store room",
        body: `Humidity jumped from ${hbase}% to ${hum}% while the temperature stayed near ${temp} °C. Damp air makes the fridge work harder and can ruin vaccine packaging.`,
        evidence: [rise, cutoff, { text: `Temperature ${temp} °C`, tone: "info" }],
        steps: [
          "Check that the store room door and window are shut.",
          "Look for a leak or a wet floor near the fridge.",
          "Keep vaccine boxes off the floor and away from the walls.",
          `Watch humidity for 10 minutes. It should fall below ${cut}%.`,
        ],
        parts: INVENTORY.earth,
      };
    }
    if (stage >= 1) {
      return {
        level: "WATCH",
        title: "Running on battery until sunrise",
        body: `The light sensor reads ${dark}% dark, so solar has stopped charging. The board turned the fan off${stage >= 2 ? " and the exam room lights" : ""} to keep the vaccine fridge cold until morning.`,
        evidence: [
          { text: `Light sensor ${dark}% dark`, tone: "info" },
          { text: `Solar input ${solar}%`, tone: "watch" },
          { text: `Humidity ${hum}%`, tone: "ok" },
        ],
        steps: [
          "Keep the fridge closed until morning unless a vaccine is needed.",
          "Leave the fan off. The board turns it back on when it gets light.",
          "Check the battery cabinet lights before you leave for the night.",
        ],
        parts: [],
      };
    }
    return {
      level: "OK",
      title: "Daylight: the battery is charging",
      body: `Solar input is ${solar}% and all four systems are on. Humidity is ${hum}%, under the ${cut}% cutoff.`,
      evidence: [
        { text: `Solar input ${solar}%`, tone: "watch" },
        { text: `Humidity ${hum}%`, tone: "ok" },
        { text: `Temperature ${temp} °C`, tone: "info" },
      ],
      steps: [],
      parts: [],
    };
  }

  if (world === "moon") {
    if (alarm) {
      return {
        level: "ALERT",
        title: "The dehumidifier fan in Hab A has likely stopped",
        body: `Humidity rose from ${hbase}% to ${hum}% while the temperature stayed near ${temp} °C. That pattern means the air is not being dried. It is not a heating problem.`,
        evidence: [rise, cutoff, { text: `Temperature ${temp} °C`, tone: "info" }],
        steps: [
          "Check whether the dehumidifier fan in Hab A is spinning.",
          "If it has stopped, switch it off and swap in the spare fan module.",
          "Switch it back on and check for airflow at the vent.",
          `Watch humidity for 10 minutes. It should fall below ${cut}%.`,
        ],
        parts: INVENTORY.moon,
      };
    }
    const calm: Evidence[] = [
      { text: `Light sensor ${dark}% dark`, tone: "info" },
      { text: `Humidity ${hum}%`, tone: "ok" },
      { text: `Temperature ${temp} °C`, tone: "watch" },
    ];
    if (stage >= 2) {
      return {
        level: stage >= 3 ? "WATCH" : "OK",
        title: stage >= 3 ? "Almost no light: comms are on low power" : "Lunar night: the power rules are working",
        body:
          stage >= 3
            ? `The light sensor reads ${dark}% dark. Science and Comfort are off, and comms are blinking on low power so the battery lasts longer.`
            : `The light sensor reads ${dark}% dark. Science and Comfort are off, so the battery lasts until the light returns. Humidity is ${hum}%, under the ${cut}% cutoff.`,
        evidence: calm,
        steps: [],
        parts: [],
      };
    }
    if (stage === 1) {
      return {
        level: "OK",
        title: "Light is falling: Comfort is off",
        body: `The light sensor reads ${dark}% dark, so the board turned Comfort off to save power. Science stays on until 55%. Humidity is ${hum}%, under the ${cut}% cutoff.`,
        evidence: calm,
        steps: [],
        parts: [],
      };
    }
    return {
      level: "OK",
      title: "All readings are in the normal range",
      body: `Nothing needs attention right now. Humidity is ${hum}%, under the ${cut}% cutoff. If a reading crosses its cutoff, a troubleshooting plan appears here.`,
      evidence: [calm[1], calm[0], calm[2]],
      steps: [],
      parts: [],
    };
  }

  if (alarm) {
    return {
      level: "ALERT",
      title: "Hab humidity is above the cutoff",
      body: `Humidity rose from ${hbase}% to ${hum}% in the hab while the temperature stayed near ${temp} °C. The air is not being dried, so check the dehumidifier before the storm gets worse.`,
      evidence: [rise, cutoff, { text: `Storm strength ${dark}%`, tone: "info" }],
      steps: ["Check that the hab dehumidifier fan is spinning.", "Clear dust from its intake filter.", `Watch humidity for 10 minutes. It should fall below ${cut}%.`],
      parts: [],
    };
  }
  if (stage >= 1) {
    const severe = stage >= 3;
    const shed = stage >= 2 ? "Comfort and Science are off" : "Comfort is off";
    return {
      level: severe ? "ALERT" : "WATCH",
      title: severe ? "Severe dust storm: power is critical" : "Dust storm is cutting solar power",
      body: `Solar input is down to ${solar}%. Using the lunar night rules: ${shed}${severe ? ", and comms are on low power" : ""}. Dust storms on Mars can last for weeks, so plan for a long one.`,
      evidence: [
        { text: `Solar input ${solar}%`, tone: "watch" },
        { text: `Storm strength ${dark}%`, tone: "info" },
        { text: "Relay ship: 2 faults handled", tone: "ok" },
      ],
      steps: [
        "Keep Science off until solar input is back above 50%.",
        "Check the battery heaters every few hours. Cold batteries hold less charge.",
        "Clear dust from the panels once the storm drops below 30%.",
        "Send a daily summary to Earth. No reply is needed to act.",
      ],
      parts: INVENTORY.mars,
    };
  }
  return {
    level: "OK",
    title: "Solar power is normal",
    body: `Solar input is ${solar}%. The relay ship handled two faults on its own today. Nothing needs the crew.`,
    evidence: [
      { text: `Solar input ${solar}%`, tone: "watch" },
      { text: `Storm strength ${dark}%`, tone: "info" },
      { text: "Relay ship: 2 faults handled", tone: "ok" },
    ],
    steps: [],
    parts: [],
  };
}

export function suggestedQuestions(world: WorldKey, r: KitReading, delay?: EarthDelay) {
  const { stage, dark } = facts(r);
  if (world === "earth") {
    return [
      {
        q: "Will the fridge stay cold until sunrise?",
        a: "Yes, if nothing else changes. The fridge is priority 1, so it is the last thing the board turns off. The fan and lights go first to save the battery.",
      },
      {
        q: "Can we turn the fan back on?",
        a:
          stage >= 1
            ? `Only for short periods. The light sensor reads ${dark}% dark, so the battery is doing the work. With the fan on all night, the fridge could warm up before sunrise.`
            : "It is already on. The board turns it off again at sunset, when the light sensor reaches 30% dark.",
      },
      { q: "Which readings are you watching?", a: "Light level from the A0 sensor, humidity and temperature from the DHT11, and which of the four systems the board has switched on." },
    ];
  }
  if (world === "moon") {
    return [
      {
        q: "Can we turn Science back on tonight?",
        a:
          stage >= 2
            ? "Not yet. With Science off, the battery lasts until the light returns. The board turns it back on by itself once the light sensor drops below 55% dark."
            : `It is already on. The light sensor reads ${dark}% dark, under the 55% limit for lunar night.`,
      },
      {
        q: "Do we need to call Earth about this?",
        a: (() => {
          const status = communicationAutonomy({ world: "moon", reading: r });
          return `${status.summary} ${status.recommendation}`;
        })(),
      },
      { q: "Which readings are you watching?", a: "Light level on A0, humidity and temperature from the DHT11 in Hab A, and which of the four systems the board left on." },
    ];
  }
  return [
    {
      q: "Should we wait for Earth before acting?",
      a: (() => {
        const status = communicationAutonomy({ world: "mars", reading: r, mars: delay ?? null });
        return `${status.summary} ${status.recommendation} The power rules were tested on the Moon, and the Arduino already applies them.`;
      })(),
    },
    {
      q: "What did the relay ship fix on its own?",
      a: "Radio A stopped answering, so it switched to radio B. A camera heater failed, so it turned the camera off to save power. Neither needed the crew.",
    },
    { q: "Which readings are you watching?", a: "Light level as dust storm strength, humidity and temperature in the hab, which systems are on, and fault reports from the relay ship." },
  ];
}

const lead = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function fallbackAnswer(world: WorldKey, question: string, r: KitReading, finding: Finding, delay?: EarthDelay) {
  const asked = question.trim().toLowerCase();
  const suggested = suggestedQuestions(world, r, delay);
  const exact = suggested.find((s) => s.q.toLowerCase() === asked);
  if (exact) return exact.a;
  if (/(part|spare|stock)/.test(asked)) {
    const inStock = finding.parts.filter((p) => p.inStock);
    return inStock.length
      ? `Yes: ${inStock.map((p) => `${lead(p.name)}, ${lead(p.detail)}`).join("; ")}.`
      : "No part is needed for the current finding, and I won't guess at stock I can't see.";
  }
  const keyed = [
    { re: /(science|night)/, i: 0 },
    { re: /(fridge|vaccine)/, i: 0 },
    { re: /(fan|earth|call|wait)/, i: world === "mars" ? 0 : 1 },
    { re: /(relay|ship|fix)/, i: 1 },
    { re: /(reading|watch|sensor)/, i: 2 },
  ].find((k) => k.re.test(asked));
  if (keyed) return suggested[keyed.i].a;
  return `${finding.title}. I watch the light sensor, humidity, temperature and which systems the board has on. Ask about readings, power or parts.`;
}
