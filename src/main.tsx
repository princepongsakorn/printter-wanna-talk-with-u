import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";

// PWA-only keyboard fix:
// Only apply body lock + visualViewport sync in PWA standalone mode.
// This makes the keyboard push only the input area (fixed navbar), similar to native apps.
// In regular Safari, keep the browser's default behavior that iOS users already expect.
type SafariNavigator = Navigator & { standalone?: boolean };
const isPWA =
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as SafariNavigator).standalone === true;

if (isPWA) {
  document.documentElement.classList.add("pwa-mode");

  const syncViewport = () => {
    const vv = window.visualViewport;
    const h = vv?.height ?? window.innerHeight;
    const top = vv?.offsetTop ?? 0;
    document.documentElement.style.setProperty("--app-height", `${h}px`);
    document.documentElement.style.setProperty("--app-top", `${top}px`);
  };
  syncViewport();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncViewport);
    window.visualViewport.addEventListener("scroll", syncViewport);
  }
  window.addEventListener("resize", syncViewport);
  window.addEventListener("orientationchange", syncViewport);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
