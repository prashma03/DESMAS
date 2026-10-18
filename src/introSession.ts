export type IntroPhase = "video1" | "video2" | "complete";
export type IntroAdvance = "end" | "error" | "skip";

export function advanceIntro(phase: IntroPhase, reason: IntroAdvance): IntroPhase {
  if (phase === "complete" || reason === "skip") return "complete";
  if (phase === "video1") return "video2";
  return "complete";
}

export type IntroSoundPrompt = "play" | "enable";

/** Initial playback stays silent. A prompt appears only until the viewer asks for sound. */
export function introSoundPrompt(soundOn: boolean, playing: boolean, needsGesture: boolean): IntroSoundPrompt | null {
  if (soundOn) return null;
  if (playing) return "enable";
  if (needsGesture) return "play";
  return null;
}

/**
 * Lives for this JavaScript runtime only.
 * A browser refresh or a new native process loads the module again and plays the intro.
 * Background, inactive, and in-app navigation do not reset it, and nothing is written to storage.
 */
let introComplete = false;

export function isIntroComplete() {
  return introComplete;
}

export function completeIntro() {
  introComplete = true;
}
