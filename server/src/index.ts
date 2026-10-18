import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "node:url";
import { diagnose } from "./diagnose.js";
import { askGrok } from "./grok.js";
import { marsDelay } from "./horizons.js";
import { earthPowerScenario, marsTauScenario } from "./scenarios.js";
import { communicationAutonomy } from "../../src/kit/autonomy.js";
import {
  CREW_VOICE_INSTRUCTIONS,
  GET_SENSOR_STATE_CHAT_TOOL,
  GET_SENSOR_STATE_NAME,
  getSensorState,
  isKitReading,
  offlineCrewAnswer,
} from "../../src/kit/sensorState.js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const app = express();
const port = Number(process.env.PORT ?? 8787);
const XAI_TTS = "https://api.x.ai/v1/tts";
const TTS_MAX_CHARS = 4000;

const hostedOrigins = (process.env.CORS_ORIGINS ?? "https://prashma03.github.io")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function originAllowed(origin: string | undefined) {
  if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return hostedOrigins.includes(origin);
}

app.use(
  cors({
    origin: (origin, cb) => {
      cb(null, originAllowed(origin));
    },
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

const XAI_CHAT = "https://api.x.ai/v1/chat/completions";
const XAI_CLIENT_SECRETS = "https://api.x.ai/v1/realtime/client_secrets";
const CHAT_MODEL = process.env.GROK_CHAT_MODEL?.trim() || "grok-4.7";
const TOKEN_TTL_SEC = 300;

function ttsConfigured() {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

const SECRET_KEY = /secret|token|authorization|api[_-]?key|bearer|^value$/i;

function publicText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/xai-[A-Za-z0-9._-]+/gi, "[redacted]").slice(0, 280);
}

function publicUpstreamMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const walk = (node: unknown): string => {
    if (typeof node === "string") return publicText(node);
    if (!node || typeof node !== "object") return "";
    if (Array.isArray(node)) return node.map(walk).filter(Boolean).join(" ");
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      const found = walk(v);
      if (found) return found;
    }
    return "";
  };
  return walk(body);
}

function realtimeTokenFailure(status: number, body: unknown) {
  const detail = publicUpstreamMessage(body);
  const lower = detail.toLowerCase();
  let message = `xAI realtime token request failed (HTTP ${status}).`;
  if (status === 401) {
    message = "xAI rejected the API key (HTTP 401 Unauthorized). Check XAI_API_KEY in the server .env.";
  } else if (status === 402 || (status === 403 && /credit|quota|billing|balance/.test(lower))) {
    message =
      "xAI denied the realtime token (insufficient credits or billing). Add credits in the xAI console.";
  } else if (status === 403) {
    message = detail
      ? `xAI forbidden the realtime token (HTTP 403). ${detail}`
      : "xAI forbidden the realtime token (HTTP 403). The key may lack Voice/Realtime access, or credits may be too low.";
  } else if (status === 429) {
    message = "xAI rate-limited the realtime token request (HTTP 429). Wait and try once more.";
  } else if (status === 400) {
    message = `xAI rejected the token request format (HTTP 400). ${detail}`.trim();
  } else if (detail) {
    message = `xAI realtime token failed (HTTP ${status}). ${detail}`;
  }
  return { error: "realtime_token" as const, upstreamStatus: status, message };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "desmas",
    tts: ttsConfigured(),
    realtime: ttsConfigured(),
    grok: ttsConfigured(),
  });
});

app.post("/api/realtime/token", async (_req, res) => {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    res.status(503).json({ error: "realtime_unconfigured" });
    return;
  }
  try {
    const upstream = await fetch(XAI_CLIENT_SECRETS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_after: { seconds: TOKEN_TTL_SEC } }),
    });
    const raw = await upstream.text();
    let data: { value?: string; expires_at?: number } | Record<string, unknown> | null = null;
    try {
      data = raw ? (JSON.parse(raw) as { value?: string; expires_at?: number }) : null;
    } catch {
      data = raw ? { error: publicText(raw) } : null;
    }
    const secret = data && typeof data === "object" && "value" in data ? data.value : undefined;
    if (!upstream.ok || typeof secret !== "string" || !secret) {
      console.error("realtime token upstream", upstream.status);
      res.status(502).json(realtimeTokenFailure(upstream.status, data));
      return;
    }
    const expiresAt =
      data && typeof data === "object" && "expires_at" in data && typeof data.expires_at === "number"
        ? data.expires_at
        : null;
    res.json({ value: secret, expires_at: expiresAt });
  } catch {
    res.status(502).json({ error: "realtime_unreachable" });
  }
});

type ChatMsg = {
  role: string;
  content?: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
};

app.post("/api/chat", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const world = req.body?.world;
  if (!text) {
    res.status(400).json({ error: "text_required" });
    return;
  }
  if (world !== "earth" && world !== "moon" && world !== "mars") {
    res.status(400).json({ error: "world_required" });
    return;
  }
  if (!isKitReading(req.body?.reading)) {
    res.status(400).json({ error: "reading_required" });
    return;
  }
  const reading = req.body.reading;
  const mars = world === "mars" ? await marsDelay() : null;
  const offline = () => offlineCrewAnswer(world, reading, text, mars);

  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    res.json({ source: "offline", text: offline() });
    return;
  }

  const messages: ChatMsg[] = [
    { role: "system", content: CREW_VOICE_INSTRUCTIONS },
    { role: "user", content: text },
  ];

  try {
    for (let i = 0; i < 4; i += 1) {
      const upstream = await fetch(XAI_CHAT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages,
          tools: [GET_SENSOR_STATE_CHAT_TOOL],
        }),
      });
      if (!upstream.ok) {
        res.json({ source: "offline", text: offline() });
        return;
      }
      const data = (await upstream.json()) as {
        choices?: { message?: ChatMsg }[];
      };
      const msg = data.choices?.[0]?.message;
      if (!msg) {
        res.json({ source: "offline", text: offline() });
        return;
      }
      const calls = msg.tool_calls as
        | { id: string; function?: { name?: string; arguments?: string } }[]
        | undefined;
      if (calls?.length) {
        messages.push(msg);
        for (const call of calls) {
          const name = call.function?.name;
          const out =
            name === GET_SENSOR_STATE_NAME
              ? {
                  ...getSensorState(world, reading),
                  decision: communicationAutonomy({ world, reading, mars }),
                }
              : { error: "unknown_function" };
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(out),
          });
        }
        continue;
      }
      const answer = typeof msg.content === "string" ? msg.content.trim() : "";
      if (!answer) {
        res.json({ source: "offline", text: offline() });
        return;
      }
      res.json({ source: "grok", text: answer });
      return;
    }
    res.json({ source: "offline", text: offline() });
  } catch {
    res.json({ source: "offline", text: offline() });
  }
});

app.post("/api/tts", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "text_required" });
    return;
  }
  if (text.length > TTS_MAX_CHARS) {
    res.status(400).json({ error: "text_too_long" });
    return;
  }

  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    res.status(503).json({ error: "tts_unconfigured" });
    return;
  }

  try {
    const upstream = await fetch(XAI_TTS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: "eve",
        language: "en",
        text_normalization: true,
      }),
    });

    const type = upstream.headers.get("content-type") || "";
    if (!upstream.ok || type.includes("application/json")) {
      res.status(502).json({ error: "tts_upstream" });
      return;
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    if (!audio.length) {
      res.status(502).json({ error: "tts_empty" });
      return;
    }

    res.setHeader("Content-Type", type || "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  } catch {
    res.status(502).json({ error: "tts_unreachable" });
  }
});

app.get("/api/mars-delay", async (_req, res) => {
  res.json(await marsDelay());
});

app.get("/api/scenarios/earth", async (_req, res) => {
  try {
    res.json(await earthPowerScenario());
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 280) : "NASA POWER request failed";
    res.status(502).json({ error: "power_unreachable", message });
  }
});

app.get("/api/scenarios/mars", async (_req, res) => {
  try {
    res.json(await marsTauScenario());
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 280) : "MSL tau request failed";
    res.status(502).json({ error: "tau_unreachable", message });
  }
});

app.post("/api/diagnose", (req, res) => {
  void diagnose(req, res);
});

app.post("/api/grok", async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim().slice(0, 500) : "";
  const world =
    req.body?.world === "earth" || req.body?.world === "moon" || req.body?.world === "mars"
      ? req.body.world
      : "earth";
  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }
  try {
    const answer = await askGrok({ world, question, reading: req.body?.reading });
    res.json({ answer, source: "grok" });
  } catch (err) {
    const missing = err instanceof Error && err.message === "missing-key";
    res.status(missing ? 503 : 502).json({
      error: missing ? "XAI_API_KEY is not set on the server" : "Grok request failed",
    });
  }
});

app.listen(port, () => {
  console.log(`DESMAS server http://localhost:${port}`);
});
