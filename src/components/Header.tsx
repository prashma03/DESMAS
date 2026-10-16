import { useKit } from "../kit/KitContext";

const items = [
  { id: "worlds", label: "All worlds" },
  { id: "earth", label: "Earth" },
  { id: "moon", label: "Moon" },
  { id: "mars", label: "Mars" },
] as const;

export function Header() {
  const { world, setWorld, source, connecting, connect, disconnect, connectError } = useKit();
  return (
    <header className="top">
      <div className="brand">DESMAS</div>
      <nav className="worlds-nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={world === item.id ? "active" : ""}
            onClick={() => setWorld(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="spacer" />
      <span className={`badge ${source === "arduino" ? "live" : ""}`}>
        <span className="dot" />
        {source === "arduino" ? "Live kit" : "Simulated kit"}
      </span>
      {source === "arduino" ? (
        <button className="pill ghost" onClick={disconnect}>
          Disconnect
        </button>
      ) : (
        <button className="pill" onClick={() => void connect()} disabled={connecting}>
          {connecting ? "Opening…" : "Connect Arduino"}
        </button>
      )}
      {connectError ? (
        <span className="badge" title={connectError}>
          {connectError}
        </span>
      ) : null}
    </header>
  );
}
