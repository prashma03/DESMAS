import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useScreen } from "../layout";
import Svg, { Path } from "react-native-svg";
import type { KitReading, KitSource } from "../kit/types";
import { colors } from "../theme";
import { mono, PlanetFill, sans, stormLabel } from "./dashboard";

type Id = "earth" | "moon" | "mars";

const ORDER: Id[] = ["earth", "moon", "mars"];

function layout(hover: Id | null, width: number) {
  const narrow = width < 640;
  const content = Math.max(280, width - (narrow ? 28 : 48));
  const globe = narrow
    ? Math.max(92, Math.min(140, content * 0.32))
    : Math.max(112, Math.min(230, (width - 96) / 3.8));
  const focus = Math.min(narrow ? 220 : 390, Math.max(globe * 1.45, content * (narrow ? 0.58 : 0.34)));
  const small = narrow ? Math.max(64, content * 0.18) : 120;
  const home = narrow
    ? {
        earth: { left: 28, top: 30, size: globe },
        moon: { left: 72, top: 30, size: globe },
        mars: { left: 50, top: 68, size: globe },
      }
    : {
        earth: { left: 20, top: 48, size: globe },
        moon: { left: 50, top: 46, size: globe * 1.08 },
        mars: { left: 80, top: 48, size: globe },
      };
  if (!hover) return home;
  const others = ORDER.filter((id) => id !== hover);
  return {
    ...home,
    [hover]: { left: 50, top: narrow ? 32 : 42, size: focus },
    [others[0]]: { left: narrow ? 20 : 12, top: narrow ? 80 : 76, size: small },
    [others[1]]: { left: narrow ? 80 : 88, top: narrow ? 80 : 76, size: small },
  };
}

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
  const { width, compact, narrow } = useScreen();
  const [hover, setHover] = useState<Id | null>(null);
  const anim = useRef({
    earth: { left: new Animated.Value(22), top: new Animated.Value(46), size: new Animated.Value(200) },
    moon: { left: new Animated.Value(50), top: new Animated.Value(44), size: new Animated.Value(220) },
    mars: { left: new Animated.Value(78), top: new Animated.Value(46), size: new Animated.Value(200) },
  }).current;

  useEffect(() => {
    const next = layout(hover, width);
    Animated.parallel(
      ORDER.flatMap((id) => [
        Animated.timing(anim[id].left, { toValue: next[id].left, duration: 560, useNativeDriver: false }),
        Animated.timing(anim[id].top, { toValue: next[id].top, duration: 560, useNativeDriver: false }),
        Animated.timing(anim[id].size, { toValue: next[id].size, duration: 560, useNativeDriver: false }),
      ]),
    ).start();
  }, [anim, hover, width]);

  const onCount = reading.leds.filter((v) => v > 0).length;
  const live = source === "serial";

  return (
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={[styles.page, compact ? styles.pageCompact : null]}>
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

      <View
        style={[styles.theater, { height: narrow ? 520 : 460 }]}
        {...({ onMouseLeave: () => setHover(null) } as object)}
      >
        {hover || narrow ? null : (
          <View style={styles.arcs} pointerEvents="none">
            <Svg width="100%" height="220" viewBox="0 0 1000 220">
              <Path d="M180 170 Q360 20 500 150" stroke="rgba(158,208,255,0.55)" strokeWidth="1.4" strokeDasharray="3 7" fill="none" />
              <Path d="M180 170 Q500 -30 820 160" stroke="rgba(255,163,107,0.5)" strokeWidth="1.4" strokeDasharray="3 7" fill="none" />
            </Svg>
            <Text style={[styles.arcLabel, { left: "30%", top: 28, color: colors.blue }]}>Earth ↔ Moon · 1.3 s</Text>
            <Text style={[styles.arcLabel, { left: "38%", top: 0, color: "#FFC59E" }]}>{`Earth ↔ Mars · ${marsDelay}`}</Text>
          </View>
        )}
        {ORDER.map((id) => (
          <GlobeSlot
            key={id}
            id={id}
            reading={reading}
            motion={anim[id]}
            hover={hover}
            narrow={narrow}
            onHover={() => setHover(id)}
            onOpen={() => onOpen(id)}
          />
        ))}
      </View>

      <Text style={[styles.hint, narrow ? { letterSpacing: 0.4 } : null]}>
        {narrow ? "Tap a world to open it" : hover ? "Click to open" : "Hover a world to bring it forward · click to open"}
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

function GlobeSlot({
  id,
  reading,
  motion,
  hover,
  narrow,
  onHover,
  onOpen,
}: {
  id: Id;
  reading: KitReading;
  motion: { left: Animated.Value; top: Animated.Value; size: Animated.Value };
  hover: Id | null;
  narrow: boolean;
  onHover: () => void;
  onOpen: () => void;
}) {
  const meta = caption(id, reading);
  const focused = hover === id;
  const dim = hover !== null && !focused;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: motion.left.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        top: motion.top.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        width: motion.size,
        marginLeft: Animated.multiply(motion.size, -0.5),
        marginTop: Animated.multiply(motion.size, -0.5),
        alignItems: "center",
        zIndex: focused ? 3 : 1,
      }}
    >
      {id === "earth" ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: Animated.add(motion.size, 22),
            height: Animated.add(motion.size, 22),
            borderRadius: 999,
            backgroundColor: "rgba(80,150,255,0.18)",
            top: -11,
            left: -11,
          }}
        />
      ) : (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: Animated.multiply(motion.size, 1.36),
            height: Animated.multiply(motion.size, 0.28),
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.16)",
            top: Animated.multiply(motion.size, 0.36),
            left: Animated.multiply(motion.size, -0.18),
          }}
        />
      )}
      <Pressable accessibilityLabel={`Open ${meta.name}`} onHoverIn={onHover} onFocus={onHover} onPress={onOpen}>
        <Animated.View
          style={{
            width: motion.size,
            height: motion.size,
            borderRadius: Animated.divide(motion.size, 2),
            overflow: "hidden",
            backgroundColor: "#000",
          }}
        >
          <PlanetFill kind={id} />
        </Animated.View>
      </Pressable>
      <View style={{ alignItems: "center", marginTop: 14, width: "100%", opacity: dim ? 0.85 : 1 }}>
        <Text style={styles.kicker}>{meta.kicker}</Text>
        <Text numberOfLines={1} style={[styles.name, focused ? { fontSize: narrow ? 22 : 30 } : null]}>{meta.name}</Text>
        {dim ? null : (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text numberOfLines={2} style={[styles.status, { color: meta.color, textAlign: "center", flexShrink: 1 }]}>{meta.status}</Text>
          </View>
        )}
      </View>
    </Animated.View>
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
    const on = reading.leds.filter((v) => v > 0).length;
    return {
      name: "Moon",
      kicker: "02 · Live hardware",
      status: alarm ? `Humidity ${Math.round(reading.hum)}%` : night ? `Night · ${on} of 4 on` : "Lunar day · all on",
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
  page: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 18, width: "100%", maxWidth: 1240, alignSelf: "center" },
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
  theater: { height: 430, marginTop: 4 },
  arcs: { position: "absolute", left: 0, right: 0, top: 70, height: 220 },
  arcLabel: { position: "absolute", fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  hint: { textAlign: "center", color: colors.dim, fontFamily: mono, fontSize: 12, letterSpacing: 1.4, marginTop: 8 },
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
  kicker: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" },
  name: { color: colors.ink, fontFamily: sans, fontSize: 22, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  status: { fontFamily: mono, fontSize: 12 },
});
