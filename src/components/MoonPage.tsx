import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import type { KitEvent, KitReading, KitSource } from "../kit/types";
import { useScreen } from "../layout";
import { colors } from "../theme";
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
  const night = reading.dark >= 55;
  const on = (i: number) => reading.leds[i] > 0;
  const onCount = reading.leds.filter((v) => v > 0).length;
  const pulse = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    if (!reading.alarm) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.2, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reading.alarm, pulse]);
  const comms =
    reading.leds[1] === 2 ? "Comms — LOW POWER" : on(1) ? "Comms — ON" : "Comms — OFF";
  const tags = [
    { title: "Communications Tower", line: comms, color: colors.ledBlue, on: on(1), style: { left: "46%" as const, top: "30%" as const } },
    { title: "Science Lab", line: on(2) ? "Science — ON" : "Science — OFF", color: colors.ledYellow, on: on(2), style: { left: "12%" as const, top: "46%" as const } },
    { title: "Hab A", line: on(0) ? "Life Support — ON" : "Life Support — OFF", color: colors.green, on: on(0), style: { left: "38%" as const, top: "40%" as const } },
    { title: "Comfort Module", line: on(3) ? "Comfort — ON" : "Comfort — OFF", color: colors.ledRed, on: on(3), style: { left: "58%" as const, top: "62%" as const } },
    { title: "Solar Arrays", line: solar >= 15 ? "Charging" : "Idle", color: colors.gold, on: solar >= 15, style: { right: "6%" as const, top: "34%" as const } },
  ];

  return (
    <Page>
      <View style={styles.scene}>
        <Image source={require("../../assets/moon/artemis-base.jpg")} style={styles.photo} resizeMode="cover" accessibilityLabel="Artemis lunar research base at the Moon's south pole" />
        <View pointerEvents="none" style={[styles.veil, { opacity: Math.min(0.78, reading.dark / 128) }]} />
        {reading.alarm ? <Animated.View pointerEvents="none" style={[styles.alarm, { opacity: pulse }]} /> : null}
        <DayBadge
          label={reading.alarm ? `Hab A humidity ${Math.round(reading.hum)}%` : night ? `Lunar night · ${onCount} of 4 on` : "Lunar day · all systems on"}
          tone={reading.alarm ? "alert" : night ? "watch" : "ok"}
        />
        {narrow ? null : (
          <View style={styles.linkPill}>
            <View style={styles.earthDotSm} />
            <Text style={styles.linkTxt}>Earth · 1.3 s away by radio</Text>
          </View>
        )}
        {narrow ? null : tags.map((tag) => <GlassTag key={tag.title} title={tag.title} line={tag.line} color={tag.color} on={tag.on} style={tag.style} />)}
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
          { label: "Humidity · Hab A", badge: "DHT11", value: `${Math.round(reading.hum)}%`, valueColor: reading.alarm ? colors.alert : colors.ink, note: `Cutoff ${Math.round(reading.cut)}%`, series: history.map((h) => h.hum), color: colors.ledBlue },
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
  scene: { width: "100%", aspectRatio: 16 / 9, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: "#000" },
  photo: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: "#020308" },
  alarm: {
    position: "absolute",
    left: "36%",
    top: "48%",
    width: "20%",
    height: "16%",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.alert,
    backgroundColor: "rgba(248,113,113,0.1)",
  },
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
