import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { User } from "firebase/auth";
import { otherUidOf, subscribeFriendships } from "../lib/friends";
import { canShowNotification, showNotification } from "../lib/notifications";

/**
 * Global listener: watches `friendships` and pops a browser notification
 * whenever a new incoming message (from another user) arrives while the
 * app is either hidden, unfocused, or viewing a different conversation.
 *
 * The very first snapshot is treated as "initial state" — we seed the
 * seen-map without firing notifications so the user never sees a flood
 * of historical messages on page load.
 */
export function useMessageNotifications(user: User | null): void {
  const location = useLocation();
  const currentPathRef = useRef(location.pathname);
  const lastSeenRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);

  // Keep the path available to the subscription callback without
  // re-subscribing on every route change.
  useEffect(() => {
    currentPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    // Reset state across login/logout so a re-login doesn't replay old ids.
    lastSeenRef.current = new Map();
    initializedRef.current = false;
    if (!user) return;

    const unsub = subscribeFriendships(user.uid, (friendships) => {
      const firstPass = !initializedRef.current;
      for (const f of friendships) {
        const last = f.lastMessage;
        if (!last) continue;
        // Older docs may not have messageId — fall back to a stable key
        // derived from sender + text + createdAt millis.
        const key =
          (last as { messageId?: string }).messageId ??
          `${last.senderUid}:${last.text}:${last.createdAt?.toMillis?.() ?? 0}`;
        const prev = lastSeenRef.current.get(f.id);
        if (prev === key) continue;
        lastSeenRef.current.set(f.id, key);

        if (firstPass) continue;
        if (last.senderUid === user.uid) continue;

        const pairUrl = `/chat/${f.id}`;
        const viewingThis = currentPathRef.current === pairUrl;
        const focused = typeof document !== "undefined" && !document.hidden;
        if (viewingThis && focused) continue;

        if (!canShowNotification()) continue;

        const otherUid = otherUidOf(f, user.uid);
        const other = f.userInfo?.[otherUid];
        const title = other?.displayName ?? other?.email ?? "เพื่อน";

        showNotification({
          title,
          body: last.text,
          tag: f.id,
          url: pairUrl,
        });
      }
      initializedRef.current = true;
    });
    return () => {
      unsub();
      lastSeenRef.current = new Map();
      initializedRef.current = false;
    };
  }, [user]);
}
