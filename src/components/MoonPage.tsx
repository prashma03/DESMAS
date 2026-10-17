import { Image, Platform, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from "react-native";
import type { KitEvent, KitReading, KitSource } from "../kit/types";
import { useScreen } from "../layout";
import { colors } from "../theme";
import { SceneScanOverlay } from "./SceneScanOverlay";
import { HumidityRings } from "./HumidityRings";
import { AiMonitor } from "./AIMonitor";
import {
  AlertFeed,
  batteryEstimate,
  DayBadge,
  GlassTag,
  HumidityChart,
  KitReadout,
  Legend,
  Lower,
  mono,
  Page,
  PowerBlock,
  sans,
  SceneTitle,
  SerialLog,
  SideNav,
  solarOf,
  Split,
  StatRow,
} from "./dashboard";

const DAY = require("../../assets/moon/artemis-day.jpg");
const NIGHT = require("../../assets/moon/artemis-night.jpg");

/** Daylight through the first cover, then the night plate is fully in by lunar night. */
function nightOpacity(dark: number) {
  return Math.max(0, Math.min(1, (dark - 24) / (58 - 24)));
}

function powerWord(led: number) {
  if (led === 2) return "LOW POWER";
  return led > 0 ? "ON" : "OFF";
}

function solarWord(dark: number) {
  if (dark >= 55) return "LOW";
  if (dark >= 30) return "DIM";
  return "CHARGING";
}

function HabLabel({
  alarm,
  hum,
  led,
  style,
  inline,
}: {
  alarm: boolean;
  hum: number;
  led: number;
  style?: ViewStyle;
  inline?: boolean;
}) {
  if (!alarm) {
    return (
      <GlassTag
        inline={inline}
        title="Hab A"
        line={`LIFE SUPPORT: ${powerWord(led)}`}
        color={colors.green}
        on={led > 0}
        style={style}
      />
    );
  }
  return (
    <View style={[styles.habAlert, inline ? styles.habInline : null, style]}>
      <Text style={styles.habTitle}>Hab A · life support</Text>
      <Text style={styles.habLine}>{`HUMIDITY ${Math.round(hum)}% · ALERT`}</Text>
    </View>
  );
}

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
  lines,
}: {
  reading: KitReading;
  history: KitReading[];
  events: KitEvent[];
  source: KitSource;
  lines: string[];
}) {
  const { narrow } = useScreen();
  const solar = solarOf(reading.dark);
  const battery = batteryEstimate("moon", reading.dark);
  const allOn = reading.leds.every((v) => v > 0);
  const on = (i: number) => reading.leds[i] > 0;
  const onCount = reading.leds.filter((v) => v > 0).length;
  const humidityAlarm = reading.alarm === 1;
  const above = { zIndex: 4 as const };
  const tags = [
    { title: "Communications Tower", line: `COMMS: ${powerWord(reading.leds[1])}`, color: reading.leds[1] === 2 ? colors.gold : colors.ledBlue, on: on(1), style: { ...above, left: "44%" as const, top: "28%" as const } },
    { title: "Science Lab", line: `SCIENCE: ${powerWord(reading.leds[2])}`, color: colors.ledYellow, on: on(2), style: { ...above, left: "6%" as const, top: "52%" as const } },
    { title: "Comfort Module", line: `COMFORT: ${powerWord(reading.leds[3])}`, color: colors.ledRed, on: on(3), style: { ...above, left: "54%" as const, top: "68%" as const } },
    { title: "Solar Arrays", line: `SOLAR INPUT: ${solarWord(reading.dark)}`, color: colors.gold, on: reading.dark < 55, style: { ...above, right: "2%" as const, top: "38%" as const } },
  ];
  const habStyle = { ...above, left: "36%" as const, top: "44%" as const };

  return (
    <Page>
      <View style={styles.scene}>
        <Image source={DAY} style={styles.photo} resizeMode="cover" accessibilityLabel="Artemis base in lunar daylight" />
        <Image
          source={NIGHT}
          style={[styles.photo, styles.nightFade, { opacity: nightOpacity(reading.dark) }]}
          resizeMode="cover"
          accessibilityLabel="Artemis base during lunar night"
        />
        <SceneScanOverlay tone="moon" />
        <HumidityRings active={humidityAlarm} />
        <DayBadge
          label={reading.alarm ? `Hab A humidity ${Math.round(reading.hum)}%` : allOn ? "Lunar day · all systems on" : `Lunar night · ${onCount} of 4 on`}
          tone={reading.alarm ? "alert" : allOn ? "ok" : "watch"}
        />
        {narrow ? null : (
          <View style={styles.linkPill}>
            <View style={styles.earthDotSm} />
            <Text style={styles.linkTxt}>Earth · 1.3 s away by radio</Text>
          </View>
        )}
        {narrow ? null : (
          <>
            {tags.map((tag) => (
              <GlassTag key={tag.title} title={tag.title} line={tag.line} color={tag.color} on={tag.on} style={tag.style} />
            ))}
            <HabLabel alarm={humidityAlarm} hum={reading.hum} led={reading.leds[0]} style={habStyle} />
          </>
        )}
        <SceneTitle kicker="02 · Moon · lunar south pole" title="Artemis base" />
        {narrow ? null : (
          <KitReadout
            live={source === "serial"}
            dark={reading.dark}
            hum={reading.hum}
            temp={reading.temp}
            muted={reading.muted}
            note="Cover the light sensor for lunar night. Cover it fully so comms drop to low power. Breathe on the DHT11 to set off the humidity alarm."
          />
        )}
      </View>
      {narrow ? (
        <>
          <Legend>
            <GlassTag inline title="Earth link" line="1.3 s by radio" color={colors.blue} />
            {tags.map((tag) => (
              <GlassTag key={tag.title} inline title={tag.title} line={tag.line} color={tag.color} on={tag.on} />
            ))}
            <HabLabel inline alarm={humidityAlarm} hum={reading.hum} led={reading.leds[0]} />
          </Legend>
          <KitReadout
            inline
            live={source === "serial"}
            dark={reading.dark}
            hum={reading.hum}
            temp={reading.temp}
            muted={reading.muted}
            note="Cover the light sensor for lunar night. Cover it fully so comms drop to low power. Breathe on the DHT11 to set off the humidity alarm."
          />
        </>
      ) : null}

      <StatRow
        stats={[
          { label: "Solar input", badge: "A0", value: `${solar}%`, note: `Light sensor, ${Math.round(reading.dark)}% dark`, series: history.map((h) => solarOf(h.dark)), color: colors.gold },
          { label: "Systems on", badge: "LEDs", value: `${onCount} of 4`, note: "Lowest priority goes off first", series: history.map((h) => h.leds.filter((v) => v > 0).length), color: colors.green },
          { label: "Humidity · Hab A", badge: "DHT11", value: `${Math.round(reading.hum)}%`, valueColor: humidityAlarm ? colors.alert : colors.ink, note: humidityAlarm ? `Above cutoff (${Math.round(reading.cut)}%)` : `Cutoff ${Math.round(reading.cut)}%`, series: history.map((h) => h.hum), color: humidityAlarm ? colors.alert : colors.ledBlue, alert: humidityAlarm },
          { label: "Temp · Hab A", badge: "DHT11", value: `${reading.temp.toFixed(1)} °C`, note: "Inside the hab", series: history.map((h) => h.temp), color: colors.ledBlue },
          { label: "Battery", value: `${battery}%`, note: "Estimate · no sensor on the kit", series: history.map((h) => batteryEstimate("moon", h.dark)), color: colors.gold },
          { label: "Earth link", value: "1.3 s", note: "One way, by radio", color: colors.blue },
        ]}
      />

      <Lower
        nav={
          <SideNav
            label="On this base"
            items={[
              { id: "power", label: "Power" },
              { id: "humidity", label: "Hab A" },
              { id: "feed", label: "Alert feed" },
              { id: "serial", label: "Raw serial" },
              { id: "monitor", label: "AI monitor" },
            ]}
          />
        }
      >
        <View nativeID="power">
          <PowerBlock
            eyebrow="Power priority · set by the Arduino"
            title="What stays on when the sun goes down"
            systems={SYSTEMS}
            leds={reading.leds}
            solar={solar}
            battery={battery}
          />
        </View>
        <Split>
          <View nativeID="humidity" style={styles.slot}>
            <HumidityChart history={history} reading={reading} />
          </View>
          <View nativeID="feed" style={styles.slot}>
            <AlertFeed world="moon" events={events} />
          </View>
        </Split>
        <SerialLog lines={lines} live={source === "serial"} />
        <AiMonitor world="moon" reading={reading} source={source} />
      </Lower>
    </Page>
  );
}

const styles = StyleSheet.create({
  slot: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, maxWidth: "100%" },
  scene: { width: "100%", aspectRatio: 1006 / 492, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: "#000" },
  photo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  nightFade: (Platform.OS === "web"
    ? { transitionProperty: "opacity", transitionDuration: "800ms", transitionTimingFunction: "ease" }
    : {}) as ImageStyle,
  habAlert: {
    position: "absolute",
    zIndex: 4,
    backgroundColor: "rgba(8,10,14,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,107,94,0.92)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
    maxWidth: "100%",
  },
  habInline: { position: "relative", alignSelf: "flex-start", flexShrink: 1 },
  habTitle: { color: "#FFFFFF", fontSize: 13, fontFamily: sans },
  habLine: { color: colors.alert, fontSize: 11, fontFamily: mono, letterSpacing: 0.4 },
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
