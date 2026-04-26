import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { pairIdOf, type Message } from "./types";

/**
 * Generate a new message doc reference with a client-side ID. Used for the
 * optimistic-send pattern: we want to know the message's final ID *before*
 * the network round-trip so the UI can render a pending bubble immediately
 * and dedup against the server snapshot when it arrives.
 */
export function newMessageRef(pairId: string) {
  return doc(collection(db, "chats", pairId, "messages"));
}

/**
 * Send a message with a pre-generated ID. The caller is expected to have
 * already added an optimistic placeholder with the same id so the UI shows
 * "กำลังส่ง" without waiting on the network. On resolve, the Firestore
 * snapshot listener will pick up the real doc and the placeholder is
 * removed by the caller.
 *
 * Throws on permission-denied / offline-write-failure so the caller can
 * surface a "ส่งไม่สำเร็จ" state.
 */
export async function sendMessageWithId(
  me: User,
  otherUid: string,
  messageId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const pairId = pairIdOf(me.uid, otherUid);

  await setDoc(doc(db, "chats", pairId, "messages", messageId), {
    senderUid: me.uid,
    text: trimmed,
    createdAt: serverTimestamp(),
    readBy: { [me.uid]: serverTimestamp() },
  });

  // Update friendship lastMessage. Non-critical - do not await.
  updateDoc(doc(db, "friendships", pairId), {
    lastMessage: {
      text: trimmed,
      senderUid: me.uid,
      createdAt: serverTimestamp(),
      messageId,
    },
  }).catch((err) => console.warn("lastMessage update failed", err));
}

/**
 * Subscribe to the most recent `msgLimit` messages in a chat. The callback
 * receives messages in ASCENDING order (oldest first, newest last), plus a
 * boolean `reachedTop` telling the caller whether the subscription has
 * already covered the entire history (i.e. no older messages exist).
 *
 * Pagination strategy: we query with `orderBy("createdAt", "desc")` + a
 * `limit(msgLimit)`, then reverse in-memory. To load older messages the
 * caller bumps `msgLimit` and re-subscribes — which keeps realtime updates
 * flowing for every currently-visible message (important for read
 * receipts and edits), at the cost of a single Firestore re-subscribe per
 * "load older" action.
 *
 * `reachedTop === true` when Firestore returned fewer than `msgLimit`
 * documents, which means we've already loaded the entire chat history.
 */
export function subscribeMessages(
  pairId: string,
  cb: (items: Message[], reachedTop: boolean) => void,
  msgLimit = 30,
): () => void {
  const q = query(
    collection(db, "chats", pairId, "messages"),
    orderBy("createdAt", "desc"),
    limit(msgLimit),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) }) as Message)
      .reverse();
    const reachedTop = snap.docs.length < msgLimit;
    cb(items, reachedTop);
  });
}

export async function markRead(
  myUid: string,
  pairId: string,
  messageIds: string[],
): Promise<void> {
  if (messageIds.length === 0) return;
  await Promise.all(
    messageIds.map((id) =>
      updateDoc(doc(db, "chats", pairId, "messages", id), {
        [`readBy.${myUid}`]: serverTimestamp(),
      }).catch(() => {
        /* swallow - best effort */
      }),
    ),
  );
}
