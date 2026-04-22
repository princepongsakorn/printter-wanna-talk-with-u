import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  /** User's chosen mode. "system" defers to OS preference. */
  mode: ThemeMode;
  /** The currently applied theme (resolves "system" to light/dark). */
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  /** Cycles light -> dark -> system -> light. */
  cycle: () => void;
};

const STORAGE_KEY = "chat:theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPref(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function applyDomClass(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  // Align the iOS status-bar / Android chrome color with the app bg.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = resolved === "dark" ? "#020617" : "#0ea5e9";
}

/**
 * Call ONCE before React renders to avoid a flash of the wrong theme.
 * Reads the stored preference (or system default) and applies the dark
 * class to <html> synchronously.
 */
export function initThemeOnDocument(): void {
  const stored = readStoredMode();
  const resolved = stored === "system" ? getSystemPref() : stored;
  applyDomClass(resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [systemPref, setSystemPref] = useState<"light" | "dark">(() =>
    getSystemPref(),
  );

  // Follow OS preference changes while mode === "system".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setSystemPref(e.matches ? "dark" : "light");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const resolved: "light" | "dark" = mode === "system" ? systemPref : mode;

  // Apply the class and persist the user's choice.
  useEffect(() => {
    applyDomClass(resolved);
  }, [resolved]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage disabled - fine, session-only */
    }
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
  const cycle = useCallback(() => {
    setModeState((prev) =>
      prev === "light" ? "dark" : prev === "dark" ? "system" : "light",
    );
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, cycle }),
    [mode, resolved, setMode, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
