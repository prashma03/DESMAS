import { kitStore } from "../kit/store";
import { createBoardLink } from "./link";

const NO_READINGS_MS = 10_000;
const NO_READINGS =
  "No readings came from that port. Check that it's the Arduino and the DESMAS sketch is uploaded, then connect again.";

export const board = createBoardLink({
  onOpen() {
    kitStore.goLive();
    const { since } = kitStore.getSnapshot();
    setTimeout(async () => {
      const kit = kitStore.getSnapshot();
      if (kit.source !== "serial" || kit.since !== since || kit.history.length > 0) return;
      await board.disconnect();
      kitStore.setNotice(NO_READINGS);
    }, NO_READINGS_MS);
  },
  onLine: (line) => kitStore.ingestLine(line),
  onClose: (notice) => kitStore.goSim(notice),
  onNotice: (notice) => kitStore.setNotice(notice),
});
