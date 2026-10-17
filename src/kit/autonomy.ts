import type { KitReading } from "./types";

/** Minutes. One-way and round-trip stay separate; round trip is what Earth needs to answer. */
export type LinkMinutes = { oneWayMin: number; roundTripMin: number; au?: number };

export type DecisionMode = "local-first" | "earth-guided";
export type IncidentUrgency = "critical" | "urgent" | "routine";

export type AutonomyStatus = {
  mode: DecisionMode;
  urgency: IncidentUrgency;
  oneWayMin: number;
  roundTripMin: number;
  responseWindowMin: number;
  linkSource: "horizons" | "radio" | "onsite" | "worst-case";
  /** Safety LEDs stay on the Arduino. This flag is always false. */
  grokMaySwitchHardware: false;
  summary: string;
  recommendation: string;
};

/** Moon one-way radio time already shown in the Moon page. */
const MOON_ONE_WAY_SEC = 1.3;
/** Urgent crew choices (shed loads, not life safety) can wait this long for advice. */
const URGENT_WINDOW_MIN = 5;
/** Routine status can wait out a normal Mars round trip. */
const ROUTINE_WINDOW_MIN = 60;
/** Existing UI bound when today's Horizons range has not arrived. */
const MARS_WORST_ONE_WAY_MIN = 22;
const MARS_WORST_ROUND_TRIP_MIN = 44;

let publishedMars: LinkMinutes | null = null;

export function publishMarsDelay(delay: LinkMinutes | null) {
  publishedMars = delay;
}

export function publishedMarsDelay(): LinkMinutes | null {
  return publishedMars;
}

function formatDelay(min: number) {
  if (min <= 0) return "0 s";
  if (min < 1) {
    const seconds = Math.round(min * 60 * 10) / 10;
    return `${seconds} s`;
  }
  return `${min.toFixed(1)} min`;
}

function urgencyOf(reading: KitReading): IncidentUrgency {
  if (reading.alarm === 1 || reading.leds[0] === 0) return "critical";
  if (reading.leds[3] === 0 || reading.leds[2] === 0 || reading.leds[1] === 2) return "urgent";
  return "routine";
}

function linkFor(world: "earth" | "moon" | "mars", mars: LinkMinutes | null) {
  if (world === "earth") {
    return { oneWayMin: 0, roundTripMin: 0, linkSource: "onsite" as const };
  }
  if (world === "moon") {
    const oneWayMin = MOON_ONE_WAY_SEC / 60;
    return { oneWayMin, roundTripMin: oneWayMin * 2, linkSource: "radio" as const };
  }
  if (mars && Number.isFinite(mars.oneWayMin) && Number.isFinite(mars.roundTripMin)) {
    return { oneWayMin: mars.oneWayMin, roundTripMin: mars.roundTripMin, linkSource: "horizons" as const };
  }
  return {
    oneWayMin: MARS_WORST_ONE_WAY_MIN,
    roundTripMin: MARS_WORST_ROUND_TRIP_MIN,
    linkSource: "worst-case" as const,
  };
}

/**
 * Decision support only. The Arduino still switches P1–P4.
 * Safety-critical incidents are local-first even when the round trip is a few seconds.
 */
export function communicationAutonomy(input: {
  world: "earth" | "moon" | "mars";
  reading: KitReading;
  mars?: LinkMinutes | null;
}): AutonomyStatus {
  const urgency = urgencyOf(input.reading);
  const link = linkFor(input.world, input.mars ?? (input.world === "mars" ? publishedMars : null));
  const responseWindowMin = urgency === "critical" ? 0 : urgency === "urgent" ? URGENT_WINDOW_MIN : ROUTINE_WINDOW_MIN;
  const mode: DecisionMode =
    urgency === "critical" || link.roundTripMin > responseWindowMin ? "local-first" : "earth-guided";
  const one = formatDelay(link.oneWayMin);
  const round = formatDelay(link.roundTripMin);
  const linkText =
    link.linkSource === "horizons"
      ? `Horizons light time is ${one} one way and ${round} round trip`
      : link.linkSource === "radio"
        ? `Radio light time is ${one} one way and ${round} round trip`
        : link.linkSource === "onsite"
          ? "This clinic is on Earth, so there is no light-time delay"
          : `Today's Horizons range is not in yet. Worst case is ${one} one way and ${round} round trip`;

  const summary =
    urgency === "critical"
      ? `Local-first. ${linkText}. A humidity alarm or life-support fault cannot wait for Earth, even when the delay is short.`
      : mode === "local-first"
        ? `Local-first. ${linkText}. That round trip is longer than the ${responseWindowMin} min response window.`
        : `Earth-guided. ${linkText}. That round trip fits inside the ${responseWindowMin} min window, so Earth can advise this non-critical choice.`;

  const recommendation =
    mode === "local-first"
      ? "Use onboard troubleshooting now. The Arduino already owns P1–P4. Grok cannot switch them."
      : "Earth can be consulted for this non-critical choice. Safety hardware still does not wait, and Grok cannot switch P1–P4.";

  return {
    mode,
    urgency,
    oneWayMin: link.oneWayMin,
    roundTripMin: link.roundTripMin,
    responseWindowMin,
    linkSource: link.linkSource,
    grokMaySwitchHardware: false,
    summary,
    recommendation,
  };
}
