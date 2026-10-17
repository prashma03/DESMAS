import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { KitReading, KitSource, WorldId } from "../kit/types";
import { API } from "../api";
import { fallbackAnswer, suggestedQuestions, type EarthDelay } from "../findings";
import { useScreen } from "../layout";
import { colors } from "../theme";
import { useDiagnosis } from "../useDiagnosis";
import { speakAlert, stopVoice, voiceSupported } from "../voice";
import { speakAlert as speakGrokTts } from "../speakAlert";
import { communicationAutonomy } from "../kit/autonomy";
import { IncidentPanel } from "./IncidentPanel";
import { ModelValidation } from "./ModelValidation";
import { VoiceTalk } from "./VoiceTalk";
import { mono, sans } from "./dashboard";

const TONE: Record<string, string> = {
  alert: colors.alert,
  watch: colors.watch,
  ok: colors.ok,
  info: colors.ledBlue,
};

export function AiMonitor({
  world,
  reading,
  source,
  delay,
}: {
  world: Exclude<WorldId, "all">;
  reading: KitReading;
  source: KitSource;
  delay?: EarthDelay;
}) {
  const { finding: info, grok } = useDiagnosis(world, reading);
  const level = info.level;
  const findingKey = `${info.level}|${info.title}|${info.steps.join("|")}`;
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [draft, setDraft] = useState("");
  const [askError, setAskError] = useState(false);
  const [pending, setPending] = useState(false);
  const [via, setVia] = useState<"grok" | "fallback">("fallback");
  const questions = suggestedQuestions(world, reading, delay);
  const [log, setLog] = useState(() => {
    const first = suggestedQuestions(world, reading, delay)[0];
    return [{ q: first.q, a: first.a }];
  });
  const finished = info.steps.filter((_, i) => done[i]).length;
  const progress = info.steps.length ? Math.round((finished / info.steps.length) * 100) : 0;

  useEffect(() => {
    setDone({});
  }, [findingKey]);
  const canSpeak = voiceSupported();
  const [voice, setVoice] = useState(() =>
    canSpeak
      ? { text: "Ready. Speak Alert reads the current finding out loud.", error: false }
      : { text: "Speech synthesis is not available in this browser.", error: true },
  );
  const spokenAlarm = useRef(false);
  const line = `${info.title}. ${info.body}`;
  const lineRef = useRef(line);
  lineRef.current = line;
  const speak = () => {
    void speakGrokTts(line)
      .then((source) => {
        setVoice({
          text: source === "grok" ? "Playing Grok TTS" : "Browser voice (API unavailable)",
          error: false,
        });
      })
      .catch(() => speakAlert(line, setVoice));
  };
  const stop = () => {
    stopVoice();
    setVoice({ text: "Voice stopped.", error: false });
  };

  useEffect(() => {
    if (reading.alarm && !spokenAlarm.current) {
      spokenAlarm.current = true;
      speakAlert(lineRef.current, setVoice);
    }
    if (!reading.alarm) spokenAlarm.current = false;
  }, [reading.alarm, world]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text) {
      setAskError(true);
      return;
    }
    if (pending) return;
    setAskError(false);
    setPending(true);
    setDraft("");
    setLog((prev) => [{ q: text, a: "Asking Grok…" }, ...prev].slice(0, 4));
    const local = fallbackAnswer(world, text, reading, info, delay);
    try {
      const res = await fetch(`${API}/api/grok`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          world,
          question: text,
          reading: {
            hum: reading.hum,
            temp: reading.temp,
            dark: reading.dark,
            cut: reading.cut,
            alarm: reading.alarm,
            leds: reading.leds,
          },
        }),
      });
      const data = (await res.json()) as { answer?: string };
      if (!res.ok || !data.answer) throw new Error("grok");
      setVia("grok");
      setLog((prev) => {
        const next = [...prev];
        if (next[0]?.q === text) next[0] = { q: text, a: data.answer as string };
        return next;
      });
    } catch {
      setVia("fallback");
      setLog((prev) => {
        const next = [...prev];
        if (next[0]?.q === text) next[0] = { q: text, a: local };
        return next;
      });
    } finally {
      setPending(false);
    }
  };
  const autonomy = communicationAutonomy({
    world,
    reading,
    mars: world === "mars" ? delay ?? null : null,
  });
  const { narrow } = useScreen();
  const tone = level === "ALERT" ? colors.alert : level === "WATCH" ? colors.watch : colors.ok;
  const rate =
    world === "earth"
      ? "Reading the clinic kit · twice a second"
      : world === "mars"
        ? "Matching base and relay ship · light sensor = dust"
        : source === "serial"
          ? "Arduino live · twice a second"
          : "Reading the Arduino · twice a second";

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Text style={styles.brand}>AI monitor</Text>
          <Text style={styles.pill}>{grok || via === "grok" ? "Grok" : "Onboard fallback"}</Text>
        </View>
        <Text style={styles.rate}>{rate}</Text>
      </View>
      <View style={styles.titleRow}>
        <Text style={[styles.level, { color: tone, borderColor: tone }]}>{level}</Text>
        <Text style={[styles.title, narrow ? { fontSize: 20 } : null]}>{info.title}</Text>
      </View>
      <Text style={styles.body}>{info.body}</Text>
      <View style={styles.autonomy}>
        <Text style={[styles.kicker, { color: autonomy.mode === "local-first" ? colors.gold : colors.ok }]}>
          {autonomy.mode === "local-first" ? "Local-first" : "Earth-guided"}
        </Text>
        <Text style={styles.voiceStatus}>{autonomy.summary}</Text>
        <Text style={styles.voiceStatus}>{autonomy.recommendation}</Text>
      </View>
      <View style={styles.voice}>
        <View style={styles.voiceBtns}>
          <Pressable
            style={[styles.speakBtn, !canSpeak ? styles.voiceOff : null]}
            disabled={!canSpeak}
            onPress={speak}
          >
            <Text style={styles.speakTxt}>Speak Alert</Text>
          </Pressable>
          <Pressable
            style={[styles.stopBtn, !canSpeak ? styles.voiceOff : null]}
            disabled={!canSpeak}
            onPress={stop}
          >
            <Text style={styles.stopTxt}>Stop Voice</Text>
          </Pressable>
        </View>
        <Text style={[styles.voiceStatus, voice.error ? styles.voiceErr : null]}>{voice.text}</Text>
      </View>
      <VoiceTalk world={world} />
      <IncidentPanel world={world} />
      <ModelValidation />
      <View style={styles.chips}>
        <Text style={styles.kicker}>Based on</Text>
        {info.evidence.map((item) => (
          <Chip key={item.text} text={item.text} color={TONE[item.tone] ?? colors.ledBlue} />
        ))}
      </View>
      <View style={styles.columns}>
        <View nativeID="monitor" style={styles.box}>
          <View style={styles.head}>
            <Text style={styles.kicker}>Troubleshooting plan</Text>
            {info.steps.length ? <Text style={styles.kicker}>{`${finished} / ${info.steps.length} done`}</Text> : null}
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          {info.steps.length ? (
            info.steps.map((step, i) => (
              <Pressable key={step} style={styles.step} onPress={() => setDone((prev) => ({ ...prev, [i]: !prev[i] }))}>
                <View style={[styles.check, done[i] ? styles.checkOn : null]} />
                <Text style={[styles.stepTxt, done[i] ? styles.stepDone : null]}>{`${String(i + 1).padStart(2, "0")}   ${step}`}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.muted}>No plan needed right now. One appears here as soon as a reading crosses its cutoff.</Text>
          )}
          {info.parts.map((part) => (
            <View key={part.name} style={[styles.part, part.inStock ? null : styles.partOut]}>
              <Text style={[styles.stock, part.inStock ? null : styles.stockOut]}>{part.inStock ? "In stock" : "Not in stock"}</Text>
              <Text style={styles.partName}>{part.name}</Text>
              <Text style={styles.muted}>{part.detail}</Text>
            </View>
          ))}
        </View>
        <View style={styles.box}>
          <Text style={styles.kicker}>Ask the crew's AI</Text>
          {log.map((turn, i) => (
            <View key={`${turn.q}-${i}`} style={{ gap: 8 }}>
              <View style={styles.crew}>
                <Text style={styles.crewTxt}>{turn.q}</Text>
              </View>
              <View style={styles.ai}>
                <Text style={styles.aiTxt}>{turn.a}</Text>
              </View>
            </View>
          ))}
          <View style={styles.suggest}>
            {questions.map((item) => (
              <Pressable key={item.q} style={styles.suggestBtn} onPress={() => ask(item.q)}>
                <Text style={styles.suggestTxt}>{item.q}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.askRow}>
            <TextInput
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (text.trim()) setAskError(false);
              }}
              placeholder="Ask about readings, power or parts"
              placeholderTextColor={colors.dim}
              style={styles.input}
              onSubmitEditing={() => ask(draft)}
            />
            <Pressable style={styles.send} onPress={() => ask(draft)}>
              <Text style={styles.sendTxt}>↑</Text>
            </Pressable>
          </View>
          {askError ? <Text style={styles.askError}>Type a question first.</Text> : null}
        </View>
      </View>
    </View>
  );
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.chipTxt}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#0c0e12",
    padding: 16,
    gap: 12,
    maxWidth: "100%",
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { color: colors.ink, fontFamily: sans, fontSize: 13, letterSpacing: 1.2 },
  pill: {
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontFamily: mono,
  },
  rate: { color: colors.blue, fontFamily: mono, fontSize: 11, letterSpacing: 0.4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  level: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  title: { color: colors.ink, fontFamily: sans, fontWeight: "400", fontSize: 26, letterSpacing: -0.4, flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, fontFamily: sans },
  autonomy: {
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  voice: { gap: 8 },
  voiceBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  speakBtn: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  speakTxt: { color: "#061018", fontFamily: sans, fontWeight: "600", fontSize: 14 },
  stopBtn: { backgroundColor: "#31445f", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  stopTxt: { color: "#d7e4f5", fontFamily: sans, fontWeight: "600", fontSize: 14 },
  voiceOff: { opacity: 0.55 },
  voiceStatus: { color: colors.muted, fontFamily: sans, fontSize: 13 },
  voiceErr: { color: colors.alert },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  kicker: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipTxt: { color: colors.ink, fontSize: 12, fontFamily: sans },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 12, width: "100%" },
  box: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, maxWidth: "100%", borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 10, backgroundColor: "rgba(255,255,255,0.02)" },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: colors.dim, marginTop: 2 },
  checkOn: { backgroundColor: colors.green, borderColor: colors.green },
  stepTxt: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 20, fontFamily: sans },
  stepDone: { color: colors.dim, textDecorationLine: "line-through" },
  progressTrack: { height: 4, borderRadius: 99, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: colors.ledBlue },
  askError: { color: colors.alert, fontFamily: sans, fontSize: 13 },
  partOut: { borderColor: "rgba(242,181,68,0.35)", backgroundColor: "rgba(242,181,68,0.08)" },
  stockOut: { color: colors.gold },
  muted: { color: colors.dim, fontSize: 13, lineHeight: 18, fontFamily: sans },
  part: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(134,239,172,0.35)", backgroundColor: "rgba(134,239,172,0.08)", borderRadius: 12, padding: 10 },
  stock: { color: colors.ok, fontFamily: mono, fontSize: 11, letterSpacing: 0.6 },
  partName: { color: colors.ink, flex: 1, fontFamily: sans },
  crew: { alignSelf: "flex-end", maxWidth: "90%", backgroundColor: "#2a2e36", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  crewTxt: { color: colors.ink, fontFamily: sans },
  ai: { alignSelf: "flex-start", maxWidth: "92%", backgroundColor: "#171b22", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  aiTxt: { color: colors.ink, fontFamily: sans, lineHeight: 20 },
  suggest: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestBtn: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(90,168,255,0.45)", paddingHorizontal: 10, paddingVertical: 6 },
  suggestTxt: { color: colors.blue, fontSize: 13, fontFamily: sans },
  askRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%", borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingLeft: 14, paddingRight: 4, paddingVertical: 4 },
  input: { flex: 1, minWidth: 0, color: colors.ink, fontFamily: sans, fontSize: 14, paddingVertical: Platform.OS === "web" ? 8 : 4 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  sendTxt: { color: "#111", fontSize: 16, fontWeight: "700" },
});
