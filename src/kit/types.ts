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

export type WorldId = "all" | "earth" | "moon" | "mars";
