import assert from "node:assert/strict";
import test from "node:test";
import { scoreShedStream, stepShed } from "./shedModel";

const on = [1, 1, 1, 1] as const;

test("P4 turns off at 30 and stays on at 29", () => {
  assert.deepEqual(stepShed(on, 29), [1, 1, 1, 1]);
  assert.deepEqual(stepShed(on, 30), [1, 1, 1, 0]);
});

test("P4 holds inside the gap and restores at 26", () => {
  const off = [1, 1, 1, 0] as const;
  assert.deepEqual(stepShed(off, 27), [1, 1, 1, 0]);
  assert.deepEqual(stepShed(on, 27), [1, 1, 1, 1]);
  assert.deepEqual(stepShed(off, 26), [1, 1, 1, 1]);
  assert.deepEqual(stepShed(off, 25), [1, 1, 1, 1]);
});

test("P3 turns off at 55, holds at 52, and restores at 51", () => {
  assert.deepEqual(stepShed(on, 54)[2], 1);
  assert.deepEqual(stepShed(on, 55), [1, 1, 0, 0]);
  const shed = [1, 1, 0, 0] as const;
  assert.deepEqual(stepShed(shed, 52), [1, 1, 0, 0]);
  assert.deepEqual(stepShed(shed, 51), [1, 1, 1, 0]);
});

test("P2 blinks at 85, holds the blink, and returns to solid at 81", () => {
  assert.deepEqual(stepShed(on, 84), [1, 1, 0, 0]);
  assert.deepEqual(stepShed(on, 85), [1, 2, 0, 0]);
  const blink = [1, 2, 0, 0] as const;
  assert.deepEqual(stepShed(blink, 82), [1, 2, 0, 0]);
  assert.deepEqual(stepShed(blink, 81), [1, 1, 0, 0]);
});

test("a stored P2 value of 0 is the on side of the comms rule", () => {
  assert.deepEqual(stepShed([1, 0, 1, 1], 84)[1], 1);
  assert.deepEqual(stepShed([1, 0, 1, 1], 85)[1], 2);
});

test("P1 stays on at full darkness", () => {
  assert.equal(stepShed([1, 2, 0, 0], 100)[0], 1);
  assert.deepEqual(stepShed([0, 2, 0, 0], 100), [1, 2, 0, 0]);
});

test("the first live sample synchronizes and is not scored", () => {
  const score = scoreShedStream([{ dark: 27, leds: [1, 1, 1, 0] }]);
  assert.equal(score.synced, true);
  assert.equal(score.scoredSamples, 0);
  assert.equal(score.scoredChannels, 0);
  assert.equal(score.predicted, null);
  assert.deepEqual(score.observed, [1, 1, 1, 0]);
});

test("an empty stream is not synchronized", () => {
  const score = scoreShedStream([]);
  assert.equal(score.synced, false);
  assert.equal(score.scoredSamples, 0);
});

test("a hysteresis-band mismatch is counted", () => {
  const score = scoreShedStream([
    { dark: 40, leds: [1, 1, 1, 0] },
    { dark: 27, leds: [1, 1, 1, 1] },
  ]);
  assert.equal(score.scoredSamples, 1);
  assert.equal(score.matchedSamples, 0);
  assert.equal(score.matchedChannels, 3);
  assert.equal(score.scoredChannels, 4);
  assert.deepEqual(score.predicted, [1, 1, 1, 0]);
});

test("a matching restore is a full sample match", () => {
  const score = scoreShedStream([
    { dark: 40, leds: [1, 1, 1, 0] },
    { dark: 26, leds: [1, 1, 1, 1] },
    { dark: 85, leds: [1, 2, 0, 0] },
  ]);
  assert.equal(score.scoredSamples, 2);
  assert.equal(score.matchedSamples, 2);
  assert.equal(score.matchedChannels, 8);
  assert.deepEqual(score.predicted, [1, 2, 0, 0]);
});
