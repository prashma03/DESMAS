import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "desmas" });
});

// Fallback from the project summary (JPL Horizons, 15 Oct 2026). Live fetch comes next.
const FALLBACK_MARS = {
  au: 1.56,
  oneWaySeconds: 12.96 * 60,
  source: "fallback" as const,
  note: "NASA JPL Horizons, 15 Oct 2026. Live query not wired yet.",
};

app.get("/api/mars-delay", (_req, res) => {
  res.json(FALLBACK_MARS);
});

app.listen(port, () => {
  console.log(`DESMAS server http://localhost:${port}`);
});
