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
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { initPresence } from "../lib/presence";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAnonymouslyWithNickname: (nickname: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function upsertUserDoc(user: User) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const fallbackName =
    user.displayName ??
    user.email?.split("@")[0] ??
    (user.isAnonymous ? "Anonymous" : "User");
  const baseData = {
    uid: user.uid,
    email: user.email ?? null,
    emailLower: user.email ? user.email.toLowerCase() : null,
    displayName: fallbackName,
    photoURL: user.photoURL ?? null,
    isAnonymous: user.isAnonymous,
    lastActiveAt: serverTimestamp(),
  };
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
      signInWithGoogle: async () => {
        // Google users stay logged in across browser restarts.
        await setPersistence(auth, browserLocalPersistence);
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
