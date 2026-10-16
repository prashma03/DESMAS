import { useState } from "react";
import { Globe } from "../components/Globe";
import { AIMonitor } from "../components/AIMonitor";
import { useKit } from "../kit/KitContext";
import { MARS_DELAY_MIN, MOON_DELAY_S } from "../worlds";

const slots = [
  { id: "earth", kind: "earth", index: "01 · TODAY", name: "Earth", place: "Daylight · charging" },
  { id: "moon", kind: "moon", index: "02 · LIVE HARDWARE", name: "Moon", place: "Lunar day · all systems on" },
  { id: "mars", kind: "mars", index: "03 · NEXT", name: "Mars", place: "Dust storm · light" },
] as const;

function pos(id: string, hover: string | null) {
  if (!hover) {
    if (id === "earth") return { left: "12%", top: "22%" };
    if (id === "moon") return { left: "40%", top: "8%" };
    return { left: "68%", top: "24%" };
  }
  if (id === hover) return { left: "38%", top: "6%" };
  if (hover === "moon") {
    return id === "earth" ? { left: "6%", top: "8%" } : { left: "74%", top: "10%" };
  }
  if (hover === "earth") {
    return id === "moon" ? { left: "70%", top: "6%" } : { left: "78%", top: "48%" };
  }
  return id === "earth" ? { left: "8%", top: "10%" } : { left: "10%", top: "52%" };
}

export function AllWorlds() {
  const { setWorld, reading } = useKit();
  const [hover, setHover] = useState<string | null>(null);
  const on = reading.leds.reduce((a, b) => a + b, 0);

  return (
    <div className="all-worlds">
      <div className="live-line">
        <strong>Live</strong> · one Arduino drives all three worlds
      </div>
      <h1 className="headline">One system, three worlds</h1>
      <p className="subhead">
        The same power rules and AI monitor, from an off-grid clinic to a base on the Moon to a ship
        orbiting Mars.
      </p>
      <div className="delays">
        <span>Earth ↔ Moon · {MOON_DELAY_S} s</span>
        <span>Earth ↔ Mars · 3 to 22 min · now {MARS_DELAY_MIN} min</span>
      </div>
      <div className="theater" onMouseLeave={() => setHover(null)}>
        {slots.map((s) => {
          const p = pos(s.id, hover);
          const large = hover === s.id || (!hover && s.id === "moon");
          return (
            <button
              key={s.id}
              className="globe-slot"
              style={{ left: p.left, top: p.top, transform: large ? "scale(1)" : "scale(0.86)" }}
              onMouseEnter={() => setHover(s.id)}
              onClick={() => setWorld(s.id)}
            >
              <Globe kind={s.kind} large={large} />
              <div className="meta">
                <div className="idx">{s.index}</div>
                <h2>{s.name}</h2>
                <div className="place">
                  {s.id === "mars" ? `${reading.dark}% · light` : s.place}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="hint-row">Hover a world to bring it forward · click to open</div>
      <div className="kit-strip">
        <span>
          Simulated kit · light sensor <b>{reading.dark}%</b> dark
        </span>
        <span>
          Humidity <b>{reading.hum}%</b>
        </span>
        <span>
          Temp <b>{reading.temp} °C</b>
        </span>
        <span>
          Systems on <b>{on} of 4</b>
        </span>
        <span>Planet look: Solar System Scope, CC BY 4.0, based on NASA imagery</span>
      </div>
      <AIMonitor world="moon" />
    </div>
  );
}
