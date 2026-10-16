import type { KitEvent, KitReading, KitSource } from "../kit/types";
import { EarthPage } from "./EarthPage";
import { MarsPage } from "./MarsPage";
import { MoonPage } from "./MoonPage";

export function WorldView({
  world,
  reading,
  history,
  events,
  marsDelay,
  source,
}: {
  world: "earth" | "moon" | "mars";
  reading: KitReading;
  history: KitReading[];
  events: KitEvent[];
  marsDelay: string;
  source: KitSource;
}) {
  if (world === "earth") return <EarthPage reading={reading} history={history} events={events} source={source} />;
  if (world === "moon") return <MoonPage reading={reading} history={history} events={events} source={source} />;
  return <MarsPage reading={reading} history={history} events={events} source={source} marsDelay={marsDelay} />;
}
