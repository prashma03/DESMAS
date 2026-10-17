import { memo, useEffect, useState } from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import Svg, { Ellipse } from "react-native-svg";

const STYLE_ID = "desmas-hum-rings";

/**
 * Three ground-plane ellipses. Scale and opacity only, so the loop stays on the compositor.
 * Negative delays stagger one 2.8s pulse into thirds. vector-effect keeps the stroke near 1.75px.
 */
const CSS = `
@keyframes desmas-hum-ring {
  0% { transform: scale(0.4); opacity: 0; }
  12% { opacity: 0.88; }
  100% { transform: scale(1); opacity: 0; }
}
[data-hum-rings] {
  pointer-events: none;
  opacity: 0;
  transition: opacity 900ms ease;
}
[data-hum-rings="on"] {
  opacity: 1;
}
[data-hum-rings] ellipse {
  pointer-events: none;
  fill: none;
  stroke-width: 1.75px;
  vector-effect: non-scaling-stroke;
  transform-box: fill-box;
  transform-origin: center;
  animation: desmas-hum-ring 2.8s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
  will-change: transform, opacity;
}
[data-hum-rings] ellipse:nth-of-type(1) {
  stroke: rgba(255, 196, 186, 0.96);
  filter: drop-shadow(0 0 1px rgba(20, 0, 0, 0.8)) drop-shadow(0 0 3px rgba(255, 90, 78, 0.72));
  animation-delay: 0s;
}
[data-hum-rings] ellipse:nth-of-type(2) {
  stroke: rgba(255, 96, 86, 0.62);
  filter: drop-shadow(0 0 1px rgba(20, 0, 0, 0.65)) drop-shadow(0 0 5px rgba(255, 48, 40, 0.45));
  animation-delay: -0.93s;
}
[data-hum-rings] ellipse:nth-of-type(3) {
  stroke: rgba(255, 72, 64, 0.4);
  filter: drop-shadow(0 0 1px rgba(20, 0, 0, 0.5)) drop-shadow(0 0 6px rgba(255, 40, 32, 0.28));
  animation-delay: -1.87s;
}
[data-hum-rings="off"] ellipse {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  [data-hum-rings] {
    transition: none;
  }
  [data-hum-rings] ellipse {
    animation: none;
    opacity: 0;
    transform: none;
    filter: none;
  }
  [data-hum-rings="on"] ellipse:nth-of-type(2) {
    transform: scale(0.68);
    opacity: 0.85;
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
 * Hab A cylinder in artemis-day.jpg / artemis-night.jpg (1006×492).
 * The lit body runs about x 450–555 and y 260–318. The on-screen midpoint of
 * that span sits at 48.5% / 58.8% of the hero, which is where the rings originate.
 */
const ORIGIN = { left: "48.5%" as const, top: "58.8%" as const };

function Ring({ rx, stroke, opacity }: { rx: number; stroke: string; opacity?: number }) {
  return (
    <Ellipse
      cx="50"
      cy="50"
      rx={rx}
      ry={rx}
      fill="none"
      stroke={stroke}
      strokeWidth={1.75}
      strokeOpacity={opacity}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function HumidityRingsComponent({ active }: { active: boolean }) {
  const [present, setPresent] = useState(active);
  const [shown, setShown] = useState(active);

  useEffect(() => {
    if (active) {
      setPresent(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setPresent(false), 980);
    return () => clearTimeout(timer);
  }, [active]);

  if (!present) return null;

  const web = Platform.OS === "web";

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
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        pointerEvents="none"
      >
        <Ring rx={web ? 46 : 20} stroke="rgba(255, 196, 186, 0.96)" />
        <Ring rx={web ? 46 : 32} stroke="rgba(255, 96, 86, 0.62)" opacity={web ? undefined : 0.7} />
        <Ring rx={web ? 46 : 44} stroke="rgba(255, 72, 64, 0.4)" opacity={web ? undefined : 0.4} />
      </Svg>
    </View>
  );
}

export const HumidityRings = memo(HumidityRingsComponent);

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: ORIGIN.left,
    top: ORIGIN.top,
    width: "32%",
    height: "24%",
    zIndex: 1,
    transform: [{ translateX: "-50%" }, { translateY: "-50%" }],
  },
});
