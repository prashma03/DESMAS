import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type ImageStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { EarthDelay } from "../findings";
import { kitFreshness, type KitEvent, type KitReading, type KitSource, type LinkStatus } from "../kit/types";
import { useScreen } from "../layout";
import { board } from "../serial/board";
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
  mono,
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
import { SceneScanOverlay } from "./SceneScanOverlay";

const CLEAR = require("../../assets/mars/surface-clear.jpg");
const STORM = require("../../assets/mars/surface-storm.jpg");
const ADVICE = "Same four systems and rules as the Moon base. The relay ship above handles its own faults.";

/** Clear plate below a light haze, storm plate fully in by a strong dust storm. */
function stormOpacity(dark: number) {
  return Math.max(0, Math.min(1, (dark - 18) / (58 - 18)));
}

function systemStatus(led: number, on: string, off: string) {
  if (led === 2) return "LOW POWER · LINK TO RELAY SHIP";
  return led > 0 ? on : off;
}

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
  delay,
  link,
}: {
  reading: KitReading;
  history: KitReading[];
  events: KitEvent[];
  source: KitSource;
  delay: EarthDelay | null;
  link?: LinkStatus;
}) {
  const { narrow, width } = useScreen();
  const fresh = kitFreshness(source, link);
  const solar = solarOf(reading.dark);
  const battery = batteryEstimate("mars", reading.dark);
  const storm = stormLabel(reading.dark);
  const oneWay = delay ? `${delay.oneWayMin.toFixed(1)} min` : "3 to 22 min";
  const linkLine = delay ? `Earth · ${delay.oneWayMin.toFixed(1)} min one way today` : "Earth · up to 22 min one way";
  const thick = reading.dark >= 30;
  const on = (i: number) => reading.leds[i] > 0;
  const onCount = reading.leds.filter((v) => v > 0).length;
  const planet = narrow ? Math.min(150, Math.round(width * 0.36)) : 300;
  const clearSky = reading.dark < 30;
  const active = colors.green;
  const cover = { backgroundColor: "rgba(10,8,6,0.96)" as const, zIndex: 5 };
  const tags = [
    { title: "Comms tower", line: systemStatus(reading.leds[1], "ON · LINK TO RELAY SHIP", "OFF"), color: reading.leds[1] === 2 ? colors.gold : active, on: reading.leds[1] > 0, style: { ...cover, left: "38%" as const, top: "14%" as const, minWidth: 168 } },
    { title: "Science lab", line: on(2) ? "ON" : "OFF · SAVING POWER", color: active, on: on(2), style: { ...cover, left: "18%" as const, top: "42%" as const, minWidth: 156 } },
    { title: "Hab · life support", line: reading.alarm ? `ALERT · HUMIDITY ${Math.round(reading.hum)}%` : on(0) ? `ON · HUMIDITY ${Math.round(reading.hum)}%` : "OFF", color: reading.alarm ? colors.alert : active, on: reading.alarm ? true : on(0), style: { ...cover, left: "39%" as const, top: "34%" as const, minWidth: 168 } },
    { title: "Comfort dome", line: on(3) ? "ON" : "OFF · SAVING POWER", color: active, on: on(3), style: { ...cover, left: "63%" as const, top: "58%" as const, minWidth: 156 } },
    { title: "Solar arrays", line: thick ? `DUST · ${solar}%` : `CHARGING · ${solar}%`, color: colors.gold, on: true, style: { ...cover, right: "7%" as const, top: "16%" as const, minWidth: 132 } },
  ];
  const phase = clearSky ? "CLEAR SKY" : `DUST STORM · ${storm.toUpperCase()}`;
  const phaseDetail = clearSky
    ? onCount === 4
      ? "Solar charging · all systems on"
      : `Solar charging · ${onCount} of 4 on`
    : `Solar input ${solar}% · power conservation active`;

  return (
    <Page>
      <View nativeID="surface" style={[styles.orbit, narrow ? { height: 300 } : null]}>
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
              <Text style={styles.delayTxt}>{linkLine}</Text>
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
            <GlassTag inline title="Earth link" line={linkLine.replace("Earth · ", "")} color="#FFC59E" />
          </Legend>
          <View style={styles.stormInline}>
            <Text style={styles.kicker}>Dust storm · from the light sensor</Text>
            <Text style={styles.stormVal}>{`${Math.round(reading.dark)}%  ${storm}`}</Text>
            <Text style={styles.note}>Cover the light sensor to thicken the storm. The base sheds power the same way it does in a lunar night.</Text>
          </View>
        </>
      ) : null}

      <View style={styles.scene}>
        <Image source={CLEAR} style={styles.photo} resizeMode="stretch" accessibilityLabel="Mars future base under a clear sky" />
        <Image
          source={STORM}
          style={[styles.photo, styles.stormFade, { opacity: stormOpacity(reading.dark) }]}
          resizeMode="stretch"
          accessibilityLabel="Mars future base in a dust storm"
        />
        <SceneScanOverlay tone="mars" />
        <View style={styles.phaseRow}>
          <View style={[styles.pill, clearSky ? styles.pillClear : styles.pillStorm]}>
            <Text style={[styles.pillTxt, { color: clearSky ? colors.ok : "#E7B08A" }]}>{phase}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillDetail} numberOfLines={2}>{phaseDetail}</Text>
          </View>
        </View>
        {narrow ? null : tags.map((tag) => <GlassTag key={tag.title} title={tag.title} line={tag.line} color={tag.color} on={tag.on} style={tag.style} />)}
        <View style={[styles.titleCard, narrow ? styles.titleCardNarrow : null]}>
          <Text style={styles.warmKicker}>03 · Mars · surface · crewed</Text>
          <Text style={[styles.title, narrow ? { fontSize: 26 } : null]}>Future base</Text>
        </View>
        {narrow ? null : (
          <View style={styles.advice}>
            <Text style={styles.warmKicker}>The AI advises this crew</Text>
            <Text style={styles.adviceTxt}>{ADVICE}</Text>
            {fresh.live ? (
              <View style={styles.cmdRow}>
                <Pressable style={styles.cmd} onPress={() => void board.send("c")}>
                  <Text style={styles.cmdTxt}>Recalibrate</Text>
                </Pressable>
                <Pressable style={styles.cmd} onPress={() => void board.send("m")}>
                  <Text style={styles.cmdTxt}>{reading.muted ? "Unmute buzzer" : "Mute buzzer"}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </View>
      {narrow ? (
        <>
          <Legend>
            {tags.map((tag) => (
              <GlassTag key={tag.title} inline title={tag.title} line={tag.line} color={tag.color} on={tag.on} />
            ))}
          </Legend>
          <View style={styles.adviceInline}>
            <Text style={styles.warmKicker}>The AI advises this crew</Text>
            <Text style={styles.adviceTxt}>{ADVICE}</Text>
          </View>
          <KitReadout
            inline
            live={fresh.live}
            mark={fresh.mark}
            dark={reading.dark}
            hum={reading.hum}
            temp={reading.temp}
            muted={reading.muted}
            note="Cover the light sensor to thicken the dust storm. Send c to recalibrate, m to mute the buzzer."
          />
        </>
      ) : null}

      <StatRow
        stats={[
          { label: "Solar input", badge: "A0", value: `${solar}%`, note: "Dust on panels and in the air", series: history.map((h) => solarOf(h.dark)), color: colors.gold },
          { label: "Dust storm", badge: "A0", value: storm, note: `${Math.round(reading.dark)}% strength`, series: history.map((h) => h.dark), color: "#FFB07A" },
          { label: "Humidity · hab", badge: "DHT11", value: `${Math.round(reading.hum)}%`, valueColor: reading.alarm ? colors.alert : colors.ink, note: `Cutoff ${Math.round(reading.cut)}%`, series: history.map((h) => h.hum), color: colors.ledBlue },
          { label: "Systems on", badge: "LEDs", value: `${onCount} of 4`, note: "Lowest priority goes off first", series: history.map((h) => h.leds.filter((v) => v > 0).length), color: colors.green },
          { label: "Earth link", value: oneWay, note: delay ? `Round trip ${delay.roundTripMin.toFixed(1)} min${delay.au ? ` · ${delay.au.toFixed(3)} AU` : ""}` : "One way, depends on orbits", color: colors.ink },
          { label: "Relay ship", value: "Healthy", valueColor: colors.ok, note: "2 faults handled onboard", color: colors.ok },
        ]}
      />

      <Lower
        nav={
          <SideNav
            label="On Mars"
            items={[
              { id: "power", label: "Base power" },
              { id: "surface", label: "Surface base" },
              { id: "delay", label: "Earth delay" },
              { id: "faults", label: "Fault log" },
              { id: "monitor", label: "AI monitor" },
            ]}
          />
        }
      >
        <View nativeID="power">
          <PowerBlock
            eyebrow="Base power · rules learned on the Moon"
            title="A dust storm is a long lunar night"
            systems={SYSTEMS}
            leds={reading.leds}
            solar={solar}
            battery={battery}
          />
        </View>
        <Split>
          <DelayCard now={Date.now()} oneWayMin={delay?.oneWayMin} roundTripMin={delay?.roundTripMin} au={delay?.au} />
          <View nativeID="faults" style={styles.slot}>
            <FaultLog events={events} />
          </View>
        </Split>
        <AiMonitor world="mars" reading={reading} source={source} delay={delay ?? undefined} />
      </Lower>
    </Page>
  );
}

const styles = StyleSheet.create({
  slot: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, maxWidth: "100%" },
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
  scene: { width: "100%", aspectRatio: 1024 / 491, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: "#000" },
  photo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  stormFade: (Platform.OS === "web"
    ? { transitionProperty: "opacity", transitionDuration: "900ms", transitionTimingFunction: "ease" }
    : {}) as ImageStyle,
  phaseRow: { position: "absolute", top: 14, left: 14, zIndex: 4, flexDirection: "row", flexWrap: "wrap", gap: 8, maxWidth: "78%" },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(12,8,6,0.96)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  pillClear: { backgroundColor: "rgba(20,28,18,0.78)" },
  pillStorm: { backgroundColor: "rgba(62,28,16,0.82)", borderColor: "rgba(231,176,138,0.35)" },
  pillTxt: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8 },
  pillDetail: { color: colors.ink, fontSize: 12, fontFamily: mono },
  titleCard: {
    position: "absolute",
    left: 16,
    bottom: 16,
    zIndex: 4,
    maxWidth: "42%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(18,8,6,0.96)",
    borderWidth: 1,
    borderColor: "rgba(196,96,58,0.45)",
  },
  titleCardNarrow: { left: 12, right: 12, bottom: 12, maxWidth: "70%" },
  warmKicker: { color: "#E7B08A", fontFamily: mono, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 34, fontWeight: "300", letterSpacing: -0.6, marginTop: 2 },
  advice: {
    position: "absolute",
    right: 16,
    bottom: 16,
    zIndex: 4,
    width: 300,
    maxWidth: "38%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 6,
    backgroundColor: "rgba(28,10,8,0.96)",
    borderWidth: 1,
    borderColor: "rgba(196,96,58,0.4)",
  },
  adviceInline: { width: "100%", padding: 12, borderRadius: 16, gap: 6, backgroundColor: "rgba(28,10,8,0.96)", borderWidth: 1, borderColor: "rgba(196,96,58,0.4)" },
  adviceTxt: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  cmdRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cmd: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(0,0,0,0.35)" },
  cmdTxt: { color: colors.ink, fontSize: 12 },
});
