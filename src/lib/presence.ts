import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set,
} from "firebase/database";
import { rtdb } from "./firebase";

export type PresenceState = {
  state: "online" | "offline";
  lastChanged: number;
};

/**
 * Initialize presence for the current user.
 * Sets state = 'online' and registers an onDisconnect handler to flip to 'offline'
 * when the TCP connection drops (tab close, browser crash, network loss, etc.).
 *
 * Also listens to the special `.info/connected` path so we re-register presence
 * whenever the client reconnects.
 *
 * Returns a cleanup function that sets state = 'offline' and detaches listeners.
 */
export function initPresence(uid: string): () => void {
  const statusRef = ref(rtdb, `status/${uid}`);
  const connectedRef = ref(rtdb, ".info/connected");

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() === false) return;

    onDisconnect(statusRef)
      .set({ state: "offline", lastChanged: rtdbServerTimestamp() })
      .then(() => {
        set(statusRef, { state: "online", lastChanged: rtdbServerTimestamp() }).catch(
          (err) => console.warn("presence set online failed", err),
        );
      })
      .catch((err) => console.warn("onDisconnect register failed", err));
  });

  return () => {
    unsub();
    set(statusRef, { state: "offline", lastChanged: rtdbServerTimestamp() }).catch(
      () => {},
    );
  };
}

export function subscribePresence(
  uid: string,
  cb: (state: PresenceState | null) => void,
): () => void {
  const statusRef = ref(rtdb, `status/${uid}`);
  return onValue(statusRef, (snap) => {
    const val = snap.val() as PresenceState | null;
    cb(val);
  });
}

export function formatLastSeen(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} วันที่แล้ว`;
  return new Date(ms).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
}
