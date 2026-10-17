import { buildMarsTauScenario, MARS_TAU_CSV_URL, parseTauCsv, type MarsTauScenario } from "../../src/sim/marsTau.js";
import {
  EARTH_POWER_DAY,
  buildPowerReplay,
  parsePowerHourlyPoint,
  powerHourlyPointUrl,
  type EarthPowerScenario,
} from "../../src/sim/powerDay.js";

const CACHE_MS = 60 * 60 * 1000;
let cache: { at: number; value: EarthPowerScenario } | null = null;
let marsCache: { at: number; value: MarsTauScenario } | null = null;

export async function earthPowerScenario(): Promise<EarthPowerScenario> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const sourceUrl = powerHourlyPointUrl(EARTH_POWER_DAY);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const upstream = await fetch(sourceUrl, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "DESMAS/1.0" },
    });
    if (!upstream.ok) throw new Error(`NASA POWER HTTP ${upstream.status}`);
    const body: unknown = await upstream.json();
    const scenario = buildPowerReplay(
      parsePowerHourlyPoint(body, {
        sourceUrl,
        latitude: EARTH_POWER_DAY.latitude,
        longitude: EARTH_POWER_DAY.longitude,
      }),
    );
    cache = { at: Date.now(), value: scenario };
    return scenario;
  } finally {
    clearTimeout(timer);
  }
}

export async function marsTauScenario(): Promise<MarsTauScenario> {
  if (marsCache && Date.now() - marsCache.at < CACHE_MS) return marsCache.value;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const upstream = await fetch(MARS_TAU_CSV_URL, {
      signal: ctrl.signal,
      headers: { Accept: "text/csv,text/plain,*/*", "User-Agent": "DESMAS/1.0" },
    });
    if (!upstream.ok) throw new Error(`MSL tau HTTP ${upstream.status}`);
    const scenario = buildMarsTauScenario(parseTauCsv(await upstream.text()));
    marsCache = { at: Date.now(), value: scenario };
    return scenario;
  } finally {
    clearTimeout(timer);
  }
}
