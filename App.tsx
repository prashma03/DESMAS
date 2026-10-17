import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, Pressable, SafeAreaView, StatusBar as RNStatusBar, StyleSheet, Text, View } from "react-native";
import { AllWorlds } from "./src/components/AllWorlds";
import { WorldView } from "./src/components/WorldView";
import type { EarthDelay } from "./src/findings";
import { kitStore } from "./src/kit/store";
import { kitFreshness, type WorldId } from "./src/kit/types";
import { board } from "./src/serial/board";
import { colors, styles as shell } from "./src/theme";
import { API } from "./src/api";
import { useKit } from "./src/useKit";
import { mono, sans } from "./src/components/dashboard";
import { Starfield } from "./src/components/Starfield";
import { useScreen } from "./src/layout";
const NAV: { id: WorldId; label: string }[] = [
  { id: "all", label: "All worlds" },
  { id: "earth", label: "Earth" },
  { id: "moon", label: "Moon" },
  { id: "mars", label: "Mars" },
];

export default function App() {
  const kit = useKit();
  const { compact, narrow } = useScreen();
  const [world, setWorld] = useState<WorldId>("all");
  const [delay, setDelay] = useState<EarthDelay | null>(null);
  const fresh = kitFreshness(kit.source, kit.link);
  const live = fresh.live;
  const portBusy = kit.link === "connecting" || kit.link === "connected" || kit.link === "live";
  const badge =
    kit.link === "live"
      ? `Arduino live · ${formatUptime(Date.now() - kit.lastAt)}`
      : kit.link === "connecting" || kit.link === "connected"
        ? "Connecting"
        : kit.link === "stale" || kit.link === "disconnected"
          ? "Stale"
          : kit.link === "error"
            ? "Error"
            : narrow
              ? "Simulated"
              : "Simulated kit";
  const marsDelay = delay ? `${delay.oneWayMin.toFixed(1)} min` : "3 to 22 min";
  const androidTop = Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) : 0;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("desmas-font")) return;
    const link = document.createElement("link");
    link.id = "desmas-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => board.watch(), []);

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetch(`${API}/api/mars-delay`)
        .then((r) => r.json())
        .then((d: { oneWayMin?: number; roundTripMin?: number; oneWaySeconds?: number; au?: number }) => {
          if (stop) return;
          if (typeof d.oneWayMin === "number" && typeof d.roundTripMin === "number") {
            setDelay({ oneWayMin: d.oneWayMin, roundTripMin: d.roundTripMin, au: d.au });
            return;
          }
          if (!d.oneWaySeconds) return;
          const oneWayMin = d.oneWaySeconds / 60;
          setDelay({ oneWayMin, roundTripMin: oneWayMin * 2, au: d.au });
        })
        .catch(() => {
          /* server optional */
        });
    };
    load();
    const timer = setInterval(load, 60 * 60 * 1000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <SafeAreaView style={[shell.root, androidTop ? { paddingTop: androidTop } : null]}>
      <StatusBar style="light" />
      <Starfield />
      <View style={[styles.topbar, compact ? styles.topbarCompact : null]}>
        <View style={[styles.brandWrap, compact ? styles.brandCompact : null]}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <View style={styles.markDot} />
            </View>
            <Text style={styles.brandTxt}>DESMAS</Text>
          </View>
          {compact ? (
            <View style={[styles.sim, live ? styles.simLive : null, styles.simCompact]}>
              <View style={[styles.simDot, { backgroundColor: live ? colors.ok : fresh.mark === "Stale" ? colors.watch : colors.gold }]} />
              <Text numberOfLines={1} style={styles.simTxt}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.nav, compact ? styles.navCompact : null]}>
          {NAV.map((item) => {
            const on = world === item.id;
            const label = narrow && item.id === "all" ? "All" : item.label;
            return (
              <Pressable key={item.id} style={[styles.navBtn, compact ? styles.navBtnCompact : null, on ? styles.navOn : null]} onPressIn={() => setWorld(item.id)}>
                <Text numberOfLines={1} style={[styles.navTxt, compact ? styles.navTxtCompact : null, on ? styles.navTxtOn : null]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {compact ? (
          portBusy ? null : (
            <Pressable
              style={[styles.connect, styles.connectCompact]}
              onPress={() => void board.connect()}
            >
              <Text style={styles.connectTxt}>Connect Arduino</Text>
            </Pressable>
          )
        ) : (
          <View style={styles.tools}>
            <View style={[styles.sim, live ? styles.simLive : null]}>
              <View style={[styles.simDot, { backgroundColor: live ? colors.ok : fresh.mark === "Stale" ? colors.watch : colors.gold }]} />
              <Text style={styles.simTxt}>{badge}</Text>
            </View>
            {portBusy ? null : (
              <Pressable
                style={styles.connect}
                onPress={() => void board.connect()}
              >
                <Text style={styles.connectTxt}>Connect Arduino</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      {kit.notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTxt}>{kit.notice}</Text>
          <Pressable accessibilityLabel="Dismiss message" onPress={() => kitStore.setNotice("")} style={styles.noticeClose}>
            <Text style={styles.noticeX}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={[shell.stage, styles.stage]}>
        {world === "all" ? (
          <AllWorlds reading={kit.reading} source={kit.source} link={kit.link} marsDelay={marsDelay} onOpen={setWorld} />
        ) : (
          <WorldView
            world={world}
            reading={kit.reading}
            history={kit.history}
            events={kit.events}
            lines={kit.lines}
            delay={delay}
            source={kit.source}
            link={kit.link}
          />
        )}
      </View>
      <HardwareDiag kit={kit} />
    </SafeAreaView>
  );
}

function HardwareDiag({ kit }: { kit: ReturnType<typeof useKit> }) {
  const [on, setOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    setOn(new URLSearchParams(window.location.search).get("diag") === "1");
  }, []);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  if (!on) return null;
  const age = kit.lastAt > 0 ? `${Math.max(0, Math.round((now - kit.lastAt) / 1000))} s` : "none";
  return (
    <View pointerEvents="none" style={styles.diag}>
      <Text style={styles.diagTxt}>{`link ${kit.link} · source ${kit.source} · last ${age}`}</Text>
      <Text style={styles.diagTxt}>{`light ${Math.round(kit.reading.light)} · dark ${Math.round(kit.reading.dark)}% · hum ${kit.reading.hum.toFixed(1)}% · temp ${kit.reading.temp.toFixed(1)} °C`}</Text>
      <Text style={styles.diagTxt}>{`alarm ${kit.reading.alarm} · dht ${kit.reading.dht} · leds ${kit.reading.leds.join(" ")}`}</Text>
    </View>
  );
}

function formatUptime(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 100 ? `${s} s` : `${Math.round(s / 60)} min`;
}

const styles = StyleSheet.create({
  stage: { zIndex: 1 },
  notice: {
    zIndex: 2,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 14,
    backgroundColor: "rgba(242,181,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(242,181,68,0.35)",
  },
  noticeTxt: { flex: 1, color: colors.gold, fontFamily: sans, fontSize: 14, lineHeight: 20 },
  noticeClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  noticeX: { color: colors.gold, fontSize: 18 },
  topbar: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  topbarCompact: { flexDirection: "column", alignItems: "stretch", paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  brandWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  brandCompact: { flex: 0, width: "100%", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  mark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.4, borderColor: colors.gold, alignItems: "center", justifyContent: "center" },
  markDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  brandTxt: { color: colors.ink, fontFamily: sans, fontWeight: "600", letterSpacing: 2.4, fontSize: 14 },
  nav: {
    flexDirection: "row",
    flexShrink: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 4,
  },
  navCompact: { alignSelf: "stretch", flexShrink: 0 },
  navBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center" },
  navBtnCompact: { flex: 1, paddingHorizontal: 4, minWidth: 0 },
  navOn: { backgroundColor: colors.ink },
  navTxt: { color: colors.muted, fontFamily: sans, fontSize: 14, userSelect: "none" },
  navTxtCompact: { fontSize: 13, textAlign: "center" },
  navTxtOn: { color: "#111", fontWeight: "600" },
  tools: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, justifyContent: "flex-end" },
  simCompact: { flexShrink: 1, minWidth: 0 },
  sim: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(242,181,68,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  simLive: { borderColor: "rgba(134,239,172,0.45)" },
  simDot: { width: 7, height: 7, borderRadius: 4 },
  simTxt: { color: colors.muted, fontFamily: mono, fontSize: 11, letterSpacing: 0.8, flexShrink: 1 },
  connect: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  connectCompact: { alignItems: "center" },
  connectTxt: { color: "#111", fontFamily: sans, fontWeight: "600", fontSize: 14 },
  diag: {
    position: "absolute",
    right: 12,
    bottom: 12,
    zIndex: 8,
    maxWidth: 420,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  diagTxt: { color: colors.muted, fontFamily: mono, fontSize: 11, lineHeight: 16 },
});
