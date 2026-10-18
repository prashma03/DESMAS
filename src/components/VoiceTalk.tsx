import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { WorldId } from "../kit/types";
import { colors } from "../theme";
import { API } from "../api";
import { askTypedQuestion } from "../grokVoice/chatFallback";
import { PushToTalk, type VoiceStatus } from "../grokVoice/pushToTalk";
import { voiceUnavailableMessage } from "../grokVoice/voiceEndpoint";
import { mono, sans } from "./dashboard";

type World = Exclude<WorldId, "all">;
const WEB = typeof document !== "undefined";

function statusLabel(s: VoiceStatus) {
  if (s === "connecting") return "Connecting to Grok realtime…";
  if (s === "ready") return "Realtime ready · hold to talk";
  if (s === "listening") return "Listening (mic on)";
  if (s === "thinking") return "Grok is answering…";
  if (s === "speaking") return "Grok speaking";
  if (s === "fallback") return "Realtime failed · type a question";
  if (s === "offline") return "Offline · local sensor rules";
  if (s === "error") return "Voice error";
  return "Idle";
}

export function VoiceTalk({ world }: { world: World }) {
  const session = useRef<PushToTalk | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [detail, setDetail] = useState<string | null>(API ? null : voiceUnavailableMessage());
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [typed, setTyped] = useState("");
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ptt = new PushToTalk(world, {
      onStatus: (s, d) => {
        setStatus(s);
        setDetail(d ?? null);
        if (s === "fallback" || s === "offline") setFallback(true);
      },
      onUserTranscript: setUserText,
      onAssistantTranscript: setAssistantText,
      onFallback: () => setFallback(true),
    });
    session.current = ptt;
    return () => ptt.close();
  }, [world]);

  useEffect(() => {
    session.current?.setWorld(world);
  }, [world]);

  const showType = fallback || status === "error" || status === "idle" || status === "ready";

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>Grok realtime · push-to-talk</Text>
      <Text style={styles.hint}>{WEB ? statusLabel(status) : "Push-to-talk is for Chrome on localhost."}</Text>
      {detail ? <Text style={status === "error" ? styles.err : styles.hint}>{detail}</Text> : null}
      {WEB ? (
        <Pressable
          style={[styles.hold, status === "listening" ? styles.holdOn : null]}
          onPressIn={() => {
            setFallback(false);
            void session.current?.hold();
          }}
          onPressOut={() => session.current?.release()}
        >
          <Text style={styles.holdTxt}>{status === "listening" ? "Release to send" : "Hold to talk"}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.kicker}>You</Text>
      <Text style={styles.body}>{userText || "—"}</Text>
      <Text style={styles.kicker}>Grok</Text>
      <Text style={styles.body}>{assistantText || "—"}</Text>
      {showType ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.hint}>Typed fallback uses /api/chat then Grok TTS. Not browser fake-voice for realtime.</Text>
          <View style={styles.row}>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder="Ask about humidity, P1–P4, or last-minute incidents"
              placeholderTextColor={colors.dim}
              style={styles.input}
            />
            <Pressable
              style={styles.send}
              disabled={busy || !typed.trim()}
              onPress={() => {
                const q = typed.trim();
                setBusy(true);
                setUserText(q);
                setStatus("thinking");
                askTypedQuestion(world, q)
                  .then((r) => {
                    setAssistantText(r.answer);
                    setStatus(r.source === "offline" ? "offline" : "ready");
                    setFallback(r.source === "offline");
                  })
                  .catch(() => {
                    setStatus("error");
                    setFallback(true);
                  })
                  .finally(() => setBusy(false));
              }}
            >
              <Text style={styles.sendTxt}>{busy ? "…" : "Ask"}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  kicker: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  hint: { color: colors.muted, fontFamily: sans, fontSize: 13, lineHeight: 18 },
  err: { color: colors.alert, fontFamily: sans, fontSize: 13 },
  body: { color: colors.ink, fontFamily: sans, fontSize: 14, lineHeight: 20 },
  hold: { alignSelf: "flex-start", backgroundColor: "#c43d3d", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  holdOn: { backgroundColor: "#2a9d5c" },
  holdTxt: { color: "#fff", fontFamily: sans, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    minWidth: 160,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    color: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: sans,
  },
  send: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  sendTxt: { color: "#061018", fontFamily: sans, fontWeight: "600" },
});
