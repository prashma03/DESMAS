import { Pressable, Text, View } from "react-native";
import type { KitReading } from "../kit/types";
import { styles } from "../theme";

export function AllWorlds({
  reading,
  marsDelay,
  onOpen,
}: {
  reading: KitReading;
  marsDelay: string;
  onOpen: (world: "earth" | "moon" | "mars") => void;
}) {
  const on = reading.leds.filter(Boolean).length;
  return (
    <View>
      <Text style={styles.kicker}>One Arduino drives all three worlds</Text>
      <View style={styles.row}>
        <Pressable style={styles.globe} onPress={() => onOpen("earth")}>
          <View style={[styles.sphere, { width: 132, height: 132, backgroundColor: "#1f5fbf" }]} />
          <Text style={styles.kicker}>01 · TODAY</Text>
          <Text style={styles.globeName}>Earth</Text>
          <Text style={styles.hint}>Daylight · charging</Text>
        </Pressable>
        <Pressable style={styles.globe} onPress={() => onOpen("moon")}>
          <View style={[styles.sphere, { width: 100, height: 100, backgroundColor: "#cfc8b8" }]} />
          <Text style={styles.kicker}>02 · LIVE HARDWARE</Text>
          <Text style={styles.globeName}>Moon</Text>
          <Text style={styles.hint}>Cover A0 for lunar night</Text>
        </Pressable>
        <Pressable style={styles.globe} onPress={() => onOpen("mars")}>
          <View style={[styles.sphere, { width: 112, height: 112, backgroundColor: "#c44521" }]} />
          <Text style={styles.kicker}>03 · NEXT</Text>
          <Text style={styles.globeName}>Mars</Text>
          <Text style={styles.hint}>{`Dust storm ${reading.dark}% · light`}</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>The same power rules, from an off-grid clinic to a ship at Mars.</Text>
      <Text style={styles.body}>
        Tap a world for live tiles. Until a board is connected, a 44-second simulated loop covers the
        light sensor, then breathes on the DHT11.
      </Text>
      <Text style={styles.kicker}>{`EARTH ↔ MOON · 1.3 S    EARTH ↔ MARS · ${marsDelay}`}</Text>
      <View style={styles.row}>
        <Stat label="DARK · A0" value={`${reading.dark}%`} />
        <Stat label="HUMIDITY" value={`${reading.hum}%`} />
        <Stat label="TEMP" value={`${reading.temp} °C`} />
        <Stat label="SYSTEMS ON" value={`${on} of 4`} />
      </View>
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
