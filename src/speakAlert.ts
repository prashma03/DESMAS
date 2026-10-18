const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";
const TTS_MAX_CHARS = 4000;

type SpeechWin = {
  Audio?: new (src?: string) => {
    play: () => Promise<void>;
    pause: () => void;
    addEventListener: (name: string, fn: () => void) => void;
  };
  SpeechSynthesisUtterance?: new (text: string) => { text: string };
  speechSynthesis?: { cancel: () => void; speak: (u: { text: string }) => void };
};

type TrackedAudio = {
  pause: () => void;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
};

const TRACKED = "__desmasAudio";

function trackedAudio(): TrackedAudio[] {
  const bag = globalThis as Record<string, TrackedAudio[] | undefined>;
  if (!bag[TRACKED]) bag[TRACKED] = [];
  return bag[TRACKED];
}

let currentAudio: TrackedAudio | null = null;
let objectUrl: string | null = null;

function win(): SpeechWin {
  return globalThis as unknown as SpeechWin;
}

function hushElements() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("audio").forEach((node) => {
    if (!(node instanceof HTMLMediaElement)) return;
    node.loop = false;
    node.muted = true;
    node.volume = 0;
    try {
      node.pause();
    } catch {
      // A detached element can throw.
    }
  });
}

export function stopPlayback() {
  for (const audio of trackedAudio()) {
    audio.loop = false;
    audio.muted = true;
    audio.volume = 0;
    try {
      audio.pause();
    } catch {
      // A released element can throw.
    }
  }
  (globalThis as Record<string, TrackedAudio[] | undefined>)[TRACKED] = [];
  currentAudio = null;
  if (objectUrl) {
    if (typeof URL !== "undefined" && "revokeObjectURL" in URL) {
      URL.revokeObjectURL(objectUrl);
    }
    objectUrl = null;
  }
  try {
    win().speechSynthesis?.cancel();
  } catch {
    // The browser can throw if speech synthesis is already idle.
  }
  hushElements();
}

function speakBrowser(text: string): boolean {
  const w = win();
  if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) return false;
  w.speechSynthesis.cancel();
  w.speechSynthesis.speak(new w.SpeechSynthesisUtterance(text));
  return true;
}

async function playGrokAudio(blob: Blob) {
  const AudioCtor = win().Audio;
  if (!AudioCtor) throw new Error("no_audio");
  stopPlayback();
  objectUrl = URL.createObjectURL(blob);
  const audio = new AudioCtor(objectUrl);
  currentAudio = audio;
  trackedAudio().push(audio);
  audio.addEventListener("ended", stopPlayback);
  await audio.play();
}

export type SpeakSource = "grok" | "browser";

export async function speakAlert(text: string): Promise<SpeakSource> {
  const clipped = text.trim().slice(0, TTS_MAX_CHARS);
  if (!clipped) throw new Error("empty");

  try {
    const res = await fetch(`${API}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clipped }),
    });
    if (!res.ok) throw new Error("tts_http");
    const mime = res.headers.get("content-type") ?? "";
    const blob = await res.blob();
    if (!blob.size) throw new Error("tts_empty");
    if (mime.includes("json") || (blob.type && blob.type.includes("json"))) {
      throw new Error("tts_not_audio");
    }
    await playGrokAudio(blob);
    return "grok";
  } catch {
    stopPlayback();
    if (speakBrowser(clipped)) return "browser";
    throw new Error("speech_unavailable");
  }
}

stopPlayback();
