import { AIMonitor } from "../components/AIMonitor";
import {
  AlertFeed,
  PowerPanel,
  Scene,
  SideNav,
  StatusTiles,
  worldOf,
} from "../components/WorldParts";

/** Earth page — off-grid clinic. Open this file to edit Earth. */
export function EarthPage() {
  const world = worldOf("earth");
  return (
    <div className="world-page earth">
      <SideNav world={world} />
      <Scene world={world} />
      <StatusTiles world={world} />
      <div className="lower">
        <PowerPanel world={world} />
        <AlertFeed />
      </div>
      <AIMonitor world="earth" />
    </div>
  );
}
