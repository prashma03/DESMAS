import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { kitFreshness, type KitReading, type KitSource, type LinkStatus } from "../kit/types";
import { useScreen } from "../layout";
import { colors } from "../theme";
import { AllWorldsSpaceBackground } from "./AllWorldsSpaceBackground";
import { mono, PlanetFill, sans, stormLabel } from "./dashboard";

type Id = "earth" | "moon" | "mars";
type Slot = "left" | "center" | "right";

const ORDER: Id[] = ["earth", "moon", "mars"];

function slotOf(selected: Id, id: Id): Slot {
  if (id === selected) return "center";
  if (selected === "earth") return id === "moon" ? "left" : "right";
  if (selected === "mars") return id === "earth" ? "left" : "right";
  return id === "earth" ? "left" : "right";
}

type Stage = {
  w: number;
  h: number;
  focus: number;
  small: number;
  cy: number;
  leftX: number;
  rightX: number;
  centerX: number;
};

function stageFor(stageW: number, narrow: boolean, focused: boolean): Stage {
  const w = Math.max(280, stageW);
  if (!focused) {
    const small = narrow ? Math.min(108, Math.max(84, w * 0.22)) : Math.min(188, Math.max(150, w * 0.145));
    const step = small + (narrow ? 36 : 72);
    const cy = Math.max(small / 2 + 36, step * 0.78);
    const h = cy + small / 2 + (narrow ? 96 : 118);
    return { w, h, focus: small, small, cy, leftX: w / 2 - step, rightX: w / 2 + step, centerX: w / 2 };
  }
  let focus = narrow ? Math.min(220, w * 0.48) : Math.min(520, Math.max(420, w * 0.38));
  let small = narrow ? Math.max(72, Math.min(104, w * 0.18)) : Math.min(168, Math.max(140, w * 0.12));
  const centerX = w / 2;
  let leftX = Math.max(small / 2 + 16, w * (narrow ? 0.16 : 0.14));
  const gap = () => centerX - focus / 2 - (leftX + small / 2);
  while (gap() < 40 && focus > small + 60) focus -= 8;
  while (gap() < 28 && small > 72) {
    small -= 4;
    leftX = Math.max(small / 2 + 12, leftX);
  }
  const cy = focus / 2 + (narrow ? 10 : 16);
  const h = cy + focus / 2 + (narrow ? 100 : 124);
  return { w, h, focus, small, cy, leftX, rightX: w - leftX, centerX };
}

const GLIDE_MS = 780;
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

function rim(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const span = Math.hypot(dx, dy) || 1;
  const ux = dx / span;
  const uy = dy / span;
  return { x1: x1 + ux * r1, y1: y1 + uy * r1, x2: x2 - ux * r2, y2: y2 - uy * r2 };
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

const glideStyle = (Platform.OS === "web"
  ? {
      transitionProperty: "transform, width, height, left, top, opacity",
      transitionDuration: "780ms",
      transitionTimingFunction: "cubic-bezier(0.45, 0, 0.2, 1)",
    }
  : {}) as ViewStyle;

export function AllWorlds({
  reading,
  source,
  link,
  marsDelay,
  onOpen,
}: {
  reading: KitReading;
  source: KitSource;
  link?: LinkStatus;
  marsDelay: string;
  onOpen: (world: Id) => void;
}) {
  const { width, compact, narrow } = useScreen();
  const selected = null as Id | null;
  const [hovered, setHovered] = useState<Id | null>(null);
  const [measured, setMeasured] = useState(0);
  const [glide, setGlide] = useState(false);
  const reduceMotion = useReducedMotion();
  const hits = useRef<Partial<Record<Id, HTMLElement>>>({});
  const point = useRef<{ x: number; y: number } | null>(null);
  const intent = useRef(false);
  const hoverRef = useRef<Id | null>(null);
  const lockUntil = useRef(0);
  const movedDuringLock = useRef(false);
  const guess = Math.max(280, Math.min(width, 1520) - (compact ? 28 : 44));
  const focus = hovered ?? selected;
  const stage = stageFor(measured || guess, narrow, focus !== null);
  const systemsOn = reading.leds.filter((value) => value > 0).length;
  const fresh = kitFreshness(source, link);

  useEffect(() => {
    if (measured <= 0) return;
    const id = requestAnimationFrame(() => setGlide(true));
    return () => cancelAnimationFrame(id);
  }, [measured]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const hitAt = (x: number, y: number): Id | null => {
      let found: Id | null = null;
      for (const id of ORDER) {
        const node = hits.current[id];
        if (!node?.getBoundingClientRect) continue;
        const rect = node.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const radius = rect.width / 2;
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) found = id;
      }
      return found;
    };
    const commit = (next: Id | null) => {
      if (hoverRef.current === next) return;
      hoverRef.current = next;
      setHovered(next);
      const until = Date.now() + GLIDE_MS;
      lockUntil.current = until;
      movedDuringLock.current = false;
      window.setTimeout(() => {
        if (lockUntil.current !== until || !movedDuringLock.current || !point.current) return;
        commit(hitAt(point.current.x, point.current.y));
      }, GLIDE_MS + 20);
    };
    const onMove = (event: PointerEvent) => {
      const prev = point.current;
      point.current = { x: event.clientX, y: event.clientY };
      if (!prev) return;
      if (Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 3) return;
      intent.current = true;
      if (Date.now() < lockUntil.current) {
        movedDuringLock.current = true;
        return;
      }
      commit(hitAt(event.clientX, event.clientY));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const onStage = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setMeasured((current) => (Math.abs(current - next) < 2 ? current : next));
  };

  return (
    <>
    <AllWorldsSpaceBackground />
    <ScrollView style={[styles.scroll, styles.aboveSky]} contentContainerStyle={[styles.page, compact ? styles.pageCompact : null]}>
      <View style={styles.intro}>
        <Pressable style={styles.live} onPress={() => onOpen("moon")}>
          <Text style={styles.liveMark}>LIVE</Text>
          <Text style={styles.liveTxt}>One Arduino drives all three worlds</Text>
          <Text style={styles.liveTxt}>↗</Text>
        </Pressable>
        <Text style={[styles.h1, narrow ? { fontSize: 30 } : compact ? { fontSize: 36 } : null]}>One system, three worlds</Text>
        <Text style={[styles.sub, compact ? { fontSize: 15, lineHeight: 22 } : null]}>
          The same power rules and AI monitor, from an off-grid clinic to a base on the Moon to a ship orbiting Mars.
        </Text>
      </View>

      <View style={[styles.theater, { height: stage.h }]} onLayout={onStage}>
        <SignalArcs stage={stage} focus={focus} marsDelay={marsDelay} reduce={reduceMotion} />
        {ORDER.map((id) => (
          <Planet
            key={id}
            id={id}
            reading={reading}
            stage={stage}
            slot={focus ? slotOf(focus, id) : id === "earth" ? "left" : id === "mars" ? "right" : "center"}
            focused={focus === id}
            equal={focus === null}
            glide={glide}
            narrow={narrow}
            onHit={(node) => {
              if (node) hits.current[id] = node;
              else delete hits.current[id];
            }}
            onChoose={() => onOpen(id)}
          />
        ))}
      </View>

      <Text style={[styles.hint, narrow ? { letterSpacing: 0.4 } : null]}>
        {narrow ? "Tap a world to open it" : focus ? "Click to open · move away to line them up" : "Hover a world to bring it forward · click to open"}
      </Text>

      <View style={[styles.footer, compact ? { flexDirection: "column" } : null]}>
        <Text style={styles.footTxt}>
          <Text style={{ color: fresh.live ? colors.ok : fresh.mark === "Stale" ? colors.watch : colors.gold }}>
            {fresh.mark === "Live" ? "Arduino live" : fresh.mark === "Stale" ? "Stale reading" : fresh.mark === "Connecting" ? "Connecting" : "Simulated kit"}
          </Text>
          {`   Light sensor ${Math.round(reading.dark)}% dark    Humidity ${Math.round(reading.hum)}%    Temp ${reading.temp.toFixed(1)} °C    Systems on ${systemsOn} of 4`}
        </Text>
        <Text style={styles.footTxt}>Planet textures: Solar System Scope, CC BY 4.0, based on NASA imagery</Text>
      </View>
    </ScrollView>
    </>
  );
}

function Planet({
  id,
  reading,
  stage,
  slot,
  focused,
  equal,
  glide,
  narrow,
  onHit,
  onChoose,
}: {
  id: Id;
  reading: KitReading;
  stage: Stage;
  slot: Slot;
  focused: boolean;
  equal: boolean;
  glide: boolean;
  narrow: boolean;
  onHit: (node: HTMLElement | null) => void;
  onChoose: () => void;
}) {
  const meta = caption(id, reading);
  const size = equal ? stage.small : slot === "center" ? stage.focus : stage.small;
  const x = slot === "center" ? stage.centerX : slot === "left" ? stage.leftX : stage.rightX;
  const motion = glide ? glideStyle : undefined;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.anchor, motion, { transform: [{ translateX: x }, { translateY: stage.cy }], zIndex: focused ? 2 : 1 }]}
    >
      <View pointerEvents="none" style={[styles.halo, motion, { width: size, height: size, left: -size / 2, top: -size / 2 }]}>
        {id === "earth" ? <View style={styles.glow} /> : <Orbit mars={id === "mars"} />}
        {focused ? <View style={styles.hotRing} /> : null}
      </View>
      <Pressable
        ref={(node) => onHit(node as unknown as HTMLElement | null)}
        accessibilityLabel={`Open ${meta.name}`}
        accessibilityRole="button"
        onPress={onChoose}
        style={[
          styles.planet,
          motion,
          {
            width: size,
            height: size,
            left: -size / 2,
            top: -size / 2,
            borderRadius: size / 2,
            ...(Platform.OS === "web" ? { cursor: "pointer" } : null),
          } as ViewStyle,
        ]}
      >
        <View pointerEvents="none" style={styles.skin}>
          <PlanetFill kind={id} />
        </View>
      </Pressable>
      <View pointerEvents="none" style={[styles.label, motion, { transform: [{ translateY: size / 2 + (focused ? 16 : 12) }] }]}>
        <Text numberOfLines={1} style={[styles.kicker, narrow ? { letterSpacing: 0.2 } : null]}>
          {narrow ? (id === "earth" ? "Today" : id === "moon" ? "Live" : "Next") : meta.kicker}
        </Text>
        <Text numberOfLines={1} style={[styles.name, focused ? { fontSize: narrow ? 24 : 32 } : null]}>
          {meta.name}
        </Text>
        {focused ? (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text numberOfLines={2} style={[styles.status, { color: meta.color }]}>
              {meta.status}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SignalArcs({
  stage,
  focus,
  marsDelay,
  reduce,
}: {
  stage: Stage;
  focus: Id | null;
  marsDelay: string;
  reduce: boolean;
}) {
  const radius = (id: Id) => (focus === null ? stage.small : focus === id ? stage.focus : stage.small) / 2;
  const place = (id: Id) => {
    if (!focus) return id === "earth" ? stage.leftX : id === "mars" ? stage.rightX : stage.centerX;
    const slot = slotOf(focus, id);
    return slot === "center" ? stage.centerX : slot === "left" ? stage.leftX : stage.rightX;
  };
  const earth = { x: place("earth"), y: stage.cy, r: radius("earth") };
  const moon = { x: place("moon"), y: stage.cy, r: radius("moon") };
  const mars = { x: place("mars"), y: stage.cy, r: radius("mars") };
  const toMoon = rim(earth.x, earth.y, earth.r, moon.x, moon.y, moon.r);
  const toMars = rim(earth.x, earth.y, earth.r, mars.x, mars.y, mars.r);
  const moonLift = Math.min(moon.y - 28, Math.max(32, Math.hypot(toMoon.x2 - toMoon.x1, toMoon.y2 - toMoon.y1) * 0.7));
  const marsLift = Math.min(earth.y - 24, Math.max(84, Math.hypot(toMars.x2 - toMars.x1, toMars.y2 - toMars.y1) * 0.46));
  const moonCurve = bend(toMoon, moonLift);
  const marsCurve = bend(toMars, marsLift);
  return (
    <View pointerEvents="none" style={styles.arcs}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${stage.w} ${stage.h}`} preserveAspectRatio="none">
        <Travel d={moonCurve.d} color="#9ED0FF" duration={1300} reduce={reduce} />
        <Travel d={marsCurve.d} color="#FFC59E" duration={15000} reduce={reduce} />
      </Svg>
      <Text style={[styles.arcLabel, { left: moonCurve.labelX - 70, top: Math.max(8, moonCurve.labelY - 16), color: colors.blue }]}>Earth ↔ Moon · 1.3 s</Text>
      <Text style={[styles.arcLabel, { left: marsCurve.labelX - 90, top: Math.max(4, marsCurve.labelY - 18), color: "#FFC59E" }]}>{`Earth ↔ Mars · ${marsDelay}`}</Text>
    </View>
  );
}

function bend(ends: { x1: number; y1: number; x2: number; y2: number }, lift: number) {
  const cx = (ends.x1 + ends.x2) / 2;
  const cy = (ends.y1 + ends.y2) / 2 - lift;
  return { d: `M ${ends.x1} ${ends.y1} Q ${cx} ${cy} ${ends.x2} ${ends.y2}`, labelX: cx, labelY: cy };
}

function Travel({ d, color, duration, reduce }: { d: string; color: string; duration: number; reduce: boolean }) {
  const parts = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const [x0, y0, cx, cy, x1, y1] = parts;
  const length = quadLength(x0 ?? 0, y0 ?? 0, cx ?? 0, cy ?? 0, x1 ?? 0, y1 ?? 0);
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      offset.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.timing(offset, {
        toValue: -(length + 14),
        duration,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [duration, length, offset, reduce]);
  return (
    <>
      <Path d={d} stroke={color} strokeOpacity={0.75} strokeWidth={1.4} fill="none" strokeDasharray="4 7" strokeLinecap="round" />
      {reduce ? null : (
        <AnimatedPath
          d={d}
          stroke={color}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`12 ${Math.max(length, 1)}`}
          strokeDashoffset={offset}
        />
      )}
    </>
  );
}

function Orbit({ mars }: { mars: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.ring} />
      <View style={[styles.particle, { backgroundColor: mars ? "#FFC59E" : "#F4F7FB" }]} />
    </View>
  );
}

function caption(id: Id, reading: KitReading) {
  const alarm = reading.alarm === 1;
  const night = reading.dark >= 55;
  const dusk = reading.dark >= 30;
  if (id === "earth") {
    return {
      name: "Earth",
      kicker: "01 · Today",
      status: alarm
        ? `Humidity ${Math.round(reading.hum)}%`
        : night
          ? "Night · battery"
          : dusk
            ? "Sunset · fan off"
            : "Daylight · charging",
      color: alarm ? colors.alert : dusk ? colors.watch : colors.ok,
    };
  }
  if (id === "moon") {
    const on = reading.leds.filter((value) => value > 0).length;
    return {
      name: "Moon",
      kicker: "02 · Live hardware",
      status: alarm
        ? `Humidity ${Math.round(reading.hum)}%`
        : `${night ? "Lunar night" : "Lunar day"} · ${on === 4 ? "all on" : `${on} of 4 on`}`,
      color: alarm ? colors.alert : night || on < 4 ? colors.watch : colors.ok,
    };
  }
  const level = reading.dark >= 85 ? colors.alert : reading.dark >= 30 ? colors.watch : colors.ok;
  return {
    name: "Mars",
    kicker: "03 · Next",
    status: `Storm ${Math.round(reading.dark)}% · ${stormLabel(reading.dark).toLowerCase()}`,
    color: level,
  };
}

const styles = StyleSheet.create({
  scroll: { flex: 1, minHeight: 0 },
  aboveSky: { zIndex: 1 },
  page: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 18, width: "100%", maxWidth: 1520, alignSelf: "center" },
  pageCompact: { paddingHorizontal: 14, paddingTop: 16 },
  intro: { alignItems: "center", gap: 12, width: "100%" },
  live: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingRight: 12,
    paddingVertical: 4,
    paddingLeft: 4,
  },
  liveMark: {
    color: colors.gold,
    backgroundColor: "rgba(242,181,68,0.16)",
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  liveTxt: { color: colors.ink, fontFamily: sans, fontSize: 14, flexShrink: 1, textAlign: "center" },
  h1: { color: colors.ink, fontFamily: sans, fontWeight: "300", fontSize: 44, letterSpacing: -1, textAlign: "center", width: "100%" },
  sub: { color: colors.muted, fontFamily: sans, fontSize: 17, lineHeight: 24, textAlign: "center", width: "100%", maxWidth: 640 },
  theater: { marginTop: 8, width: "100%", position: "relative", overflow: "visible" },
  arcs: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 0 },
  arcLabel: { position: "absolute", width: 180, textAlign: "center", fontFamily: mono, fontSize: 11, letterSpacing: 0.6 },
  anchor: { position: "absolute", left: 0, top: 0, width: 0, height: 0 },
  halo: { position: "absolute" },
  planet: { position: "absolute", overflow: "hidden", backgroundColor: "#000" },
  skin: { ...StyleSheet.absoluteFillObject },
  hotRing: {
    position: "absolute",
    left: -3,
    top: -3,
    right: -3,
    bottom: -3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.42)",
  },
  glow: {
    position: "absolute",
    left: "-6%",
    top: "-6%",
    width: "112%",
    height: "112%",
    borderRadius: 999,
    backgroundColor: "rgba(80,150,255,0.22)",
  },
  ring: {
    position: "absolute",
    left: "-18%",
    top: "38%",
    width: "136%",
    height: "24%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  particle: {
    position: "absolute",
    top: "46%",
    right: "-5%",
    width: 8,
    height: 8,
    borderRadius: 4,
    boxShadow: "0 0 8px rgba(255,255,255,0.85)",
  },
  label: { position: "absolute", left: -130, top: 0, width: 260, alignItems: "center" },
  hint: { textAlign: "center", color: colors.dim, fontFamily: mono, fontSize: 12, letterSpacing: 1.4, marginTop: 8, textTransform: "uppercase" },
  footer: {
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
  },
  footTxt: { color: colors.dim, fontFamily: mono, fontSize: 12, flexGrow: 1, flexShrink: 1, flexBasis: 240, maxWidth: "100%" },
  kicker: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", textAlign: "center" },
  name: { color: colors.ink, fontFamily: sans, fontSize: 20, marginTop: 2, textAlign: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, maxWidth: 260 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  status: { fontFamily: mono, fontSize: 12, textAlign: "center", flexShrink: 1 },
});
