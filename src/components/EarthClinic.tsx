import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import type { KitEvent, KitReading, KitSource } from "../kit/types";
import { stageOf } from "../findings";
import { useScreen } from "../layout";
import { colors } from "../theme";
import { AiMonitor } from "./AIMonitor";
import { batteryEstimate, clock, feedMessage, Lower, mono, sans, solarOf, Sparkline } from "./dashboard";

const LED = ["#4ADE80", "#60A5FA", "#FACC15", "#F87171"] as const;
const STAGE = ["ALL FOUR ON", "FAN OFF", "FAN AND LIGHTS OFF", "RADIO ON LOW POWER"] as const;
const FLOW_H = 78;

const SYSTEMS = [
  { name: "Vaccine fridge", detail: "Green LED · pin 8 · never shed" },
  { name: "Radio", detail: "Blue LED · pin 9 · link to the district" },
  { name: "Lights", detail: "Yellow LED · pin 10 · exam room" },
  { name: "Fan", detail: "Red LED · pin 11 · cooling" },
] as const;

const MAP = [
  ["P1 · Green", "Life support", "Vaccine fridge"],
  ["P2 · Blue", "Comms", "Radio"],
  ["P3 · Yellow", "Science", "Lights"],
  ["P4 · Red", "Comfort", "Fan"],
] as const;

const RAIL = [
  { id: "power", label: "Power", d: "M9 1.5 L3.5 9 H8 L7 14.5 L12.5 7 H8 Z" },
  { id: "leds", label: "Same four LEDs", d: "M2 5 H14 M2 11 H14 M5 2 L2 5 L5 8 M11 8 L14 11 L11 14" },
  { id: "feed", label: "Alert feed", d: "M4 11 V7.5 A4 4 0 0 1 12 7.5 V11 L13 12.5 H3 Z M6.5 14 H9.5" },
  { id: "monitor", label: "AI monitor", d: "M8 1.5 L9.4 6.6 L14.5 8 L9.4 9.4 L8 14.5 L6.6 9.4 L1.5 8 L6.6 6.6 Z" },
] as const;

const KIND_COLOR: Record<KitEvent["kind"], string> = {
  POWER: colors.gold,
  ALERT: colors.alert,
  OK: colors.ok,
  INFO: colors.dim,
};

function ledWord(led: number) {
  if (led === 2) return "LOW POWER";
  return led > 0 ? "ON" : "OFF";
}

function cardStatus(led: number) {
  if (led === 2) return "LOW POWER · BLINKING";
  return led > 0 ? "ON" : "OFF · SAVING POWER";
}

function statusColor(led: number) {
  if (led === 2) return "#93C5FD";
  return led > 0 ? colors.ok : colors.dim;
}

export function ClinicLower({
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
  return (
    <>
      <ClinicStats reading={reading} history={history} />
      <Lower nav={<ClinicRail />}>
        <View style={styles.stack}>
          <View nativeID="power">
            <ClinicPower reading={reading} />
          </View>
          <View style={styles.panels}>
            <View nativeID="leds" style={styles.slot}>
              <LedTable leds={reading.leds} />
            </View>
            <View nativeID="feed" style={styles.slot}>
              <ClinicFeed events={events} />
            </View>
          </View>
          <AiMonitor world="earth" reading={reading} source={source} />
        </View>
      </Lower>
    </>
  );
}

function ClinicStats({ reading, history }: { reading: KitReading; history: KitReading[] }) {
  const { narrow, width } = useScreen();
  const solar = solarOf(reading.dark);
  const battery = batteryEstimate("earth", reading.dark);
  const onBattery = reading.dark >= 30;
  const alarm = reading.alarm === 1;
  const basis = narrow ? "47%" : width < 1100 ? "31%" : 0;
  const stats = [
    {
      label: "Solar input",
      badge: "A0",
      value: `${solar}%`,
      valueColor: colors.ink,
      note: onBattery ? "On battery now" : "Charging the battery",
      chart: <Sparkline values={history.map((h) => solarOf(h.dark))} color={colors.gold} />,
    },
    {
      label: "Systems on",
      badge: "LEDs",
      value: `${reading.leds.filter((v) => v > 0).length} of 4`,
      valueColor: colors.ink,
      note: "Fan goes off first",
      chart: <Meter value={reading.leds.filter((v) => v > 0).length * 25} color={colors.ok} />,
    },
    {
      label: "Humidity · store room",
      badge: "DHT11",
      value: `${Math.round(reading.hum)}%`,
      valueColor: alarm ? colors.alert : colors.ink,
      note: alarm ? `Above cutoff (${Math.round(reading.cut)}%)` : `Cutoff ${Math.round(reading.cut)}%`,
      chart: <Sparkline values={history.map((h) => h.hum)} color={alarm ? colors.alert : "#5CC8FF"} />,
      border: alarm ? "rgba(255,107,94,0.5)" : undefined,
    },
    {
      label: "Temp · store room",
      badge: "DHT11",
      value: `${reading.temp.toFixed(1)} °C`,
      valueColor: colors.ink,
      note: "Where the vaccines are kept",
      chart: <Sparkline values={history.map((h) => h.temp)} color="#F7C873" />,
    },
    {
      label: "Battery",
      value: `${battery}%`,
      valueColor: "#F7C873",
      note: "Estimate · no sensor on the kit",
      chart: <Meter value={battery} color={colors.gold} />,
    },
    {
      label: "Vaccine fridge",
      value: "5 °C",
      valueColor: colors.ok,
      note: "Estimate · safe range 2\u00A0to\u00A08\u00A0°C",
      chart: <Meter value={50} color={colors.ok} />,
    },
  ];
  return (
    <View style={styles.statRow}>
      {stats.map((stat) => (
        <View key={stat.label} style={[styles.stat, { flexBasis: basis, minWidth: basis === 0 ? 148 : undefined }, stat.border ? { borderColor: stat.border } : null]}>
          <View style={styles.statHead}>
            <Text style={[styles.kicker, styles.statLabel]}>{stat.label}</Text>
            {stat.badge ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveTxt}>{stat.badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.statVal, { color: stat.valueColor }]}>{stat.value}</Text>
          <View style={styles.chartSlot}>{stat.chart}</View>
          <Text style={styles.note} numberOfLines={2}>
            {stat.note}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Meter({ value, color }: { value: number; color: string }) {
  const width = `${Math.max(0, Math.min(100, value))}%` as const;
  return (
    <View style={styles.meterTrack}>
      <View style={[styles.meterFill, { width, backgroundColor: color }]} />
    </View>
  );
}

function ClinicRail() {
  const { narrow } = useScreen();
  const [active, setActive] = useState<string>(RAIL[0].id);
  const jump = (id: string) => {
    setActive(id);
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const target = document.getElementById(id);
    if (!target) return;
    let node = target.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      const scrolls = (style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 8;
      if (scrolls) {
        const top = target.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop - 8;
        node.scrollTo({ top, behavior: "smooth" });
        return;
      }
      node = node.parentElement;
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <View style={[styles.rail, narrow ? styles.railNarrow : null]}>
      <Text style={[styles.kicker, styles.railLabel]}>At this clinic</Text>
      <View style={narrow ? styles.railRow : styles.railList}>
        {RAIL.map((item) => {
          const on = item.id === active;
          const color = on ? colors.blue : colors.muted;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPressIn={() => jump(item.id)}
              style={[styles.railItem, on ? styles.railOn : null]}
            >
              <Svg width={16} height={16} viewBox="0 0 16 16">
                <Path d={item.d} stroke={color} strokeWidth={1.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              </Svg>
              <Text style={[styles.railTxt, { color }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ClinicPower({ reading }: { reading: KitReading }) {
  const { narrow, width } = useScreen();
  const solar = solarOf(reading.dark);
  const onBattery = reading.dark >= 30;
  const stage = STAGE[stageOf(reading)];
  const rowWidth = useRef(0);
  const laid = useRef<({ x: number; y: number; w: number } | null)[]>([null, null, null, null]);
  const [geom, setGeom] = useState({ width: 0, centers: [] as number[], wrapped: false });

  const publish = () => {
    const nextWidth = rowWidth.current;
    if (nextWidth <= 0) return;
    const cards = laid.current;
    const wrapped = cards.some((card) => card && card.y > 8);
    const centers = cards.every(Boolean) ? cards.map((card) => card!.x + card!.w / 2) : evenCenters(nextWidth);
    setGeom((prev) => {
      const sameWidth = Math.abs(prev.width - nextWidth) < 0.5;
      const sameWrap = prev.wrapped === wrapped;
      const sameCenters = prev.centers.length === centers.length && prev.centers.every((value, i) => Math.abs(value - centers[i]) < 0.5);
      if (sameWidth && sameWrap && sameCenters) return prev;
      return { width: nextWidth, centers, wrapped };
    });
  };

  const onRow = (event: LayoutChangeEvent) => {
    rowWidth.current = event.nativeEvent.layout.width;
    publish();
  };
  const onCard = (index: number) => (event: LayoutChangeEvent) => {
    const { x, y, width: cardWidth } = event.nativeEvent.layout;
    const prev = laid.current[index];
    if (prev && Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5 && Math.abs(prev.w - cardWidth) < 0.5) return;
    laid.current[index] = { x, y, w: cardWidth };
    publish();
  };

  const showFlow = width >= 860 && !narrow && !geom.wrapped && geom.width > 40 && geom.centers.length === 4;
  return (
    <View style={styles.power}>
      <View style={styles.powerHead}>
        <View style={styles.powerCopy}>
          <Text style={styles.eyebrow}>Power priority · set by the Arduino</Text>
          <Text style={[styles.powerTitle, narrow ? { fontSize: 24 } : null]}>Keep the vaccines cold until sunrise</Text>
        </View>
        <View style={styles.stagePill}>
          <Text style={styles.stageTxt}>{stage}</Text>
        </View>
      </View>
      <View style={styles.powerBody}>
        {showFlow ? (
          <View style={styles.flow} pointerEvents="none">
            <FlowLines width={geom.width} centers={geom.centers} leds={reading.leds} />
            <View style={[styles.source, { borderColor: onBattery ? "rgba(158,208,255,0.4)" : "rgba(242,181,68,0.45)" }]}>
              <Svg width={14} height={14} viewBox="0 0 16 16">
                <Circle cx={8} cy={8} r={3} stroke={onBattery ? colors.blue : "#F7C873"} strokeWidth={1.4} fill="none" />
                <Path
                  d="M8 1.5 V3 M8 13 V14.5 M1.5 8 H3 M13 8 H14.5 M3.4 3.4 L4.5 4.5 M11.5 11.5 L12.6 12.6 M3.4 12.6 L4.5 11.5 M11.5 4.5 L12.6 3.4"
                  stroke={onBattery ? colors.blue : "#F7C873"}
                  strokeWidth={1.4}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
              <Text style={[styles.sourceTxt, { color: onBattery ? colors.blue : "#F7C873" }]}>
                {onBattery ? `Battery only · solar ${solar}%` : `Solar ${solar}% + battery`}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={[styles.cardRow, showFlow ? styles.cardRowFlow : null]} onLayout={onRow}>
          {SYSTEMS.map((sys, i) => (
            <View key={sys.name} style={[styles.sysWrap, narrow ? styles.sysWrapNarrow : null]} onLayout={onCard(i)}>
              <SystemCard index={i} name={sys.name} detail={sys.detail} led={reading.leds[i] ?? 0} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SystemCard({
  index,
  name,
  detail,
  led,
}: {
  index: number;
  name: string;
  detail: string;
  led: number;
}) {
  const on = led > 0;
  const low = led === 2;
  return (
    <View style={[styles.sys, on ? null : styles.sysOff, low ? styles.sysLow : null]}>
      <View style={styles.sysTop}>
        <Text style={styles.rank}>{`P${index + 1}`}</Text>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.track, { backgroundColor: on ? (low ? "rgba(96,165,250,0.4)" : "rgba(134,239,172,0.35)") : "rgba(255,255,255,0.1)" }]}
        >
          <View style={[styles.knob, { alignSelf: on ? "flex-end" : "flex-start", backgroundColor: on ? colors.ink : colors.dim }]} />
        </View>
      </View>
      <View style={styles.nameRow}>
        <LedDot color={LED[index]} on={on} low={low} />
        <Text style={styles.sysName}>{name}</Text>
      </View>
      <Text style={styles.detail}>{detail}</Text>
      <Text style={[styles.state, { color: statusColor(led) }]}>{cardStatus(led)}</Text>
    </View>
  );
}

function LedDot({ color, on, low }: { color: string; on: boolean; low: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!low) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 380, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [low, opacity]);
  return <Animated.View style={[styles.ledDot, { backgroundColor: on ? color : "#3A4048", opacity }]} />;
}

function evenCenters(width: number) {
  const gap = 10;
  const card = Math.max(0, (width - gap * 3) / 4);
  return [0, 1, 2, 3].map((i) => i * (card + gap) + card / 2);
}

function FlowLines({ width, centers, leds }: { width: number; centers: number[]; leds: number[] }) {
  const [offset, setOffset] = useState(0);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(query.matches);
    apply();
    query.addEventListener?.("change", apply);
    return () => query.removeEventListener?.("change", apply);
  }, []);
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const step = last ? now - last : 16;
      last = now;
      setOffset((value) => (value + step * 0.028) % 28);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce]);
  const mid = width / 2;
  return (
    <Svg width="100%" height={FLOW_H} viewBox={`0 0 ${width} ${FLOW_H}`} preserveAspectRatio="none">
      {centers.map((cx, i) => {
        const d = `M ${mid} 28 C ${mid} 58 ${cx} 46 ${cx} ${FLOW_H}`;
        const led = leds[i] ?? 0;
        const live = led > 0;
        const moving = live && !reduce;
        const color = live ? LED[i] : "rgba(255,255,255,0.22)";
        return (
          <G key={LED[i]}>
            <Path d={d} stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={live ? 0.4 : 1} />
            {moving ? (
              <Path
                d={d}
                stroke={color}
                strokeWidth={1.7}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="6 8"
                strokeDashoffset={-(led === 2 ? offset * 0.32 : offset)}
              />
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

function LedTable({ leds }: { leds: number[] }) {
  const { narrow } = useScreen();
  if (narrow) {
    return (
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Same hardware, same code</Text>
        <Text style={styles.panelTitle}>Same four LEDs, two places</Text>
        {MAP.map((row, i) => (
          <View key={row[0]} style={styles.tableRow}>
            <View style={styles.ledCol}>
              <View style={[styles.tableDot, { backgroundColor: leds[i] > 0 ? LED[i] : "#3A4048" }]} />
              <Text style={styles.ledName}>{row[0]}</Text>
            </View>
            <Text style={[styles.nowCell, { color: statusColor(leds[i] ?? 0) }]}>{ledWord(leds[i] ?? 0)}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>Same hardware, same code</Text>
      <Text style={styles.panelTitle}>Same four LEDs, two places</Text>
      <View style={styles.table}>
        <View style={styles.tableHead}>
          {["LED", "Moon base", "Clinic", "Now"].map((label) => (
            <Text key={label} style={[styles.col, styles.colHead]}>
              {label}
            </Text>
          ))}
        </View>
        {MAP.map((row, i) => (
          <View key={row[0]} style={styles.tableRow}>
            <View style={[styles.col, styles.ledCol]}>
              <View style={[styles.tableDot, { backgroundColor: leds[i] > 0 ? LED[i] : "#3A4048" }]} />
              <Text style={styles.ledName}>{row[0]}</Text>
            </View>
            <Text style={[styles.col, styles.moonCell]}>{row[1]}</Text>
            <Text style={[styles.col, styles.clinicCell]}>{row[2]}</Text>
            <Text style={[styles.col, styles.nowCell, { color: statusColor(leds[i] ?? 0) }]}>{ledWord(leds[i] ?? 0)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ClinicFeed({ events }: { events: KitEvent[] }) {
  const rows = events.slice(0, 6);
  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>Alert feed · from sensor events</Text>
      <Text style={styles.panelTitle}>What just happened</Text>
      <View>
        {rows.length === 0 ? <Text style={styles.note}>Waiting for the kit.</Text> : null}
        {rows.map((event) => (
          <View key={event.id} style={styles.feedRow}>
            <Text style={styles.time}>{clock(event.at)}</Text>
            <View style={[styles.feedDot, { backgroundColor: KIND_COLOR[event.kind] }]} />
            <View style={styles.feedCopy}>
              <Text style={[styles.kind, { color: KIND_COLOR[event.kind] }]}>{event.kind}</Text>
              <Text style={styles.feedTxt}>{feedMessage("earth", event.message)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const card = {
  backgroundColor: "rgba(255,255,255,0.03)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
} as const;

const styles = StyleSheet.create({
  stack: { gap: 36 },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    ...card,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  statHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6, minHeight: 16 },
  statLabel: { flexShrink: 1 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.ok },
  liveTxt: { color: colors.ok, fontFamily: mono, fontSize: 10, letterSpacing: 0.6 },
  statVal: { fontFamily: mono, fontSize: 26, fontWeight: "400", letterSpacing: -0.4 },
  chartSlot: { height: 32, justifyContent: "center" },
  note: { color: colors.muted, fontFamily: sans, fontSize: 13, lineHeight: 17, minHeight: 34 },
  meterTrack: { height: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 99 },
  rail: { width: 188, flexShrink: 0, gap: 2, paddingTop: 2 },
  railNarrow: { width: "100%" },
  railLabel: { paddingHorizontal: 12, paddingBottom: 8 },
  railList: { gap: 2 },
  railRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  railItem: { minHeight: 40, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  railOn: { backgroundColor: "rgba(92,200,255,0.1)" },
  railTxt: { fontFamily: sans, fontSize: 15, fontWeight: "500" },
  power: { gap: 14 },
  powerHead: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 },
  powerCopy: { flexGrow: 1, flexShrink: 1, minWidth: 220, gap: 6 },
  eyebrow: { color: colors.blue, fontFamily: mono, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" },
  kicker: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  powerTitle: { color: colors.ink, fontFamily: sans, fontWeight: "300", fontSize: 32, letterSpacing: -0.5 },
  stagePill: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 7 },
  stageTxt: { color: colors.muted, fontFamily: mono, fontSize: 11, letterSpacing: 0.6 },
  powerBody: { position: "relative" },
  flow: { position: "absolute", left: 0, right: 0, top: 0, height: FLOW_H, zIndex: 0 },
  cardRowFlow: { marginTop: FLOW_H - 6 },
  source: {
    position: "absolute",
    top: 0,
    left: "50%",
    zIndex: 2,
    transform: [{ translateX: "-50%" }],
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "92%",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#0E1116",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sourceTxt: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
  cardRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, zIndex: 1 },
  sysWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 150, maxWidth: "100%" },
  sysWrapNarrow: { flexBasis: "47%" },
  sys: {
    ...card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  sysOff: { opacity: 0.55 },
  sysLow: { borderColor: "rgba(96,165,250,0.45)" },
  sysTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rank: { color: colors.dim, fontFamily: mono, fontSize: 12 },
  track: { width: 36, height: 20, borderRadius: 10, padding: 2, justifyContent: "center" },
  knob: { width: 16, height: 16, borderRadius: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ledDot: { width: 8, height: 8, borderRadius: 4 },
  sysName: { color: colors.ink, fontFamily: sans, fontSize: 16, fontWeight: "500" },
  detail: { color: colors.muted, fontFamily: sans, fontSize: 13, lineHeight: 18 },
  state: { fontFamily: mono, fontSize: 11, letterSpacing: 0.6, marginTop: 2 },
  panels: { flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "stretch" },
  slot: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, maxWidth: "100%" },
  panel: { ...card, flexGrow: 1, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16, gap: 8 },
  panelTitle: { color: colors.ink, fontFamily: sans, fontWeight: "300", fontSize: 26, letterSpacing: -0.4, marginBottom: 6 },
  table: { gap: 0 },
  tableHead: { flexDirection: "row", gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  tableRow: { flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  col: { flex: 1, minWidth: 0 },
  colHead: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  ledCol: { flexDirection: "row", alignItems: "center", gap: 8 },
  tableDot: { width: 8, height: 8, borderRadius: 4 },
  ledName: { color: colors.muted, fontFamily: mono, fontSize: 12, flexShrink: 1 },
  moonCell: { color: colors.muted, fontFamily: sans, fontSize: 14 },
  clinicCell: { color: colors.ink, fontFamily: sans, fontSize: 14 },
  nowCell: { fontFamily: mono, fontSize: 11, letterSpacing: 0.4 },
  feedRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  time: { width: 64, color: colors.dim, fontFamily: mono, fontSize: 12, paddingTop: 2 },
  feedDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  feedCopy: { flex: 1, minWidth: 0, gap: 2 },
  kind: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8 },
  feedTxt: { color: "#E3E7EC", fontFamily: sans, fontSize: 14, lineHeight: 19 },
});
