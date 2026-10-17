import { DARKNESS_FORMULA, I0_RULE, replayDarkness } from "./darknessIndex";
import type { ShedLeds } from "./shedModel";

export const EARTH_POWER_DAY = {
  parameter: "ALLSKY_SFC_SW_DWN",
  community: "RE",
  latitude: 38,
  longitude: -77,
  start: "20250621",
  end: "20250621",
} as const;

export function powerHourlyPointUrl(query: {
  parameter?: string;
  community?: string;
  latitude: number;
  longitude: number;
  start: string;
  end: string;
}): string {
  const params = new URLSearchParams({
    parameters: query.parameter ?? EARTH_POWER_DAY.parameter,
    community: query.community ?? EARTH_POWER_DAY.community,
    longitude: String(query.longitude),
    latitude: String(query.latitude),
    start: query.start,
    end: query.end,
    format: "JSON",
    "time-standard": "UTC",
  });
  return `https://power.larc.nasa.gov/api/temporal/hourly/point?${params.toString()}`;
}

export type PowerHour = {
  timestampUtc: string;
  irradiance: number | null;
};

export type PowerDay = {
  parameter: "ALLSKY_SFC_SW_DWN";
  longname: string;
  units: string;
  fillValue: number;
  timeStandard: "UTC";
  requestedLatitude: number;
  requestedLongitude: number;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  start: string;
  end: string;
  sources: string[];
  title: string;
  apiName: string;
  apiVersion: string;
  sourceUrl: string;
  messages: string[];
  hours: PowerHour[];
};

export type PowerReplayHour = {
  timestampUtc: string;
  irradiance: number | null;
  missing: boolean;
  modeledDark: number | null;
  leds: ShedLeds | null;
};

export type EarthPowerScenario = {
  kind: "nasa-power-hourly";
  parameter: "ALLSKY_SFC_SW_DWN";
  longname: string;
  units: string;
  fillValue: number;
  timeStandard: "UTC";
  requestedLatitude: number;
  requestedLongitude: number;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  start: string;
  end: string;
  sources: string[];
  title: string;
  apiName: string;
  apiVersion: string;
  sourceUrl: string;
  messages: string[];
  i0: number | null;
  formula: string;
  i0Rule: string;
  hours: PowerReplayHour[];
};

const HOUR_KEY = /^(\d{4})(\d{2})(\d{2})(\d{2})$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`POWER response is missing ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function messageLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const lines: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      lines.push(item.trim());
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const fields = item as Record<string, unknown>;
    const found = [fields.message, fields.description, fields.text].find((entry) => typeof entry === "string" && entry.trim());
    if (typeof found === "string") lines.push(found.trim());
  }
  return lines;
}

export function parsePowerHourlyPoint(
  body: unknown,
  request: { sourceUrl: string; latitude: number; longitude: number },
): PowerDay {
  const root = record(body, "an object");
  const header = record(root.header, "header");
  const parameters = record(root.parameters, "parameters");
  const about = record(parameters.ALLSKY_SFC_SW_DWN, "ALLSKY_SFC_SW_DWN parameter");
  const units = text(about.units);
  const longname = text(about.longname);
  if (!units) throw new Error("POWER response has no ALLSKY_SFC_SW_DWN units");
  if (typeof header.fill_value !== "number" || !Number.isFinite(header.fill_value)) {
    throw new Error("POWER response has no numeric fill_value");
  }
  if (header.time_standard !== "UTC") {
    throw new Error(`POWER time standard is ${text(header.time_standard) || "missing"}, expected UTC`);
  }
  const geometry = record(root.geometry, "geometry");
  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error("POWER geometry has no point");
  const longitude = coordinates[0];
  const latitude = coordinates[1];
  const elevation = coordinates[2];
  if (typeof longitude !== "number" || typeof latitude !== "number") {
    throw new Error("POWER geometry coordinates are not numbers");
  }
  const properties = record(root.properties, "properties");
  const parameter = record(properties.parameter, "properties.parameter");
  const series = record(parameter.ALLSKY_SFC_SW_DWN, "hourly ALLSKY_SFC_SW_DWN");
  const fillValue = header.fill_value;
  const hours: PowerHour[] = Object.keys(series)
    .sort()
    .map((key) => {
      const match = HOUR_KEY.exec(key);
      if (!match) throw new Error(`POWER hour key ${key} is not YYYYMMDDHH`);
      const value = series[key];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`POWER hour ${key} is not a finite number`);
      }
      const timestampUtc = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:00:00Z`;
      return { timestampUtc, irradiance: value === fillValue ? null : value };
    });
  if (hours.length === 0) throw new Error("POWER returned no hourly values");
  const api = header.api && typeof header.api === "object" ? (header.api as Record<string, unknown>) : {};
  const sources = Array.isArray(header.sources) ? header.sources.filter((item): item is string => typeof item === "string") : [];
  return {
    parameter: "ALLSKY_SFC_SW_DWN",
    longname,
    units,
    fillValue,
    timeStandard: "UTC",
    requestedLatitude: request.latitude,
    requestedLongitude: request.longitude,
    latitude,
    longitude,
    elevationM: typeof elevation === "number" && Number.isFinite(elevation) ? elevation : null,
    start: text(header.start),
    end: text(header.end),
    sources,
    title: text(header.title),
    apiName: text(api.name),
    apiVersion: text(api.version),
    sourceUrl: request.sourceUrl,
    messages: messageLines(root.messages),
    hours,
  };
}

export function buildPowerReplay(day: PowerDay): EarthPowerScenario {
  const replay = replayDarkness(day.hours.map((hour) => hour.irradiance));
  return {
    kind: "nasa-power-hourly",
    parameter: day.parameter,
    longname: day.longname,
    units: day.units,
    fillValue: day.fillValue,
    timeStandard: day.timeStandard,
    requestedLatitude: day.requestedLatitude,
    requestedLongitude: day.requestedLongitude,
    latitude: day.latitude,
    longitude: day.longitude,
    elevationM: day.elevationM,
    start: day.start,
    end: day.end,
    sources: day.sources,
    title: day.title,
    apiName: day.apiName,
    apiVersion: day.apiVersion,
    sourceUrl: day.sourceUrl,
    messages: day.messages,
    i0: replay.i0,
    formula: DARKNESS_FORMULA,
    i0Rule: I0_RULE,
    hours: day.hours.map((hour, index) => ({
      timestampUtc: hour.timestampUtc,
      irradiance: hour.irradiance,
      missing: hour.irradiance === null,
      modeledDark: replay.hours[index]?.modeledDark ?? null,
      leds: replay.hours[index]?.leds ?? null,
    })),
  };
}

function isLeds(value: unknown): value is ShedLeds {
  return Array.isArray(value) && value.length === 4 && value.every((code) => code === 0 || code === 1 || code === 2);
}

function isReplayHour(value: unknown, i0: number | null): value is PowerReplayHour {
  if (!value || typeof value !== "object") return false;
  const hour = value as PowerReplayHour;
  if (typeof hour.timestampUtc !== "string" || !hour.timestampUtc.endsWith("Z")) return false;
  if (typeof hour.missing !== "boolean") return false;
  if (hour.missing) {
    return hour.irradiance === null && hour.modeledDark === null && hour.leds === null;
  }
  if (typeof hour.irradiance !== "number" || !Number.isFinite(hour.irradiance)) return false;
  if (i0 === null) return hour.modeledDark === null && hour.leds === null;
  return typeof hour.modeledDark === "number" && Number.isFinite(hour.modeledDark) && isLeds(hour.leds);
}

export function isEarthPowerScenario(value: unknown): value is EarthPowerScenario {
  if (!value || typeof value !== "object") return false;
  const scenario = value as EarthPowerScenario;
  if (scenario.kind !== "nasa-power-hourly" || scenario.parameter !== "ALLSKY_SFC_SW_DWN") return false;
  if (scenario.timeStandard !== "UTC" || typeof scenario.units !== "string" || !scenario.units) return false;
  if (typeof scenario.fillValue !== "number" || typeof scenario.formula !== "string") return false;
  if (scenario.i0 !== null && (typeof scenario.i0 !== "number" || scenario.i0 <= 0)) return false;
  if (!Array.isArray(scenario.hours) || scenario.hours.length === 0) return false;
  return scenario.hours.every((hour) => isReplayHour(hour, scenario.i0));
}
