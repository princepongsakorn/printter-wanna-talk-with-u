import type { Timestamp } from "firebase/firestore";

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  emailLower: string | null;
  isAnonymous: boolean;
  createdAt: Timestamp;
  lastActiveAt?: Timestamp;
};

export type FriendshipUserInfo = {
  displayName: string;
  photoURL: string | null;
  email: string | null;
  isAnonymous?: boolean;
};

export type Friendship = {
  id: string; // pairId = [uidA, uidB].sort().join("_")
  users: [string, string];
  userInfo: Record<string, FriendshipUserInfo>;
  /**
   * Map of uid -> when that user added the other as a friend.
   * - Value is a Timestamp if the user has added/accepted.
   * - Value is null (or the entry is missing) if they haven't.
   * - Entire `addedBy` field missing = legacy doc, treated as "both accepted".
   *
   * `canSend(friendship, uid)` = addedBy[uid] is a Timestamp.
   */
  addedBy?: Record<string, Timestamp | null>;
  lastMessage?: {
    text: string;
    senderUid: string;
    createdAt: Timestamp;
  };
  createdAt: Timestamp;
};

export type Message = {
  id: string;
  senderUid: string;
  text: string;
  createdAt: Timestamp;
  readBy: Record<string, Timestamp>;
};

export function pairIdOf(a: string, b: string): string {
  return [a, b].sort().join("_");
}

/** True if `uid` has added the other user as friend (i.e. is allowed to send messages). */
export function canSend(friendship: Friendship, uid: string): boolean {
  // Legacy doc without addedBy field -> treated as both accepted.
  if (!friendship.addedBy) return true;
  return friendship.addedBy[uid] != null;
}

/** Alias — semantically "has accepted the friendship". */
export function hasAccepted(friendship: Friendship, uid: string): boolean {
  return canSend(friendship, uid);
}
