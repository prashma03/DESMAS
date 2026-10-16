import { Header } from "./components/Header";
import { Stars } from "./components/Stars";
import { useKit } from "./kit/KitContext";
import { AllWorldsPage } from "./pages/AllWorldsPage";
import { EarthPage } from "./pages/EarthPage";
import { MarsPage } from "./pages/MarsPage";
import { MoonPage } from "./pages/MoonPage";

export function App() {
  const { world } = useKit();
  return (
    <div className="app">
      <div className="dotgrid" />
      <Stars />
      <Header />
      <main className="stage">
        {world === "worlds" ? <AllWorldsPage /> : null}
        {world === "earth" ? <EarthPage /> : null}
        {world === "moon" ? <MoonPage /> : null}
        {world === "mars" ? <MarsPage /> : null}
      </main>
    </div>
  );
}
