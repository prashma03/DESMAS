let grokBusy = false;

export function setGrokPlaybackBusy(busy: boolean) {
  grokBusy = busy;
}

export function isGrokPlaybackBusy() {
  return grokBusy;
}
