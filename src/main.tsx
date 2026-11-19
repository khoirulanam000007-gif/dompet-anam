import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { UiHost } from "./lib/ui";
import "./lib/install";
import SetupNeeded from "./pages/SetupNeeded";
import { CONFIGURED } from "./lib/config";

if (localStorage.getItem("theme") === "dark") document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {CONFIGURED ? <App /> : <SetupNeeded />}
    <UiHost />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Getar halus saat tombol ditekan (jika perangkat mendukung).
document.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("button")) navigator.vibrate?.(6); }, { passive: true });
