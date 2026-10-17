import { stepShed, type ShedLeds } from "./shedModel";

/** Modeled darkness from a light-like series. I is irradiance, I0 is the reference from that same series. */
export const DARKNESS_FORMULA = "clamp(100 * (1 - I / I0), 0, 100)";

/** I0 is the highest finite observation in the replay window. Fill values are not observations. */
export const I0_RULE = "I0 is the maximum finite irradiance in this series, excluding the API fill value.";

/** Firmware boot state in hardware/desmas.ino. The replay steps forward from here. */
export const SHED_BOOT: ShedLeds = [1, 1, 1, 1];

export function referenceMaximum(values: readonly (number | null)[]): number | null {
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    if (value > max) max = value;
  }
  if (!Number.isFinite(max) || max <= 0) return null;
  return max;
}

export function referenceIrradiance(values: readonly (number | null)[]): number | null {
  return referenceMaximum(values);
}

/** Modeled darkness from optical depth. Higher tau is darker. tau_ref is the maximum in the replay window. */
export const TAU_DARKNESS_FORMULA = "clamp(100 * tau / tau_ref, 0, 100)";

export const TAU_REF_RULE = "tau_ref is the maximum finite optical depth in this replay window.";

export function modeledDarknessFromTau(tau: number, tauRef: number): number {
  const raw = 100 * tau / tauRef;
  if (raw < 0) return 0;
  if (raw > 100) return 100;
  return raw;
}

export function modeledDarkness(irradiance: number, i0: number): number {
  const raw = 100 * (1 - irradiance / i0);
  if (raw < 0) return 0;
  if (raw > 100) return 100;
  return raw;
}

export type DarknessStep = {
  modeledDark: number | null;
  leds: ShedLeds | null;
};

/**
 * Steps the tested shed model through modeled darkness.
 * A null sample is a missing observation: it is not scored and does not change LED state.
 */
export function replayDarkness(samples: readonly (number | null)[]): { i0: number | null; hours: DarknessStep[] } {
  const i0 = referenceIrradiance(samples);
  let prev: ShedLeds = SHED_BOOT;
  const hours = samples.map((irradiance) => {
    if (irradiance === null || i0 === null) return { modeledDark: null, leds: null };
    const modeledDark = modeledDarkness(irradiance, i0);
    const leds = stepShed(prev, modeledDark);
    prev = leds;
    return { modeledDark, leds };
  });
  return { i0, hours };
}

/** Steps the shed model through optical depth. A null sample is missing and does not change LED state. */
export function replayOpticalDepth(samples: readonly (number | null)[]): { tauRef: number | null; hours: DarknessStep[] } {
  const tauRef = referenceMaximum(samples);
  let prev: ShedLeds = SHED_BOOT;
  const hours = samples.map((tau) => {
    if (tau === null || tauRef === null) return { modeledDark: null, leds: null };
    const modeledDark = modeledDarknessFromTau(tau, tauRef);
    const leds = stepShed(prev, modeledDark);
    prev = leds;
    return { modeledDark, leds };
  });
  return { tauRef, hours };
}
