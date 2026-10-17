import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import type { KitReading, KitSource } from "../kit/types";
import { useScreen } from "../layout";
import { colors } from "../theme";
import { mono, PlanetFill, sans, solarOf, stormLabel } from "./dashboard";

type Id = "earth" | "moon" | "mars";
type Slot = "left" | "center" | "right";

const ORDER: Id[] = ["earth", "moon", "mars"];

function slotOf(selected: Id, id: Id): Slot {
  if (id === selected) return "center";
  if (selected === "earth") return id === "moon" ? "left" : "right";
  if (selected === "mars") return id === "earth" ? "left" : "right";
  return id === "earth" ? "left" : "right";
}

function stageFor(stageW: number, narrow: boolean) {
  const w = Math.max(280, stageW);
  let focus = narrow ? Math.min(210, w * 0.46) : Math.min(520, Math.max(360, w * 0.36));
  let small = narrow ? Math.max(64, Math.min(96, w * 0.16)) : Math.min(168, Math.max(140, w * 0.12));
  const centerX = w / 2;
  let leftX = Math.max(small / 2 + 12, w * (narrow ? 0.16 : 0.13));
  const gap = () => centerX - focus / 2 - (leftX + small / 2);
  while (gap() < 36 && focus > small + 48) focus -= 6;
  while (gap() < 24 && small > 64) {
    small -= 4;
    leftX = Math.max(small / 2 + 8, leftX);
  }
  const cy = focus / 2 + (narrow ? 8 : 18);
  const h = cy + focus / 2 + (narrow ? 96 : 116);
  return { w, h, focus, small, cy, leftX, rightX: w - leftX, centerX };
}

const glideStyle = (Platform.OS === "web"
  ? { transitionProperty: "transform, opacity", transitionDuration: "680ms", transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }
  : {}) as ViewStyle;

const panelStyle = (Platform.OS === "web"
  ? { transitionProperty: "opacity, transform", transitionDuration: "680ms", transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }
  : {}) as ViewStyle;

type Tone = "ok" | "watch" | "alert";

const TONE = {
  ok: { fg: colors.ok, bg: "rgba(134,239,172,0.08)", line: "rgba(134,239,172,0.45)", chip: "rgba(134,239,172,0.16)" },
  watch: { fg: colors.watch, bg: "rgba(247,200,115,0.08)", line: "rgba(247,200,115,0.45)", chip: "rgba(247,200,115,0.16)" },
  alert: { fg: colors.alert, bg: "rgba(255,138,128,0.1)", line: "rgba(255,138,128,0.5)", chip: "rgba(255,138,128,0.16)" },
} as const;

function canvasSize(stageW: number) {
  return Math.min(620, Math.max(500, Math.min(stageW * 0.44, 620)));
}

function previewBox(stageW: number, height: number, canvas: number) {
  const stacked = stageW < 860;
  const gap = 44;
  let planet = Math.min(canvas, stacked ? Math.min(320, stageW * 0.72) : Math.max(460, Math.min(620, height * 0.56)));
  let panelW = stacked ? stageW : Math.min(620, Math.max(520, stageW - planet - gap));
  if (!stacked && planet + panelW + gap > stageW) {
    const spare = Math.max(320, stageW - gap);
    panelW = Math.min(620, Math.max(400, spare * 0.5));
    planet = Math.min(canvas, Math.max(280, spare - panelW));
  }
  const group = planet + gap + panelW;
  const start = stacked ? 0 : Math.max(0, (stageW - group) / 2);
  const stageH = stacked ? planet + 760 : Math.max(planet + 32, 640);
  return {
    planet,
    panelW: stacked ? stageW : panelW,
    panelRight: stacked ? 0 : start,
    panelTop: stacked ? planet + 24 : 0,
    cx: stacked ? stageW / 2 : start + planet / 2,
    cy: stacked ? planet / 2 + 8 : stageH / 2,
    stageH,
    stacked,
  };
}

function detailFor(id: Id, reading: KitReading, marsDelay: string) {
  const systems = `${reading.leds.filter((value) => value > 0).length} of 4`;
  const solar = `${solarOf(reading.dark)}%`;
  const humidity = `${Math.round(reading.hum)}%`;
  const alarm = reading.alarm === 1;
  const comms = reading.leds[1];
  const science = reading.leds[2];
  const comfort = reading.leds[3];
  if (id === "earth") {
    const status = alarm
      ? { tone: "alert" as Tone, chip: "ALARM", message: `Store room humidity is ${Math.round(reading.hum)}%. The vaccine fridge stays on.` }
      : comms === 2
        ? { tone: "watch" as Tone, chip: "LOW", message: `Very dark. The radio is on low power. ${systems} systems are on.` }
        : science === 0
          ? { tone: "watch" as Tone, chip: "NIGHT", message: `Night. The clinic is on battery and ${systems} systems are on.` }
          : comfort === 0
            ? { tone: "watch" as Tone, chip: "LOW", message: `Sun going down. The fan is off and ${systems} systems are on.` }
            : { tone: "ok" as Tone, chip: "OK", message: "Daylight. Solar is charging the battery and all four systems are on." };
    return {
      kicker: "01 · Earth · Off-grid clinic",
      title: "Off-grid clinic",
      body: "Solar panels and a battery keep the vaccine fridge cold through the night. Same hardware and code as the Moon base, with different labels.",
      ...status,
      metrics: [
        { label: "Solar input", value: solar },
        { label: "Humidity", value: humidity },
        { label: "Systems on", value: systems },
        { label: "Signal delay", value: "0 s" },
      ],
      open: "Open clinic view",
    };
  }
  if (id === "moon") {
    const mode = comms === 2 ? "Low power" : science === 0 ? "Night" : comfort === 0 ? "Conserving" : "Full";
    const status = alarm
      ? { tone: "alert" as Tone, chip: "ALARM", message: `Hab humidity is ${Math.round(reading.hum)}%. Life support stays on.` }
      : comms === 2
        ? { tone: "watch" as Tone, chip: "LOW", message: `Communications are on low power. ${systems} systems are on.` }
        : science === 0
          ? { tone: "watch" as Tone, chip: "NIGHT", message: `Lunar night. ${systems} systems are on.` }
          : comfort === 0
            ? { tone: "watch" as Tone, chip: "LOW", message: `Comfort is off. ${systems} systems are on.` }
            : { tone: "ok" as Tone, chip: "OK", message: "Lunar day. All four systems are on." };
    return {
      kicker: "02 · Moon · Live hardware",
      title: "Moon base",
      body: "An autonomous lunar habitat uses the same four-priority power management system to protect essential equipment during lunar night.",
      ...status,
      metrics: [
        { label: "Solar input", value: solar },
        { label: "Humidity", value: humidity },
        { label: "Systems on", value: systems },
        { label: "Power mode", value: mode },
      ],
      open: "Open Moon base",
    };
  }
  const dust = reading.dark < 30 ? "Clear" : stormLabel(reading.dark);
  const status = alarm
    ? { tone: "alert" as Tone, chip: "ALARM", message: `Hab humidity is ${Math.round(reading.hum)}%. Life support stays on.` }
    : comms === 2
      ? { tone: "alert" as Tone, chip: "STORM", message: `Severe dust storm. Communications are on low power. ${systems} systems are on.` }
      : science === 0
        ? { tone: "watch" as Tone, chip: "STORM", message: `Dust storm. ${systems} systems are on.` }
        : comfort === 0
          ? { tone: "watch" as Tone, chip: "DUST", message: `Dust is building. Comfort is off. ${systems} systems are on.` }
          : { tone: "ok" as Tone, chip: "CLEAR", message: "Clear sky. Solar is charging and all four systems are on." };
  return {
    kicker: "03 · Mars · Future base",
    title: "Future base",
    body: "A future Mars habitat uses autonomous power management to protect essential systems during dust storms and communication delays.",
    ...status,
    metrics: [
      { label: "Solar input", value: solar },
      { label: "Dust intensity", value: dust },
      { label: "Systems on", value: systems },
      { label: "Earth delay", value: marsDelay },
    ],
    open: "Open Mars base",
  };
}

const hoverStyle = (Platform.OS === "web"
  ? { transitionProperty: "transform, box-shadow", transitionDuration: "160ms", transitionTimingFunction: "ease-out" }
  : {}) as ViewStyle;

export function AllWorlds({
  reading,
  source,
  marsDelay,
  onOpen,
}: {
  reading: KitReading;
  source: KitSource;
  marsDelay: string;
  onOpen: (world: Id) => void;
}) {
  const { width, height, compact, narrow } = useScreen();
  const [selected, setSelected] = useState<Id>("moon");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hot, setHot] = useState<Id | null>(null);
  const [measured, setMeasured] = useState(0);
  const [glide, setGlide] = useState(false);
  const lock = useRef(false);
  const guess = Math.max(280, Math.min(width, 1520) - (compact ? 28 : 44));
  const stage = stageFor(measured || guess, narrow);
  const canvas = canvasSize(stage.w);
  const preview = previewBox(stage.w, Math.round(height / 24) * 24, canvas);
  const detail = detailFor(selected, reading, marsDelay);
  const onCount = reading.leds.filter((value) => value > 0).length;
  const live = source === "serial";

  useEffect(() => {
    if (measured <= 0) return;
    const id = requestAnimationFrame(() => setGlide(true));
    return () => cancelAnimationFrame(id);
  }, [measured]);

  const onStage = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setMeasured((current) => (Math.abs(current - next) < 2 ? current : next));
  };

  const arm = () => {
    lock.current = true;
    setTimeout(() => {
      lock.current = false;
    }, 700);
  };

  const onPlanet = (id: Id) => {
    if (lock.current || previewOpen) return;
    arm();
    setHot(null);
    if (id === selected) setPreviewOpen(true);
    else setSelected(id);
  };

  const closePreview = () => {
    if (lock.current || !previewOpen) return;
    arm();
    setPreviewOpen(false);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact ? styles.pageCompact : null]}>
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

      <View style={[styles.theater, { height: previewOpen ? preview.stageH : stage.h }]} onLayout={onStage} pointerEvents="box-none">
        {ORDER.map((id) => {
          const slot = slotOf(selected, id);
          const overviewSize = slot === "center" ? stage.focus : stage.small;
          const overviewX = slot === "center" ? stage.centerX : slot === "left" ? stage.leftX : stage.rightX;
          const focused = previewOpen && id === selected;
          return (
            <Planet
              key={id}
              id={id}
              reading={reading}
              canvas={canvas}
              x={focused ? preview.cx : overviewX}
              y={focused ? preview.cy : stage.cy}
              scale={(focused ? preview.planet : overviewSize) / canvas}
              opacity={previewOpen && id !== selected ? 0 : 1}
              selected={slot === "center"}
              hot={hot === id && !previewOpen}
              glide={glide}
              narrow={narrow}
              labels={previewOpen ? 0 : 1}
              onHot={() => setHot(id)}
              onCold={() => setHot((current) => (current === id ? null : current))}
              onChoose={() => onPlanet(id)}
            />
          );
        })}
        <View
          pointerEvents={previewOpen ? "auto" : "none"}
          style={[
            styles.panelWrap,
            panelStyle,
            preview.stacked
              ? { top: preview.panelTop, left: 0, right: 0, transform: [{ translateY: previewOpen ? 0 : 28 }] }
              : {
                  top: 0,
                  bottom: 0,
                  right: preview.panelRight,
                  width: preview.panelW,
                  justifyContent: "center",
                  transform: [{ translateX: previewOpen ? 0 : 56 }],
                },
            { opacity: previewOpen ? 1 : 0 },
          ]}
        >
          <DetailCard detail={detail} onClose={closePreview} onOpen={() => onOpen(selected)} onAll={closePreview} />
        </View>
      </View>

      <Text style={[styles.hint, narrow ? { letterSpacing: 0.4 } : null]}>
        {previewOpen ? " " : narrow ? "Tap a small world to center it, then tap again" : "Click a small world to center it  ·  click the large world to open it"}
      </Text>

      <View style={[styles.footer, compact ? { flexDirection: "column" } : null]}>
        <Text style={styles.footTxt}>
          <Text style={{ color: live ? colors.ok : colors.gold }}>{live ? "Live kit" : "Simulated kit"}</Text>
          {`   Light sensor ${Math.round(reading.dark)}% dark    Humidity ${Math.round(reading.hum)}%    Temp ${reading.temp.toFixed(1)} °C    Systems on ${onCount} of 4`}
        </Text>
        <Text style={styles.footTxt}>Planet textures: Solar System Scope, CC BY 4.0, based on NASA imagery</Text>
      </View>
    </ScrollView>
  );
}

function Planet({
  id,
  reading,
  canvas,
  x,
  y,
  scale,
  opacity,
  selected,
  hot,
  glide,
  narrow,
  labels,
  onHot,
  onCold,
  onChoose,
}: {
  id: Id;
  reading: KitReading;
  canvas: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  selected: boolean;
  hot: boolean;
  glide: boolean;
  narrow: boolean;
  labels: number;
  onHot: () => void;
  onCold: () => void;
  onChoose: () => void;
}) {
  const meta = caption(id, reading);
  const motion = glide ? glideStyle : undefined;
  const visual = canvas * scale;
  return (
    <>
      <Pressable
        accessibilityLabel={selected ? `Open ${meta.name} preview` : `Select ${meta.name}`}
        accessibilityRole="button"
        pointerEvents={opacity === 0 ? "none" : "auto"}
        onHoverIn={onHot}
        onHoverOut={onCold}
        onFocus={onHot}
        onBlur={onCold}
        onPress={onChoose}
        style={[
          styles.planet,
          motion,
          {
            width: canvas,
            height: canvas,
            marginLeft: -canvas / 2,
            marginTop: -canvas / 2,
            opacity,
            zIndex: selected ? 3 : hot ? 2 : 1,
            transform: [{ translateX: x }, { translateY: y }, { scale }],
            ...(Platform.OS === "web" ? { cursor: "pointer", transformOrigin: "center" } : null),
          } as ViewStyle,
        ]}
      >
        <View pointerEvents="none" style={[styles.skin, hoverStyle, { transform: [{ scale: hot ? 1.045 : 1 }] }]}>
          {id === "earth" ? <View style={styles.glow} /> : <Orbit mars={id === "mars"} />}
          <View style={[styles.disc, hot ? styles.discHot : null]}>
            <PlanetFill kind={id} />
          </View>
        </View>
      </Pressable>
      <View
        pointerEvents="none"
        style={[
          styles.label,
          motion,
          { zIndex: 4, opacity: labels, transform: [{ translateX: x }, { translateY: y + visual / 2 + (selected ? 16 : 12) }] },
        ]}
      >
        <Text numberOfLines={1} style={[styles.kicker, narrow ? { letterSpacing: 0.2 } : null]}>
          {narrow ? (id === "earth" ? "Today" : id === "moon" ? "Live" : "Next") : meta.kicker}
        </Text>
        <Text numberOfLines={1} style={[styles.name, selected ? { fontSize: narrow ? 24 : 32 } : null]}>
          {meta.name}
        </Text>
        {selected ? (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text numberOfLines={2} style={[styles.status, { color: meta.color }]}>
              {meta.status}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

function DetailCard({
  detail,
  onClose,
  onOpen,
  onAll,
}: {
  detail: ReturnType<typeof detailFor>;
  onClose: () => void;
  onOpen: () => void;
  onAll: () => void;
}) {
  const tone = TONE[detail.tone];
  return (
    <View style={styles.card}>
      <Pressable accessibilityLabel="Close preview" onPress={onClose} style={styles.close}>
        <Text style={styles.closeTxt}>×</Text>
      </Pressable>
      <View style={styles.kickerRow}>
        <View style={styles.kickerMark}>
          <View style={styles.kickerDot} />
        </View>
        <Text style={styles.cardKicker}>{detail.kicker}</Text>
      </View>
      <Text style={styles.cardTitle}>{detail.title}</Text>
      <Text style={styles.cardBody}>{detail.body}</Text>
      <View style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.line }]}>
        <View style={[styles.chip, { backgroundColor: tone.chip, borderColor: tone.line }]}>
          <Text style={[styles.chipTxt, { color: tone.fg }]}>{detail.chip}</Text>
        </View>
        <Text style={[styles.bannerTxt, { color: tone.fg }]}>{detail.message}</Text>
      </View>
      <View style={styles.metrics}>
        {detail.metrics.map((metric) => (
          <View key={metric.label} style={styles.metric}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={[styles.metricValue, metric.value.length > 10 ? styles.metricValueLong : null]}>{metric.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityLabel={detail.open} onPress={onOpen} style={styles.primary}>
          <Text style={styles.primaryTxt}>{`${detail.open}  →`}</Text>
        </Pressable>
        <Pressable accessibilityLabel="All worlds" onPress={onAll} style={styles.secondary}>
          <Text style={styles.secondaryTxt}>All worlds</Text>
        </Pressable>
      </View>
    </View>
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
      status: alarm ? `Humidity ${Math.round(reading.hum)}%` : night ? `Lunar night · ${on} of 4 on` : "Lunar day · all on",
      color: alarm ? colors.alert : night ? colors.watch : colors.ok,
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
  theater: { marginTop: 8, width: "100%", overflow: "visible" },
  planet: { position: "absolute", left: 0, top: 0 },
  skin: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  disc: { width: "100%", height: "100%", borderRadius: 999, overflow: "hidden", backgroundColor: "#000" },
  discHot: Platform.OS === "web" ? { boxShadow: "0 0 0 2px rgba(255,255,255,0.42), 0 0 28px rgba(180,210,255,0.35)" } : {},
  glow: {
    position: "absolute",
    left: "-3%",
    top: "-3%",
    width: "106%",
    height: "106%",
    borderRadius: 999,
    backgroundColor: "rgba(80,150,255,0.2)",
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
    right: "-4%",
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
  panelWrap: { position: "absolute", zIndex: 6 },
  card: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "#12141A",
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 22,
    gap: 14,
  },
  close: { position: "absolute", top: 14, right: 14, width: 36, height: 36, alignItems: "center", justifyContent: "center", zIndex: 2 },
  closeTxt: { color: colors.muted, fontSize: 26, lineHeight: 28 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 36 },
  kickerMark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.4, borderColor: "rgba(255,255,255,0.28)", alignItems: "center", justifyContent: "center" },
  kickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink },
  cardKicker: { color: colors.dim, fontFamily: mono, fontSize: 12, letterSpacing: 1.3, textTransform: "uppercase", flexShrink: 1 },
  cardTitle: { color: colors.ink, fontFamily: sans, fontWeight: "300", fontSize: 40, letterSpacing: -0.8, lineHeight: 46 },
  cardBody: { color: colors.muted, fontFamily: sans, fontSize: 16, lineHeight: 24 },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 1 },
  chipTxt: { fontFamily: mono, fontSize: 11, letterSpacing: 0.6 },
  bannerTxt: { flex: 1, fontFamily: sans, fontSize: 15, lineHeight: 21 },
  metrics: { flexDirection: "row", flexWrap: "wrap", rowGap: 16, marginTop: 4 },
  metric: { width: "50%", paddingRight: 12, gap: 4 },
  metricLabel: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  metricValue: { color: colors.ink, fontFamily: sans, fontWeight: "300", fontSize: 32, letterSpacing: -0.4 },
  metricValueLong: { fontSize: 24, letterSpacing: 0 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  primary: { borderRadius: 999, backgroundColor: "#F3F5F7", paddingHorizontal: 18, paddingVertical: 12 },
  primaryTxt: { color: "#16181C", fontFamily: sans, fontSize: 15 },
  secondary: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", paddingHorizontal: 18, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.02)" },
  secondaryTxt: { color: colors.ink, fontFamily: sans, fontSize: 15 },
});
