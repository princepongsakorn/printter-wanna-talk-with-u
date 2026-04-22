type Props = {
  name: string;
  photoURL?: string | null;
  size?: number;
  className?: string;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function colorFor(key: string): string {
  const palette = [
    "bg-rose-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-sky-500",
    "bg-indigo-500",
    "bg-fuchsia-500",
  ];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function Avatar({ name, photoURL, size = 40, className = "" }: Props) {
  const style = { width: size, height: size };
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        style={style}
        className={`rounded-full object-cover ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      style={style}
      className={`flex items-center justify-center rounded-full text-white font-semibold ${colorFor(
        name,
      )} ${className}`}
    >
      <span style={{ fontSize: size * 0.4 }}>{initialsOf(name)}</span>
    </div>
  );
}
