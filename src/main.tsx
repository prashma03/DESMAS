import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { KitProvider } from "./kit/KitContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KitProvider>
      <App />
    </KitProvider>
  </StrictMode>,
);
