import { ReactNode } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import type { KitEvent, KitReading } from "../kit/types";
import { colors } from "../theme";

export const mono = Platform.OS === "web" ? "Geist Mono, ui-monospace, monospace" : undefined;
export const sans = Platform.OS === "web" ? "Geist, sans-serif" : undefined;

const TEX = {
  earth: require("../../assets/planets/earth.jpg"),
  moon: require("../../assets/planets/moon.jpg"),
  mars: require("../../assets/planets/mars.jpg"),
} as const;
const SHADE = require("../../assets/planets/shade.webp");
const CLOUDS = require("../../assets/planets/clouds.webp");

export type WorldKey = "earth" | "moon" | "mars";

export function solarOf(dark: number) {
  return Math.max(0, Math.round(100 - dark));
}

/** Battery is not on the kit. This is a display estimate from the light sensor. */
export function batteryEstimate(world: WorldKey, dark: number) {
  const solar = Math.max(0, 100 - dark);
  const raw = world === "earth" ? 28 + solar * 0.1 : world === "moon" ? 40 + solar * 0.31 : 36 + solar * 0.25;
  return Math.round(Math.min(99, Math.max(8, raw)));
}

export function stormLabel(dark: number) {
  if (dark < 30) return "Light";
  if (dark < 55) return "Moderate";
  if (dark < 85) return "Strong";
  return "Severe";
}

export function clock(at: number) {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function feedMessage(world: WorldKey, message: string) {
  if (world === "moon") return message;
  if (world === "earth") {
    return message
      .replace("Turned off Comfort.", "Turned off the fan.")
      .replace("Lunar night. Turned off Science too.", "Night. Exam room lights off unless needed.")
      .replace("Light rising. Science is back on.", "Brighter. Lights are back on.")
      .replace("Sunlight is back. All four systems are on.", "Daylight. All four systems are on.")
      .replace("Hab humidity", "Store room humidity")
      .replace("Humidity is back under the cutoff.", "Store room humidity is back under the cutoff.");
  }
  return message
    .replace("Turned off Comfort.", "Turned off comfort extras.")
    .replace("Lunar night. Turned off Science too.", "Storm thickened. Turned off Science.")
    .replace("Light rising. Science is back on.", "Storm easing. Science is back on.")
    .replace("Sunlight is back. All four systems are on.", "Storm cleared. All four systems are on.");
}

const KIND_COLOR: Record<KitEvent["kind"], string> = {
  POWER: colors.gold,
  ALERT: colors.alert,
  OK: colors.ok,
  INFO: colors.dim,
};

export function Page({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
      {children}
    </ScrollView>
  );
}

export function PlanetFill({ kind }: { kind: WorldKey }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={TEX[kind]} style={styles.planetPhoto} resizeMode="cover" />
      {kind === "earth" ? <Image source={CLOUDS} style={styles.clouds} resizeMode="cover" /> : null}
      <Image
        source={SHADE}
        style={[styles.shade, Platform.OS === "web" ? ({ mixBlendMode: "multiply" } as object) : null]}
        resizeMode="stretch"
      />
    </View>
  );
}

export function GlassTag({
  title,
  line,
  color = colors.ok,
  on = true,
  style,
}: {
  title: string;
  line: string;
  color?: string;
  on?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.tag, style]}>
      <Text style={styles.tagTitle}>{title}</Text>
      <View style={styles.tagRow}>
        <View style={[styles.dot, { backgroundColor: on ? color : "#555" }]} />
        <Text style={[styles.tagLine, { color: on ? color : colors.dim }]}>{line}</Text>
      </View>
    </View>
  );
}

export function DayBadge({ label, tone = "ok" }: { label: string; tone?: "ok" | "watch" | "alert" }) {
  const color = tone === "alert" ? colors.alert : tone === "watch" ? colors.watch : colors.ok;
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

export function SceneTitle({ kicker, title, style }: { kicker: string; title: string; style?: ViewStyle }) {
  return (
    <View style={[styles.titleBlock, style]}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.sceneTitle}>{title}</Text>
    </View>
  );
}

export function KitReadout({
  live,
  dark,
  hum,
  temp,
  note,
}: {
  live: boolean;
  dark: number;
  hum: number;
  temp: number;
  note: string;
}) {
  return (
    <View style={styles.kitCard}>
      <View style={styles.kitHead}>
        <Text style={styles.kicker}>From the kit</Text>
        <Text style={[styles.kicker, { color: live ? colors.ok : colors.gold }]}>{live ? "Live" : "Simulated"}</Text>
      </View>
      <View style={styles.kitNums}>
        <KitNum label="Dark · A0" value={`${Math.round(dark)}%`} />
        <KitNum label="Humidity" value={`${Math.round(hum)}%`} />
        <KitNum label="Temp" value={`${temp.toFixed(1)} °C`} />
      </View>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

function KitNum({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={styles.kitVal}>{value}</Text>
    </View>
  );
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <View style={styles.statRow}>
      {stats.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </View>
  );
}

export type Stat = {
  label: string;
  badge?: string;
  value: string;
  valueColor?: string;
  note: string;
  series?: number[];
  color?: string;
};

function StatCard({ stat }: { stat: Stat }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Text style={styles.kicker}>{stat.label}</Text>
        {stat.badge ? <Text style={styles.badgeMini}>{stat.badge}</Text> : null}
      </View>
      <Text style={[styles.statVal, stat.valueColor ? { color: stat.valueColor } : null]}>{stat.value}</Text>
      <Sparkline values={stat.series ?? []} color={stat.color ?? colors.gold} />
      <Text style={styles.note}>{stat.note}</Text>
    </View>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 160;
  const h = 32;
  const nums = values.slice(-28);
  if (nums.length < 2) {
    return (
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <Line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke={color} strokeWidth="1.6" />
      </Svg>
    );
  }
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const pts = nums
    .map((v, i) => {
      const x = (i / (nums.length - 1)) * w;
      const y = h - 4 - ((v - lo) / span) * (h - 8);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export function SideNav({ label, items }: { label: string; items: string[] }) {
  return (
    <View style={styles.nav}>
      <Text style={styles.kicker}>{label}</Text>
      {items.map((item, i) => (
        <View key={item} style={[styles.navItem, i === 0 ? styles.navOn : null]}>
          <Text style={[styles.navTxt, i === 0 ? styles.navTxtOn : null]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const LEDS = [colors.green, colors.ledBlue, colors.ledYellow, colors.ledRed];

export function PowerBlock({
  eyebrow,
  title,
  systems,
  leds,
  solar,
  battery,
}: {
  eyebrow: string;
  title: string;
  systems: { name: string; detail: string }[];
  leds: number[];
  solar: number;
  battery: number;
}) {
  const on = leds.filter((v) => v > 0).length;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.powerHead}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.kicker, { color: colors.gold }]}>{eyebrow}</Text>
          <Text style={styles.powerTitle}>{title}</Text>
        </View>
        <Text style={styles.kicker}>{on === 4 ? "All four on" : `${on} of 4 on`}</Text>
      </View>
      <View style={styles.curveWrap}>
        <Svg width="100%" height={78} viewBox="0 0 520 78">
          {LEDS.map((color, i) => (
            <Polyline
              key={color}
              points={curve(leds[i] > 0, 18 + i * 4)}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeDasharray={i >= 2 ? "5 5" : undefined}
            />
          ))}
        </Svg>
        <View style={styles.curvePill}>
          <Text style={styles.kicker}>{`Solar ${solar}%  ·  battery est. ${battery}%`}</Text>
        </View>
      </View>
      <View style={styles.cardRow}>
        {systems.map((sys, i) => {
          const onLed = leds[i] > 0;
          return (
            <View key={sys.name} style={[styles.sys, onLed ? null : { opacity: 0.55 }]}>
              <View style={styles.sysTop}>
                <Text style={[styles.kicker, { color: LEDS[i] }]}>{`P${i + 1}`}</Text>
                <View style={[styles.toggle, { backgroundColor: onLed ? colors.green : "#2a2d33" }]}>
                  <View style={[styles.knob, { alignSelf: onLed ? "flex-end" : "flex-start" }]} />
                </View>
              </View>
              <Text style={styles.sysName}>{sys.name}</Text>
              <Text style={styles.note}>{sys.detail}</Text>
              <Text style={[styles.state, { color: onLed ? colors.ok : colors.dim }]}>{onLed ? "ON" : "OFF"}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function curve(on: boolean, dip: number) {
  if (on) return "8,34 70,28 140,22 210,20 280,24 360,30 440,34 512,38";
  return `8,30 60,28 110,32 160,48 230,${58 + (dip % 5)} 320,64 420,66 512,68`;
}

export function AlertFeed({ world, events }: { world: WorldKey; events: KitEvent[] }) {
  const rows = events.slice(0, 6);
  return (
    <View style={[styles.panel, { flex: 1, minWidth: 260 }]}>
      <Text style={styles.kicker}>Alert feed · from sensor events</Text>
      <Text style={styles.panelTitle}>What just happened</Text>
      <View style={{ gap: 12, marginTop: 8 }}>
        {rows.length === 0 ? <Text style={styles.note}>Waiting for the kit.</Text> : null}
        {rows.map((event) => (
          <View key={event.id} style={styles.feedRow}>
            <Text style={styles.time}>{clock(event.at)}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.kind, { color: KIND_COLOR[event.kind] }]}>{event.kind}</Text>
              <Text style={styles.feedTxt}>{feedMessage(world, event.message)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function HumidityChart({ history, reading }: { history: KitReading[]; reading: KitReading }) {
  const w = 360;
  const h = 120;
  const vals = history.slice(-30);
  const lo = 40;
  const hi = 95;
  const yOf = (v: number) => h - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * h;
  const pts =
    vals.length > 1
      ? vals
          .map((sample, i) => `${(i / (vals.length - 1)) * w},${yOf(sample.hum)}`)
          .join(" ")
      : `0,${h} ${w},${h}`;
  return (
    <View style={[styles.panel, { flex: 1.2, minWidth: 280 }]}>
      <View style={styles.powerHead}>
        <View>
          <Text style={styles.kicker}>Hab A · DHT11 on pin 2</Text>
          <Text style={styles.panelTitle}>Humidity, last 30 seconds</Text>
        </View>
        <Text style={styles.big}>{Math.round(reading.hum)}%</Text>
      </View>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <Line x1="0" y1={yOf(reading.cut)} x2={w} y2={yOf(reading.cut)} stroke={colors.gold} strokeDasharray="4 5" strokeWidth="1.2" />
        <Line x1="0" y1={yOf(reading.hbase)} x2={w} y2={yOf(reading.hbase)} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 6" strokeWidth="1" />
        <Polyline points={pts} fill="none" stroke={colors.ledBlue} strokeWidth="2.4" />
      </Svg>
      <View style={styles.chartFoot}>
        <Text style={styles.note}>{`Temp\n${reading.temp.toFixed(1)} °C`}</Text>
        <Text style={styles.note}>{`Normal\n${Math.round(reading.hbase)}%`}</Text>
        <Text style={styles.note}>{`Cutoff\n${Math.round(reading.cut)}%`}</Text>
      </View>
    </View>
  );
}

export function SerialLog({ history }: { history: KitReading[] }) {
  const lines = history.slice(-6).map((row) => JSON.stringify(row));
  return (
    <View style={styles.panel}>
      <View style={styles.powerHead}>
        <View>
          <Text style={styles.kicker}>Raw serial · USB · 9600 baud</Text>
          <Text style={styles.panelTitle}>What the Arduino sends</Text>
        </View>
        <Text style={styles.kicker}>2 lines a second · simulated</Text>
      </View>
      <Text style={styles.serial}>{lines.join("\n\n") || "Waiting for lines…"}</Text>
    </View>
  );
}

export function LedMap({ leds }: { leds: number[] }) {
  const rows = [
    ["P1 · Green", "Life support", "Vaccine fridge"],
    ["P2 · Blue", "Comms", "Radio"],
    ["P3 · Yellow", "Science", "Lights"],
    ["P4 · Red", "Comfort", "Fan"],
  ];
  return (
    <View style={[styles.panel, { flex: 1.1, minWidth: 280 }]}>
      <Text style={styles.kicker}>Same hardware, same code</Text>
      <Text style={styles.panelTitle}>Same four LEDs, two places</Text>
      <View style={[styles.mapRow, { marginTop: 12 }]}>
        <Text style={[styles.mapCell, styles.kicker]}>LED</Text>
        <Text style={[styles.mapCell, styles.kicker]}>Moon base</Text>
        <Text style={[styles.mapCell, styles.kicker]}>Clinic</Text>
        <Text style={[styles.mapCell, styles.kicker]}>Now</Text>
      </View>
      {rows.map((row, i) => (
        <View key={row[0]} style={styles.mapRow}>
          <Text style={[styles.mapCell, { color: LEDS[i] }]}>{row[0]}</Text>
          <Text style={styles.mapCell}>{row[1]}</Text>
          <Text style={styles.mapCell}>{row[2]}</Text>
          <Text style={[styles.mapCell, { color: leds[i] > 0 ? colors.ok : colors.dim }]}>{leds[i] > 0 ? "ON" : "OFF"}</Text>
        </View>
      ))}
    </View>
  );
}

export function DelayCard({ delay }: { delay: string }) {
  return (
    <View style={[styles.panel, { flex: 1, minWidth: 260 }]}>
      <Text style={styles.kicker}>Why it runs onboard</Text>
      <View style={styles.powerHead}>
        <Text style={styles.panelTitle}>Wait for Earth, or decide here?</Text>
      </View>
      <Text style={styles.note}>Ask Mission Control</Text>
      <Text style={styles.big}>{delay}</Text>
      <Text style={styles.note}>Still waiting · worst case 44 min round trip</Text>
      <View style={styles.doneRow}>
        <Text style={styles.body}>DESMAS on the base</Text>
        <Text style={[styles.body, { color: "#FFB07A" }]}>Done</Text>
      </View>
      <View style={styles.track}>
        <View style={styles.trackFill} />
      </View>
      <Text style={styles.note}>Acted on the last reading. The base follows the Moon power rules.</Text>
    </View>
  );
}

export function FaultLog({ events }: { events: KitEvent[] }) {
  const handled = [
    { time: "14:02", text: "Relay ship: radio A stopped answering. Switched to radio B." },
    { time: "13:48", text: "Relay ship: camera heater fault. Turned the camera off to save power." },
  ];
  return (
    <View style={[styles.panel, { flex: 1, minWidth: 260 }]}>
      <Text style={styles.kicker}>Fault log</Text>
      <Text style={styles.panelTitle}>Handled without Earth</Text>
      <View style={{ gap: 12, marginTop: 8 }}>
        {events.slice(0, 4).map((event) => (
          <View key={event.id} style={styles.feedRow}>
            <Text style={styles.time}>{clock(event.at)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kind, { color: KIND_COLOR[event.kind] }]}>{event.kind}</Text>
              <Text style={styles.feedTxt}>{feedMessage("mars", event.message)}</Text>
            </View>
          </View>
        ))}
        {handled.map((row) => (
          <View key={row.time} style={styles.feedRow}>
            <Text style={styles.time}>{row.time}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kind, { color: colors.ok }]}>HANDLED</Text>
              <Text style={styles.feedTxt}>{row.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Split({ children }: { children: ReactNode }) {
  return <View style={styles.split}>{children}</View>;
}

export function Lower({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.lower}>
      {nav}
      <View style={{ flex: 1, minWidth: 280, gap: 14 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 48, gap: 14, width: "100%", maxWidth: 1240, alignSelf: "center" },
  planetPhoto: { width: "100%", height: "100%" },
  clouds: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", opacity: 0.35 },
  shade: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", opacity: 0.85 },
  tag: {
    position: "absolute",
    backgroundColor: "rgba(8,10,14,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  tagTitle: { color: colors.ink, fontSize: 13, fontFamily: sans },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tagLine: { fontSize: 11, fontFamily: mono, letterSpacing: 0.4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badge: {
    position: "absolute",
    top: 14,
    left: 14,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(8,10,14,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  badgeTxt: { fontFamily: mono, fontSize: 11, letterSpacing: 0.6 },
  titleBlock: {
    position: "absolute",
    left: 16,
    bottom: 16,
    zIndex: 3,
    maxWidth: 460,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(6,8,12,0.55)",
  },
  kicker: {
    color: colors.dim,
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  sceneTitle: { color: colors.ink, fontFamily: sans, fontWeight: "300", fontSize: 34, letterSpacing: -0.6, marginTop: 2 },
  kitCard: {
    position: "absolute",
    right: 14,
    bottom: 14,
    zIndex: 3,
    width: 280,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    backgroundColor: "rgba(8,10,14,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  kitHead: { flexDirection: "row", justifyContent: "space-between" },
  kitNums: { flexDirection: "row", gap: 8 },
  kitVal: { color: colors.ink, fontFamily: mono, fontSize: 16, marginTop: 2 },
  note: { color: colors.dim, fontSize: 12, lineHeight: 16, fontFamily: sans },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 4,
    minWidth: 140,
  },
  statHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  badgeMini: {
    color: colors.dim,
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: 0.6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statVal: { color: colors.ink, fontFamily: sans, fontWeight: "400", fontSize: 26, letterSpacing: -0.4 },
  nav: { width: 176, gap: 6, paddingTop: 8 },
  navItem: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  navOn: { backgroundColor: "#3a2a16" },
  navTxt: { color: colors.muted, fontFamily: sans, fontSize: 14 },
  navTxtOn: { color: colors.ink },
  powerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 },
  powerTitle: { color: colors.ink, fontFamily: sans, fontWeight: "300", fontSize: 28, letterSpacing: -0.4 },
  curveWrap: { height: 86, justifyContent: "center" },
  curvePill: {
    position: "absolute",
    alignSelf: "center",
    top: 4,
    backgroundColor: "rgba(12,14,18,0.9)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sys: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 150,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 4,
  },
  sysTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggle: { width: 36, height: 20, borderRadius: 10, padding: 2, justifyContent: "center" },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
  sysName: { color: colors.ink, fontSize: 16, fontFamily: sans, marginTop: 6 },
  state: { fontFamily: mono, fontSize: 12, letterSpacing: 0.8, marginTop: 8 },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 6,
  },
  panelTitle: { color: colors.ink, fontFamily: sans, fontWeight: "400", fontSize: 22, letterSpacing: -0.3 },
  feedRow: { flexDirection: "row", gap: 10 },
  time: { color: colors.dim, fontFamily: mono, fontSize: 11, width: 62 },
  kind: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8 },
  feedTxt: { color: colors.muted, fontSize: 14, lineHeight: 18, fontFamily: sans },
  big: { color: colors.ink, fontFamily: sans, fontWeight: "300", fontSize: 36 },
  chartFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  serial: { color: "#b7e3c8", fontFamily: mono, fontSize: 12, lineHeight: 18, marginTop: 8 },
  mapRow: { flexDirection: "row", gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  mapCell: { flex: 1, color: colors.ink, fontSize: 13, fontFamily: sans },
  body: { color: colors.ink, fontSize: 15, fontFamily: sans },
  doneRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  track: { height: 6, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  trackFill: { width: "100%", height: "100%", backgroundColor: "#FFB07A" },
  split: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  lower: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
});
