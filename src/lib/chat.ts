import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { pairIdOf, type Message } from "./types";

export async function sendMessage(me: User, otherUid: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const pairId = pairIdOf(me.uid, otherUid);

  const msgRef = await addDoc(collection(db, "chats", pairId, "messages"), {
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
      messageId: msgRef.id,
    },
  }).catch((err) => console.warn("lastMessage update failed", err));
}

export function subscribeMessages(
  pairId: string,
  cb: (items: Message[]) => void,
  max = 200,
): () => void {
  const q = query(
    collection(db, "chats", pairId, "messages"),
    orderBy("createdAt", "asc"),
    limit(max),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) }) as Message,
    );
    cb(items);
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
