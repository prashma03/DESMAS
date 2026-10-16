const SYSTEM = `You are the DESMAS crew assistant for an Earth clinic, a Moon base, and a Mars relay ship.
Answer in 2 to 4 short sentences a crew member can act on.
The Arduino board owns power and LED decisions. Never tell the crew to recompute which loads are on. The leds array is the board's decision: index 0 life support, 1 comms, 2 science or lights, 3 comfort or fan. 1 means on.
Battery percent and vaccine-fridge temperature are estimates when you mention them. Say so.
Do not invent lunar south-pole sunrise or sunset times. If the light sensor is dark, say priority shedding is already in effect.
Use only the humidity, temperature, and darkness values in the reading. Do not invent other sensor numbers.`;

export type GrokAsk = {
  world: string;
  question: string;
  reading: unknown;
};

function readingSummary(raw: unknown) {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (key: string) => (typeof row[key] === "number" ? row[key] : null);
  const leds = Array.isArray(row.leds) ? row.leds.filter((n) => typeof n === "number").slice(0, 4) : [];
  return {
    hum: num("hum"),
    temp: num("temp"),
    dark: num("dark"),
    cut: num("cut"),
    alarm: num("alarm"),
    leds,
  };
}

export async function askGrok(input: GrokAsk): Promise<string> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) throw new Error("missing-key");

  const model = process.env.XAI_MODEL?.trim() || "grok-4.7";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const upstream = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `World: ${input.world}\nQuestion: ${input.question}\nReadings JSON: ${JSON.stringify(readingSummary(input.reading))}`,
          },
        ],
      }),
    });
    if (!upstream.ok) throw new Error("upstream");
    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("empty");
    return answer;
  } finally {
    clearTimeout(timer);
  }
}
