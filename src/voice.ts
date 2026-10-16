import { Platform } from "react-native";
import * as Speech from "expo-speech";

export type VoiceStatus = {
  text: string;
  error: boolean;
};

function webSynth() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const w = window as Window & { speechSynthesis?: SpeechSynthesis };
  return w.speechSynthesis ?? null;
}

export function voiceSupported() {
  if (webSynth()) return true;
  return Platform.OS !== "web";
}

export function stopVoice() {
  Speech.stop();
  webSynth()?.cancel();
}

export function speakAlert(
  message: string,
  onStatus: (status: VoiceStatus) => void,
) {
  const text = message.trim();
  if (!text) {
    onStatus({ text: "Nothing to speak.", error: true });
    return;
  }
  if (!voiceSupported()) {
    onStatus({ text: "Speech synthesis is not available in this browser.", error: true });
    return;
  }

  stopVoice();

  Speech.speak(text, {
    rate: 1,
    pitch: 1,
    onStart: () => onStatus({ text: "Speaking alert...", error: false }),
    onDone: () => onStatus({ text: "Finished speaking.", error: false }),
    onStopped: () => onStatus({ text: "Voice stopped.", error: false }),
    onError: () =>
      onStatus({ text: "Could not speak the alert. Try another browser or device.", error: true }),
  });
}
