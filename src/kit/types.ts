export type LedState = [number, number, number, number];

export type KitReading = {
  ms: number;
  light: number;
  lbase: number;
  dark: number;
  hum: number;
  hbase: number;
  cut: number;
  temp: number;
  alarm: 0 | 1;
  muted: 0 | 1;
  dht: 0 | 1;
  leds: LedState;
};

export type KitEventKind = "POWER" | "ALERT" | "OK" | "INFO";

export type KitEvent = {
  id: number;
  at: number;
  kind: KitEventKind;
  message: string;
};

export type KitSource = "simulated" | "serial";

/** Transport state. "live" is the only status that means a valid reading just arrived. */
export type LinkStatus = "simulated" | "connecting" | "connected" | "live" | "stale" | "disconnected" | "error";

export function kitFreshness(source: KitSource, link?: LinkStatus): {
  live: boolean;
  mark: "Live" | "Simulated" | "Stale" | "Connecting";
} {
  if (link === "live" || (link === undefined && source === "serial")) return { live: true, mark: "Live" };
  if (link === "stale" || link === "disconnected") return { live: false, mark: "Stale" };
  if (link === "connecting" || link === "connected") return { live: false, mark: "Connecting" };
  return { live: false, mark: "Simulated" };
}

export type WorldId = "all" | "earth" | "moon" | "mars";
