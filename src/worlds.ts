import type { WorldId } from "./kit/types";

export type SystemCard = {
  id: "p1" | "p2" | "p3" | "p4";
  name: string;
  detail: string;
  color: "green" | "blue" | "yellow" | "red";
};

export type SceneTag = {
  id: string;
  label: string;
  x: string;
  y: string;
  led?: 0 | 1 | 2 | 3;
  extra?: (r: { dark: number; hum: number; solar: number }) => string;
};

export type WorldConfig = {
  id: Exclude<WorldId, "worlds">;
  index: string;
  kicker: string;
  name: string;
  place: string;
  dayLabel: (dark: number) => string;
  hint: string;
  nav: { id: string; label: string }[];
  systems: SystemCard[];
  tags: SceneTag[];
  humidityPlace: string;
  powerTitle: string;
  powerSub: string;
  battery: (dark: number) => number;
};

export const worlds: Record<Exclude<WorldId, "worlds">, WorldConfig> = {
  earth: {
    id: "earth",
    index: "01",
    kicker: "TODAY",
    name: "Earth",
    place: "Off-grid clinic",
    dayLabel: (dark) => (dark < 30 ? "Daylight · solar charging the battery" : "Night · on battery"),
    hint: "Cover the light sensor for sunset. Breathe on the DHT11 to test the store room alarm.",
    nav: [
      { id: "power", label: "Power" },
      { id: "leds", label: "Same four LEDs" },
      { id: "alerts", label: "Alert feed" },
      { id: "ai", label: "AI monitor" },
    ],
    systems: [
      { id: "p1", name: "Vaccine fridge", detail: "Green LED · pin 8 · never shed", color: "green" },
      { id: "p2", name: "Radio", detail: "Blue LED · pin 9 · link to the district", color: "blue" },
      { id: "p3", name: "Lights", detail: "Yellow LED · pin 10 · exam room", color: "yellow" },
      { id: "p4", name: "Fan", detail: "Red LED · pin 11 · cooling", color: "red" },
    ],
    tags: [
      { id: "fridge", label: "Vaccine fridge", x: "18%", y: "42%", led: 0, extra: () => "ON · P1 · ALWAYS" },
      { id: "lights", label: "Lights", x: "48%", y: "36%", led: 2 },
      { id: "fan", label: "Fan", x: "68%", y: "48%", led: 3 },
      { id: "battery", label: "Battery", x: "32%", y: "62%", extra: ({ dark }) => `CHARGING · ${Math.max(12, 40 - Math.round(dark / 4))}%` },
      { id: "radio", label: "Radio", x: "78%", y: "28%", led: 1 },
    ],
    humidityPlace: "Store room",
    powerTitle: "Keep the vaccines cold until sunrise",
    powerSub: "AT THIS CLINIC",
    battery: (dark) => Math.max(12, 38 - Math.round(dark / 5)),
  },
  moon: {
    id: "moon",
    index: "02",
    kicker: "LIVE HARDWARE",
    name: "Moon",
    place: "Artemis base",
    dayLabel: (dark) => (dark < 55 ? "Lunar day · all systems on" : "Lunar night · shedding load"),
    hint: "Cover the light sensor for lunar night. Breathe on the DHT11 to set off the humidity alarm.",
    nav: [
      { id: "power", label: "Power" },
      { id: "hab", label: "Hab A" },
      { id: "alerts", label: "Alert feed" },
      { id: "serial", label: "Raw serial" },
      { id: "ai", label: "AI monitor" },
    ],
    systems: [
      { id: "p1", name: "Life support", detail: "Hab A · green LED · pin 8", color: "green" },
      { id: "p2", name: "Comms", detail: "Comms tower · blue LED · pin 9", color: "blue" },
      { id: "p3", name: "Science", detail: "Lab · yellow LED · pin 10", color: "yellow" },
      { id: "p4", name: "Comfort", detail: "Comfort module · red LED · pin 11", color: "red" },
    ],
    tags: [
      { id: "hab", label: "Hab A · life support", x: "22%", y: "44%", led: 0, extra: ({ hum }) => `ON · HUMIDITY ${Math.round(hum)}%` },
      { id: "sci", label: "Science lab", x: "48%", y: "38%", led: 2 },
      { id: "comf", label: "Comfort module", x: "64%", y: "52%", led: 3 },
      { id: "comms", label: "Comms tower", x: "78%", y: "26%", led: 1, extra: () => "ON · LINK TO EARTH" },
      { id: "solar", label: "Solar arrays", x: "36%", y: "22%", extra: ({ solar }) => `CHARGING · ${solar}%` },
      { id: "relay", label: "Relay ship", x: "70%", y: "12%", extra: () => "IN ORBIT · RELAYS TO EARTH" },
      { id: "earth", label: "Earth", x: "8%", y: "18%", extra: () => "1.3 S AWAY BY RADIO" },
    ],
    humidityPlace: "Hab A",
    powerTitle: "What stays on when the sun goes down",
    powerSub: "ON THIS BASE",
    battery: (dark) => Math.max(18, 71 - Math.round(dark / 3)),
  },
  mars: {
    id: "mars",
    index: "03",
    kicker: "NEXT",
    name: "Mars",
    place: "Relay ship and future base",
    dayLabel: (dark) => (dark < 55 ? "Clear sky · solar charging" : "Dust storm · lunar night rules"),
    hint: "Cover the light sensor to thicken the storm. The base sheds power the same way it does in a lunar night.",
    nav: [
      { id: "power", label: "Base power" },
      { id: "surface", label: "Surface base" },
      { id: "delay", label: "Earth delay" },
      { id: "faults", label: "Fault log" },
      { id: "ai", label: "AI monitor" },
    ],
    systems: [
      { id: "p1", name: "Life support", detail: "Green LED · air and heat", color: "green" },
      { id: "p2", name: "Comms", detail: "Blue LED · link to the relay ship", color: "blue" },
      { id: "p3", name: "Science", detail: "Yellow LED · experiments", color: "yellow" },
      { id: "p4", name: "Comfort", detail: "Red LED · lights and extras", color: "red" },
    ],
    tags: [
      { id: "hab", label: "Hab · life support", x: "24%", y: "50%", led: 0, extra: ({ hum }) => `ON · HUMIDITY ${Math.round(hum)}%` },
      { id: "sci", label: "Science lab", x: "46%", y: "40%", led: 2 },
      { id: "comf", label: "Comfort dome", x: "62%", y: "56%", led: 3 },
      { id: "comms", label: "Comms tower", x: "76%", y: "32%", led: 1, extra: () => "ON · LINK TO RELAY SHIP" },
      { id: "solar", label: "Solar arrays", x: "34%", y: "28%", extra: ({ solar }) => `CHARGING · ${solar}%` },
      { id: "relay", label: "Relay ship", x: "58%", y: "10%", extra: () => "FIXES ITS OWN FAULTS" },
    ],
    humidityPlace: "Hab",
    powerTitle: "A dust storm is a long lunar night",
    powerSub: "ON MARS",
    battery: (dark) => Math.max(20, 64 - Math.round(dark / 3)),
  },
};

export const MARS_DELAY_MIN = 12.96;
export const MOON_DELAY_S = 1.3;
