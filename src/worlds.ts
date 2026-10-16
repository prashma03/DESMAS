import type { WorldId } from "./kit/types";

export type SystemCard = {
  id: "p1" | "p2" | "p3" | "p4";
  pin: number;
  led: "Green" | "Blue" | "Yellow" | "Red";
  name: string;
  detail: string;
};

export type WorldMeta = {
  id: Exclude<WorldId, "all">;
  index: string;
  title: string;
  place: string;
  dayLabel: (dark: number) => string;
  hint: string;
  humidityPlace: string;
  earthDelay: string;
  systems: SystemCard[];
};

export const WORLDS: Record<Exclude<WorldId, "all">, WorldMeta> = {
  earth: {
    id: "earth",
    index: "01 · TODAY",
    title: "Off-grid clinic",
    place: "Earth",
    dayLabel: (dark) => (dark >= 55 ? "Night · battery" : "Daylight · charging"),
    hint: "Cover the light sensor for sunset. Breathe on the DHT11 to test the store room alarm.",
    humidityPlace: "Store room",
    earthDelay: "local",
    systems: [
      { id: "p1", pin: 8, led: "Green", name: "Vaccine fridge", detail: "Never shed" },
      { id: "p2", pin: 9, led: "Blue", name: "Radio", detail: "Link to the district" },
      { id: "p3", pin: 10, led: "Yellow", name: "Lights", detail: "Exam room" },
      { id: "p4", pin: 11, led: "Red", name: "Fan", detail: "Cooling" },
    ],
  },
  moon: {
    id: "moon",
    index: "02 · LIVE HARDWARE",
    title: "Artemis base",
    place: "Lunar south pole",
    dayLabel: (dark) => (dark >= 55 ? "Lunar night" : "Lunar day · all systems on"),
    hint: "Cover the light sensor for lunar night. Breathe on the DHT11 to set off the humidity alarm.",
    humidityPlace: "Hab A",
    earthDelay: "1.3 s",
    systems: [
      { id: "p1", pin: 8, led: "Green", name: "Life support", detail: "Hab A · air and heat" },
      { id: "p2", pin: 9, led: "Blue", name: "Comms", detail: "Tower · link to Earth" },
      { id: "p3", pin: 10, led: "Yellow", name: "Science", detail: "Lab" },
      { id: "p4", pin: 11, led: "Red", name: "Comfort", detail: "Module" },
    ],
  },
  mars: {
    id: "mars",
    index: "03 · NEXT",
    title: "Future base",
    place: "Mars · surface",
    dayLabel: (dark) =>
      dark >= 55 ? "Dust storm · shed like lunar night" : "Clear sky · solar charging",
    hint: "Cover the light sensor to thicken the storm. The base sheds power the same way it does in a lunar night.",
    humidityPlace: "Hab",
    earthDelay: "3 to 22 min",
    systems: [
      { id: "p1", pin: 8, led: "Green", name: "Life support", detail: "Hab · air and heat" },
      { id: "p2", pin: 9, led: "Blue", name: "Comms", detail: "Link to the relay ship" },
      { id: "p3", pin: 10, led: "Yellow", name: "Science", detail: "Experiments" },
      { id: "p4", pin: 11, led: "Red", name: "Comfort", detail: "Dome · lights and extras" },
    ],
  },
};

export const LED_MAP = [
  { led: "P1 · Green", moon: "Life support", clinic: "Vaccine fridge" },
  { led: "P2 · Blue", moon: "Comms", clinic: "Radio" },
  { led: "P3 · Yellow", moon: "Science", clinic: "Lights" },
  { led: "P4 · Red", moon: "Comfort", clinic: "Fan" },
] as const;

export const LED_COLOR = {
  Green: "#3dd68c",
  Blue: "#3d8bff",
  Yellow: "#f5c542",
  Red: "#e25a32",
} as const;
