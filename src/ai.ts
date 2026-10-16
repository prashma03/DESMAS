import type { Reading, WorldId } from "./kit/types";

export type FindingLevel = "OK" | "WATCH" | "ALERT";

export type Finding = {
  level: FindingLevel;
  title: string;
  body: string;
  chips: string[];
  steps: string[];
  part?: string;
};

export function diagnose(world: Exclude<WorldId, "worlds">, r: Reading, solar: number): Finding {
  if (r.alarm) {
    if (world === "earth") {
      return {
        level: "ALERT",
        title: "Humidity is rising in the vaccine store room",
        body: `Humidity rose to ${r.hum}% while the temperature stayed near ${r.temp} °C. Shut the door and window before the fridge works harder.`,
        chips: [`Humidity ${r.hum}%`, `Cutoff ${r.cut}%`, `Temperature ${r.temp} °C`],
        steps: [
          "Shut the store room door and window.",
          "Check the fridge seal is closed.",
          "Put silica gel packs on the shelf.",
          "Watch humidity for 10 minutes. It should fall below 62%.",
        ],
        part: "Silica gel packs · in stock",
      };
    }
    if (world === "mars") {
      return {
        level: "ALERT",
        title: "Hab humidity is above the cutoff",
        body: `Humidity is ${r.hum}% with the temperature near ${r.temp} °C. On Mars the crew acts here; Earth is minutes away.`,
        chips: [`Humidity ${r.hum}%`, `Cutoff ${r.cut}%`, `Storm ${r.dark}% dark`],
        steps: [
          "Check the hab dehumidifier fan.",
          "Keep Science off if solar is weak.",
          "Switch in the spare if the fan has stopped.",
          "Watch humidity until it is under 62%.",
        ],
        part: "Spare battery heater · in stock",
      };
    }
    return {
      level: "ALERT",
      title: "The dehumidifier fan in Hab A has likely stopped",
      body: `Humidity rose while the temperature stayed near ${r.temp} °C. That pattern means the air is not being dried. It is not a heating problem.`,
      chips: [`Humidity → ${r.hum}%`, `Cutoff ${r.cut}%`, `Temperature ${r.temp} °C`],
      steps: [
        "Check whether the dehumidifier fan in Hab A is spinning.",
        "If it has stopped, switch it off and swap in the spare fan module.",
        "Switch it back on and check for airflow at the vent.",
        "Watch humidity for 10 minutes. It should fall below 62%.",
      ],
      part: "Spare fan module · 2 in Storage B",
    };
  }

  if (world === "mars" && r.dark >= 55) {
    return {
      level: "WATCH",
      title: "The dust storm is cutting solar power",
      body: "The base is using the lunar-night playbook. Keep Science off until solar is above 50%. The relay ship handles its own faults.",
      chips: [`Solar input ${solar}%`, `Storm strength ${Math.min(99, r.dark)}%`, "Relay ship: 2 faults handled"],
      steps: [
        "Keep Science off until solar is above 50%.",
        "Leave life support on P1.",
        "Do not wait for Earth — round trip can be 44 minutes.",
      ],
      part: "Spare battery heater",
    };
  }

  if (r.dark >= 55) {
    return {
      level: "WATCH",
      title: world === "earth" ? "Night: the fridge stays on battery" : "Lunar night: Science is off",
      body:
        world === "earth"
          ? `Solar input is ${solar}%. The fan is shed first. The fridge is priority 1, so it is the last thing the board turns off.`
          : `The light sensor reads ${r.dark}% dark. Comfort and Science are off. Hab A stays on.`,
      chips: [`Light sensor ${r.dark}% dark`, `Humidity ${r.hum}%`, `Temperature ${r.temp} °C`],
      steps: [],
    };
  }

  return {
    level: "OK",
    title:
      world === "earth"
        ? "Daylight: the battery is charging"
        : world === "mars"
          ? "Solar power is normal"
          : "All readings are in the normal range",
    body:
      world === "mars"
        ? `Solar input is ${solar}%. The relay ship handled two faults on its own today. Nothing needs the crew.`
        : `Humidity is ${r.hum}%, under the ${r.cut}% cutoff. If a reading crosses its cutoff, a plan appears here.`,
    chips: [`Humidity ${r.hum}%`, `Light sensor ${r.dark}% dark`, `Temperature ${r.temp} °C`],
    steps: [],
  };
}

export function answerCrew(
  q: string,
  world: Exclude<WorldId, "worlds">,
  r: Reading,
  solar: number,
): string {
  const s = q.toLowerCase();
  if (s.includes("science") || s.includes("tonight")) {
    if (r.leds[2]) {
      return "It is already on. The light sensor is under the 55% dark limit for lunar night.";
    }
    return "Not yet. With Science off, the battery lasts until sunrise. The board turns it back on by itself when the light sensor drops below 55% dark.";
  }
  if (s.includes("earth") || s.includes("call") || s.includes("wait")) {
    if (world === "mars") {
      return "No. A reply could take up to 44 minutes. These power rules were tested during lunar nights on the Moon, so the base can follow them on its own.";
    }
    return "The Moon is 1.3 seconds from Earth by radio. You do not need to call unless the humidity alarm stays up after the spare fan is in.";
  }
  if (s.includes("fridge") || s.includes("sunrise") || s.includes("fan")) {
    return `Yes, if nothing else changes. With the fan off, the battery lasts about 11 hours. Solar is ${solar}% and the fridge is priority 1.`;
  }
  if (s.includes("spare") || s.includes("part")) {
    if (world === "earth") return "Silica gel packs are on the store-room shelf.";
    if (world === "mars") return "Spare battery heater is logged in stock for the surface base.";
    return "Spare fan module: 2 in Storage B.";
  }
  if (s.includes("relay") || s.includes("fix")) {
    return "Relay ship: radio A stopped answering, switched to radio B. Camera heater fault — camera turned off to save power.";
  }
  if (s.includes("watch") || s.includes("reading")) {
    return `Humidity ${r.hum}% (cutoff ${r.cut}%), light ${r.dark}% dark, temperature ${r.temp} °C, LEDs ${r.leds.join(",")}.`;
  }
  return `Watching humidity ${r.hum}% against a ${r.cut}% cutoff, and the four priority LEDs. Ask about Science, Earth, or spare parts.`;
}

export const promptsFor = (world: Exclude<WorldId, "worlds">) => {
  if (world === "earth") {
    return ["Will the fridge stay cold until sunrise?", "Can we turn the fan back on?", "Which readings are you watching?"];
  }
  if (world === "mars") {
    return ["Should we wait for Earth before acting?", "What did the relay ship fix on its own?", "Which readings are you watching?"];
  }
  return ["Can we turn Science back on tonight?", "Do we need to call Earth about this?", "Which readings are you watching?"];
};
