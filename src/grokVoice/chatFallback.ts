import { kitStore } from "../kit/store";
import { offlineCrewAnswer } from "../kit/sensorState";
import type { WorldId } from "../kit/types";
import { speakAlert } from "../speakAlert";

const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

type World = Exclude<WorldId, "all">;

export type ChatSource = "grok" | "offline";

export async function askTypedQuestion(
  world: World,
  text: string,
): Promise<{ source: ChatSource; answer: string; spoken: "grok" | "browser" | "none" }> {
  const clipped = text.trim().slice(0, 2000);
  if (!clipped) throw new Error("empty");
  const { reading } = kitStore.getSnapshot();

  try {
    const res = await fetch(`${API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clipped, world, reading }),
    });
    const data = (await res.json()) as { source?: ChatSource; text?: string };
    const answer = data.text?.trim() || offlineCrewAnswer(world, reading, clipped);
    const source: ChatSource = data.source === "grok" && res.ok ? "grok" : "offline";
    let spoken: "grok" | "browser" | "none" = "none";
    try {
      spoken = await speakAlert(answer);
    } catch {
      spoken = "none";
    }
    return { source, answer, spoken };
  } catch {
    const answer = offlineCrewAnswer(world, reading, clipped);
    let spoken: "grok" | "browser" | "none" = "none";
    try {
      spoken = await speakAlert(answer);
    } catch {
      spoken = "none";
    }
    return { source: "offline", answer, spoken };
  }
}
