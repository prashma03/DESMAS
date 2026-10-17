import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { modeledDarknessFromTau } from "./darknessIndex";
import { buildMarsTauScenario, parseTauCsv, selectTauWindow } from "./marsTau";

const csv = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/msl-tau-880-storm-window.csv"), "utf8");

test("the storm-window Mastcam rows keep source text and skip the unobserved sol", () => {
  const extra = `${csv}2086ML0111130010801510C00_DXX7,2086.6387, 196.1, 7.673, 0.099\n`;
  const rows = parseTauCsv(extra);
  assert.equal(rows.length, 15);
  assert.equal(rows[0]?.solText, "2073.6050");
  assert.equal(rows[0]?.tauText, "0.626");
  assert.equal(rows[0]?.sigmaText, "0.029");
  assert.equal(rows[0]?.lsText, "188.3");
  const windowRows = selectTauWindow(rows, 2073, 2086);
  assert.equal(windowRows.length, 14);
  assert.equal(windowRows.some((row) => Math.floor(row.sol) === 2078), false);
  const scenario = buildMarsTauScenario(rows);
  assert.equal(scenario.samples.length, 14);
  assert.equal(scenario.tauRefText, "8.589");
  assert.equal(scenario.tableMaximumTauText, "8.589");
  assert.deepEqual(scenario.omittedIntegerSols, [2078]);
  assert.equal(scenario.formula, "clamp(100 * tau / tau_ref, 0, 100)");
  assert.equal(scenario.samples[0]?.modeledDark, modeledDarknessFromTau(0.626, 8.589));
  assert.deepEqual(scenario.samples[0]?.leds, [1, 1, 1, 1]);
  assert.deepEqual(scenario.samples[9]?.leds, [1, 1, 1, 0]);
  assert.equal(scenario.samples[9]?.solText, "2082.5918");
  assert.deepEqual(scenario.samples[11]?.leds, [1, 2, 0, 0]);
  assert.equal(scenario.samples[11]?.tauText, "7.325");
  assert.deepEqual(scenario.samples[12]?.leds, [1, 2, 0, 0]);
  assert.equal(scenario.samples[12]?.tauText, "7.136");
  assert.deepEqual(scenario.samples[13]?.leds, [1, 2, 0, 0]);
  assert.equal(scenario.samples[13]?.modeledDark, 100);
});

test("a Mastcam row that is not five numeric fields is rejected", () => {
  assert.throws(() => parseTauCsv("PID, sol, ls, tau\n"), /5 fields/);
  assert.throws(() => parseTauCsv("PID, 1, 2, -999, 0.1\n".replace("-999", "missing")), /Tau/);
});
