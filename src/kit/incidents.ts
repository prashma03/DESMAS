/**
 * Bounded incident intelligence from observed Arduino JSON.
 * Facts = LED/sensor edges. Causes = labeled inferences from published policy.
 * Exact firmware hysteresis offsets are not in serial JSON and are not invented.
 */
import type { KitReading } from "./types";

type IncidentSource = "LIVE ARDUINO" | "SIMULATED";
type Severity = "critical" | "warn" | "ok" | "info";

export type IncidentEvent = {
  id: number;
  at: number;
  iso: string;
  source: IncidentSource;
  event: string;
  title: string;
  severity: Severity;
  systems: string[];
  observed: Record<string, unknown>;
  inferred: Record<string, unknown>;
};

export const MAX_READINGS = 180;
export const MAX_EVENTS = 48;
export const P2_BLINK_DARK = 80;

export const AUTONOMOUS_POLICY = {
  controller: "Arduino Mega firmware (autonomous). Grok explains only; never commands LEDs.",
  p1: "Life support / vaccine fridge is never shed.",
  p4: "Comfort / fan sheds (OFF) at >= 30% darkness.",
  p3: "Science / clinic lights shed (OFF) at >= 55% darkness.",
  p2: "Comms / radio enters low-power BLINKING at >= 85% darkness.",
  hysteresis:
    "Firmware uses hysteresis, so restore can occur below the trip darkness. Restore offsets are not in the serial stream; only observed LED edges and darkness at those times are facts.",
  not_measured: ["battery_percent", "energy_saved", "component_failure", "sunrise_time"],
};

const SYSTEMS = ["P1", "P2", "P3", "P4"];

function ledLabel(n: number) {
  if (n === 2) return "BLINKING";
  if (n === 1) return "ON";
  return "OFF";
}

export function observedContext(reading: KitReading) {
  const dhtOk = reading.dht === 1;
  return {
    darkness: reading.dark,
    light: reading.light,
    lbase: reading.lbase,
    humidity: dhtOk ? reading.hum : null,
    temperature: dhtOk ? reading.temp : null,
    cutoff: reading.cut,
    dhtOk,
    alarm: dhtOk && reading.alarm === 1,
    muted: reading.muted === 1,
    leds: {
      P1: ledLabel(reading.leds[0]),
      P2: ledLabel(reading.leds[1]),
      P3: ledLabel(reading.leds[2]),
      P4: ledLabel(reading.leds[3]),
    },
    led_codes: reading.leds.slice(),
  };
}

function inferShed(system: string, tripPct: number, dark: number | null) {
  const atTrip = typeof dark === "number" && dark >= tripPct;
  return {
    cause: atTrip
      ? `Matches published policy: ${system} sheds at >= ${tripPct}% darkness. Observed darkness ${dark}%.`
      : `Observed ${system} OFF at darkness ${dark}%. Policy trip is ${tripPct}%; firmware hysteresis or another firmware rule may apply. Do not invent battery or hardware-fault causes.`,
    policy_trip_darkness_pct: tripPct,
    hysteresis_note: AUTONOMOUS_POLICY.hysteresis,
    not_measured: AUTONOMOUS_POLICY.not_measured,
  };
}

function inferRestore(system: string, tripPct: number, dark: number | null) {
  return {
    cause: `Observed ${system} ON again at darkness ${dark}%. Policy sheds ${system} at >= ${tripPct}%. Restore may be hysteresis (not measured in JSON).`,
    policy_trip_darkness_pct: tripPct,
    hysteresis_note: AUTONOMOUS_POLICY.hysteresis,
    not_measured: AUTONOMOUS_POLICY.not_measured,
  };
}

function makeEvent(
  id: number,
  at: number,
  source: IncidentSource,
  type: string,
  severity: Severity,
  systems: string[],
  observed: Record<string, unknown>,
  inferred: Record<string, unknown>,
  title: string,
): IncidentEvent {
  return {
    id,
    at,
    iso: new Date(at).toISOString(),
    source,
    event: type,
    title,
    severity,
    systems,
    observed,
    inferred,
  };
}

export function crewChecklist(events: IncidentEvent[], nowReading: KitReading | null) {
  const steps = [];
  const types = new Set(events.map((e) => e.event));
  const p1Off = nowReading && nowReading.leds[0] === 0;
  if (p1Off) {
    steps.push("P1 (life support / vaccine fridge) is observed OFF — that is not explained by the 30/55/85% shed policy. Check the green LED on the Mega. Do not assume battery state.");
  } else {
    steps.push("Confirm P1 remains ON (policy: never shed). Observed LED is the fact; Grok cannot switch it.");
  }
  if (types.has("P4_COMFORT_SHUTDOWN") && !types.has("P4_COMFORT_RECOVERY")) {
    steps.push("P4 comfort/fan was observed OFF. Uncover the photoresistor (or wait for light). Do not claim energy savings.");
  }
  if (types.has("P3_SCIENCE_SHUTDOWN") && !types.has("P3_SCIENCE_RECOVERY")) {
    steps.push("P3 science/lights was observed OFF (policy trip 55% darkness). Same light-sensor action as P4.");
  }
  if (types.has("P2_COMMS_LOW_POWER") && !types.has("P2_COMMS_RECOVERY")) {
    steps.push("P2 comms is in observed low-power/BLINKING (policy trip 85%). Treat as degraded link, not a measured radio failure.");
  }
  if (types.has("HUMIDITY_ALARM_ON") && !types.has("HUMIDITY_ALARM_OFF")) {
    steps.push("Humidity alarm observed ON with a valid DHT reading vs cutoff. Ventilate the sensor; optional firmware mute is 'm'. Do not diagnose a failed fridge from humidity alone.");
  }
  if (types.has("DHT_INVALID") && !types.has("DHT_RECOVERY")) {
    steps.push("DHT11 is invalid/stale. Do not quote humidity or temperature until DHT recovers.");
  }
  if (types.has("SERIAL_STALE") || types.has("SERIAL_DISCONNECT")) {
    steps.push("Serial went silent or disconnected. Numbers after that are not live until the Mega streams again.");
  }
  if (!steps.length) {
    steps.push("No shedding or alarm edges in this window. Quote only the latest observed darkness/LEDs.");
  }
  steps.push("Never report battery %, watt-hours saved, or component failure unless a sensor actually measured it (none of those fields exist on the wire).");
  return steps;
}

export class IncidentLog {
  readings: { at: number; source: IncidentSource; reading: KitReading }[] = [];
  events: IncidentEvent[] = [];
  prev: KitReading | null = null;
  nextId = 1;
  p2LowPower = false;
  p2OnStreak = 0;
  staleLogged = false;

  _pushEvent(evt: IncidentEvent) {
    this.events.push(evt);
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }

  pushReading(reading: KitReading, wallMs: number, source: IncidentSource) {
    const rec = { at: wallMs, source, reading };
    this.readings.push(rec);
    if (this.readings.length > MAX_READINGS) this.readings.splice(0, this.readings.length - MAX_READINGS);

    const prev = this.prev;
    this.prev = reading;
    if (!prev) return [];

    const added: IncidentEvent[] = [];
    const obs = observedContext(reading);
    const dark = reading.dark;
    const emit = (
      type: string,
      severity: Severity,
      systems: string[],
      inferred: Record<string, unknown>,
      title: string,
    ) => {
      const evt = makeEvent(this.nextId, wallMs, source, type, severity, systems, obs, inferred, title);
      this.nextId += 1;
      this._pushEvent(evt);
      added.push(evt);
    };

    if (prev.leds[0] === 1 && reading.leds[0] === 0) {
      emit(
        "P1_UNEXPECTED_OFF",
        "critical",
        ["P1"],
        {
          cause: "Observed P1 OFF. Published policy never sheds P1. Cause is not in the JSON.",
          not_measured: AUTONOMOUS_POLICY.not_measured,
        },
        "P1 life support LED went OFF (not explained by shed policy)",
      );
    }
    if (prev.leds[0] === 0 && reading.leds[0] === 1) {
      emit(
        "P1_RECOVERY",
        "ok",
        ["P1"],
        { cause: "Observed P1 ON again.", not_measured: AUTONOMOUS_POLICY.not_measured },
        "P1 life support LED is ON again",
      );
    }

    if (prev.leds[3] === 1 && reading.leds[3] === 0) {
      emit(
        "P4_COMFORT_SHUTDOWN",
        "warn",
        ["P4"],
        inferShed("P4", 30, dark),
        "P4 comfort/fan shed (observed OFF)",
      );
    }
    if (prev.leds[3] === 0 && reading.leds[3] === 1) {
      emit(
        "P4_COMFORT_RECOVERY",
        "ok",
        ["P4"],
        inferRestore("P4", 30, dark),
        "P4 comfort/fan recovered (observed ON)",
      );
    }

    if (prev.leds[2] === 1 && reading.leds[2] === 0) {
      emit(
        "P3_SCIENCE_SHUTDOWN",
        "warn",
        ["P3"],
        inferShed("P3", 55, dark),
        "P3 science/lights shed (observed OFF)",
      );
    }
    if (prev.leds[2] === 0 && reading.leds[2] === 1) {
      emit(
        "P3_SCIENCE_RECOVERY",
        "ok",
        ["P3"],
        inferRestore("P3", 55, dark),
        "P3 science/lights recovered (observed ON)",
      );
    }

    const p2 = reading.leds[1];
    const p2Prev = prev.leds[1];
    if (!this.p2LowPower) {
      const enterBlink = p2 === 2 || (p2Prev === 1 && p2 === 0 && typeof dark === "number" && dark >= P2_BLINK_DARK);
      if (enterBlink) {
        this.p2LowPower = true;
        this.p2OnStreak = 0;
        emit(
          "P2_COMMS_LOW_POWER",
          "warn",
          ["P2"],
          inferShed("P2", 85, dark),
          "P2 comms entered low-power / blinking (observed)",
        );
      } else if (p2Prev === 1 && p2 === 0) {
        emit(
          "P2_COMMS_OFF",
          "warn",
          ["P2"],
          {
            cause: `Observed P2 OFF at darkness ${dark}%, below the 85% blink policy. Do not invent a radio failure.`,
            not_measured: AUTONOMOUS_POLICY.not_measured,
          },
          "P2 comms LED observed OFF (not at 85% blink trip)",
        );
      }
    } else if (p2 === 1) {
      this.p2OnStreak += 1;
      if (this.p2OnStreak >= 2) {
        this.p2LowPower = false;
        this.p2OnStreak = 0;
        emit(
          "P2_COMMS_RECOVERY",
          "ok",
          ["P2"],
          inferRestore("P2", 85, dark),
          "P2 comms recovered from low-power (observed steady ON)",
        );
      }
    } else {
      this.p2OnStreak = 0;
    }

    if (prev.dht === 1 && reading.dht === 0) {
      emit(
        "DHT_INVALID",
        "warn",
        [],
        {
          cause: "Observed dht:0. Humidity and temperature on this line are invalid/stale.",
          not_measured: AUTONOMOUS_POLICY.not_measured,
        },
        "DHT11 invalid/stale",
      );
    }
    if (prev.dht === 0 && reading.dht === 1) {
      emit(
        "DHT_RECOVERY",
        "ok",
        [],
        { cause: "Observed dht:1 again. Climate numbers are valid only from this point.", not_measured: AUTONOMOUS_POLICY.not_measured },
        "DHT11 reporting again",
      );
    }

    const dhtOk = prev.dht === 1 && reading.dht === 1;
    if (dhtOk && prev.alarm === 0 && reading.alarm === 1) {
      emit(
        "HUMIDITY_ALARM_ON",
        "critical",
        [],
        {
          cause: `Observed alarm with humidity ${reading.hum} vs cutoff ${reading.cut}. Firmware drives the buzzer; Grok does not.`,
          not_measured: AUTONOMOUS_POLICY.not_measured,
        },
        "Humidity alarm ON (valid DHT)",
      );
    }
    if (dhtOk && prev.alarm === 1 && reading.alarm === 0) {
      emit(
        "HUMIDITY_ALARM_OFF",
        "ok",
        [],
        { cause: "Observed alarm clear while DHT still valid.", not_measured: AUTONOMOUS_POLICY.not_measured },
        "Humidity alarm OFF",
      );
    }

    this.staleLogged = false;
    return added;
  }

  markSerialGap(wallMs: number, source: IncidentSource, type: string, title: string) {
    if (type === "SERIAL_STALE" && this.staleLogged) return null;
    if (type === "SERIAL_STALE") this.staleLogged = true;
    const reading = this.prev;
    const evt = makeEvent(
      this.nextId,
      wallMs,
      source,
      type,
      "warn",
      [],
      reading ? observedContext(reading) : { note: "No reading yet" },
      {
        cause: "Serial stream gap or disconnect. Later SIMULATED snapshots are not live incidents.",
        not_measured: AUTONOMOUS_POLICY.not_measured,
      },
      title,
    );
    this.nextId += 1;
    this._pushEvent(evt);
    return evt;
  }

  getHistory(windowSeconds: number = 60) {
    const win = Math.min(180, Math.max(5, Number(windowSeconds) || 60)) * 1000;
    const now = Date.now();
    const events = this.events.filter((e) => now - e.at <= win).slice().reverse();
    const readings = this.readings.filter((r) => now - r.at <= win);
    const live = events.some((e) => e.source === "LIVE ARDUINO") || readings.some((r) => r.source === "LIVE ARDUINO");
    const source = live ? "LIVE ARDUINO" : "SIMULATED";
    const latest = this.prev;
    return {
      source,
      source_note: live
        ? "LIVE Arduino incident window. Do not call this simulated."
        : "SIMULATED — no live Arduino incident history. Do not invent events or present this as a real shedding incident.",
      window_seconds: win / 1000,
      policy: AUTONOMOUS_POLICY,
      event_count: events.length,
      reading_count: readings.length,
      events,
      checklist: crewChecklist(events, latest),
      grok_must: live
        ? "Use observed facts (LED edges, darkness, DHT). Label inferences as policy matches, not measured battery or faults. You do not control LEDs."
        : "Say SIMULATED. There is no live incident timeline. Do not narrate a fake power-shedding event.",
    };
  }
}

export { SYSTEMS, ledLabel };
