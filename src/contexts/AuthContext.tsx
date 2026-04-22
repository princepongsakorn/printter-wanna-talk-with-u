import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { initPresence } from "../lib/presence";
import { isSyntheticEmail, resolveIdentifier } from "../lib/username";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: (keepLoggedIn?: boolean) => Promise<void>;
  signInAnonymouslyWithNickname: (nickname: string) => Promise<void>;
  /** `identifier` is email or username. */
  signInWithEmail: (
    identifier: string,
    password: string,
    keepLoggedIn?: boolean,
  ) => Promise<void>;
  /** `identifier` is email or username. `displayName` is optional — falls back to the username/email local-part. */
  signUpWithEmail: (
    identifier: string,
    password: string,
    displayName: string,
    keepLoggedIn?: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

function mapFirebaseAuthError(err: unknown): Error {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case "auth/invalid-email":
      return new Error("รูปแบบอีเมลไม่ถูกต้อง");
    case "auth/email-already-in-use":
      return new Error("อีเมล หรือ username นี้ถูกใช้ไปแล้ว");
    case "auth/weak-password":
      return new Error("รหัสผ่านสั้นเกินไป (ขั้นต่ำ 6 ตัวอักษร)");
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return new Error("อีเมล / username หรือรหัสผ่านไม่ถูกต้อง");
    case "auth/too-many-requests":
      return new Error("พยายามเข้าสู่ระบบถี่เกินไป ลองใหม่ในภายหลัง");
    case "auth/network-request-failed":
      return new Error("เชื่อมต่ออินเทอร์เน็ตล้มเหลว");
    default:
      return err instanceof Error ? err : new Error("เกิดข้อผิดพลาด");
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function upsertUserDoc(
  user: User,
  override?: { username?: string },
) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  // Hide synthetic emails (from username sign-ups) from friend lookup.
  // Real emails are stored lowercased in emailLower for case-insensitive search.
  const synthetic = isSyntheticEmail(user.email);
  const realEmail = synthetic ? null : user.email;

  // For synthetic emails the local-part IS the username; for real emails it's
  // the username-before-@. Either way it's a reasonable display fallback.
  const fallbackName =
    user.displayName ??
    user.email?.split("@")[0] ??
    (user.isAnonymous ? "Anonymous" : "User");

  const baseData: Record<string, unknown> = {
    uid: user.uid,
    email: realEmail ?? null,
    emailLower: realEmail ? realEmail.toLowerCase() : null,
    displayName: fallbackName,
    photoURL: user.photoURL ?? null,
    isAnonymous: user.isAnonymous,
    lastActiveAt: serverTimestamp(),
  };

  // Only write username fields when we explicitly have one (i.e., on sign-up).
  // Omitting them on merge preserves whatever was previously stored, so
  // username users don't get their username wiped on subsequent sign-ins.
  if (override?.username) {
    baseData.username = override.username;
    baseData.usernameLower = override.username.toLowerCase();
  }

  if (snap.exists()) {
    await setDoc(ref, baseData, { merge: true });
  } else {
    await setDoc(ref, { ...baseData, createdAt: serverTimestamp() });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Bump this after updateProfile so context consumers re-render and pick up
  // the mutated auth.currentUser fields (Firebase mutates in place).
  const [profileNonce, setProfileNonce] = useState(0);
  const presenceCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      setUser(u);
      setLoading(false);

      if (presenceCleanupRef.current) {
        presenceCleanupRef.current();
        presenceCleanupRef.current = null;
      }

      if (u) {
        try {
          await upsertUserDoc(u);
        } catch (err) {
          console.error("upsertUserDoc failed", err);
        }
        try {
          presenceCleanupRef.current = initPresence(u.uid);
        } catch (err) {
          console.warn("initPresence failed", err);
        }
      }
    });
    return () => {
      unsub();
      if (presenceCleanupRef.current) presenceCleanupRef.current();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signInWithGoogle: async (keepLoggedIn = true) => {
        // keepLoggedIn=true (default) -> persist across browser restarts.
        // keepLoggedIn=false -> session-only, cleared when tab closes.
        await setPersistence(
          auth,
          keepLoggedIn ? browserLocalPersistence : browserSessionPersistence,
        );
        await signInWithPopup(auth, googleProvider);
      },
      signInAnonymouslyWithNickname: async (nickname: string) => {
        const trimmed = nickname.trim();
        if (!trimmed) throw new Error("กรุณากรอกชื่อเล่น");
        if (trimmed.length > 30) throw new Error("ชื่อเล่นยาวเกินไป (สูงสุด 30 ตัวอักษร)");
        // Anonymous users: session only. Persistence clears when tab closes.
        await setPersistence(auth, browserSessionPersistence);
        await signInAnonymously(auth);
        if (!auth.currentUser) throw new Error("sign-in failed");
        await updateProfile(auth.currentUser, { displayName: trimmed });
        await upsertUserDoc(auth.currentUser);
        // updateProfile mutates auth.currentUser in place and does NOT fire
        // onAuthStateChanged — bump nonce so context consumers re-render.
        setProfileNonce((n) => n + 1);
      },
      signInWithEmail: async (
        identifier: string,
        password: string,
        keepLoggedIn = true,
      ) => {
        try {
          const { authEmail } = resolveIdentifier(identifier);
          await setPersistence(
            auth,
            keepLoggedIn ? browserLocalPersistence : browserSessionPersistence,
          );
          await signInWithEmailAndPassword(auth, authEmail, password);
        } catch (err) {
          throw mapFirebaseAuthError(err);
        }
      },
      signUpWithEmail: async (
        identifier: string,
        password: string,
        displayName: string,
        keepLoggedIn = true,
      ) => {
        try {
          const { authEmail, username } = resolveIdentifier(identifier);
          // displayName is optional for username sign-ups — fall back to the
          // username so the user always has something to show.
          const trimmedName = displayName.trim();
          const finalName = trimmedName || username || "";
          if (!finalName) throw new Error("กรุณากรอกชื่อที่แสดง");
          if (finalName.length > 30)
            throw new Error("ชื่อที่แสดงยาวเกินไป (สูงสุด 30 ตัวอักษร)");

          await setPersistence(
            auth,
            keepLoggedIn ? browserLocalPersistence : browserSessionPersistence,
          );
          await createUserWithEmailAndPassword(auth, authEmail, password);
          if (!auth.currentUser) throw new Error("sign-up failed");
          await updateProfile(auth.currentUser, { displayName: finalName });
          await upsertUserDoc(auth.currentUser, { username: username ?? undefined });
          // updateProfile mutates auth.currentUser in place and does NOT fire
          // onAuthStateChanged — bump nonce so context consumers re-render.
          setProfileNonce((n) => n + 1);
        } catch (err) {
          throw mapFirebaseAuthError(err);
        }
      },
      logout: async () => {
        // Flush presence to 'offline' before we lose auth (RTDB rules require auth).
        if (presenceCleanupRef.current) {
          presenceCleanupRef.current();
          presenceCleanupRef.current = null;
        }
        await signOut(auth);
      },
    }),
    [user, loading, profileNonce],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
