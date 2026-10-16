import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { AllWorlds } from "./src/components/AllWorlds";
import { WorldView } from "./src/components/WorldView";
import type { WorldId } from "./src/kit/types";
import { styles } from "./src/theme";
import { useKit } from "./src/useKit";

const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";
const NAV: { id: WorldId; label: string }[] = [
  { id: "all", label: "All worlds" },
  { id: "earth", label: "Earth" },
  { id: "moon", label: "Moon" },
  { id: "mars", label: "Mars" },
];

export default function App() {
  const kit = useKit();
  const [world, setWorld] = useState<WorldId>("all");
  const [marsDelay, setMarsDelay] = useState("3 to 22 min");

  useEffect(() => {
    fetch(`${API}/api/mars-delay`)
      .then((r) => r.json())
      .then((d: { oneWaySeconds?: number }) => {
        if (!d.oneWaySeconds) return;
        setMarsDelay(`${(d.oneWaySeconds / 60).toFixed(2)} min`);
      })
      .catch(() => {
        /* server optional */
      });
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.topbar}>
        <Text style={styles.brand}>DESMAS</Text>
        {NAV.map((item) => {
          const on = world === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.navBtn, on ? styles.navBtnOn : null]}
              onPress={() => setWorld(item.id)}
            >
              <Text style={[styles.navTxt, on ? styles.navTxtOn : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
        <Text style={styles.kitChip}>
          {kit.source === "simulated" ? "SIMULATED KIT" : "LIVE ARDUINO"}
        </Text>
        <Pressable
          style={styles.navBtn}
          onPress={() =>
            Alert.alert("Connect Arduino", "Serial lands next. The simulated kit is running now.")
          }
        >
          <Text style={styles.navTxt}>Connect Arduino</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.stage}>
        {world === "all" ? (
          <AllWorlds reading={kit.reading} marsDelay={marsDelay} onOpen={setWorld} />
        ) : (
          <WorldView
            world={world}
            reading={kit.reading}
            history={kit.history}
            events={kit.events}
            marsDelay={marsDelay}
          />
        )}
      </ScrollView>
    </View>
  );
}
