import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API } from "../api";
import { isMarsTauScenario, type MarsTauScenario, type MarsTauSample } from "../sim/marsTau";
import { isEarthPowerScenario, type EarthPowerScenario } from "../sim/powerDay";
import { colors } from "../theme";
import { mono, sans } from "./dashboard";

function utcLabel(iso: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return match ? `${match[1]} ${match[2]} UTC` : iso;
}

function dayLabel(yyyymmdd: string) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(yyyymmdd);
  if (!match) return yyyymmdd;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

function coord(latitude: number, longitude: number) {
  const ns = latitude >= 0 ? "N" : "S";
  const ew = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude)}°${ns}, ${Math.abs(longitude)}°${ew}`;
}

function measure(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, useGrouping: false }).format(value);
}

function word(code: number) {
  if (code === 2) return "BLINK";
  if (code === 1) return "ON";
  return "OFF";
}

function ledLine(leds: readonly number[]) {
  return `P1 ${word(leds[0] ?? 0)} · P2 ${word(leds[1] ?? 0)} · P3 ${word(leds[2] ?? 0)} · P4 ${word(leds[3] ?? 0)}`;
}

export function ScenarioPanel() {
  const [scenario, setScenario] = useState<EarthPowerScenario | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API}/api/scenarios/earth`, { signal: ctrl.signal })
      .then(async (res) => {
        const body: unknown = await res.json();
        if (!res.ok || !isEarthPowerScenario(body)) throw new Error("NASA POWER day is unavailable.");
        setScenario(body);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : "NASA POWER day is unavailable.");
      });
    return () => ctrl.abort();
  }, []);

  const hour = scenario?.hours[index] ?? null;
  const point = scenario ? coord(scenario.latitude, scenario.longitude) : "";
  const requested = scenario ? coord(scenario.requestedLatitude, scenario.requestedLongitude) : "";

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>Historical scenario</Text>
      <Text style={styles.title}>{scenario ? `NASA POWER · ${dayLabel(scenario.start)}` : "NASA POWER"}</Text>
      {scenario && hour ? (
        <>
          <Text style={styles.body}>{scenario.longname}</Text>
          <Text style={styles.hint}>
            {`POWER point ${point}`}
            {point === requested ? "" : ` · requested ${requested}`}
            {scenario.elevationM === null ? "" : ` · elevation ${measure(scenario.elevationM)} m`}
            {scenario.sources.length ? ` · ${scenario.sources.join(", ")}` : ""}
            {scenario.apiName ? ` · ${scenario.apiName}${scenario.apiVersion ? ` ${scenario.apiVersion}` : ""}` : ""}
          </Text>
          <Text style={[styles.label, styles.nasa]}>NASA historical</Text>
          <Text style={styles.body}>
            {hour.missing || hour.irradiance === null
              ? `No observation at ${utcLabel(hour.timestampUtc)}. The API fill value ${measure(scenario.fillValue)} marks this hour as missing.`
              : `${measure(hour.irradiance)} ${scenario.units} at ${utcLabel(hour.timestampUtc)}`}
          </Text>
          {hour.irradiance === 0 ? <Text style={styles.hint}>Measured zero. This hour is an observation.</Text> : null}
          <Text style={[styles.label, styles.modeled]}>Modeled darkness</Text>
          <Text style={styles.body}>
            {scenario.i0 === null || hour.modeledDark === null
              ? "Not computed. This series has no positive irradiance to use as I0."
              : `${measure(hour.modeledDark)}% · I0 = ${measure(scenario.i0)} ${scenario.units}`}
          </Text>
          <Text style={styles.hint}>{`${scenario.formula} · ${scenario.i0Rule}`}</Text>
          <Text style={[styles.label, styles.modeled]}>Modeled prediction</Text>
          <Text style={styles.body}>{hour.leds ? ledLine(hour.leds) : "No shed prediction for this hour."}</Text>
          <Text style={styles.hint}>Shed model, started from P1–P4 ON, then one step per observed hour.</Text>
          <View style={styles.scrub}>
            <Pressable
              accessibilityLabel="Previous hour"
              disabled={index === 0}
              onPress={() => setIndex((current) => Math.max(0, current - 1))}
              style={[styles.stepBtn, index === 0 ? styles.stepOff : null]}
            >
              <Text style={styles.stepTxt}>Earlier</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Next hour"
              disabled={index >= scenario.hours.length - 1}
              onPress={() => setIndex((current) => Math.min(scenario.hours.length - 1, current + 1))}
              style={[styles.stepBtn, index >= scenario.hours.length - 1 ? styles.stepOff : null]}
            >
              <Text style={styles.stepTxt}>Later</Text>
            </Pressable>
          </View>
          <View style={styles.hours}>
            {scenario.hours.map((item, itemIndex) => {
              const selected = itemIndex === index;
              return (
                <Pressable
                  key={item.timestampUtc}
                  accessibilityLabel={utcLabel(item.timestampUtc)}
                  accessibilityState={{ selected }}
                  onPress={() => setIndex(itemIndex)}
                  style={[styles.hour, selected ? styles.hourOn : null]}
                >
                  <Text style={[styles.hourTxt, selected ? styles.hourTxtOn : null]}>{item.timestampUtc.slice(11, 13)}</Text>
                </Pressable>
              );
            })}
          </View>
          {scenario.messages.map((message) => (
            <Text key={message} style={styles.hint}>
              {message}
            </Text>
          ))}
          <Text style={styles.hint}>Live Arduino measurements stay on the clinic readout and in Model validation.</Text>
          <Text style={styles.source}>{scenario.sourceUrl}</Text>
        </>
      ) : (
        <Text style={styles.body}>{error || "Loading the NASA POWER hourly day."}</Text>
      )}
    </View>
  );
}

function solLabel(sample: MarsTauSample) {
  return `sol ${sample.solText}`;
}

export function MarsScenarioPanel() {
  const [scenario, setScenario] = useState<MarsTauScenario | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API}/api/scenarios/mars`, { signal: ctrl.signal })
      .then(async (res) => {
        const body: unknown = await res.json();
        if (!res.ok || !isMarsTauScenario(body)) throw new Error("Mastcam optical-depth series is unavailable.");
        setScenario(body);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Mastcam optical-depth series is unavailable.");
      });
    return () => ctrl.abort();
  }, []);

  const sample = scenario?.samples[index] ?? null;
  const omitted = scenario?.omittedIntegerSols.length
    ? `No Mastcam tau row on sol ${scenario.omittedIntegerSols.join(", ")}. Those sols are omitted.`
    : "";

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>Historical scenario</Text>
      <Text style={styles.title}>
        {scenario ? `Mastcam tau · sols ${scenario.minSol}–${scenario.maxSolExclusive - 1}` : "Mastcam tau"}
      </Text>
      {scenario && sample ? (
        <>
          <Text style={styles.body}>{scenario.longname}</Text>
          <Text style={styles.hint}>
            {`${scenario.site} · ${scenario.instrument} · ${scenario.processingLevel} PDS product · ${scenario.solDescription}`}
          </Text>
          <Text style={[styles.label, styles.nasa]}>NASA historical</Text>
          <Text style={styles.body}>
            {`tau ${sample.tauText} ± ${sample.sigmaText} · ${solLabel(sample)} · L_s ${sample.lsText}`}
          </Text>
          <Text style={styles.hint}>
            {`${scenario.tauDescription}. The PDS label gives Tau no unit. L_s is ${scenario.lsDescription.toLowerCase()}, also without a unit element.`}
          </Text>
          <Text style={[styles.label, styles.modeled]}>Modeled darkness</Text>
          <Text style={styles.body}>
            {scenario.tauRef === null || sample.modeledDark === null
              ? "Not computed. This window has no positive optical depth to use as tau_ref."
              : `${measure(sample.modeledDark)}% · tau_ref = ${scenario.tauRefText ?? measure(scenario.tauRef)}`}
          </Text>
          <Text style={styles.hint}>{`${scenario.formula} · ${scenario.tauRefRule}`}</Text>
          <Text style={styles.hint}>
            880 nm aerosol optical depth, mostly dust and also including ice. This is not solar-panel irradiance.
          </Text>
          <Text style={[styles.label, styles.modeled]}>Modeled prediction</Text>
          <Text style={styles.body}>{sample.leds ? ledLine(sample.leds) : "No shed prediction for this observation."}</Text>
          <Text style={styles.hint}>Shed model, started from P1–P4 ON, then one step per Mastcam observation.</Text>
          {omitted ? <Text style={styles.hint}>{omitted}</Text> : null}
          <View style={styles.scrub}>
            <Pressable
              accessibilityLabel="Previous observation"
              disabled={index === 0}
              onPress={() => setIndex((current) => Math.max(0, current - 1))}
              style={[styles.stepBtn, index === 0 ? styles.stepOff : null]}
            >
              <Text style={styles.stepTxt}>Earlier</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Next observation"
              disabled={index >= scenario.samples.length - 1}
              onPress={() => setIndex((current) => Math.min(scenario.samples.length - 1, current + 1))}
              style={[styles.stepBtn, index >= scenario.samples.length - 1 ? styles.stepOff : null]}
            >
              <Text style={styles.stepTxt}>Later</Text>
            </Pressable>
          </View>
          <View style={styles.hours}>
            {scenario.samples.map((item, itemIndex) => {
              const selected = itemIndex === index;
              return (
                <Pressable
                  key={item.pid}
                  accessibilityLabel={solLabel(item)}
                  accessibilityState={{ selected }}
                  onPress={() => setIndex(itemIndex)}
                  style={[styles.hour, selected ? styles.hourOn : null]}
                >
                  <Text style={[styles.hourTxt, selected ? styles.hourTxtOn : null]}>{item.solText}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {`PDS label span for the whole table: ${scenario.archiveStartUtc} to ${scenario.archiveStopUtc}. Each row above is a decimal sol, not an Earth UTC timestamp.`}
          </Text>
          <Text style={styles.hint}>Live Arduino measurements stay on the Mars readout and in Model validation.</Text>
          <Text style={styles.source}>{scenario.sourceUrl}</Text>
        </>
      ) : (
        <Text style={styles.body}>{error || "Loading the Mastcam optical-depth window."}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  kicker: { color: colors.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: sans, fontSize: 18, fontWeight: "500" },
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, marginTop: 4 },
  nasa: { color: colors.blue },
  modeled: { color: colors.gold },
  hint: { color: colors.muted, fontFamily: sans, fontSize: 13, lineHeight: 18 },
  body: { color: colors.ink, fontFamily: sans, fontSize: 14, lineHeight: 20 },
  scrub: { flexDirection: "row", gap: 8, marginTop: 4 },
  stepBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepOff: { opacity: 0.4 },
  stepTxt: { color: colors.ink, fontFamily: sans, fontSize: 13 },
  hours: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  hour: {
    minWidth: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  hourOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  hourTxt: { color: colors.muted, fontFamily: mono, fontSize: 11 },
  hourTxtOn: { color: "#1A1408" },
  source: { color: colors.dim, fontFamily: mono, fontSize: 11, lineHeight: 16 },
});
