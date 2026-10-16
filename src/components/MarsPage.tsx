import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { KitEvent, KitReading, KitSource } from "../kit/types";
import { useScreen } from "../layout";
import { colors } from "../theme";
import { AiMonitor } from "./AIMonitor";
import {
  batteryEstimate,
  DayBadge,
  DelayCard,
  FaultLog,
  GlassTag,
  KitReadout,
  Legend,
  Lower,
  Page,
  PlanetFill,
  PowerBlock,
  SceneTitle,
  SideNav,
  solarOf,
  Split,
  StatRow,
  stormLabel,
} from "./dashboard";

const SYSTEMS = [
  { name: "Life support", detail: "Green LED · air and heat" },
  { name: "Comms", detail: "Blue LED · link to the relay ship" },
  { name: "Science", detail: "Yellow LED · experiments" },
  { name: "Comfort", detail: "Red LED · lights and extras" },
];

export function MarsPage({
  reading,
  history,
  events,
  source,
  marsDelay,
}: {
  reading: KitReading;
  history: KitReading[];
  events: KitEvent[];
  source: KitSource;
  marsDelay: string;
}) {
  const { narrow, width } = useScreen();
  const solar = solarOf(reading.dark);
  const battery = batteryEstimate("mars", reading.dark);
  const storm = stormLabel(reading.dark);
  const thick = reading.dark >= 30;
  const on = (i: number) => reading.leds[i] > 0;
  const onCount = reading.leds.filter((v) => v > 0).length;
  const planet = narrow ? Math.min(150, Math.round(width * 0.36)) : 300;
  const tags = [
    { title: "Comms tower", line: on(1) ? "ON · link to relay ship" : "OFF", color: colors.ledBlue, on: on(1), style: { left: "36%" as const, top: "16%" as const } },
    { title: "Science lab", line: on(2) ? "ON" : "OFF", color: colors.ledYellow, on: on(2), style: { left: "16%" as const, top: "40%" as const } },
    { title: "Hab · life support", line: on(0) ? `ON · humidity ${Math.round(reading.hum)}%` : "OFF", color: colors.green, on: on(0), style: { left: "42%" as const, top: "34%" as const } },
    { title: "Comfort dome", line: on(3) ? "ON" : "OFF", color: colors.ledRed, on: on(3), style: { right: "30%" as const, top: "46%" as const } },
    { title: "Solar arrays", line: `Charging · ${solar}%`, color: colors.gold, on: true, style: { right: "8%" as const, top: "20%" as const } },
  ];

  return (
    <Page>
      <View style={[styles.orbit, narrow ? { height: 300 } : null]}>
        <View style={[styles.planet, { width: planet, height: planet, borderRadius: planet / 2 }, narrow ? { left: 16, top: 44 } : null]}>
          <PlanetFill kind="mars" />
        </View>
        <View style={[styles.ship, narrow ? { right: "8%" as const, top: "22%" as const } : null]} />
        <View style={styles.dash} />
        {narrow ? null : (
          <>
            <GlassTag title="Relay ship" line="Fixes its own faults" color="#FFC59E" style={{ right: "16%", top: "28%" }} />
            <GlassTag title="Future base" line={`Solar ${solar}% · ${onCount} of 4 on`} color={colors.ok} style={{ left: "22%", top: "58%" }} />
            <View style={styles.delayPill}>
              <Text style={styles.delayTxt}>Earth · up to 22 min one way</Text>
            </View>
            <View style={styles.stormCard}>
              <Text style={styles.kicker}>Dust storm · from the light sensor</Text>
              <Text style={styles.stormVal}>{`${Math.round(reading.dark)}%  ${storm}`}</Text>
              <Text style={styles.note}>Cover the light sensor to thicken the storm. The base sheds power the same way it does in a lunar night.</Text>
            </View>
          </>
        )}
        <DayBadge label={`Dust storm · ${storm}`} tone={reading.dark >= 55 ? "alert" : thick ? "watch" : "ok"} />
        <SceneTitle kicker="03 · Mars · next" title="Relay ship and future base" style={narrow ? undefined : { maxWidth: "52%" }} />
      </View>
      {narrow ? (
        <>
          <Legend>
            <GlassTag inline title="Relay ship" line="Fixes its own faults" color="#FFC59E" />
            <GlassTag inline title="Future base" line={`Solar ${solar}% · ${onCount} of 4 on`} color={colors.ok} />
            <GlassTag inline title="Earth link" line="Up to 22 min one way" color="#FFC59E" />
          </Legend>
          <View style={styles.stormInline}>
            <Text style={styles.kicker}>Dust storm · from the light sensor</Text>
            <Text style={styles.stormVal}>{`${Math.round(reading.dark)}%  ${storm}`}</Text>
            <Text style={styles.note}>Cover the light sensor to thicken the storm. The base sheds power the same way it does in a lunar night.</Text>
          </View>
        </>
      ) : null}

      <View style={[styles.scene, narrow ? { height: 300 } : null]}>
        <LinearGradient colors={thick ? ["#4a2018", "#7a341c", "#9a3a1c", "#6a2814"] : ["#c45a32", "#e07a45", "#c4512a", "#8d3418"]} style={StyleSheet.absoluteFill} />
        <View style={styles.ground} />
        <View style={[styles.hab, narrow ? { left: "16%", width: "36%" } : { left: "24%" }]} />
        <View style={[styles.hab, narrow ? { left: "42%", width: "28%" } : { left: "40%", width: 110 }]} />
        <View style={styles.dome} />
        <View style={styles.array} />
        <View style={[styles.veil, { opacity: Math.min(0.55, reading.dark / 140) }]} />
        <DayBadge label={thick ? `Dust · ${storm.toLowerCase()} · lunar night rules` : "Clear sky · solar charging · all systems on"} tone={thick ? "watch" : "ok"} />
        {narrow ? null : tags.map((tag) => <GlassTag key={tag.title} title={tag.title} line={tag.line} color={tag.color} on={tag.on} style={tag.style} />)}
        <SceneTitle kicker="03 · Mars · surface · crewed" title="Future base" />
        {narrow ? null : (
          <KitReadout
            live={source === "serial"}
            dark={reading.dark}
            hum={reading.hum}
            temp={reading.temp}
            note="The AI advises this crew. Same four systems and rules as the Moon base. The relay ship above handles its own faults."
          />
        )}
      </View>
      {narrow ? (
        <>
          <Legend>
            {tags.map((tag) => (
              <GlassTag key={tag.title} inline title={tag.title} line={tag.line} color={tag.color} on={tag.on} />
            ))}
          </Legend>
          <KitReadout
            inline
            live={source === "serial"}
            dark={reading.dark}
            hum={reading.hum}
            temp={reading.temp}
            note="The AI advises this crew. Same four systems and rules as the Moon base. The relay ship above handles its own faults."
          />
        </>
      ) : null}

      <StatRow
        stats={[
          { label: "Solar input", badge: "A0", value: `${solar}%`, note: "Dust on panels and in the air", series: history.map((h) => solarOf(h.dark)), color: colors.gold },
          { label: "Dust storm", badge: "A0", value: storm, note: `${Math.round(reading.dark)}% strength`, series: history.map((h) => h.dark), color: "#FFB07A" },
          { label: "Humidity · hab", badge: "DHT11", value: `${Math.round(reading.hum)}%`, valueColor: reading.alarm ? colors.alert : colors.ink, note: `Cutoff ${Math.round(reading.cut)}%`, series: history.map((h) => h.hum), color: colors.ledBlue },
          { label: "Systems on", badge: "LEDs", value: `${onCount} of 4`, note: "Lowest priority goes off first", series: history.map((h) => h.leds.filter((v) => v > 0).length), color: colors.green },
          { label: "Earth link", value: marsDelay, note: "One way, depends on orbits", color: colors.ink },
          { label: "Relay ship", value: "Healthy", valueColor: colors.ok, note: "2 faults handled onboard", color: colors.ok },
        ]}
      />

      <Lower nav={<SideNav label="On Mars" items={["Base power", "Surface base", "Earth delay", "Fault log", "AI monitor"]} />}>
        <PowerBlock
          eyebrow="Base power · rules learned on the Moon"
          title="A dust storm is a long lunar night"
          systems={SYSTEMS}
          leds={reading.leds}
          solar={solar}
          battery={battery}
        />
        <Split>
          <DelayCard delay={marsDelay} />
          <FaultLog events={events} />
        </Split>
        <AiMonitor world="mars" reading={reading} source={source} />
      </Lower>
    </Page>
  );
}

const styles = StyleSheet.create({
  orbit: { height: 420, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: "#05060a" },
  planet: { position: "absolute", left: 36, top: 36, width: 300, height: 300, borderRadius: 150, overflow: "hidden" },
  ship: { position: "absolute", right: "22%", top: "24%", width: 16, height: 10, borderRadius: 5, backgroundColor: "#f4f1ea" },
  dash: { position: "absolute", left: "28%", top: "34%", width: "36%", height: 1, backgroundColor: "rgba(255,197,158,0.7)" },
  delayPill: { position: "absolute", top: 16, right: 16, zIndex: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(8,10,14,0.72)", borderWidth: 1, borderColor: colors.line },
  delayTxt: { color: "#FFC59E", fontSize: 11, letterSpacing: 0.6 },
  stormCard: { position: "absolute", right: 16, bottom: 16, zIndex: 3, width: 220, maxWidth: "42%", padding: 12, borderRadius: 16, backgroundColor: "rgba(8,10,14,0.82)", borderWidth: 1, borderColor: colors.line, gap: 4 },
  stormInline: { width: "100%", padding: 12, borderRadius: 16, backgroundColor: "rgba(8,10,14,0.82)", borderWidth: 1, borderColor: colors.line, gap: 4 },
  kicker: { color: colors.dim, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  stormVal: { color: "#FFB07A", fontSize: 32, fontWeight: "300" },
  stormWord: { position: "absolute", right: 12, top: 36, color: colors.ink, fontSize: 14 },
  note: { color: colors.dim, fontSize: 12, lineHeight: 16 },
  scene: { height: 420, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  ground: { position: "absolute", left: 0, right: 0, bottom: 0, height: "38%", backgroundColor: "#8a3018" },
  hab: { position: "absolute", bottom: "30%", width: 140, height: 44, borderRadius: 22, backgroundColor: "#f4f1ea" },
  dome: { position: "absolute", left: "54%", bottom: "26%", width: 64, height: 44, borderTopLeftRadius: 36, borderTopRightRadius: 36, backgroundColor: "#efeae2" },
  array: { position: "absolute", right: "12%", bottom: "34%", width: 84, height: 48, backgroundColor: "#16325c", transform: [{ rotate: "-16deg" }] },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: "#2a0c08" },
});
