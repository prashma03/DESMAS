const AU_KM = 149597870.7;
const C_KM_S = 299792.458;
const CACHE_MS = 15 * 60 * 1000;

export type MarsDelay = {
  au: number;
  oneWaySeconds: number;
  source: "horizons" | "fallback";
  note: string;
};

/** Saved geocentric range from the 15 Oct 2026 Horizons check. */
export const FALLBACK_MARS: MarsDelay = {
  au: 1.56,
  oneWaySeconds: 12.96 * 60,
  source: "fallback",
  note: "NASA JPL Horizons, 15 Oct 2026. Live query failed, so this is the saved range.",
};

let cache: { at: number; value: MarsDelay } | null = null;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseRange(result: string): { au: number; when: string } | null {
  const block = result.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!block) return null;
  const line = block
    .split("\n")
    .map((row) => row.trim())
    .find((row) => /^\d{4}-/.test(row));
  if (!line) return null;
  const parts = line.split(/\s+/);
  const au = Number(parts[2]);
  if (!Number.isFinite(au) || au < 0.3 || au > 3) return null;
  return { au, when: parts[0] ?? "" };
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
    STEP_SIZE: "'1 d'",
    QUANTITIES: "'20'",
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
    return {
      au: Math.round(parsed.au * 1000) / 1000,
      oneWaySeconds: (parsed.au * AU_KM) / C_KM_S,
      source: "horizons",
      note: `NASA JPL Horizons geocentric range to Mars on ${parsed.when}. One-way light time is that range divided by the speed of light.`,
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
