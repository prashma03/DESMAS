/**
 * Power-shed model copied from hardware/desmas.ino rule().
 * P1 stays on. P4 and P3 use 0/1. P2 uses 2 for blink and never turns fully off.
 * Shed at dark >= limit. Restore at dark <= limit - 4. Otherwise hold.
 */
export const SHED_COMFORT = 30;
export const SHED_SCIENCE = 55;
export const COMMS_LOW = 85;
export const GAP = 4;

export type ShedLeds = [number, number, number, number];

/** 1 = on, 0 = off. The gap returns the previous code unchanged. */
export function shedRule(current: number, dark: number, limit: number): number {
  if (dark >= limit) return 0;
  if (dark <= limit - GAP) return 1;
  return current;
}

export function stepShed(prev: readonly number[], dark: number): ShedLeds {
  const p2 = shedRule(prev[1] === 2 ? 0 : 1, dark, COMMS_LOW) === 1 ? 1 : 2;
  const p3 = shedRule(prev[2] ?? 1, dark, SHED_SCIENCE);
  const p4 = shedRule(prev[3] ?? 1, dark, SHED_COMFORT);
  return [1, p2, p3, p4];
}

export type ShedSample = { dark: number; leds: readonly number[] };

export type ShedScore = {
  synced: boolean;
  observed: ShedLeds | null;
  predicted: ShedLeds | null;
  scoredSamples: number;
  matchedSamples: number;
  scoredChannels: number;
  matchedChannels: number;
};

function quad(leds: readonly number[]): ShedLeds {
  return [leds[0] ?? 0, leds[1] ?? 0, leds[2] ?? 0, leds[3] ?? 0];
}

/**
 * The first sample sets the model state and is not scored.
 * Each later sample is predicted from the previous observed LEDs and that sample's darkness.
 * A mismatch inside a hysteresis gap still counts.
 */
export function scoreShedStream(readings: readonly ShedSample[]): ShedScore {
  if (readings.length === 0) {
    return {
      synced: false,
      observed: null,
      predicted: null,
      scoredSamples: 0,
      matchedSamples: 0,
      scoredChannels: 0,
      matchedChannels: 0,
    };
  }
  let matchedSamples = 0;
  let matchedChannels = 0;
  let predicted: ShedLeds | null = null;
  for (let i = 1; i < readings.length; i += 1) {
    const next = stepShed(readings[i - 1].leds, readings[i].dark);
    predicted = next;
    const observed = quad(readings[i].leds);
    let channels = 0;
    for (let c = 0; c < 4; c += 1) if (next[c] === observed[c]) channels += 1;
    matchedChannels += channels;
    if (channels === 4) matchedSamples += 1;
  }
  const scoredSamples = readings.length - 1;
  return {
    synced: true,
    observed: quad(readings[readings.length - 1].leds),
    predicted,
    scoredSamples,
    matchedSamples,
    scoredChannels: scoredSamples * 4,
    matchedChannels,
  };
}
