export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500 ${className}`}
      role="status"
      aria-label="loading"
    />
  );
}
