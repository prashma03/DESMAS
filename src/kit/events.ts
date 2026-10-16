import type { KitEvent, Reading, WorldId } from "./types";

function clock(ms: number) {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

let seq = 0;

export function diffEvents(
  prev: Reading | null,
  next: Reading,
  world: Exclude<WorldId, "worlds">,
): KitEvent[] {
  if (!prev) {
    return [
      {
        id: `e${seq++}`,
        at: Date.now(),
        clock: clock(Date.now()),
        level: "INFO",
        text: "Simulated kit running. Connect the Arduino for real readings.",
      },
    ];
  }

  const out: KitEvent[] = [];
  const now = Date.now();
  const c = clock(now);
  const push = (level: KitEvent["level"], text: string) => {
    out.push({ id: `e${seq++}`, at: now, clock: c, level, text });
  };

  if (prev.leds[3] === 1 && next.leds[3] === 0) {
    push(
      "POWER",
      world === "earth"
        ? `Sunset (${next.dark}% dark). Turned off the fan.`
        : world === "mars"
          ? `Storm thickening (${next.dark}% dark). Turned off Comfort.`
          : `Light falling (${next.dark}% dark). Turned off Comfort.`,
    );
  }
  if (prev.leds[2] === 1 && next.leds[2] === 0) {
    push(
      "POWER",
      world === "earth"
        ? "Night. Exam room lights off unless needed."
        : world === "mars"
          ? "Dust storm. Turned off Science too."
          : "Lunar night. Turned off Science too.",
    );
  }
  if (prev.leds[2] === 0 && next.leds[2] === 1) {
    push(
      "POWER",
      world === "earth" ? "Brighter. Lights are back on." : "Light rising. Science is back on.",
    );
  }
  if (prev.leds[3] === 0 && next.leds[3] === 1 && next.leds.every((x) => x === 1)) {
    push(
      "POWER",
      world === "earth"
        ? "Daylight. All four systems are on."
        : world === "mars"
          ? "Storm cleared. All four systems are on."
          : "Sunlight is back. All four systems are on.",
    );
  }

  if (prev.alarm === 0 && next.alarm === 1) {
    const place = world === "earth" ? "Store room" : "Hab A";
    push(
      "ALERT",
      `${place} humidity ${next.hum}%, above the ${next.cut}% cutoff. The buzzer is sounding.`,
    );
  }
  if (prev.alarm === 1 && next.alarm === 0) {
    const place = world === "earth" ? "Store room" : world === "mars" ? "Hab" : "Hab A";
    push("OK", `${place} humidity is back under the cutoff.`);
  }

  return out;
}
