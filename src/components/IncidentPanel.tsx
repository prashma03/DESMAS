import { StyleSheet, Text, View } from "react-native";
import { AUTONOMOUS_POLICY } from "../kit/incidents";
import { kitStore } from "../kit/store";
import { colors } from "../theme";
import { useKit } from "../useKit";
import { mono, sans } from "./dashboard";

function clock(at: number) {
  return new Date(at).toLocaleTimeString(undefined, { hour12: false });
}

export function IncidentPanel({ world }: { world: "earth" | "moon" | "mars" }) {
  useKit();
  const hist = kitStore.getIncidentHistory(60);
  const analog =
    world === "earth"
      ? "Desk Arduino labeled as the Earth clinic analog."
      : `World page is ${world}. Arduino numbers are the desk kit analog — not ${world} instruments.`;

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>Incident intelligence · last 60s</Text>
      <Text style={styles.hint}>{analog}</Text>
      <Text style={styles.hint}>{`${AUTONOMOUS_POLICY.p1} ${AUTONOMOUS_POLICY.p4} ${AUTONOMOUS_POLICY.p3} ${AUTONOMOUS_POLICY.p2}`}</Text>
      <Text style={styles.hint}>{AUTONOMOUS_POLICY.hysteresis}</Text>
      {hist.events.length === 0 ? (
        <Text style={styles.body}>
          {hist.source === "LIVE ARDUINO"
            ? "No LED/alarm transitions in this window yet."
            : "SIMULATED — empty live timeline (not a real incident)."}
        </Text>
      ) : (
        hist.events.map((e) => (
          <View key={e.id} style={{ marginTop: 6 }}>
            <Text style={[styles.title, e.severity === "critical" ? styles.crit : null]}>
              {`${clock(e.at)} · ${e.severity} · ${e.title}`}
            </Text>
            <Text style={styles.hint}>
              {`Observed dark ${String((e.observed as { darkness?: number }).darkness)}% · ${(e.systems || []).join(", ") || "—"}`}
            </Text>
            <Text style={styles.hint}>{`Inferred: ${String((e.inferred as { cause?: string }).cause ?? "")}`}</Text>
          </View>
        ))
      )}
      <Text style={[styles.kicker, { marginTop: 8 }]}>Crew checklist</Text>
      {hist.checklist.map((step) => (
        <Text key={step} style={styles.hint}>{`• ${step}`}</Text>
      ))}
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
  title: { color: colors.ink, fontFamily: sans, fontWeight: "600", fontSize: 14 },
  crit: { color: colors.alert },
});
