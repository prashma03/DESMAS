import { isGrokPlaybackBusy } from "../grokVoice/playbackGate";

const COOLDOWN_MS = 2500;
let lastAt = 0;

/** Short cue for incident edges. Skips while Grok PCM is playing. Not Grok Voice. */
export function playIncidentWarning(severity: "critical" | "warn" | "ok" | "info") {
  if (severity === "ok" || severity === "info") return;
  if (isGrokPlaybackBusy()) return;
  const now = Date.now();
  if (now - lastAt < COOLDOWN_MS) return;
  lastAt = now;
  const AudioCtx = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
    .AudioContext;
  const Webkit = (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const Ctor = AudioCtx ?? Webkit;
  if (!Ctor) return;
  const ctx = new Ctor();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = severity === "critical" ? 880 : 520;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.09);
  osc.onended = () => void ctx.close();
}
