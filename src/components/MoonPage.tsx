import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { KitEvent, KitReading, KitSource } from "../kit/types";
import { colors } from "../theme";
import { AiMonitor } from "./AIMonitor";
import {
  AlertFeed,
  batteryEstimate,
  DayBadge,
  GlassTag,
  HumidityChart,
  KitReadout,
  Lower,
  Page,
  PowerBlock,
  SceneTitle,
  SerialLog,
  SideNav,
  solarOf,
  Split,
  StatRow,
} from "./dashboard";

const SYSTEMS = [
  { name: "Life support", detail: "Hab A · green LED · pin 8" },
  { name: "Comms", detail: "Comms tower · blue LED · pin 9" },
  { name: "Science", detail: "Lab · yellow LED · pin 10" },
  { name: "Comfort", detail: "Comfort module · red LED · pin 11" },
];

export function MoonPage({
  reading,
  history,
  events,
  source,
}: {
  reading: KitReading;
  history: KitReading[];
  events: KitEvent[];
  source: KitSource;
}) {
  const solar = solarOf(reading.dark);
  const battery = batteryEstimate("moon", reading.dark);
  const night = reading.dark >= 55;
  const on = (i: number) => reading.leds[i] > 0;
  const onCount = reading.leds.filter((v) => v > 0).length;

  return (
    <Page>
      <View style={styles.scene}>
        <LinearGradient colors={["#070b16", "#121826", "#2a2e36", "#1a1c22"]} style={StyleSheet.absoluteFill} />
        <View style={styles.ground} />
        <View style={styles.crater} />
        <View style={styles.craterSm} />
        <View style={styles.earth}>
          <View style={styles.earthDot} />
        </View>
        <View style={[styles.hab, { left: "22%", width: 150 }]} />
        <View style={[styles.hab, { left: "38%", width: 120, bottom: "38%" }]} />
        <View style={styles.dome} />
        <View style={styles.dish} />
        <View style={styles.array} />
        <View style={[styles.veil, { opacity: Math.min(0.55, reading.dark / 160) }]} />
        <DayBadge
          label={reading.alarm ? `Hab A humidity ${Math.round(reading.hum)}%` : night ? `Lunar night · ${onCount} of 4 on` : "Lunar day · all systems on"}
          tone={reading.alarm ? "alert" : night ? "watch" : "ok"}
        />
        <View style={styles.linkPill}>
          <View style={styles.earthDotSm} />
          <Text style={styles.linkTxt}>Earth · 1.3 s away by radio</Text>
        </View>
        <GlassTag title="Comms tower" line={on(1) ? "ON · link to Earth" : "OFF · link to Earth"} color={colors.ledBlue} on={on(1)} style={{ left: "42%", top: "18%" }} />
        <GlassTag title="Science lab" line={on(2) ? "ON" : "OFF"} color={colors.ledYellow} on={on(2)} style={{ left: "18%", top: "42%" }} />
        <GlassTag title="Hab A · life support" line={on(0) ? `ON · humidity ${Math.round(reading.hum)}%` : "OFF"} color={colors.green} on={on(0)} style={{ left: "40%", top: "36%" }} />
        <GlassTag title="Comfort module" line={on(3) ? "ON" : "OFF"} color={colors.ledRed} on={on(3)} style={{ right: "28%", top: "48%" }} />
        <GlassTag title="Solar arrays" line={`Charging · ${solar}%`} color={colors.gold} style={{ right: "8%", top: "22%" }} />
        <SceneTitle kicker="02 · Moon · lunar south pole" title="Artemis base" />
        <KitReadout
          live={source === "serial"}
          dark={reading.dark}
          hum={reading.hum}
          temp={reading.temp}
          note="Cover the light sensor for lunar night. Breathe on the DHT11 to set off the humidity alarm."
        />
      </View>

      <StatRow
        stats={[
          { label: "Solar input", badge: "A0", value: `${solar}%`, note: `Light sensor, ${Math.round(reading.dark)}% dark`, series: history.map((h) => solarOf(h.dark)), color: colors.gold },
          { label: "Systems on", badge: "LEDs", value: `${onCount} of 4`, note: "Lowest priority goes off first", series: history.map((h) => h.leds.filter((v) => v > 0).length), color: colors.green },
          { label: "Humidity · Hab A", badge: "DHT11", value: `${Math.round(reading.hum)}%`, valueColor: reading.alarm ? colors.alert : colors.ink, note: `Cutoff ${Math.round(reading.cut)}%`, series: history.map((h) => h.hum), color: colors.ledBlue },
          { label: "Temp · Hab A", badge: "DHT11", value: `${reading.temp.toFixed(1)} °C`, note: "Inside the hab", series: history.map((h) => h.temp), color: colors.ledBlue },
          { label: "Battery", value: `${battery}%`, note: "Estimate · no sensor on the kit", series: history.map((h) => batteryEstimate("moon", h.dark)), color: colors.gold },
          { label: "Earth link", value: "1.3 s", note: "One way, by radio", color: colors.blue },
        ]}
      />

      <Lower nav={<SideNav label="On this base" items={["Power", "Hab A", "Alert feed", "Raw serial", "AI monitor"]} />}>
        <PowerBlock
          eyebrow="Power priority · set by the Arduino"
          title="What stays on when the sun goes down"
          systems={SYSTEMS}
          leds={reading.leds}
          solar={solar}
          battery={battery}
        />
        <Split>
          <HumidityChart history={history} reading={reading} />
          <AlertFeed world="moon" events={events} />
        </Split>
        <SerialLog history={history} />
        <AiMonitor world="moon" reading={reading} source={source} />
      </Lower>
    </Page>
  );
}

const styles = StyleSheet.create({
  scene: { height: 460, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  ground: { position: "absolute", left: "-10%", right: "-10%", bottom: -30, height: "42%", borderTopLeftRadius: 220, borderTopRightRadius: 220, backgroundColor: "#3a3e46" },
  crater: { position: "absolute", left: "8%", bottom: "18%", width: 90, height: 36, borderRadius: 40, backgroundColor: "#2c3038" },
  craterSm: { position: "absolute", left: "60%", bottom: "14%", width: 50, height: 20, borderRadius: 20, backgroundColor: "#32363e" },
  earth: { position: "absolute", left: "16%", top: 54 },
  earthDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#3d7edb", borderWidth: 3, borderColor: "rgba(120,170,255,0.35)" },
  hab: { position: "absolute", bottom: "32%", height: 48, borderRadius: 24, backgroundColor: "#f4f1ea" },
  dome: { position: "absolute", left: "52%", bottom: "28%", width: 70, height: 48, borderTopLeftRadius: 40, borderTopRightRadius: 40, backgroundColor: "#efeae2" },
  dish: { position: "absolute", left: "48%", bottom: "46%", width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: "#ddd", backgroundColor: "transparent" },
  array: { position: "absolute", right: "10%", bottom: "36%", width: 90, height: 54, backgroundColor: "#16325c", borderWidth: 2, borderColor: "#9bb", transform: [{ rotate: "-18deg" }] },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: "#05060c" },
  linkPill: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(8,10,14,0.72)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  earthDotSm: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#3d7edb" },
  linkTxt: { color: colors.muted, fontSize: 12 },
});
