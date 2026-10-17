import { memo } from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

const STYLE_ID = "desmas-scene-scan";

/** One full-height sheet. translateY(100%) then equals the hero height, not the 2px line. */
const CSS = `
@keyframes desmas-scene-scan {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}
[data-scene-scan] > div {
  pointer-events: none;
  animation: desmas-scene-scan 6s linear infinite;
  will-change: transform;
}
[data-scene-scan] > div::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 22px;
  transform: translateY(-50%);
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--scan-glow) 30%,
    var(--scan-line) 46%,
    var(--scan-line) 54%,
    var(--scan-glow) 70%,
    transparent 100%
  );
}
[data-scene-scan="earth"] > div {
  --scan-line: rgba(232, 240, 255, 0.78);
  --scan-glow: rgba(186, 214, 255, 0.28);
}
[data-scene-scan="moon"] > div {
  --scan-line: rgba(244, 246, 248, 0.76);
  --scan-glow: rgba(220, 226, 232, 0.26);
}
[data-scene-scan="mars"] > div {
  --scan-line: rgba(255, 246, 236, 0.78);
  --scan-glow: rgba(255, 206, 160, 0.32);
}
@media (prefers-reduced-motion: reduce) {
  [data-scene-scan] > div {
    animation: none;
    opacity: 0;
  }
}
`;

if (Platform.OS === "web" && typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export type ScanTone = "earth" | "moon" | "mars";

function SceneScanOverlayComponent({ tone }: { tone: ScanTone }) {
  if (Platform.OS !== "web") return null;
  return (
    <View
      {...({
        pointerEvents: "none",
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants",
        dataSet: { sceneScan: tone },
        style: styles.host,
      } as ViewProps)}
    >
      <View pointerEvents="none" style={styles.beam} />
    </View>
  );
}

export const SceneScanOverlay = memo(SceneScanOverlayComponent);

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  beam: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    width: "100%",
    height: "100%",
  },
});
