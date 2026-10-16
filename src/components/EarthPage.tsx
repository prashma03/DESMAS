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
  KitReadout,
  LedMap,
  Lower,
  Page,
  PowerBlock,
  SceneTitle,
  SideNav,
  solarOf,
  Split,
  StatRow,
} from "./dashboard";

const SYSTEMS = [
  { name: "Vaccine fridge", detail: "Green LED · pin 8 · never shed" },
  { name: "Radio", detail: "Blue LED · pin 9 · link to the district" },
  { name: "Lights", detail: "Yellow LED · pin 10 · exam room" },
  { name: "Fan", detail: "Red LED · pin 11 · cooling" },
];

export function EarthPage({
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
  const battery = batteryEstimate("earth", reading.dark);
  const night = reading.dark >= 55;
  const dusk = !night && reading.dark >= 30;
  const on = (i: number) => reading.leds[i] > 0;

  return (
    <Page>
      <View style={styles.scene}>
        <LinearGradient
          colors={night ? ["#1a2744", "#24324a", "#3a4634", "#243024"] : ["#8ec8ef", "#d5eef8", "#c5e2a4", "#6f9a4e"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.ground, { backgroundColor: night ? "#1c2818" : "#6d9a48" }]} />
        <View style={[styles.peak, { left: "8%", borderBottomColor: night ? "#2c3a28" : "#8eae78" }]} />
        <View style={[styles.peak, { left: "22%", borderBottomColor: night ? "#334232" : "#9bb884", borderLeftWidth: 110, borderRightWidth: 110, borderBottomWidth: 150 }]} />
        <View style={[styles.peak, { right: "6%", borderBottomColor: night ? "#2a3828" : "#7f9e6c" }]} />
        <Tree left="6%" />
        <Tree left="14%" />
        <Tree left="78%" />
        <View style={styles.clinic}>
          <View style={styles.roof}>
            <View style={styles.panels}>
              {Array.from({ length: 8 }).map((_, i) => (
                <View key={i} style={styles.cell} />
              ))}
            </View>
          </View>
          <View style={styles.walls}>
            <View style={styles.window} />
            <View style={styles.door} />
            <View style={styles.window} />
          </View>
          <View style={styles.sign}>
            <Text style={styles.signTxt}>CLINIC</Text>
          </View>
        </View>
        <View style={styles.fanBox} />
        <View style={styles.tower} />
        <View style={[styles.veil, { opacity: Math.min(0.62, reading.dark / 140) }]} />
        <DayBadge
          label={night ? "Night · on battery" : dusk ? "Sunset · fan off" : "Daylight · solar charging the battery"}
          tone={reading.alarm ? "alert" : night || dusk ? "watch" : "ok"}
        />
        <GlassTag title="Vaccine fridge" line={on(0) ? "ON · P1 · always" : "OFF · P1"} color={colors.green} on={on(0)} style={{ left: "30%", top: "28%" }} />
        <GlassTag title="Fan" line={on(3) ? "ON · P4" : "OFF · P4"} color={colors.ledRed} on={on(3)} style={{ right: "24%", top: "34%" }} />
        <GlassTag title="Battery" line={`Estimate · ${battery}%`} color={colors.gold} style={{ right: "18%", top: "52%" }} />
        <GlassTag title="Lights" line={on(2) ? "ON · P3" : "OFF · P3"} color={colors.ledYellow} on={on(2)} style={{ left: "46%", top: "58%" }} />
        <GlassTag title="Radio" line={on(1) ? "ON · P2" : "OFF · P2"} color={colors.ledBlue} on={on(1)} style={{ right: "8%", top: "16%" }} />
        <SceneTitle kicker="01 · Earth · today" title="Off-grid clinic" />
        <KitReadout
          live={source === "serial"}
          dark={reading.dark}
          hum={reading.hum}
          temp={reading.temp}
          note="Cover the light sensor for sunset. Breathe on the DHT11 to test the store room alarm."
        />
      </View>

      <StatRow
        stats={[
          { label: "Solar input", badge: "A0", value: `${solar}%`, note: solar > 40 ? "Charging the battery" : "On battery", series: history.map((h) => solarOf(h.dark)), color: colors.gold },
          { label: "Systems on", badge: "LEDs", value: `${reading.leds.filter((v) => v > 0).length} of 4`, note: "Fan goes off first", series: history.map((h) => h.leds.filter((v) => v > 0).length), color: colors.green },
          { label: "Humidity · store room", badge: "DHT11", value: `${Math.round(reading.hum)}%`, valueColor: reading.alarm ? colors.alert : colors.ink, note: `Cutoff ${Math.round(reading.cut)}%`, series: history.map((h) => h.hum), color: colors.ledBlue },
          { label: "Temp · store room", badge: "DHT11", value: `${reading.temp.toFixed(1)} °C`, note: "Where the vaccines are kept", series: history.map((h) => h.temp), color: colors.ledBlue },
          { label: "Battery", value: `${battery}%`, note: "Estimate · no sensor on the kit", series: history.map((h) => batteryEstimate("earth", h.dark)), color: colors.gold },
          { label: "Vaccine fridge", value: "5 °C", note: "Estimate · safe range 2 to 8 °C", color: colors.green },
        ]}
      />

      <Lower nav={<SideNav label="At this clinic" items={["Power", "Same four LEDs", "Alert feed", "AI monitor"]} />}>
        <PowerBlock
          eyebrow="Power priority · set by the Arduino"
          title="Keep the vaccines cold until sunrise"
          systems={SYSTEMS}
          leds={reading.leds}
          solar={solar}
          battery={battery}
        />
        <Split>
          <LedMap leds={reading.leds} />
          <AlertFeed world="earth" events={events} />
        </Split>
        <AiMonitor world="earth" reading={reading} source={source} />
      </Lower>
    </Page>
  );
}

function Tree({ left }: { left: `${number}%` }) {
  return (
    <View style={[styles.tree, { left }]}>
      <View style={styles.canopy} />
      <View style={styles.trunk} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { height: 460, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  ground: { position: "absolute", left: 0, right: 0, bottom: 0, height: "34%" },
  peak: {
    position: "absolute",
    bottom: "28%",
    width: 0,
    height: 0,
    borderLeftWidth: 90,
    borderRightWidth: 90,
    borderBottomWidth: 120,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  tree: { position: "absolute", bottom: "30%", alignItems: "center" },
  canopy: { width: 46, height: 64, borderRadius: 24, backgroundColor: "#2f6a34" },
  trunk: { width: 6, height: 18, backgroundColor: "#5a3b24" },
  clinic: { position: "absolute", left: "28%", bottom: "16%", width: 280, alignItems: "center" },
  roof: { width: 300, height: 54, backgroundColor: "#8d9298", borderTopLeftRadius: 6, borderTopRightRadius: 6, justifyContent: "center" },
  panels: { flexDirection: "row", justifyContent: "center", gap: 4 },
  cell: { width: 22, height: 28, backgroundColor: "#1d3d66", borderRadius: 2 },
  walls: { width: 260, height: 110, backgroundColor: "#f3efe6", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-evenly", paddingBottom: 0 },
  window: { width: 36, height: 32, backgroundColor: "#243044", marginBottom: 28 },
  door: { width: 34, height: 58, backgroundColor: "#6b4a32" },
  sign: { position: "absolute", top: 62, backgroundColor: "#1f6b45", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 },
  signTxt: { color: "#fff", fontSize: 10, letterSpacing: 1 },
  fanBox: { position: "absolute", right: "30%", bottom: "28%", width: 36, height: 28, backgroundColor: "#d9d3c8", borderRadius: 4 },
  tower: { position: "absolute", right: "12%", bottom: "30%", width: 3, height: 120, backgroundColor: "#c5c8cc" },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: "#05070d" },
});
