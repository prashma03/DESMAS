const AU_KM = 149597870.7;
const C_KM_S = 299792.458;
const CACHE_MS = 15 * 60 * 1000;

export type MarsDelay = {
  au: number;
  oneWaySeconds: number;
  oneWayMin: number;
  roundTripMin: number;
  closing: boolean;
  source: "horizons" | "fallback";
  note: string;
};

/** Saved geocentric range from the 15 Oct 2026 Horizons check: 1.558 AU, 12.96 min, closing. */
export const FALLBACK_MARS: MarsDelay = {
  au: 1.558,
  oneWaySeconds: 12.96 * 60,
  oneWayMin: 12.96,
  roundTripMin: 25.92,
  closing: true,
  source: "fallback",
  note: "NASA JPL Horizons, 15 Oct 2026. Live query failed, so this is the saved range.",
};

let cache: { at: number; value: MarsDelay } | null = null;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseRange(result: string): { au: number; when: string; deldot: number; lightMin: number | null } | null {
  const block = result.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!block) return null;
  const line = block
    .split("\n")
    .map((row) => row.trim())
    .find((row) => /^\d{4}-/.test(row));
  if (!line) return null;
  const parts = line.split(/\s+/);
  const nums = parts.map(Number).filter((n) => Number.isFinite(n));
  const au = nums[0];
  const deldot = nums[1] ?? 0;
  const lightMin = nums[2];
  if (!Number.isFinite(au) || au < 0.3 || au > 3) return null;
  return {
    au,
    when: parts[0] ?? "",
    deldot,
    lightMin: Number.isFinite(lightMin) && lightMin > 2 && lightMin < 25 ? lightMin : null,
  };
}

async function fetchLive(): Promise<MarsDelay | null> {
  const start = new Date();
  const stop = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    format: "json",
    COMMAND: "'499'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    START_TIME: `'${isoDay(start)}'`,
    STOP_TIME: `'${isoDay(stop)}'`,
    STEP_SIZE: "'1 h'",
    QUANTITIES: "'20,21'",
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`, {
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string };
    if (!data.result) return null;
    const parsed = parseRange(data.result);
    if (!parsed) return null;
    const au = Math.round(parsed.au * 1000) / 1000;
    const oneWayMin = Math.round((parsed.lightMin ?? (parsed.au * AU_KM) / C_KM_S / 60) * 100) / 100;
    const roundTripMin = Math.round(oneWayMin * 200) / 100;
    const closing = parsed.deldot < 0;
    return {
      au,
      oneWaySeconds: oneWayMin * 60,
      oneWayMin,
      roundTripMin,
      closing,
      source: "horizons",
      note: `NASA JPL Horizons geocentric range to Mars on ${parsed.when}. One-way light time is ${oneWayMin.toFixed(2)} min (${roundTripMin.toFixed(2)} min round trip). Mars is ${closing ? "getting closer" : "moving away"}.`,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function marsDelay(): Promise<MarsDelay> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const live = await fetchLive();
  if (!live) return FALLBACK_MARS;
  cache = { at: Date.now(), value: live };
  return live;
}
