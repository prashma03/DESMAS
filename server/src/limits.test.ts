import assert from "node:assert/strict";
import test from "node:test";
import { allowPaidRoute, resetLimits } from "./limits.js";

test("a caller cannot mint an unlimited number of realtime tokens", () => {
  resetLimits();
  const now = 1_000_000;
  for (let i = 0; i < 5; i += 1) assert.equal(allowPaidRoute("token", "203.0.113.8", now + i), true);
  assert.equal(allowPaidRoute("token", "203.0.113.8", now + 6), false);
  assert.equal(allowPaidRoute("token", "203.0.113.9", now + 6), true);
});

test("the shared hourly cap stops a burst from many addresses", () => {
  resetLimits();
  const now = 2_000_000;
  for (let i = 0; i < 30; i += 1) assert.equal(allowPaidRoute("token", `198.51.100.${i}`, now), true);
  assert.equal(allowPaidRoute("token", "198.51.100.200", now), false);
});
