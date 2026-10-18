import { useEffect, useState } from "react";
import { API } from "./api";
import { cannedFinding, diagnosisKey, type Finding, type WorldKey } from "./findings";
import type { KitReading } from "./kit/types";

const WAIT_MS = 400;

export function useDiagnosis(world: WorldKey, reading: KitReading): { finding: Finding; grok: boolean } {
  const key = diagnosisKey(world, reading);
  const [answer, setAnswer] = useState<{ key: string; finding: Finding } | null>(null);

  useEffect(() => {
    if (!API || process.env.EXPO_PUBLIC_AUTO_DIAGNOSE !== "1") return;
    const ctrl = new AbortController();
    const snapshot = reading;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/diagnose`, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ world, reading: snapshot }),
        });
        const data = (await res.json()) as Finding & { source?: string };
        if (res.ok && data.source === "grok" && data.title && data.body) setAnswer({ key, finding: data });
      } catch {
        // The onboard plan stays up when the server or Grok is unreachable.
      }
    }, WAIT_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // Ask again only when the world, power stage, or alarm changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (answer && answer.key === key) return { finding: answer.finding, grok: true };
  return { finding: cannedFinding(world, reading), grok: false };
}
