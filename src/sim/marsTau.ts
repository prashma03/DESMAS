import { TAU_DARKNESS_FORMULA, TAU_REF_RULE, replayOpticalDepth } from "./darknessIndex";
import type { ShedLeds } from "./shedModel";

export const MARS_TAU_CSV_URL =
  "https://atmos.nmsu.edu/PDS/review/PDS4/msl_mmm_tau_bundle/data_derived/msl_tau_880.csv";

export const MARS_TAU_LABEL_URL =
  "https://atmos.nmsu.edu/PDS/review/PDS4/msl_mmm_tau_bundle/data_derived/msl_tau_880.xml";

/** Onset through the table maximum. Rows outside this slice are not part of the replay. */
export const MARS_TAU_WINDOW = { minSol: 2073, maxSolExclusive: 2086 } as const;

export type TauRow = {
  pid: string;
  solText: string;
  sol: number;
  lsText: string;
  ls: number;
  tauText: string;
  tau: number;
  sigmaText: string;
  sigma: number;
};

export type MarsTauSample = TauRow & {
  modeledDark: number | null;
  leds: ShedLeds | null;
};

export type MarsTauScenario = {
  kind: "msl-mastcam-tau-880";
  site: "Gale crater";
  instrument: "Curiosity Mastcam";
  parameter: "Tau";
  longname: "Optical depth at 880 nm";
  solDescription: "Decimal sols in true solar time";
  solUnit: "days";
  lsDescription: "Solar longitude";
  tauDescription: "Optical depth at 880 nm";
  processingLevel: "Derived";
  logicalIdentifier: "urn:nasa:pds:msl_mmm_tau:data_derived:msl_tau_880";
  doi: "https://doi.org/10.17189/fjh0-2978";
  sourceUrl: string;
  labelUrl: string;
  archiveStartUtc: "2012-09-08T23:17:00.000Z";
  archiveStopUtc: "2023-09-19T18:56:00.000Z";
  minSol: number;
  maxSolExclusive: number;
  tableMaximumTauText: string | null;
  tauRef: number | null;
  tauRefText: string | null;
  formula: string;
  tauRefRule: string;
  omittedIntegerSols: number[];
  samples: MarsTauSample[];
};

function numericField(raw: string, label: string, lineNumber: number): { text: string; value: number } {
  const text = raw.trim();
  if (!text || !/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
    throw new Error(`MSL tau line ${lineNumber} has a non-numeric ${label}`);
  }
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`MSL tau line ${lineNumber} has a non-finite ${label}`);
  return { text, value };
}

export function parseTauCsv(csv: string): TauRow[] {
  const rows: TauRow[] = [];
  const lines = csv.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim()) continue;
    const fields = line.split(",");
    if (fields.length !== 5) throw new Error(`MSL tau line ${index + 1} does not have 5 fields`);
    const pid = fields[0]?.trim() ?? "";
    if (!pid) throw new Error(`MSL tau line ${index + 1} has no product id`);
    const sol = numericField(fields[1] ?? "", "Sol", index + 1);
    const ls = numericField(fields[2] ?? "", "L_s", index + 1);
    const tau = numericField(fields[3] ?? "", "Tau", index + 1);
    const sigma = numericField(fields[4] ?? "", "Sigma", index + 1);
    rows.push({
      pid,
      solText: sol.text,
      sol: sol.value,
      lsText: ls.text,
      ls: ls.value,
      tauText: tau.text,
      tau: tau.value,
      sigmaText: sigma.text,
      sigma: sigma.value,
    });
  }
  if (rows.length === 0) throw new Error("MSL tau table has no rows");
  return rows;
}

export function selectTauWindow(rows: readonly TauRow[], minSol: number, maxSolExclusive: number): TauRow[] {
  return rows.filter((row) => row.sol >= minSol && row.sol < maxSolExclusive);
}

function omittedIntegerSols(rows: readonly TauRow[], minSol: number, maxSolExclusive: number): number[] {
  const present = new Set(rows.map((row) => Math.floor(row.sol)));
  const missing: number[] = [];
  for (let sol = Math.ceil(minSol); sol < maxSolExclusive; sol += 1) {
    if (!present.has(sol)) missing.push(sol);
  }
  return missing;
}

export function buildMarsTauScenario(rows: readonly TauRow[]): MarsTauScenario {
  if (rows.length === 0) throw new Error("MSL tau table has no rows");
  const windowRows = selectTauWindow(rows, MARS_TAU_WINDOW.minSol, MARS_TAU_WINDOW.maxSolExclusive);
  if (windowRows.length === 0) throw new Error("MSL tau window has no observations");
  const tableMax = rows.reduce((best, row) => (row.tau > best.tau ? row : best), rows[0]);
  const replay = replayOpticalDepth(windowRows.map((row) => row.tau));
  const refRow = replay.tauRef === null ? null : windowRows.find((row) => row.tau === replay.tauRef) ?? null;
  return {
    kind: "msl-mastcam-tau-880",
    site: "Gale crater",
    instrument: "Curiosity Mastcam",
    parameter: "Tau",
    longname: "Optical depth at 880 nm",
    solDescription: "Decimal sols in true solar time",
    solUnit: "days",
    lsDescription: "Solar longitude",
    tauDescription: "Optical depth at 880 nm",
    processingLevel: "Derived",
    logicalIdentifier: "urn:nasa:pds:msl_mmm_tau:data_derived:msl_tau_880",
    doi: "https://doi.org/10.17189/fjh0-2978",
    sourceUrl: MARS_TAU_CSV_URL,
    labelUrl: MARS_TAU_LABEL_URL,
    archiveStartUtc: "2012-09-08T23:17:00.000Z",
    archiveStopUtc: "2023-09-19T18:56:00.000Z",
    minSol: MARS_TAU_WINDOW.minSol,
    maxSolExclusive: MARS_TAU_WINDOW.maxSolExclusive,
    tableMaximumTauText: tableMax?.tauText ?? null,
    tauRef: replay.tauRef,
    tauRefText: refRow?.tauText ?? null,
    formula: TAU_DARKNESS_FORMULA,
    tauRefRule: TAU_REF_RULE,
    omittedIntegerSols: omittedIntegerSols(windowRows, MARS_TAU_WINDOW.minSol, MARS_TAU_WINDOW.maxSolExclusive),
    samples: windowRows.map((row, index) => ({
      ...row,
      modeledDark: replay.hours[index]?.modeledDark ?? null,
      leds: replay.hours[index]?.leds ?? null,
    })),
  };
}

function isLeds(value: unknown): value is ShedLeds {
  return Array.isArray(value) && value.length === 4 && value.every((code) => code === 0 || code === 1 || code === 2);
}

export function isMarsTauScenario(value: unknown): value is MarsTauScenario {
  if (!value || typeof value !== "object") return false;
  const scenario = value as MarsTauScenario;
  if (scenario.kind !== "msl-mastcam-tau-880" || scenario.parameter !== "Tau") return false;
  if (typeof scenario.formula !== "string" || !scenario.formula) return false;
  if (scenario.tauRef !== null && (typeof scenario.tauRef !== "number" || scenario.tauRef <= 0)) return false;
  if (!Array.isArray(scenario.samples) || scenario.samples.length === 0) return false;
  return scenario.samples.every((sample) => {
    if (typeof sample.solText !== "string" || typeof sample.tauText !== "string") return false;
    if (typeof sample.tau !== "number" || !Number.isFinite(sample.tau)) return false;
    if (scenario.tauRef === null) return sample.modeledDark === null && sample.leds === null;
    return typeof sample.modeledDark === "number" && Number.isFinite(sample.modeledDark) && isLeds(sample.leds);
  });
}
