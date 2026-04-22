import type { Timestamp } from "firebase/firestore";

export function formatTime(ts: Timestamp | undefined): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export function formatChatListTimestamp(ts: Timestamp | undefined): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }
  const diffMs = now.getTime() - d.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (diffMs < oneWeek) {
    return d.toLocaleDateString("th-TH", { weekday: "short" });
  }
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
}

export function shouldShowDateSeparator(
  prev: Timestamp | undefined,
  curr: Timestamp | undefined,
): boolean {
  if (!curr?.toDate) return false;
  if (!prev?.toDate) return true;
  const a = prev.toDate();
  const b = curr.toDate();
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

export function formatDateSeparator(ts: Timestamp | undefined): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "วันนี้";
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();
  if (isYesterday) return "เมื่อวาน";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
