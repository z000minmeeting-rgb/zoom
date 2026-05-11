
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { clearLegacyLaunchData } from "./app/data/legacyStorageCleanup.ts";
  import "./styles/index.css";

  clearLegacyLaunchData();

  createRoot(document.getElementById("root")!).render(<App />);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }
  
