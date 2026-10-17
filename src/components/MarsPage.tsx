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

/** Reference frame for the orbit hero. Positions are fractions of this box so they stay attached as it scales. */
const HERO_W = 1024;
const HERO_H = 573;
/** Full left-cropped fit of that frame, then about 6% smaller so the limb stays clear of the ship. */
const PLANET_D = Math.round(685 * 0.94);
const PLANET_CX = 293;
const PLANET_CY = HERO_H / 2;
const PLANET_LEFT = PLANET_CX - PLANET_D / 2;
const PLANET_TOP = PLANET_CY - PLANET_D / 2;
const SHIP = { x: 808, y: 176, w: 156, h: 40 };
const BASE = { x: 150, y: 448 };
const LINK_CTRL = { x: 470, y: 318 };
const LINK_END = { x: SHIP.x, y: SHIP.y + SHIP.h / 2 };
const LINK_D = `M ${BASE.x} ${BASE.y} Q ${LINK_CTRL.x} ${LINK_CTRL.y} ${LINK_END.x} ${LINK_END.y}`;
const LINK_LEN = quadLength(BASE.x, BASE.y, LINK_CTRL.x, LINK_CTRL.y, LINK_END.x, LINK_END.y);
const SIGNAL_DASH = 16;
const SIGNAL_PERIOD = SIGNAL_DASH + LINK_LEN;
const AnimatedPath = Animated.createAnimatedComponent(Path);

function quadLength(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  let length = 0;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= 32; i += 1) {
    const t = i / 32;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    length += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return length;
}

function pctX(value: number) {
  return `${(value / HERO_W) * 100}%` as const;
}

function pctY(value: number) {
  return `${(value / HERO_H) * 100}%` as const;
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduce(query.matches);
      const onChange = () => setReduce(query.matches);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    let cancel = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!cancel) setReduce(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      cancel = true;
      sub.remove();
    };
  }, []);
  return reduce;
}

function RelayCraft() {
  return (
    <View style={styles.craft} accessibilityLabel="Relay ship">
      <View style={styles.wing}>
        <View style={styles.cell} />
        <View style={styles.cell} />
        <View style={styles.cell} />
      </View>
      <View style={styles.busCol}>
        <View style={styles.dish} />
        <View style={styles.mast} />
        <View style={styles.bus}>
          <View style={styles.port} />
        </View>
      </View>
      <View style={styles.wing}>
        <View style={styles.cell} />
        <View style={styles.cell} />
        <View style={styles.cell} />
      </View>
    </View>
  );
}

function RelayLink({ reduce }: { reduce: boolean }) {
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      offset.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.timing(offset, {
        toValue: -SIGNAL_PERIOD,
        duration: 6400,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [offset, reduce]);

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${HERO_W} ${HERO_H}`} preserveAspectRatio="none" style={styles.link} pointerEvents="none">
      <Circle cx={BASE.x} cy={BASE.y} r={10} fill="#F6D2B6" opacity={0.28} />
      <Path d={LINK_D} stroke="#F2D3B8" strokeWidth={1.6} fill="none" strokeDasharray="5 7" strokeLinecap="round" />
      {reduce ? null : (
        <AnimatedPath
          d={LINK_D}
          stroke="#F8E6D4"
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${SIGNAL_DASH} ${LINK_LEN}`}
          strokeDashoffset={offset}
        />
      )}
      <Circle cx={BASE.x} cy={BASE.y} r={3.4} fill="#F8E4D2" />
    </Svg>
  );
}

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
  const { narrow } = useScreen();
  const reduceMotion = useReducedMotion();
  const fresh = kitFreshness(source, link);
  const solar = solarOf(reading.dark);
  const battery = batteryEstimate("mars", reading.dark);
  const storm = stormLabel(reading.dark);
  const oneWay = delay ? `${delay.oneWayMin.toFixed(1)} min` : "3 to 22 min";
  const linkLine = delay ? `Earth · ${delay.oneWayMin.toFixed(1)} min one way today` : "Earth · up to 22 min one way";
  const thick = reading.dark >= 30;
  const on = (i: number) => reading.leds[i] > 0;
  const onCount = reading.leds.filter((v) => v > 0).length;
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
      <View nativeID="surface" style={styles.orbit}>
        <View style={styles.planet}>
          <PlanetFill kind="mars" />
        </View>
        <RelayLink reduce={reduceMotion} />
        <View style={styles.ship}>
          <RelayCraft />
        </View>
        {narrow ? null : (
          <>
            <GlassTag title="Relay ship" line="FIXES ITS OWN FAULTS" color={colors.green} style={styles.shipTag} />
            <GlassTag title="Future base" line={`Solar ${solar}% · ${onCount} of 4 on`} color={colors.ok} style={styles.baseTag} />
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
            <GlassTag inline title="Relay ship" line="FIXES ITS OWN FAULTS" color={colors.green} />
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
  orbit: {
    width: "100%",
    aspectRatio: HERO_W / HERO_H,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#05060a",
  },
  planet: {
    position: "absolute",
    left: pctX(PLANET_LEFT),
    top: pctY(PLANET_TOP),
    width: pctX(PLANET_D),
    height: pctY(PLANET_D),
    borderRadius: PLANET_D,
    overflow: "hidden",
    zIndex: 1,
  },
  link: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 2 },
  ship: {
    position: "absolute",
    left: pctX(SHIP.x),
    top: pctY(SHIP.y),
    width: pctX(SHIP.w),
    height: pctY(SHIP.h),
    zIndex: 4,
  },
  shipTag: { right: "2%", top: pctY(SHIP.y + SHIP.h + 8), zIndex: 6, maxWidth: "28%" },
  baseTag: { left: pctX(72), top: pctY(BASE.y - 62), zIndex: 6 },
  craft: { flex: 1, height: "100%", flexDirection: "row", alignItems: "center" },
  wing: { flex: 1, height: "28%", flexDirection: "row", gap: 1, backgroundColor: "#0c1524", padding: 1 },
  cell: { flex: 1, backgroundColor: "#1b2d4c" },
  busCol: { width: "20%", height: "100%", alignItems: "center", justifyContent: "center" },
  dish: { width: "78%", height: "22%", borderRadius: 8, backgroundColor: "#d4b483", borderWidth: 1, borderColor: "#f3ead8" },
  mast: { width: 1, height: "8%", backgroundColor: "#efe6d4" },
  bus: {
    width: "100%",
    height: "42%",
    borderRadius: 4,
    backgroundColor: "#f7f4ee",
    borderWidth: 1,
    borderColor: "#ddd6cb",
    alignItems: "center",
    justifyContent: "center",
  },
  port: { width: "42%", height: "28%", borderRadius: 2, backgroundColor: "#c8c1b6" },
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
