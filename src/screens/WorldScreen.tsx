import { AIMonitor } from "../components/AIMonitor";
import { useKit } from "../kit/KitContext";
import type { WorldId } from "../kit/types";
import { MARS_DELAY_MIN, worlds } from "../worlds";

const colors = { p1: "green", p2: "blue", p3: "yellow", p4: "red" } as const;

export function WorldScreen({ id }: { id: Exclude<WorldId, "worlds"> }) {
  const { reading, events, samples, serialLines, source } = useKit();
  const w = worlds[id];
  const solar = Math.max(0, 100 - reading.dark);
  const on = reading.leds.reduce((a, b) => a + b, 0);
  const battery = w.battery(reading.dark);
  const night = Math.min(1, reading.dark / 85);

  const ledOn = (i?: number) => (i === undefined ? true : reading.leds[i] === 1);

  return (
    <div className={`world-page ${id}`}>
      <nav className="side-nav">
        <div className="kicker">
          {w.index} · {id} · {w.place}
        </div>
        {w.nav.map((n) => (
          <a key={n.id} href={`#${n.id}`} className={n.id === "power" ? "on" : ""}>
            {n.label}
          </a>
        ))}
      </nav>

      <section className={`scene ${id}`}>
        <div className="scene-bg" />
        <div className="night-veil" style={{ opacity: night * 0.85 }} />
        <div className="scan" />
        {reading.alarm ? <div className="ripple" /> : null}
        {w.tags.map((tag) => {
          const onTag = ledOn(tag.led);
          const extra = tag.extra?.({ dark: reading.dark, hum: reading.hum, solar }) ?? (onTag ? "ON" : "OFF");
          const color =
            tag.led === 0 ? "green" : tag.led === 1 ? "blue" : tag.led === 2 ? "yellow" : tag.led === 3 ? "red" : "green";
          return (
            <div
              key={tag.id}
              className={`glass-tag ${onTag ? "" : "off"}`}
              style={{ left: tag.x, top: tag.y }}
            >
              <div className="name">
                {tag.led !== undefined ? <span className={`led-dot ${color} ${onTag ? "" : "off"}`} /> : null}
                {tag.label}
              </div>
              <div className="stat">{extra}</div>
            </div>
          );
        })}
        <div className="scene-caption">
          {w.dayLabel(reading.dark)} · from the kit {source === "arduino" ? "live" : "simulated"}
        </div>
      </section>

      <aside className="tiles">
        <div className="tile">
          <div className="lbl">Dark · A0</div>
          <div className="val">
            {reading.dark}%<small>{id === "mars" ? "storm" : "dark"}</small>
          </div>
          <p>{w.hint}</p>
        </div>
        <div className="tile">
          <div className="lbl">Humidity · DHT11</div>
          <div className="val">
            {reading.hum}%<small>cutoff {reading.cut}%</small>
          </div>
          <p>{w.humidityPlace}</p>
        </div>
        <div className="tile">
          <div className="lbl">Temp · DHT11</div>
          <div className="val">
            {reading.temp}
            <small>°C</small>
          </div>
          <p>Inside the hab</p>
        </div>
        <div className="tile">
          <div className="lbl">Solar input A0</div>
          <div className="val">
            {solar}%<small>light {reading.light}</small>
          </div>
          <p>{id === "mars" ? "Dust on panels and in the air" : "Light sensor"}</p>
        </div>
        <div className="tile">
          <div className="lbl">Systems on · LEDs</div>
          <div className="val">
            {on} of 4
          </div>
          <p>Lowest priority goes off first</p>
        </div>
        <div className="tile">
          <div className="lbl">Battery</div>
          <div className="val">
            {battery}%<small>estimate</small>
          </div>
          <p>No sensor on the kit</p>
        </div>
        {id === "earth" ? (
          <div className="tile">
            <div className="lbl">Vaccine fridge</div>
            <div className="val">
              5 °C<small>2 to 8</small>
            </div>
            <p>Estimate · safe range</p>
          </div>
        ) : null}
        {id === "moon" ? (
          <div className="tile">
            <div className="lbl">Earth link</div>
            <div className="val">
              1.3 s<small>one way</small>
            </div>
            <p>By radio</p>
          </div>
        ) : null}
        {id === "mars" ? (
          <div className="tile">
            <div className="lbl">Earth link</div>
            <div className="val">
              {MARS_DELAY_MIN}
              <small>min</small>
            </div>
            <p>One way · JPL sample 15 Oct 2026</p>
          </div>
        ) : null}
      </aside>

      <div className="lower">
        <section className="panel" id="power">
          <div className="eyebrow">{w.powerSub}</div>
          <h3>Power priority · set by the Arduino</h3>
          <p className="ai-body">{w.powerTitle}</p>
          <p className="ai-body" style={{ marginTop: 4 }}>
            Solar {solar}% + battery {battery}% · {on === 4 ? "all four on" : `${on} of 4 on`}
          </p>
          <div className="power-grid">
            {w.systems.map((s, i) => {
              const isOn = reading.leds[i] === 1;
              return (
                <div key={s.id} className={`sys ${isOn ? "on" : "off"}`}>
                  <div className="pri">
                    <span className={`led-dot ${colors[s.id]} ${isOn ? "" : "off"}`} />
                    {s.id.toUpperCase()}
                  </div>
                  <h4>{s.name}</h4>
                  <div className="detail">{s.detail}</div>
                  <div className="state">{isOn ? "ON" : "OFF"}</div>
                </div>
              );
            })}
          </div>
          <div className="eyebrow" style={{ marginTop: 16 }} id="hab">
            Humidity · {w.humidityPlace} · last 30 seconds
          </div>
          <HumidityChart samples={samples} cut={reading.cut} now={reading.hum} />
          {id === "earth" ? <LedMap leds={reading.leds} /> : null}
          {id === "mars" ? <MarsDelay /> : null}
        </section>

        <section className="panel" id="alerts">
          <div className="eyebrow">Alert feed · from sensor events</div>
          <h3>What just happened</h3>
          <div className="feed">
            {events.map((e) => (
              <div key={e.id} className="feed-item">
                <time>{e.clock}</time>
                <span className={`lvl ${e.level}`}>{e.level}</span>
                <span>{e.text}</span>
              </div>
            ))}
          </div>
          {id === "moon" ? (
            <div id="serial">
              <div className="eyebrow" style={{ marginTop: 12 }}>
                Raw serial · USB · 9600 baud · {source === "arduino" ? "live" : "simulated"} · 2 lines a second
              </div>
              <pre className="serial">{serialLines.join("\n")}</pre>
            </div>
          ) : null}
          {id === "mars" ? <FaultLog /> : null}
        </section>
      </div>

      <AIMonitor world={id} />
    </div>
  );
}

function HumidityChart({
  samples,
  cut,
  now,
}: {
  samples: { t: number; hum: number }[];
  cut: number;
  now: number;
}) {
  const w = 640;
  const h = 92;
  const min = 40;
  const max = 90;
  const ys = (v: number) => h - ((v - min) / (max - min)) * h;
  const n = Math.max(samples.length, 2);
  const pts = samples
    .map((s, i) => `${(i / (n - 1)) * w},${ys(s.hum)}`)
    .join(" ");
  const cutY = ys(cut);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <line x1="0" y1={cutY} x2={w} y2={cutY} stroke="rgba(255,93,93,0.5)" strokeDasharray="4 4" />
      <polyline fill="none" stroke="#5aa8ff" strokeWidth="2" points={pts || `0,${ys(now)} ${w},${ys(now)}`} />
    </svg>
  );
}

function LedMap({ leds }: { leds: [number, number, number, number] }) {
  const rows = [
    ["P1 · Green", "Life support", "Vaccine fridge"],
    ["P2 · Blue", "Comms", "Radio"],
    ["P3 · Yellow", "Science", "Lights"],
    ["P4 · Red", "Comfort", "Fan"],
  ];
  return (
    <div id="leds">
      <div className="eyebrow" style={{ marginTop: 16 }}>
        Same hardware, same code
      </div>
      <table className="map-table">
        <thead>
          <tr>
            <th>LED</th>
            <th>Moon base</th>
            <th>Clinic</th>
            <th>Now</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]}>
              <td>{r[0]}</td>
              <td>{r[1]}</td>
              <td>{r[2]}</td>
              <td>{leds[i] ? "ON" : "OFF"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarsDelay() {
  return (
    <div className="delay-card" id="delay">
      <div className="eyebrow">Why it runs onboard</div>
      <h3>Wait for Earth, or decide here?</h3>
      <div className="wait">Ask Mission Control · still waiting · worst case 44:00 round trip · sped up 240×</div>
      <div className="big">{MARS_DELAY_MIN} min one way</div>
      <div className="done">DESMAS on the base · acted on the last reading · 0.5 s ago</div>
    </div>
  );
}

function FaultLog() {
  return (
    <div id="faults">
      <div className="eyebrow" style={{ marginTop: 12 }}>
        Fault log · handled without Earth
      </div>
      <div className="feed">
        <div className="feed-item">
          <time>14:02</time>
          <span className="lvl POWER">HANDLED</span>
          <span>Relay ship: radio A stopped answering. Switched to radio B.</span>
        </div>
        <div className="feed-item">
          <time>13:40</time>
          <span className="lvl POWER">HANDLED</span>
          <span>Relay ship: camera heater fault. Turned the camera off to save power.</span>
        </div>
      </div>
    </div>
  );
}
