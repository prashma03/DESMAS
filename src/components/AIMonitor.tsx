import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { KitReading, WorldId } from "../kit/types";
import { colors, styles } from "../theme";

const QUESTIONS: Record<Exclude<WorldId, "all">, string[]> = {
  earth: [
    "Will the fridge stay cold until sunrise?",
    "Can we turn the fan back on?",
    "Which readings are you watching?",
  ],
  moon: [
    "Can we turn Science back on tonight?",
    "Do we need to call Earth about this?",
    "Which readings are you watching?",
  ],
  mars: [
    "Should we wait for Earth before acting?",
    "What did the relay ship fix on its own?",
    "Which readings are you watching?",
  ],
};

function fallback(world: Exclude<WorldId, "all">, r: KitReading) {
  if (r.alarm) {
    if (world === "earth") {
      return {
        title: "Humidity is rising in the vaccine store room",
        body: `Humidity rose to ${r.hum}% while temperature stayed near ${r.temp} °C. Shut the door and window.`,
        steps: [
          "Shut the store room door and window.",
          "Place silica gel packs near the fridge.",
          "Watch humidity until it is under the cutoff.",
        ],
        part: "Silica gel packs",
      };
    }
    if (world === "mars") {
      return {
        title: "Hab humidity is above cutoff during the storm",
        body: `Humidity is ${r.hum}% at ${r.temp} °C. Keep Science off until solar is healthier.`,
        steps: [
          "Leave Science off while the storm is thick.",
          "Check the hab dehumidifier.",
          "Watch humidity for 10 minutes.",
        ],
        part: "Spare battery heater",
      };
    }
    return {
      title: "The dehumidifier fan in Hab A has likely stopped",
      body: `Humidity rose while temperature stayed near ${r.temp} °C. That pattern means the air is not being dried.`,
      steps: [
        "Check whether the dehumidifier fan in Hab A is spinning.",
        "If it has stopped, swap in the spare fan module.",
        "Switch it back on and check for airflow at the vent.",
        "Watch humidity for 10 minutes. It should fall below 62%.",
      ],
      part: "Spare fan module · 2 in Storage B",
    };
  }
  if (r.dark >= 55) {
    return {
      title: world === "mars" ? "Dust is cutting solar input" : "Night: the board is shedding load",
      body: `Light sensor is ${r.dark}% dark. Science/lights are off. Priority 1 stays on.`,
      steps: [] as string[],
      part: null as string | null,
    };
  }
  return {
    title: world === "earth" ? "Daylight: the battery is charging" : "All readings are in the normal range",
    body: `Humidity is ${r.hum}%, under the ${r.cut}% cutoff. Light sensor ${r.dark}% dark.`,
    steps: [] as string[],
    part: null as string | null,
  };
}

function cannedAnswer(world: Exclude<WorldId, "all">, q: string, r: KitReading) {
  if (q.includes("Science")) {
    return r.leds[2]
      ? `It is already on. The light sensor reads ${r.dark}% dark, under the 55% limit for lunar night.`
      : "Not yet. With Science off, the battery lasts until sunrise. The board turns it back on when the light sensor drops below 55% dark.";
  }
  if (q.includes("fridge")) {
    return "Yes, if nothing else changes. The fridge is priority 1, so it is the last thing the board turns off.";
  }
  if (q.includes("Earth before")) {
    return "No. A reply could take up to 44 minutes. These power rules were tested during lunar nights, so the base can follow them on its own.";
  }
  if (q.includes("relay")) {
    return "Relay ship: radio A stopped answering — switched to radio B. Camera heater fault — camera turned off to save power.";
  }
  if (q.includes("watching")) {
    return `Humidity ${r.hum}% (cutoff ${r.cut}%), darkness ${r.dark}%, temperature ${r.temp} °C, LEDs ${r.leds.join(",")}.`;
  }
  return "Grok diagnosis is not wired yet. This answer is the onboard fallback.";
}

export function AiMonitor({
  world,
  reading,
}: {
  world: Exclude<WorldId, "all">;
  reading: KitReading;
}) {
  const finding = fallback(world, reading);
  const [log, setLog] = useState(() => [
    { q: QUESTIONS[world][0], a: cannedAnswer(world, QUESTIONS[world][0], reading) },
  ]);

  return (
    <View style={styles.panel}>
      <Text style={styles.kicker}>AI monitor · fallback plans (Grok next)</Text>
      <Text style={styles.finding}>{finding.title}</Text>
      <Text style={styles.hint}>{finding.body}</Text>
      <View style={styles.row}>
        <Chip text={`Humidity ${reading.hum}%`} />
        <Chip text={`Cutoff ${reading.cut}%`} />
        <Chip text={`Temp ${reading.temp} °C`} />
        <Chip text={`Dark ${reading.dark}%`} />
      </View>
      <Text style={styles.kicker}>Troubleshooting plan</Text>
      {finding.steps.length ? (
        finding.steps.map((s, i) => (
          <Text key={s} style={styles.body}>{`${i + 1}. ${s}`}</Text>
        ))
      ) : (
        <Text style={styles.hint}>No plan needed right now. One appears when a reading crosses its cutoff.</Text>
      )}
      {finding.part ? <Text style={styles.hint}>{`Parts in stock · ${finding.part}`}</Text> : null}
      <Text style={styles.kicker}>Ask the crew&apos;s AI</Text>
      {log.map((m) => (
        <View key={m.q}>
          <View style={styles.bubbleCrew}>
            <Text>{m.q}</Text>
          </View>
          <View style={styles.bubbleAi}>
            <Text style={{ color: colors.ink }}>{m.a}</Text>
          </View>
        </View>
      ))}
      <View style={styles.row}>
        {QUESTIONS[world].map((q) => (
          <Pressable
            key={q}
            style={styles.navBtn}
            onPress={() => setLog((prev) => [{ q, a: cannedAnswer(world, q, reading) }, ...prev].slice(0, 4))}
          >
            <Text style={styles.navTxt}>{q}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipTxt}>{text}</Text>
    </View>
  );
}
