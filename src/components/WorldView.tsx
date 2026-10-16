import { Text, View } from "react-native";
import type { KitEvent, KitReading } from "../kit/types";
import { colors, styles } from "../theme";
import { LED_COLOR, LED_MAP, WORLDS } from "../worlds";
import { AiMonitor } from "./AiMonitor";

function clock(at: number) {
  return new Date(at).toLocaleTimeString(undefined, { hour12: false });
}

const SCENE = {
  earth: "#16325c",
  moon: "#2a2d36",
  mars: "#9a3a1c",
};

export function WorldView({
  world,
  reading,
  history,
  events,
  marsDelay,
}: {
  world: "earth" | "moon" | "mars";
  reading: KitReading;
  history: KitReading[];
  events: KitEvent[];
  marsDelay: string;
}) {
  const meta = WORLDS[world];
  const night = reading.dark >= 55;
  const solar = Math.max(0, 100 - reading.dark);
  const battery = Math.round(world === "earth" ? 38 + solar * 0.2 : 40 + solar * 0.3);
  const onCount = reading.leds.filter(Boolean).length;
  const cutY = ((reading.cut - 45) / 40) * 64;

  return (
    <View>
      <View
        style={[
          styles.scene,
          { backgroundColor: SCENE[world], opacity: night ? 0.72 : 1 },
        ]}
      >
        <Text style={styles.kicker}>{meta.index}</Text>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.hint}>{`${meta.place} · ${meta.dayLabel(reading.dark)}`}</Text>
        <Text style={styles.hint}>{meta.hint}</Text>
        <View style={styles.row}>
          {meta.systems.map((sys, i) => (
            <View key={sys.id} style={[styles.tag, reading.leds[i] ? styles.tagOn : null]}>
              <Text style={styles.tagTxt}>{`${sys.name} · ${reading.leds[i] ? "ON" : "OFF"}`}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <Stat label="SOLAR INPUT A0" value={`${solar}%`} />
        <Stat label="DARK · A0" value={`${reading.dark}%`} />
        <Stat label={`HUMIDITY · ${meta.humidityPlace}`} value={`${reading.hum}%`} />
        <Stat label="TEMP" value={`${reading.temp} °C`} />
        <Stat label="SYSTEMS ON" value={`${onCount} of 4`} />
        <Stat label="BATTERY · ESTIMATE" value={`${Math.min(99, battery)}%`} />
        {world === "earth" ? (
          <Stat label="VACCINE FRIDGE · ESTIMATE" value="5 °C" />
        ) : (
          <Stat label="EARTH LINK" value={world === "moon" ? "1.3 s" : marsDelay} />
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.kicker}>Power priority · set by the Arduino</Text>
        <Text style={styles.finding}>What stays on when the sun goes down</Text>
        {meta.systems.map((sys, i) => (
          <View key={sys.id} style={[styles.sys, reading.leds[i] ? null : styles.sysOff]}>
            <View>
              <Text style={{ color: colors.ink, fontWeight: "700" }}>
                <Text style={{ color: LED_COLOR[sys.led] }}>● </Text>
                {sys.name}
              </Text>
              <Text style={styles.hint}>{`${sys.led} LED · pin ${sys.pin} · ${sys.detail}`}</Text>
            </View>
            <Text style={{ color: colors.ink, fontWeight: "700" }}>{reading.leds[i] ? "ON" : "OFF"}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.kicker}>Humidity · last 30 seconds</Text>
        <View style={styles.barTrack}>
          {history.map((h) => (
            <View
              key={h.ms}
              style={[styles.bar, { height: Math.max(2, ((h.hum - 45) / 40) * 64) }]}
            />
          ))}
          <View style={[styles.cut, { bottom: Math.max(0, Math.min(64, cutY)) }]} />
        </View>
        <Text style={styles.hint}>{`Cutoff ${reading.cut}% · now ${reading.hum}%`}</Text>
      </View>

      {world === "earth" ? (
        <View style={styles.panel}>
          <Text style={styles.kicker}>Same hardware, same code</Text>
          {LED_MAP.map((row, i) => (
            <Text key={row.led} style={styles.feedLine}>
              {`${row.led}  ·  ${row.moon} / ${row.clinic}  ·  ${reading.leds[i] ? "ON" : "OFF"}`}
            </Text>
          ))}
        </View>
      ) : null}

      {world === "mars" ? (
        <View style={styles.panel}>
          <Text style={styles.kicker}>Why it runs onboard</Text>
          <Text style={styles.finding}>Wait for Earth, or decide here?</Text>
          <Text style={styles.body}>
            Ask Mission Control · still waiting · worst case 44:00 round trip. Live delay (fallback
            until Horizons): {marsDelay} one way.
          </Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.kicker}>Alert feed · from sensor events</Text>
        {events.map((e) => (
          <Text key={e.id} style={styles.feedLine}>
            {`${e.kind}  ${clock(e.at)}  ${e.message}`}
          </Text>
        ))}
      </View>

      {world === "moon" ? (
        <View style={styles.panel}>
          <Text style={styles.kicker}>Raw serial · USB · 9600 baud</Text>
          <Text style={[styles.feedLine, { color: "#b7e3c2" }]}>{JSON.stringify(reading)}</Text>
        </View>
      ) : null}

      {world === "mars" ? (
        <View style={styles.panel}>
          <Text style={styles.kicker}>Fault log · handled without Earth</Text>
          <Text style={styles.feedLine}>HANDLED  Relay ship: radio A stopped answering. Switched to radio B.</Text>
          <Text style={styles.feedLine}>HANDLED  Relay ship: camera heater fault. Camera off to save power.</Text>
        </View>
      ) : null}

      <AiMonitor world={world} reading={reading} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.panel, { minWidth: 140, flexGrow: 1 }]}>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={styles.statVal}>{value}</Text>
    </View>
  );
}
