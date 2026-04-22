import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { pairIdOf, type Friendship, type FriendshipUserInfo } from "./types";

export class FriendError extends Error {
  constructor(
    message: string,
    public code: "self" | "not-found" | "unknown",
  ) {
    super(message);
    this.name = "FriendError";
  }
}

function userInfoFromUser(u: User): FriendshipUserInfo {
  return {
    displayName: u.displayName ?? u.email?.split("@")[0] ?? "User",
    photoURL: u.photoURL ?? null,
    email: u.email ?? null,
    isAnonymous: u.isAnonymous,
  };
}

/**
 * Add a user (by email) as a friend. Creates or updates the friendship doc
 * and sets `addedBy[me.uid] = now`. Does NOT set addedBy for the other user —
 * they must add back (or click "Accept friend") before they can send messages.
 *
 * For legacy docs (no `addedBy` field), migrates by filling BOTH entries
 * with a timestamp, preserving the implicit "both accepted" semantic.
 *
 * Returns the pairId so the caller can navigate to /chat/:pairId.
 */
export async function addFriend(me: User, targetEmailRaw: string): Promise<string> {
  const targetEmail = targetEmailRaw.trim().toLowerCase();
  if (!targetEmail) throw new FriendError("กรุณากรอกอีเมล", "unknown");
  if (me.email && targetEmail === me.email.toLowerCase()) {
    throw new FriendError("ไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้", "self");
  }

  const usersQ = query(collection(db, "users"), where("emailLower", "==", targetEmail));
  const usersSnap = await getDocs(usersQ);
  if (usersSnap.empty) {
    throw new FriendError("ไม่พบผู้ใช้ตามอีเมลนี้", "not-found");
  }
  const targetDoc = usersSnap.docs[0];
  const targetUid = targetDoc.id;
  const targetData = targetDoc.data();

  const pairId = pairIdOf(me.uid, targetUid);
  const ref = doc(db, "friendships", pairId);
  const existing = await getDoc(ref);

  const myInfo = userInfoFromUser(me);
  const theirInfo: FriendshipUserInfo = {
    displayName: targetData.displayName ?? targetEmail.split("@")[0],
    photoURL: targetData.photoURL ?? null,
    email: targetData.email ?? null,
    isAnonymous: !!targetData.isAnonymous,
  };

  if (existing.exists()) {
    const data = existing.data();
    const hasAddedBy = "addedBy" in data;
    if (!hasAddedBy) {
      // Legacy: implicit "both accepted" -> migrate with both timestamps
      await setDoc(
        ref,
        {
          addedBy: {
            [me.uid]: serverTimestamp(),
            [targetUid]: serverTimestamp(),
          },
          userInfo: { [me.uid]: myInfo },
        },
        { merge: true },
      );
    } else {
      await setDoc(
        ref,
        {
          [`addedBy.${me.uid}`]: serverTimestamp(),
          [`userInfo.${me.uid}`]: myInfo,
        },
        { merge: true },
      );
    }
  } else {
    await setDoc(ref, {
      users: [me.uid, targetUid].sort(),
      userInfo: {
        [me.uid]: myInfo,
        [targetUid]: theirInfo,
      },
      addedBy: {
        [me.uid]: serverTimestamp(),
        [targetUid]: null,
      },
      createdAt: serverTimestamp(),
    });
  }
  return pairId;
}

/**
 * Accept (add-back) an existing friendship. Sets `addedBy[me.uid] = now`.
 * Used when the current user received a message/add from someone and wants
 * to reply. Does the same thing as `addFriend` but skips the email lookup.
 */
export async function acceptFriendship(me: User, pairId: string): Promise<void> {
  const ref = doc(db, "friendships", pairId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new FriendError("ไม่พบห้องแชท", "not-found");
  const data = snap.data();
  const hasAddedBy = "addedBy" in data;

  if (!hasAddedBy) {
    // Legacy -> migrate with both accepted
    const users = data.users as [string, string];
    const otherUid = users[0] === me.uid ? users[1] : users[0];
    await setDoc(
      ref,
      {
        addedBy: {
          [me.uid]: serverTimestamp(),
          [otherUid]: serverTimestamp(),
        },
        userInfo: { [me.uid]: userInfoFromUser(me) },
      },
      { merge: true },
    );
  } else {
    await setDoc(
      ref,
      {
        [`addedBy.${me.uid}`]: serverTimestamp(),
        [`userInfo.${me.uid}`]: userInfoFromUser(me),
      },
      { merge: true },
    );
  }
}

export function subscribeFriendships(
  uid: string,
  cb: (items: Friendship[]) => void,
): () => void {
  const q = query(collection(db, "friendships"), where("users", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Friendship, "id">) }) as Friendship,
    );
    items.sort((a, b) => {
      const ta = a.lastMessage?.createdAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const tb = b.lastMessage?.createdAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    cb(items);
  });
}

export function otherUidOf(friendship: Friendship, myUid: string): string {
  return friendship.users[0] === myUid ? friendship.users[1] : friendship.users[0];
}
