import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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
 * Add a user (by email OR username) as a friend. Creates or updates the
 * friendship doc and sets `addedBy[me.uid] = now`. Does NOT set addedBy for
 * the other user — they must add back (or click "Accept friend") before they
 * can send messages.
 *
 * Input detection: contains "@" → search by emailLower, else → usernameLower.
 *
 * For legacy docs (no `addedBy` field), migrates by filling BOTH entries
 * with a timestamp, preserving the implicit "both accepted" semantic.
 *
 * Returns the pairId so the caller can navigate to /chat/:pairId.
 */
export async function addFriend(me: User, identifierRaw: string): Promise<string> {
  const identifier = identifierRaw.trim().toLowerCase();
  if (!identifier) throw new FriendError("กรุณากรอกอีเมล หรือ username", "unknown");

  const searchByEmail = identifier.includes("@");
  const field = searchByEmail ? "emailLower" : "usernameLower";
  const usersQ = query(collection(db, "users"), where(field, "==", identifier));
  const usersSnap = await getDocs(usersQ);
  if (usersSnap.empty) {
    throw new FriendError(
      searchByEmail ? "ไม่พบผู้ใช้ตามอีเมลนี้" : "ไม่พบผู้ใช้ตาม username นี้",
      "not-found",
    );
  }
  const targetDoc = usersSnap.docs[0];
  const targetUid = targetDoc.id;
  if (targetUid === me.uid) {
    throw new FriendError("ไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้", "self");
  }
  const targetData = targetDoc.data();

  const pairId = pairIdOf(me.uid, targetUid);
  const ref = doc(db, "friendships", pairId);
  const existing = await getDoc(ref);

  const myInfo = userInfoFromUser(me);
  const theirInfo: FriendshipUserInfo = {
    displayName:
      targetData.displayName ??
      targetData.username ??
      (searchByEmail ? identifier.split("@")[0] : identifier),
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
      // Use updateDoc so `addedBy.<uid>` is parsed as a nested field path.
      // setDoc+merge would treat the dotted key as a literal top-level field.
      await updateDoc(ref, {
        [`addedBy.${me.uid}`]: serverTimestamp(),
        [`userInfo.${me.uid}`]: myInfo,
      });
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
    // Use updateDoc so `addedBy.<uid>` is parsed as a nested field path.
    // setDoc+merge would treat the dotted key as a literal top-level field.
    await updateDoc(ref, {
      [`addedBy.${me.uid}`]: serverTimestamp(),
      [`userInfo.${me.uid}`]: userInfoFromUser(me),
    });
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
