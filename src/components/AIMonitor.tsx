import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { KitReading, KitSource, WorldId } from "../kit/types";
import { API } from "../api";
import { colors } from "../theme";
import { mono, sans, solarOf } from "./dashboard";

const QUESTIONS: Record<Exclude<WorldId, "all">, string[]> = {
  earth: ["Will the fridge stay cold until sunrise?", "Can we turn the fan back on?", "Which readings are you watching?"],
  moon: ["Can we turn Science back on tonight?", "Do we need to call Earth about this?", "Which readings are you watching?"],
  mars: ["Should we wait for Earth before acting?", "What did the relay ship fix on its own?", "Which readings are you watching?"],
};

function levelOf(world: Exclude<WorldId, "all">, r: KitReading) {
  if (r.alarm) return "ALERT" as const;
  if (world === "mars" && r.dark >= 85) return "ALERT" as const;
  if (r.dark >= 55 || (world === "earth" && r.dark >= 30) || (world === "mars" && r.dark >= 30)) return "WATCH" as const;
  return "OK" as const;
}

function finding(world: Exclude<WorldId, "all">, r: KitReading) {
  const hum = Math.round(r.hum);
  const solar = solarOf(r.dark);
  if (r.alarm) {
    if (world === "earth") {
      return {
        title: "Humidity is rising in the vaccine store room",
        body: `Humidity is ${hum}% while temperature stayed near ${r.temp.toFixed(1)} °C. Shut the door and window.`,
        steps: ["Shut the store room door and window.", "Place silica gel packs near the fridge.", "Watch humidity until it is under the cutoff."],
        part: "Silica gel packs",
        stock: "In the clinic store",
      };
    }
    if (world === "mars") {
      return {
        title: "Hab humidity is above cutoff during the storm",
        body: `Humidity is ${hum}% at ${r.temp.toFixed(1)} °C. Keep Science off until solar is healthier.`,
        steps: ["Leave Science off while the storm is thick.", "Check the hab dehumidifier.", "Watch humidity for 10 minutes."],
        part: null,
        stock: "",
      };
    }
    return {
      title: "The dehumidifier fan in Hab A has likely stopped",
      body: `Humidity rose from ${Math.round(r.hbase)}% to ${hum}% while the temperature stayed near ${r.temp.toFixed(1)} °C. That pattern means the air is not being dried. It is not a heating problem.`,
      steps: [
        "Check whether the dehumidifier fan in Hab A is spinning.",
        "If it has stopped, switch it off and swap in the spare fan module.",
        "Switch it back on and check for airflow at the vent.",
        "Watch humidity for 10 minutes. It should fall below 62%.",
      ],
      part: "Spare fan module",
      stock: "2 in Storage B",
    };
  }
  if (r.dark >= 55) {
    return {
      title: world === "mars" ? "Dust is cutting solar input" : world === "earth" ? "Night: the board is shedding load" : "Lunar night: Science and Comfort are off",
      body: `Light sensor is ${Math.round(r.dark)}% dark. Priority 1 stays on. The board turns lower loads back on as it gets brighter.`,
      steps: [] as string[],
      part: null,
      stock: "",
    };
  }
  if (world === "earth") {
    return {
      title: "Daylight: the battery is charging",
      body: `Solar input is ${solar}% and ${r.leds.filter((v) => v > 0).length} systems are on. Humidity is ${hum}%, under the ${Math.round(r.cut)}% cutoff.`,
      steps: [] as string[],
      part: null,
      stock: "",
    };
  }
  if (world === "mars") {
    return {
      title: "Solar power is normal",
      body: `Solar input is ${solar}%. The relay ship handled two faults on its own today. Nothing needs the crew.`,
      steps: [] as string[],
      part: null,
      stock: "",
    };
  }
  return {
    title: "All readings are in the normal range",
    body: `Nothing needs attention right now. Humidity is ${hum}%, under the ${Math.round(r.cut)}% cutoff. If a reading crosses its cutoff, a plan appears here.`,
    steps: [] as string[],
    part: null,
    stock: "",
  };
}

function cannedAnswer(world: Exclude<WorldId, "all">, q: string, r: KitReading) {
  if (q.toLowerCase().includes("science")) {
    return r.leds[2]
      ? `It is already on. The light sensor reads ${Math.round(r.dark)}% dark, under the 55% limit for lunar night.`
      : "Not yet. With Science off, the battery lasts until sunrise. The board turns it back on by itself when the light sensor drops below 55% dark.";
  }
  if (q.toLowerCase().includes("fridge")) {
    return "Yes, if nothing else changes. With the fan off, the battery lasts about 11 hours. The fridge is priority 1, so it is the last thing the board turns off.";
  }
  if (q.toLowerCase().includes("fan")) {
    return r.leds[3]
      ? "The fan is already on. It is the first load the board turns off when the light sensor reaches 30% dark."
      : "Not yet. The fan is off so the fridge stays cold. The board turns it back on when the sensor drops below 30% dark.";
  }
  if (q.toLowerCase().includes("earth before") || q.toLowerCase().includes("call earth")) {
    return "No. A reply could take up to 44 minutes. These power rules were tested during lunar nights on the Moon, so the base can follow them on its own.";
  }
  if (q.toLowerCase().includes("relay")) {
    return "Relay ship: radio A stopped answering, so it switched to radio B. A camera heater fault turned the camera off to save power.";
  }
  if (q.toLowerCase().includes("watching") || q.toLowerCase().includes("reading")) {
    return `Humidity ${Math.round(r.hum)}% (cutoff ${Math.round(r.cut)}%), light sensor ${Math.round(r.dark)}% dark, temperature ${r.temp.toFixed(1)} °C, LEDs ${r.leds.join("")}.`;
  }
  return "The onboard fallback is watching humidity, the light sensor, and which LEDs the board left on. Ask about readings, power, or parts.";
}

export function AiMonitor({
  world,
  reading,
  source,
}: {
  world: Exclude<WorldId, "all">;
  reading: KitReading;
  source: KitSource;
}) {
  const info = finding(world, reading);
  const level = levelOf(world, reading);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [via, setVia] = useState<"grok" | "fallback">("fallback");
  const [log, setLog] = useState(() => {
    const q = QUESTIONS[world][0];
    return [{ q, a: cannedAnswer(world, q, reading) }];
  });
  const finished = info.steps.filter((_, i) => done[i]).length;
  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || pending) return;
    setPending(true);
    setDraft("");
    setLog((prev) => [{ q: text, a: "Asking Grok…" }, ...prev].slice(0, 4));
    const local = cannedAnswer(world, text, reading);
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
          <Text style={styles.pill}>{via === "grok" ? "Grok" : "Onboard fallback"}</Text>
        </View>
        <Text style={styles.rate}>{rate}</Text>
      </View>
      <View style={styles.titleRow}>
        <Text style={[styles.level, { color: tone, borderColor: tone }]}>{level}</Text>
        <Text style={styles.title}>{info.title}</Text>
      </View>
      <Text style={styles.body}>{info.body}</Text>
      <View style={styles.chips}>
        <Text style={styles.kicker}>Based on</Text>
        <Chip text={`Humidity ${Math.round(reading.hum)}%`} color={reading.alarm ? colors.alert : colors.ledBlue} />
        <Chip text={`Cutoff ${Math.round(reading.cut)}%`} color={colors.gold} />
        <Chip text={`Temperature ${reading.temp.toFixed(1)} °C`} color={colors.ledBlue} />
      </View>
      <View style={styles.columns}>
        <View style={styles.box}>
          <View style={styles.head}>
            <Text style={styles.kicker}>Troubleshooting plan</Text>
            {info.steps.length ? <Text style={styles.kicker}>{`${finished} / ${info.steps.length} done`}</Text> : null}
          </View>
          {info.steps.length ? (
            info.steps.map((step, i) => (
              <Pressable key={step} style={styles.step} onPress={() => setDone((prev) => ({ ...prev, [i]: !prev[i] }))}>
                <View style={[styles.check, done[i] ? styles.checkOn : null]} />
                <Text style={styles.stepTxt}>{`${String(i + 1).padStart(2, "0")}   ${step}`}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.muted}>No plan needed right now. One appears here as soon as a reading crosses its cutoff.</Text>
          )}
          {info.part ? (
            <View style={styles.part}>
              <Text style={styles.stock}>In stock</Text>
              <Text style={styles.partName}>{info.part}</Text>
              <Text style={styles.muted}>{info.stock}</Text>
            </View>
          ) : null}
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
            {QUESTIONS[world].map((q) => (
              <Pressable key={q} style={styles.suggestBtn} onPress={() => ask(q)}>
                <Text style={styles.suggestTxt}>{q}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.askRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about readings, power or parts"
              placeholderTextColor={colors.dim}
              style={styles.input}
              onSubmitEditing={() => ask(draft)}
            />
            <Pressable style={styles.send} onPress={() => ask(draft)}>
              <Text style={styles.sendTxt}>↑</Text>
            </Pressable>
          </View>
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
  title: { color: colors.ink, fontFamily: sans, fontWeight: "400", fontSize: 26, letterSpacing: -0.4, flexShrink: 1 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, fontFamily: sans },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  kicker: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipTxt: { color: colors.ink, fontSize: 12, fontFamily: sans },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  box: { flexGrow: 1, flexBasis: 280, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 10, backgroundColor: "rgba(255,255,255,0.02)" },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: colors.dim, marginTop: 2 },
  checkOn: { backgroundColor: colors.green, borderColor: colors.green },
  stepTxt: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 20, fontFamily: sans },
  muted: { color: colors.dim, fontSize: 13, lineHeight: 18, fontFamily: sans },
  part: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(134,239,172,0.35)", backgroundColor: "rgba(134,239,172,0.08)", borderRadius: 12, padding: 10 },
  stock: { color: colors.ok, fontFamily: mono, fontSize: 11, letterSpacing: 0.6 },
  partName: { color: colors.ink, flex: 1, fontFamily: sans },
  crew: { alignSelf: "flex-end", maxWidth: "90%", backgroundColor: "#2a2e36", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  crewTxt: { color: colors.ink, fontFamily: sans },
  ai: { alignSelf: "flex-start", maxWidth: "92%", backgroundColor: "#171b22", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  aiTxt: { color: colors.ink, fontFamily: sans, lineHeight: 20 },
  suggest: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestBtn: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(90,168,255,0.45)", paddingHorizontal: 10, paddingVertical: 6 },
  suggestTxt: { color: colors.blue, fontSize: 13, fontFamily: sans },
  askRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingLeft: 14, paddingRight: 4, paddingVertical: 4 },
  input: { flex: 1, color: colors.ink, fontFamily: sans, fontSize: 14, paddingVertical: Platform.OS === "web" ? 8 : 4 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  sendTxt: { color: "#111", fontSize: 16, fontWeight: "700" },
});
