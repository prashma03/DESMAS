import { worlds, type WorldConfig } from "../worlds";
import { useKit } from "../kit/KitContext";

const ledColor = ["green", "blue", "yellow", "red"] as const;

export function SideNav({ world }: { world: WorldConfig }) {
  return (
    <nav className="side-nav">
      <div className="kicker">
        {world.index} · {world.kicker}
      </div>
      {world.nav.map((item, i) => (
        <a key={item.id} href={`#${item.id}`} className={i === 0 ? "on" : ""}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function Scene({ world }: { world: WorldConfig }) {
  const { reading } = useKit();
  const solar = Math.max(0, 100 - reading.dark);
  const night = Math.min(0.85, reading.dark / 100);

  return (
    <section className={`scene ${world.id}`} id={world.nav[1]?.id ?? "scene"}>
      <div className="scene-bg" />
      <div className="night-veil" style={{ opacity: night }} />
      <div className="scan" />
      {reading.alarm ? <div className="ripple" /> : null}
      {world.tags.map((tag) => {
        const on = tag.led === undefined ? true : reading.leds[tag.led] === 1;
        const extra = tag.extra?.({ dark: reading.dark, hum: reading.hum, solar });
        const color = tag.led !== undefined ? ledColor[tag.led] : "green";
        return (
          <div
            key={tag.id}
            className={`glass-tag ${on ? "" : "off"}`}
            style={{ left: tag.x, top: tag.y }}
          >
            <div className="name">
              {tag.led !== undefined ? (
                <span className={`led-dot ${on ? color : "off"}`} />
              ) : null}
              {tag.label}
            </div>
            <div className="stat">
              {extra ?? (tag.led !== undefined ? (on ? "ON" : "OFF") : "")}
            </div>
          </div>
        );
      })}
      <div className="scene-caption">{world.dayLabel(reading.dark)}</div>
    </section>
  );
}

export function StatusTiles({ world }: { world: WorldConfig }) {
  const { reading } = useKit();
  const solar = Math.max(0, 100 - reading.dark);
  const battery = world.battery(reading.dark);
  return (
    <div className="tiles">
      <div className="tile">
        <div className="lbl">{world.humidityPlace} humidity</div>
        <div className="val">
          {reading.hum}
          <small>%</small>
        </div>
        <p>Cutoff {reading.cut}%</p>
      </div>
      <div className="tile">
        <div className="lbl">Temperature</div>
        <div className="val">
          {reading.temp}
          <small>°C</small>
        </div>
        <p>{world.place}</p>
      </div>
      <div className="tile">
        <div className="lbl">Solar / light</div>
        <div className="val">
          {solar}
          <small>%</small>
        </div>
        <p>{reading.dark}% dark on the sensor</p>
      </div>
      <div className="tile">
        <div className="lbl">Battery</div>
        <div className="val">
          {battery}
          <small>%</small>
        </div>
        <p>{world.hint}</p>
      </div>
    </div>
  );
}

export function PowerPanel({ world }: { world: WorldConfig }) {
  const { reading } = useKit();
  return (
    <section className="panel" id="power">
      <div className="eyebrow">{world.powerSub}</div>
      <h3>{world.powerTitle}</h3>
      <div className="power-grid">
        {world.systems.map((sys, i) => {
          const on = reading.leds[i] === 1;
          return (
            <div key={sys.id} className={`sys ${on ? "on" : "off"}`}>
              <div className="pri">{sys.id.toUpperCase()}</div>
              <h4>{sys.name}</h4>
              <div className="detail">{sys.detail}</div>
              <div className="state">{on ? "ON" : "OFF"}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AlertFeed() {
  const { events } = useKit();
  return (
    <section className="panel" id="alerts">
      <div className="eyebrow">Kit events</div>
      <h3>Alert feed</h3>
      <HumidityChart />
      <div className="feed">
        {events.map((e) => (
          <div key={e.id} className="feed-item">
            <time>{e.clock}</time>
            <span className={`lvl ${e.level}`}>{e.level}</span>
            <span>{e.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HumidityChart() {
  const { samples } = useKit();
  const w = 320;
  const h = 92;
  const pts = samples.length
    ? samples
        .map((s, i) => {
          const x = (i / Math.max(1, samples.length - 1)) * w;
          const y = h - (Math.min(100, s.hum) / 100) * h;
          return `${x},${y}`;
        })
        .join(" ")
    : `0,${h} ${w},${h}`;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke="#5aa8ff" strokeWidth="2" points={pts} />
    </svg>
  );
}

export function SerialLog() {
  const { serialLines } = useKit();
  return (
    <section className="panel" id="serial">
      <div className="eyebrow">Arduino</div>
      <h3>Raw serial</h3>
      <pre className="serial">{serialLines.join("\n") || "Waiting for lines…"}</pre>
    </section>
  );
}

export function DelayCard() {
  return (
    <section className="panel" id="delay">
      <div className="eyebrow">Earth delay</div>
      <h3>Do not wait for a reply</h3>
      <div className="delay-card">
        <div className="wait">ROUND TRIP RIGHT NOW</div>
        <div className="big">25.9 min</div>
        <p className="ai-body">
          One-way delay is about 13 minutes. The base follows the same power rules that were tested
          on the Moon.
        </p>
      </div>
    </section>
  );
}

export function LedMap({ world }: { world: WorldConfig }) {
  const { reading } = useKit();
  return (
    <table className="map-table">
      <thead>
        <tr>
          <th>LED</th>
          <th>System</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {world.systems.map((sys, i) => (
          <tr key={sys.id}>
            <td>{sys.color}</td>
            <td>{sys.name}</td>
            <td>{reading.leds[i] ? "on" : "off"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function worldOf(id: keyof typeof worlds) {
  return worlds[id];
}
