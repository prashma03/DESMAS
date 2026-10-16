import { useMemo, useState } from "react";
import { answerCrew, diagnose, promptsFor } from "../ai";
import { useKit } from "../kit/KitContext";
import type { WorldId } from "../kit/types";

export function AIMonitor({ world }: { world: Exclude<WorldId, "worlds"> }) {
  const { reading } = useKit();
  const solar = Math.max(0, 100 - reading.dark);
  const finding = useMemo(() => diagnose(world, reading, solar), [world, reading, solar]);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [text, setText] = useState("");
  const prompts = promptsFor(world);

  const ask = (q: string) => {
    const query = q.trim();
    if (!query) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: query },
      { role: "ai", text: answerCrew(query, world, reading, solar) },
    ]);
    setText("");
  };

  return (
    <section className="ai-dock" id="ai">
      <div>
        <div className="ai-kicker">AI monitor · powered by Grok API · reading the Arduino · twice a second</div>
        <div className={`ai-finding ${finding.level}`}>
          {finding.level} · {finding.title}
        </div>
        <p className="ai-body">{finding.body}</p>
        <div className="chips">
          {finding.chips.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </div>
        <div className="eyebrow">Troubleshooting plan {finding.steps.length ? `0 / ${finding.steps.length} done` : ""}</div>
        {finding.steps.length ? (
          <ol className="steps">
            {finding.steps.map((s, i) => (
              <li key={s}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ai-body">No plan needed right now. One appears here as soon as a reading crosses its cutoff.</p>
        )}
        {finding.part ? (
          <p className="ai-body" style={{ marginTop: 10 }}>
            Parts in stock · {finding.part}
          </p>
        ) : null}
      </div>
      <div className="chat">
        <div className="eyebrow">Ask the crew's AI</div>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        <div className="prompts">
          {prompts.map((p) => (
            <button key={p} type="button" onClick={() => ask(p)}>
              {p}
            </button>
          ))}
        </div>
        <form
          className="chat-row"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Hold a question for the station…" />
          <button className="pill" type="submit">
            Ask
          </button>
        </form>
      </div>
    </section>
  );
}
