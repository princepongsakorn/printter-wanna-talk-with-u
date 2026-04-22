import { onDisconnect, onValue, ref, remove, set } from "firebase/database";
import { rtdb } from "./firebase";

const TYPING_TTL_MS = 4_000; // Consider user "typing" if heartbeat is fresh within 4 seconds.
const HEARTBEAT_INTERVAL_MS = 2_000; // Send heartbeat every 2 seconds to keep typing state alive.

/**
 * Returns a controller that sends throttled heartbeats while the user is typing
 * and clears typing state when they stop or the connection drops.
 */
export function createTypingController(pairId: string, myUid: string) {
  const path = `typing/${pairId}/${myUid}`;
  const myRef = ref(rtdb, path);

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let onDisconnectRegistered = false;

  const writeHeartbeat = () => {
    set(myRef, Date.now()).catch(() => {
      /* swallow - best effort */
    });
  };

  const start = () => {
    if (!onDisconnectRegistered) {
      onDisconnect(myRef)
        .remove()
        .then(() => {
          onDisconnectRegistered = true;
        })
        .catch(() => {
          /* best effort */
        });
    }
    if (heartbeatTimer == null) {
      writeHeartbeat();
      heartbeatTimer = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
    }
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      stopNow();
    }, TYPING_TTL_MS);
  };

  const stopNow = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    remove(myRef).catch(() => {});
  };

  return {
    /** Call on every keystroke; throttled to 1 heartbeat per 2s plus an idle timeout */
    ping: start,
    /** Call when message is sent or composer cleared to immediately stop typing */
    stop: stopNow,
    /** Call on unmount to fully clean up */
    dispose: stopNow,
  };
}

export function subscribeTyping(
  pairId: string,
  otherUid: string,
  cb: (isTyping: boolean) => void,
): () => void {
  const path = `typing/${pairId}/${otherUid}`;
  const theirRef = ref(rtdb, path);

  let lastTypingMs: number | null = null;
  let expireTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    const fresh =
      lastTypingMs != null && Date.now() - lastTypingMs < TYPING_TTL_MS;
    cb(fresh);
  };

  const scheduleExpire = () => {
    if (expireTimer) clearTimeout(expireTimer);
    if (lastTypingMs == null) return;
    const remaining = TYPING_TTL_MS - (Date.now() - lastTypingMs);
    if (remaining <= 0) {
      emit();
      return;
    }
    expireTimer = setTimeout(() => emit(), remaining + 50);
  };

  const unsub = onValue(theirRef, (snap) => {
    const val = snap.val();
    lastTypingMs = typeof val === "number" ? val : null;
    emit();
    scheduleExpire();
  });

  return () => {
    unsub();
    if (expireTimer) clearTimeout(expireTimer);
  };
}
