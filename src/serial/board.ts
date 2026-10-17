import { kitStore } from "../kit/store";
import { createBoardLink } from "./link";

const NO_READINGS_MS = 10_000;
const STALE_MS = 3_000;
const NO_READINGS =
  "No readings came from that port. Check that it's the Arduino and the DESMAS sketch is uploaded, then connect again.";

let watch: ReturnType<typeof setInterval> | undefined;

function stopWatch() {
  if (watch) clearInterval(watch);
  watch = undefined;
}

function startWatch() {
  stopWatch();
  watch = setInterval(() => {
    const kit = kitStore.getSnapshot();
    const age = Date.now() - (kit.lastAt || kit.since);
    if (kit.link === "connected" && age > NO_READINGS_MS) {
      stopWatch();
      void board.disconnect().then(() => kitStore.markError(NO_READINGS));
      return;
    }
    if (kit.link === "live" && Date.now() - kit.lastAt > STALE_MS) kitStore.markStale();
  }, 500);
}

export const board = createBoardLink({
  onConnecting() {
    kitStore.markConnecting();
  },
  onOpen() {
    kitStore.markConnected();
    startWatch();
  },
  onLine: (line) => kitStore.ingestLine(line),
  onClose: (notice) => {
    stopWatch();
    kitStore.markDisconnected(notice);
  },
  onNotice: (notice) => {
    stopWatch();
    kitStore.markError(notice);
  },
});
