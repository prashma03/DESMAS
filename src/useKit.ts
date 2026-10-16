import { useSyncExternalStore } from "react";
import { kitStore } from "./kit/store";

export function useKit() {
  return useSyncExternalStore(kitStore.subscribe, kitStore.getSnapshot);
}
