import { AIMonitor } from "../components/AIMonitor";
import {
  AlertFeed,
  DelayCard,
  PowerPanel,
  Scene,
  SideNav,
  StatusTiles,
  worldOf,
} from "../components/WorldParts";

/** Mars page — dust storm + Earth delay. Open this file to edit Mars. */
export function MarsPage() {
  const world = worldOf("mars");
  return (
    <div className="world-page mars">
      <SideNav world={world} />
      <Scene world={world} />
      <StatusTiles world={world} />
      <div className="lower">
        <PowerPanel world={world} />
        <div>
          <DelayCard />
          <AlertFeed />
        </div>
      </div>
      <AIMonitor world="mars" />
    </div>
  );
}
