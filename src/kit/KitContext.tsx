import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { diffEvents } from "./events";
import { connectArduino, parseReading } from "./serial";
import { simulateAt } from "./simulate";
import {
  TICK_MS,
  type KitEvent,
  type KitSource,
  type Reading,
  type Sample,
  type WorldId,
} from "./types";

type KitState = {
  world: WorldId;
  setWorld: (w: WorldId) => void;
  reading: Reading;
  source: KitSource;
  events: KitEvent[];
  samples: Sample[];
  serialLines: string[];
  connectError: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const KitContext = createContext<KitState | null>(null);

export function KitProvider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<WorldId>("worlds");
  const [reading, setReading] = useState<Reading>(() => simulateAt(0));
  const [source, setSource] = useState<KitSource>("simulated");
  const [events, setEvents] = useState<KitEvent[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [serialLines, setSerialLines] = useState<string[]>([]);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const prevRef = useRef<Reading | null>(null);
  const startRef = useRef(performance.now());
  const stopSerial = useRef<(() => void) | null>(null);
  const worldRef = useRef(world);
  worldRef.current = world;

  const applyReading = useCallback((next: Reading, line?: string) => {
    const w = worldRef.current === "worlds" ? "moon" : worldRef.current;
    const added = diffEvents(prevRef.current, next, w);
    prevRef.current = next;
    setReading(next);
    if (added.length) {
      setEvents((e) => [...added, ...e].slice(0, 40));
    }
    setSamples((s) => [...s, { t: Date.now(), hum: next.hum }].slice(-60));
    if (line) {
      setSerialLines((rows) => [line, ...rows].slice(0, 24));
    } else {
      const fake = JSON.stringify(next);
      setSerialLines((rows) => [fake, ...rows].slice(0, 24));
    }
  }, []);

  useEffect(() => {
    if (source !== "simulated") return;
    const id = window.setInterval(() => {
      const ms = Math.round(performance.now() - startRef.current);
      applyReading(simulateAt(ms));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [source, applyReading]);

  const disconnect = useCallback(() => {
    stopSerial.current?.();
    stopSerial.current = null;
    setSource("simulated");
    startRef.current = performance.now();
    prevRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const stop = await connectArduino((line) => {
        const parsed = parseReading(line);
        if (parsed) applyReading(parsed, line);
        else setSerialLines((rows) => [line, ...rows].slice(0, 24));
      });
      stopSerial.current = stop;
      setSource("arduino");
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Could not open the board.");
    } finally {
      setConnecting(false);
    }
  }, [applyReading]);

  useEffect(() => () => stopSerial.current?.(), []);

  const value = useMemo(
    () => ({
      world,
      setWorld,
      reading,
      source,
      events,
      samples,
      serialLines,
      connectError,
      connecting,
      connect,
      disconnect,
    }),
    [
      world,
      reading,
      source,
      events,
      samples,
      serialLines,
      connectError,
      connecting,
      connect,
      disconnect,
    ],
  );

  return <KitContext.Provider value={value}>{children}</KitContext.Provider>;
}

export function useKit() {
  const ctx = useContext(KitContext);
  if (!ctx) throw new Error("useKit must be inside KitProvider");
  return ctx;
}
