import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { diagnose } from "./diagnose.js";
import { askGrok } from "./grok.js";
import { marsDelay } from "./horizons.js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const app = express();
const port = Number(process.env.PORT ?? 8787);
const WORLDS = new Set(["earth", "moon", "mars"]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "desmas", grok: Boolean(process.env.XAI_API_KEY?.trim()) });
});

app.get("/api/mars-delay", async (_req, res) => {
  res.json(await marsDelay());
});

app.post("/api/diagnose", (req, res) => {
  void diagnose(req, res);
});

app.post("/api/grok", async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim().slice(0, 500) : "";
  const world = typeof req.body?.world === "string" && WORLDS.has(req.body.world) ? req.body.world : "earth";
  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }
  try {
    const answer = await askGrok({ world, question, reading: req.body?.reading });
    res.json({ answer, source: "grok" });
  } catch (err) {
    const missing = err instanceof Error && (err.message === "missing-key" || err.name === "MissingKeyError");
    res.status(missing ? 503 : 502).json({
      error: missing ? "XAI_API_KEY is not set on the server" : "Grok request failed",
    });
  }
});

app.listen(port, () => {
  console.log(`DESMAS server http://localhost:${port}`);
});
