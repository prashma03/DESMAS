import { AIMonitor } from "../components/AIMonitor";
import {
  AlertFeed,
  PowerPanel,
  Scene,
  SerialLog,
  SideNav,
  StatusTiles,
  worldOf,
} from "../components/WorldParts";

/** Moon page — Artemis base + live serial. Open this file to edit the Moon. */
export function MoonPage() {
  const world = worldOf("moon");
  return (
    <div className="world-page moon">
      <SideNav world={world} />
      <Scene world={world} />
      <StatusTiles world={world} />
      <div className="lower">
        <PowerPanel world={world} />
        <div>
          <AlertFeed />
          <SerialLog />
        </div>
      </div>
      <AIMonitor world="moon" />
    </div>
  );
}
