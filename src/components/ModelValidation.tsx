import { StyleSheet, Text, View } from "react-native";
import { scoreShedStream, type ShedLeds } from "../sim/shedModel";
import { colors } from "../theme";
import { useKit } from "../useKit";
import { mono, sans } from "./dashboard";

function word(code: number) {
  if (code === 2) return "BLINK";
  if (code === 1) return "ON";
  return "OFF";
}

function line(leds: ShedLeds) {
  return `P1 ${word(leds[0])} · P2 ${word(leds[1])} · P3 ${word(leds[2])} · P4 ${word(leds[3])}`;
}

export function ModelValidation() {
  const kit = useKit();
  const live = kit.source === "serial" && kit.link === "live";
  const score = live ? scoreShedStream(kit.history) : null;

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>Model validation</Text>
      {score ? (
        <>
          <Text style={styles.hint}>Observed hardware</Text>
          <Text style={styles.body}>{score.observed ? line(score.observed) : "—"}</Text>
          <Text style={styles.hint}>Model prediction</Text>
          <Text style={styles.body}>{score.predicted ? line(score.predicted) : "Waiting for the next live sample."}</Text>
          <Text style={styles.hint}>
            {score.scoredSamples === 0
              ? "Synchronized to the first live sample. That sample is not scored."
              : `${score.matchedSamples} / ${score.scoredSamples} samples match · ${score.matchedChannels} / ${score.scoredChannels} channels match`}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.body}>No live Arduino connected.</Text>
          <Text style={styles.hint}>Simulated kit data is not hardware validation.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  kicker: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  hint: { color: colors.muted, fontFamily: sans, fontSize: 13, lineHeight: 18 },
  body: { color: colors.ink, fontFamily: sans, fontSize: 14 },
});
