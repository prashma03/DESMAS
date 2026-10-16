export type WorldId = "worlds" | "earth" | "moon" | "mars";

export type Reading = {
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
  leds: [number, number, number, number];
};

export type AlertLevel = "INFO" | "POWER" | "OK" | "ALERT" | "HANDLED";

export type KitEvent = {
  id: string;
  at: number;
  clock: string;
  level: AlertLevel;
  text: string;
};

export type KitSource = "simulated" | "arduino";

export type Sample = { t: number; hum: number };

export const LOOP_MS = 44_000;
export const TICK_MS = 500;
