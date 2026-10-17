import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { kitFreshness, type KitReading, type KitSource, type LinkStatus } from "../kit/types";
import { useScreen } from "../layout";
import { colors } from "../theme";
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

function stageFor(stageW: number, narrow: boolean) {
  const w = Math.max(280, stageW);
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
  marsDelay: _marsDelay,
  onOpen,
}: {
  reading: KitReading;
  source: KitSource;
  link?: LinkStatus;
  marsDelay: string;
  onOpen: (world: Id) => void;
}) {
  const { width, compact, narrow } = useScreen();
  const [selected, setSelected] = useState<Id>("moon");
  const [hot, setHot] = useState<Id | null>(null);
  const [measured, setMeasured] = useState(0);
  const [glide, setGlide] = useState(false);
  const guess = Math.max(280, Math.min(width, 1520) - (compact ? 28 : 44));
  const stage = stageFor(measured || guess, narrow);
  const systemsOn = reading.leds.filter((value) => value > 0).length;
  const fresh = kitFreshness(source, link);

  useEffect(() => {
    if (measured <= 0) return;
    const id = requestAnimationFrame(() => setGlide(true));
    return () => cancelAnimationFrame(id);
  }, [measured]);

  const onStage = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setMeasured((current) => (Math.abs(current - next) < 2 ? current : next));
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

      <View style={[styles.theater, { height: stage.h }]} onLayout={onStage}>
        {ORDER.map((id) => (
          <Planet
            key={id}
            id={id}
            reading={reading}
            stage={stage}
            slot={slotOf(selected, id)}
            selected={selected === id}
            hot={hot === id}
            glide={glide}
            narrow={narrow}
            onHot={() => setHot((current) => (current === id ? current : id))}
            onCold={() => setHot((current) => (current === id ? null : current))}
            onChoose={() => {
              if (id === selected) onOpen(id);
              else {
                setHot(null);
                setSelected(id);
              }
            }}
          />
        ))}
      </View>

      <Text style={[styles.hint, narrow ? { letterSpacing: 0.4 } : null]}>
        {narrow ? "Tap a small world to switch · tap the big one to open it" : "Click the big globe to open it · click a small one to switch"}
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
  );
}

function Planet({
  id,
  reading,
  stage,
  slot,
  selected,
  hot,
  glide,
  narrow,
  onHot,
  onCold,
  onChoose,
}: {
  id: Id;
  reading: KitReading;
  stage: ReturnType<typeof stageFor>;
  slot: Slot;
  selected: boolean;
  hot: boolean;
  glide: boolean;
  narrow: boolean;
  onHot: () => void;
  onCold: () => void;
  onChoose: () => void;
}) {
  const meta = caption(id, reading);
  const size = slot === "center" ? stage.focus : stage.small;
  const x = slot === "center" ? stage.centerX : slot === "left" ? stage.leftX : stage.rightX;
  const motion = glide ? glideStyle : undefined;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.anchor, motion, { transform: [{ translateX: x }, { translateY: stage.cy }], zIndex: selected ? 2 : 1 }]}
    >
      <View pointerEvents="none" style={[styles.halo, motion, { width: size, height: size, left: -size / 2, top: -size / 2 }]}>
        {id === "earth" ? <View style={styles.glow} /> : <Orbit mars={id === "mars"} />}
        {hot ? <View style={styles.hotRing} /> : null}
      </View>
      <Pressable
        accessibilityLabel={selected ? `Open ${meta.name}` : `Select ${meta.name}`}
        accessibilityRole="button"
        onHoverIn={onHot}
        onHoverOut={onCold}
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
        <View
          pointerEvents="none"
          style={[
            styles.skin,
            Platform.OS === "web"
              ? ({ transitionProperty: "transform", transitionDuration: "160ms", transitionTimingFunction: "ease-out" } as ViewStyle)
              : null,
            { transform: [{ scale: hot ? 1.045 : 1 }] },
          ]}
        >
          <PlanetFill kind={id} />
        </View>
      </Pressable>
      <View pointerEvents="none" style={[styles.label, motion, { transform: [{ translateY: size / 2 + (selected ? 16 : 12) }] }]}>
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
