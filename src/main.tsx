import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider, initThemeOnDocument } from "./contexts/ThemeContext";
import "./index.css";

// Apply the persisted theme BEFORE React renders to avoid a flash of the
// wrong palette on cold load.
initThemeOnDocument();

// Cold-start redirect:
// When the app is opened fresh (PWA launch from home-screen, typed URL,
// notification cold-open, etc.) we land the user on the home/friends page
// — never on a stale `/chat/<pairId>` URL the OS may have remembered from
// the previous session. Reloads (F5) and back/forward navigations keep
// their URL so refresh-during-use behaves naturally.
//
// `performance.getEntriesByType("navigation")[0].type`:
//   - "navigate"      => fresh open (cold start)  -> redirect
//   - "reload"        => F5 / pull-to-refresh     -> keep
//   - "back_forward"  => back/forward             -> keep
(() => {
  try {
    const navEntry = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const isColdStart = !navEntry || navEntry.type === "navigate";
    if (isColdStart && window.location.pathname.startsWith("/chat/")) {
      window.history.replaceState(null, "", "/");
    }
  } catch {
    // Performance API unavailable — leave URL alone.
  }
})();

// Register the PWA service worker (makes the app installable + enables
// notificationclick handling). When the SW posts a "navigate" message
// (from a clicked notification), push the URL into react-router's history
// via pushState + popstate so the SPA handles it without a reload.
if ("serviceWorker" in navigator) {
  // Defer until window "load" so it doesn't compete with first paint.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW registration failed", err));
  });
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data as { type?: string; url?: string } | undefined;
    if (data?.type === "navigate" && typeof data.url === "string") {
      window.history.pushState(null, "", data.url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  });
}

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
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
