
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);

  async function clearDevelopmentServiceWorkers() {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("zoom-pwa-"))
          .map((cacheName) => window.caches.delete(cacheName))
      );
    }
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      if (import.meta.env.PROD) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => registration.update())
          .catch(() => undefined);
        return;
      }

      clearDevelopmentServiceWorkers().catch(() => undefined);
    });
  }
  
