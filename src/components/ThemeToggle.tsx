import { useTheme } from "../contexts/ThemeContext";

/**
 * Compact button that cycles light -> dark -> system. Icon reflects the
 * current mode (sun / moon / half-moon-with-dot for "system").
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { mode, cycle } = useTheme();
  const label =
    mode === "light"
      ? "โหมดสว่าง"
      : mode === "dark"
        ? "โหมดมืด"
        : "ตามระบบ";

  return (
    <button
      type="button"
      onClick={cycle}
      className={`rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${className}`}
      aria-label={`สลับธีม (${label})`}
      title={label}
    >
      {mode === "light" && <SunIcon />}
      {mode === "dark" && <MoonIcon />}
      {mode === "system" && <AutoIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}
