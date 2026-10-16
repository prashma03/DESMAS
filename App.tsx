import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AllWorlds } from "./src/components/AllWorlds";
import { WorldView } from "./src/components/WorldView";
import type { WorldId } from "./src/kit/types";
import { colors, styles as shell } from "./src/theme";
import { API } from "./src/api";
import { useKit } from "./src/useKit";
import { mono, sans } from "./src/components/dashboard";
const NAV: { id: WorldId; label: string }[] = [
  { id: "all", label: "All worlds" },
  { id: "earth", label: "Earth" },
  { id: "moon", label: "Moon" },
  { id: "mars", label: "Mars" },
];

const STARS = Array.from({ length: 48 }, (_, i) => ({
  left: `${(i * 47) % 100}%` as const,
  top: `${(i * 29) % 100}%` as const,
  size: i % 8 === 0 ? 2 : 1,
  opacity: 0.18 + (i % 5) * 0.1,
}));

export default function App() {
  const kit = useKit();
  const [world, setWorld] = useState<WorldId>("all");
  const [marsDelay, setMarsDelay] = useState("3 to 22 min");
  const live = kit.source === "serial";

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("desmas-font")) return;
    const link = document.createElement("link");
    link.id = "desmas-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    fetch(`${API}/api/mars-delay`)
      .then((r) => r.json())
      .then((d: { oneWaySeconds?: number }) => {
        if (!d.oneWaySeconds) return;
        const minutes = d.oneWaySeconds / 60;
        setMarsDelay(minutes >= 1 ? `${minutes.toFixed(1)} min` : `${Math.round(d.oneWaySeconds)} s`);
      })
      .catch(() => {
        /* server optional */
      });
  }, []);

  return (
    <View style={shell.root}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {STARS.map((star, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              borderRadius: 2,
              backgroundColor: "#fff",
              opacity: star.opacity,
            }}
          />
        ))}
      </View>
      <View style={styles.topbar}>
        <View style={styles.brandWrap}>
          <View style={styles.mark}>
            <View style={styles.markDot} />
          </View>
          <Text style={styles.brand}>DESMAS</Text>
        </View>
        <View style={styles.nav}>
          {NAV.map((item) => {
            const on = world === item.id;
            return (
              <Pressable key={item.id} style={[styles.navBtn, on ? styles.navOn : null]} onPressIn={() => setWorld(item.id)}>
                <Text style={[styles.navTxt, on ? styles.navTxtOn : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.tools}>
          <View style={[styles.sim, live ? styles.simLive : null]}>
            <View style={[styles.simDot, { backgroundColor: live ? colors.ok : colors.gold }]} />
            <Text style={styles.simTxt}>{live ? "Arduino live" : "Simulated kit"}</Text>
          </View>
          {live ? null : (
            <Pressable
              style={styles.connect}
              onPress={() =>
                Alert.alert("Connect Arduino", "Open this page in Chrome or Edge, plug in the board, and connect when serial is enabled. The simulated kit is running now.")
              }
            >
              <Text style={styles.connectTxt}>Connect Arduino</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={shell.stage}>
        {world === "all" ? (
          <AllWorlds reading={kit.reading} source={kit.source} marsDelay={marsDelay} onOpen={setWorld} />
        ) : (
          <WorldView
            world={world}
            reading={kit.reading}
            history={kit.history}
            events={kit.events}
            marsDelay={marsDelay}
            source={kit.source}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexWrap: "wrap",
  },
  brandWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 140 },
  mark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.4, borderColor: colors.gold, alignItems: "center", justifyContent: "center" },
  markDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  brand: { color: colors.ink, fontFamily: sans, fontWeight: "600", letterSpacing: 2.4, fontSize: 14 },
  nav: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 4,
  },
  navBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  navOn: { backgroundColor: colors.ink },
  navTxt: { color: colors.muted, fontFamily: sans, fontSize: 14, userSelect: "none" },
  navTxtOn: { color: "#111", fontWeight: "600" },
  tools: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 140, justifyContent: "flex-end" },
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
  simTxt: { color: colors.muted, fontFamily: mono, fontSize: 11, letterSpacing: 0.8 },
  connect: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  connectTxt: { color: "#111", fontFamily: sans, fontWeight: "600", fontSize: 14 },
});
