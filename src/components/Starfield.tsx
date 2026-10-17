import { Fragment } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useScreen } from "../layout";

type Star = {
  left: string;
  top: string;
  size: number;
  opacity: number;
  glow: number;
  warm: boolean;
};

function starField(count: number): Star[] {
  let seed = 20261017;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: count }, () => {
    const roll = next();
    const size = roll > 0.985 ? 5 : roll > 0.94 ? 3.5 : roll > 0.82 ? 2.5 : roll > 0.55 ? 1.5 : 1;
    const warm = next() > 0.82;
    return {
      left: `${next() * 100}%`,
      top: `${next() * 100}%`,
      size,
      opacity: size >= 3.5 ? 0.82 + next() * 0.18 : 0.22 + next() * 0.48,
      glow: size >= 3.5 ? size * 7 : size >= 2.5 && next() > 0.4 ? 11 : 0,
      warm,
    };
  });
}

const STARS = starField(340);

type Dot = { x: number; y: number; r: number; warm?: boolean };
type Figure = {
  name: string;
  w: number;
  h: number;
  stars: Dot[];
  links: [number, number][];
  style: { top?: number | `${number}%`; left?: number | `${number}%`; right?: number | `${number}%`; bottom?: number | `${number}%` };
};

/** Small figures kept in the margins, away from the planet stage and the hero scenes. */
const CONSTELLATIONS: Figure[] = [
  {
    name: "cassiopeia",
    w: 210,
    h: 78,
    style: { top: "16%", left: "3%" },
    stars: [
      { x: 8, y: 48, r: 1.6 },
      { x: 52, y: 14, r: 2.2 },
      { x: 104, y: 52, r: 1.8, warm: true },
      { x: 154, y: 12, r: 2.4 },
      { x: 200, y: 46, r: 1.7 },
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    name: "dipper",
    w: 230,
    h: 120,
    style: { top: "11%", right: "3%" },
    stars: [
      { x: 18, y: 78, r: 1.7 },
      { x: 58, y: 42, r: 2.1 },
      { x: 108, y: 36, r: 1.8 },
      { x: 126, y: 82, r: 2.3, warm: true },
      { x: 162, y: 58, r: 1.6 },
      { x: 194, y: 28, r: 2 },
      { x: 220, y: 8, r: 1.5 },
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    name: "orion",
    w: 170,
    h: 150,
    style: { bottom: "7%", left: "5%" },
    stars: [
      { x: 28, y: 18, r: 2.2 },
      { x: 142, y: 24, r: 1.8, warm: true },
      { x: 52, y: 72, r: 1.7 },
      { x: 86, y: 76, r: 2.3 },
      { x: 120, y: 80, r: 1.7 },
      { x: 36, y: 132, r: 1.6 },
      { x: 138, y: 128, r: 2 },
    ],
    links: [
      [0, 2],
      [2, 3],
      [3, 4],
      [4, 1],
      [2, 5],
      [4, 6],
    ],
  },
  {
    name: "cross",
    w: 130,
    h: 160,
    style: { bottom: "12%", right: "6%" },
    stars: [
      { x: 66, y: 10, r: 2.2 },
      { x: 18, y: 62, r: 1.6 },
      { x: 112, y: 54, r: 1.8, warm: true },
      { x: 64, y: 118, r: 2.4 },
      { x: 78, y: 148, r: 1.3 },
    ],
    links: [
      [0, 3],
      [1, 2],
      [3, 4],
    ],
  },
  {
    name: "triangle",
    w: 96,
    h: 110,
    style: { top: "48%", left: "1.5%" },
    stars: [
      { x: 16, y: 12, r: 1.8 },
      { x: 82, y: 40, r: 2.1, warm: true },
      { x: 22, y: 96, r: 1.5 },
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
  },
];

function haloColor(warm: boolean) {
  return warm ? "rgba(255, 206, 150, 0.22)" : "rgba(186, 214, 255, 0.2)";
}

function coreColor(warm: boolean) {
  return warm ? "rgba(255, 236, 214, 1)" : "rgba(238, 246, 255, 1)";
}

export function Starfield() {
  const { narrow } = useScreen();
  const figures = narrow ? CONSTELLATIONS.filter((fig) => fig.name === "cassiopeia" || fig.name === "cross") : CONSTELLATIONS;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STARS.map((star, i) => {
        const glow = star.glow;
        const box = glow || star.size;
        const inset = glow ? (glow - star.size) / 2 : 0;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: star.left,
              top: star.top,
              width: box,
              height: box,
              marginLeft: glow ? -inset : 0,
              marginTop: glow ? -inset : 0,
            }}
          >
            {glow ? (
              <View
                style={{
                  width: glow,
                  height: glow,
                  borderRadius: glow / 2,
                  backgroundColor: haloColor(star.warm),
                }}
              />
            ) : null}
            <View
              style={{
                position: "absolute",
                left: inset,
                top: inset,
                width: star.size,
                height: star.size,
                borderRadius: star.size / 2,
                backgroundColor: coreColor(star.warm),
                opacity: star.opacity,
              }}
            />
          </View>
        );
      })}
      {figures.map((fig) => (
        <Svg key={fig.name} width={fig.w} height={fig.h} viewBox={`0 0 ${fig.w} ${fig.h}`} style={[styles.figure, fig.style]}>
          {fig.links.map(([a, b], i) => (
            <Line
              key={i}
              x1={fig.stars[a].x}
              y1={fig.stars[a].y}
              x2={fig.stars[b].x}
              y2={fig.stars[b].y}
              stroke="rgba(198, 220, 255, 0.38)"
              strokeWidth={1}
            />
          ))}
          {fig.stars.map((star, i) => (
            <Fragment key={i}>
              <Circle cx={star.x} cy={star.y} r={star.r * 4.2} fill={haloColor(!!star.warm)} />
              <Circle cx={star.x} cy={star.y} r={star.r} fill={coreColor(!!star.warm)} />
            </Fragment>
          ))}
        </Svg>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { position: "absolute", opacity: 0.9 },
});
