import { Image, Platform, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from "react-native";
import type { KitEvent, KitReading, KitSource } from "../kit/types";
import { useScreen } from "../layout";
import { colors } from "../theme";
import { AiMonitor } from "./AIMonitor";
import {
  AlertFeed,
  batteryEstimate,
  GlassTag,
  KitReadout,
  LedMap,
  Legend,
  Lower,
  Page,
  PowerBlock,
  SceneTitle,
  SideNav,
  solarOf,
  Split,
  StatRow,
} from "./dashboard";

const DAY = require("../../assets/earth/clinic-day.jpg");
const NIGHT = require("../../assets/earth/clinic-night.jpg");

/** Day plate below 25% dark, night plate fully visible by 65% dark. */
function nightOpacity(dark: number) {
  return Math.max(0, Math.min(1, (dark - 25) / 40));
}

function ledLine(led: number, pin: string, always = false) {
  if (led === 2) return `LOW POWER · ${pin}`;
  if (led > 0) return always ? `ON · ${pin} · ALWAYS` : `ON · ${pin}`;
  return "OFF · SAVING POWER";
}

const SYSTEMS = [
  { name: "Vaccine fridge", detail: "Green LED · pin 8 · never shed" },
  { name: "Radio", detail: "Blue LED · pin 9 · link to the district" },
  { name: "Lights", detail: "Yellow LED · pin 10 · exam room" },
  { name: "Fan", detail: "Red LED · pin 11 · cooling" },
];

const HINT = "Cover the light sensor for sunset. Breathe on the DHT11 to test the store room alarm.";

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
  const { narrow, width } = useScreen();
  const stacked = narrow || width < 980;
  const solar = solarOf(reading.dark);
  const battery = batteryEstimate("earth", reading.dark);
  const dark = Math.round(reading.dark);
  const night = dark >= 55;
  const dusk = !night && dark >= 30;
  const phase = night ? "NIGHT" : dusk ? "DUSK" : "DAY";
  const phaseColor = night ? colors.blue : colors.gold;
  const phaseDetail = night
    ? `Light sensor ${dark}% dark · running on battery`
    : dusk
      ? "Sun going down · fan off"
      : "Daylight · solar charging the battery";
  const batteryLine = `${dark >= 30 ? "ON BATTERY" : "CHARGING"} · EST. ${battery}%`;
  const tags = [
    { title: "Vaccine fridge", line: ledLine(reading.leds[0], "P1", true), color: colors.green, on: reading.leds[0] > 0, x: 30.4, y: 52, side: "above" as const },
    { title: "Fan", line: ledLine(reading.leds[3], "P4"), color: colors.ledRed, on: reading.leds[3] > 0, x: 61.2, y: 50, side: "above" as const },
    { title: "Lights", line: ledLine(reading.leds[2], "P3"), color: colors.ledYellow, on: reading.leds[2] > 0, x: 54.3, y: 72, side: "below" as const },
    { title: "Battery", line: batteryLine, color: colors.gold, on: true, x: 70, y: 64, side: "left" as const },
    { title: "Radio", line: ledLine(reading.leds[1], "P2"), color: reading.leds[1] === 2 ? colors.gold : colors.ledBlue, on: reading.leds[1] > 0, x: 78, y: 12, side: "left" as const },
  ];

  return (
    <Page>
      <View style={styles.scene}>
        <Image source={DAY} style={styles.photo} resizeMode="cover" accessibilityLabel="Off-grid clinic in daylight" />
        <Image
          source={NIGHT}
          style={[styles.photo, styles.nightFade, { opacity: nightOpacity(reading.dark) }]}
          resizeMode="cover"
          accessibilityLabel="Off-grid clinic at night"
        />
        <View style={styles.phase}>
          <Text style={[styles.phaseBadge, { color: phaseColor, backgroundColor: night ? "rgba(158,208,255,0.16)" : "rgba(242,181,68,0.2)" }]}>{phase}</Text>
          <Text style={styles.phaseDetail} numberOfLines={2}>
            {phaseDetail}
          </Text>
        </View>
        {stacked
          ? null
          : tags.map((tag) => (
              <GlassTag
                key={tag.title}
                title={tag.title}
                line={tag.line}
                color={tag.color}
                on={tag.on}
                style={pinStyle(tag.x, tag.y, tag.side)}
              />
            ))}
        <SceneTitle kicker="01 · Earth · today" title="Off-grid clinic" style={stacked ? styles.titleStacked : styles.title} />
        {stacked ? null : (
          <KitReadout live={source === "serial"} dark={reading.dark} hum={reading.hum} temp={reading.temp} muted={reading.muted} note={HINT} />
        )}
      </View>
      {stacked ? (
        <>
          <Legend>
            {tags.map((tag) => (
              <GlassTag key={tag.title} inline title={tag.title} line={tag.line} color={tag.color} on={tag.on} />
            ))}
          </Legend>
          <KitReadout inline live={source === "serial"} dark={reading.dark} hum={reading.hum} temp={reading.temp} muted={reading.muted} note={HINT} />
        </>
      ) : null}

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

      <Lower
        nav={
          <SideNav
            label="At this clinic"
            items={[
              { id: "power", label: "Power" },
              { id: "leds", label: "Same four LEDs" },
              { id: "feed", label: "Alert feed" },
              { id: "monitor", label: "AI monitor" },
            ]}
          />
        }
      >
        <View nativeID="power">
          <PowerBlock
            eyebrow="Power priority · set by the Arduino"
            title="Keep the vaccines cold until sunrise"
            systems={SYSTEMS}
            leds={reading.leds}
            solar={solar}
            battery={battery}
          />
        </View>
        <Split>
          <View nativeID="leds" style={styles.slot}>
            <LedMap leds={reading.leds} />
          </View>
          <View nativeID="feed" style={styles.slot}>
            <AlertFeed world="earth" events={events} />
          </View>
        </Split>
        <AiMonitor world="earth" reading={reading} source={source} />
      </Lower>
    </Page>
  );
}

function pinStyle(x: number, y: number, side: "above" | "below" | "left"): ViewStyle {
  const shift: ViewStyle["transform"] =
    side === "above"
      ? [{ translateX: "-50%" }, { translateY: "-100%" }]
      : side === "below"
        ? [{ translateX: "-50%" }]
        : [{ translateX: "-100%" }, { translateY: "-50%" }];
  return { left: `${x}%`, top: `${y}%`, zIndex: 3, transform: shift };
}

const styles = StyleSheet.create({
  slot: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, maxWidth: "100%" },
  scene: {
    width: "100%",
    aspectRatio: 1520 / 880,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#000",
  },
  photo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  nightFade: (Platform.OS === "web"
    ? { transitionProperty: "opacity", transitionDuration: "800ms", transitionTimingFunction: "ease" }
    : {}) as ImageStyle,
  phase: {
    position: "absolute",
    top: 14,
    left: 14,
    zIndex: 4,
    maxWidth: "70%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 12,
    paddingVertical: 4,
    paddingLeft: 4,
    borderRadius: 999,
    backgroundColor: "rgba(8,10,14,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  phaseBadge: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: Platform.OS === "web" ? "Geist Mono, ui-monospace, monospace" : undefined,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  phaseDetail: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 12,
    fontFamily: Platform.OS === "web" ? "Geist, sans-serif" : undefined,
  },
  title: { maxWidth: "42%", bottom: 16 },
  titleStacked: { maxWidth: "86%", left: 12, bottom: 12 },
});
