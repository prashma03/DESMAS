import { useEffect, useState } from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

const STYLE_ID = "desmas-hum-rings";

/**
 * Three ground-plane ellipses. Scale and opacity only, so the loop stays on the compositor.
 * Negative delays stagger one pulse (2.8s) into thirds.
 */
const CSS = `
@keyframes desmas-hum-ring {
  0% { transform: scale(0.32); opacity: 0; }
  14% { opacity: 0.92; }
  100% { transform: scale(1); opacity: 0; }
}
[data-hum-rings] {
  pointer-events: none;
  opacity: 0;
  transition: opacity 800ms ease;
}
[data-hum-rings="on"] {
  opacity: 1;
}
[data-hum-rings] > div {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border-radius: 50%;
  border: 1.6px solid rgba(255, 78, 68, 0.72);
  background: transparent;
  box-shadow:
    0 0 1px rgba(40, 0, 0, 0.55),
    0 0 8px rgba(255, 48, 40, 0.5);
  animation: desmas-hum-ring 2.8s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
  will-change: transform, opacity;
}
[data-hum-rings] > div:nth-child(1) {
  border-color: rgba(255, 168, 160, 0.95);
  box-shadow:
    0 0 1px rgba(40, 0, 0, 0.45),
    0 0 7px rgba(255, 90, 80, 0.72);
  animation-delay: 0s;
}
[data-hum-rings] > div:nth-child(2) {
  border-color: rgba(255, 92, 82, 0.62);
  animation-delay: -0.93s;
}
[data-hum-rings] > div:nth-child(3) {
  border-color: rgba(255, 72, 64, 0.42);
  animation-delay: -1.87s;
}
[data-hum-rings="off"] > div {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  [data-hum-rings] {
    transition: none;
  }
  [data-hum-rings] > div {
    animation: none;
    opacity: 0;
    transform: none;
  }
  [data-hum-rings="on"] > div:nth-child(2) {
    transform: scale(0.62);
    opacity: 0.8;
  }
}
`;

if (Platform.OS === "web" && typeof document !== "undefined") {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = CSS;
}

/**
 * Centered on Hab A in artemis-day.jpg (1006×492): the lit cylinder spans
 * about x 470–562 and y 275–310, so the ring origin is 51.3% / 59.5%.
 */
const ORIGIN = { left: "51.3%" as const, top: "59.5%" as const };

export function HumidityRings({ active }: { active: boolean }) {
  const [present, setPresent] = useState(active);
  const [shown, setShown] = useState(active);

  useEffect(() => {
    if (active) {
      setPresent(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setPresent(false), 900);
    return () => clearTimeout(timer);
  }, [active]);

  if (!present) return null;

  return (
    <View
      {...({
        pointerEvents: "none",
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants",
        dataSet: { humRings: shown ? "on" : "off" },
        style: styles.host,
      } as ViewProps)}
    >
      <View pointerEvents="none" style={[styles.ring, Platform.OS === "web" ? null : styles.ringNear]} />
      <View pointerEvents="none" style={[styles.ring, Platform.OS === "web" ? null : styles.ringMid]} />
      <View pointerEvents="none" style={[styles.ring, Platform.OS === "web" ? null : styles.ringFar]} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: ORIGIN.left,
    top: ORIGIN.top,
    width: "28%",
    height: "22%",
    zIndex: 1,
    transform: [{ translateX: "-50%" }, { translateY: "-50%" }],
  },
  ring: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
    ...(Platform.OS === "web"
      ? {}
      : {
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: "rgba(255, 92, 82, 0.75)",
        }),
  },
  ringNear: { transform: [{ scale: 0.42 }] },
  ringMid: { transform: [{ scale: 0.68 }], opacity: 0.7 },
  ringFar: { transform: [{ scale: 0.95 }], opacity: 0.4 },
});
