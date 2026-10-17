import assert from "node:assert/strict";
import test from "node:test";
import {
  DARKNESS_FORMULA,
  TAU_DARKNESS_FORMULA,
  modeledDarkness,
  modeledDarknessFromTau,
  referenceIrradiance,
  replayDarkness,
  replayOpticalDepth,
} from "./darknessIndex";

test("I0 is the maximum finite irradiance and fill placeholders are excluded", () => {
  assert.equal(referenceIrradiance([null, 0, 12.5, 90.22, null]), 90.22);
  assert.equal(referenceIrradiance([0, 0, null]), null);
  assert.equal(referenceIrradiance([]), null);
});

test("modeled darkness uses the published formula and clamps", () => {
  assert.equal(DARKNESS_FORMULA, "clamp(100 * (1 - I / I0), 0, 100)");
  assert.equal(modeledDarkness(903.47, 903.47), 0);
  assert.equal(modeledDarkness(0, 903.47), 100);
  assert.equal(modeledDarkness(5.9, 903.47), 100 * (1 - 5.9 / 903.47));
  assert.equal(modeledDarkness(1000, 903.47), 0);
  assert.equal(modeledDarkness(-5, 100), 100);
});

test("a missing sample does not invent darkness or move the shed state", () => {
  const replay = replayDarkness([100, null, 73]);
  assert.equal(replay.i0, 100);
  assert.equal(replay.hours[0].modeledDark, 0);
  assert.deepEqual(replay.hours[0].leds, [1, 1, 1, 1]);
  assert.equal(replay.hours[1].modeledDark, null);
  assert.equal(replay.hours[1].leds, null);
  assert.equal(replay.hours[2].modeledDark, 27);
  assert.deepEqual(replay.hours[2].leds, [1, 1, 1, 1]);
});

test("optical depth uses tau over tau_ref and keeps a missing sample from moving LEDs", () => {
  assert.equal(TAU_DARKNESS_FORMULA, "clamp(100 * tau / tau_ref, 0, 100)");
  assert.equal(modeledDarknessFromTau(8.589, 8.589), 100);
  assert.equal(modeledDarknessFromTau(0.626, 8.589), (100 * 0.626) / 8.589);
  const replay = replayOpticalDepth([0.626, null, 8.589]);
  assert.equal(replay.tauRef, 8.589);
  assert.equal(replay.hours[1].leds, null);
  assert.deepEqual(replay.hours[0].leds, [1, 1, 1, 1]);
  assert.deepEqual(replay.hours[2].leds, [1, 2, 0, 0]);
});

test("P4 holds inside the gap and restores on the next modeled hour", () => {
  const replay = replayDarkness([100, 0, 73, 74]);
  assert.equal(replay.i0, 100);
  assert.deepEqual(replay.hours[1].leds, [1, 2, 0, 0]);
  assert.equal(replay.hours[2].modeledDark, 27);
  assert.deepEqual(replay.hours[2].leds, [1, 1, 1, 0]);
  assert.equal(replay.hours[3].modeledDark, 26);
  assert.deepEqual(replay.hours[3].leds, [1, 1, 1, 1]);
});
