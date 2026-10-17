import type { EarthDelay } from "../findings";
import type { KitEvent, KitReading, KitSource } from "../kit/types";
import { EarthPage } from "./EarthPage";
import { MarsPage } from "./MarsPage";
import { MoonPage } from "./MoonPage";

export function WorldView({
  world,
  reading,
  history,
  events,
  lines,
  delay,
  source,
}: {
  world: "earth" | "moon" | "mars";
  reading: KitReading;
  history: KitReading[];
  events: KitEvent[];
  lines: string[];
  delay: EarthDelay | null;
  source: KitSource;
}) {
  if (world === "earth") return <EarthPage reading={reading} history={history} events={events} source={source} />;
  if (world === "moon") return <MoonPage reading={reading} history={history} events={events} lines={lines} source={source} />;
  return <MarsPage reading={reading} history={history} events={events} source={source} delay={delay} />;
}
