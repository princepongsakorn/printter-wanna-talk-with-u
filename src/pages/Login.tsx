import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from "../components/Spinner";

type EmailMode = "signin" | "signup";

export function LoginPage() {
  const {
    user,
    loading,
    signInWithGoogle,
    signInAnonymouslyWithNickname,
    signInWithEmail,
    signUpWithEmail,
  } = useAuth();
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [submittingAnon, setSubmittingAnon] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [nickname, setNickname] = useState("");
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation() as { state?: { from?: { pathname?: string } } };

  useEffect(() => {
    setError(null);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (user) {
    const to = location.state?.from?.pathname ?? "/";
    return <Navigate to={to} replace />;
  }

  const handleGoogleSignIn = async () => {
    setSubmittingGoogle(true);
    setError(null);
    try {
      await signInWithGoogle(keepLoggedIn);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmittingGoogle(false);
    }
  };

  const handleAnonSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAnon(true);
    setError(null);
    try {
      await signInAnonymouslyWithNickname(nickname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เข้าใช้งานไม่สำเร็จ");
    } finally {
      setSubmittingAnon(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEmail(true);
    setError(null);
    try {
      if (emailMode === "signup") {
        await signUpWithEmail(email, password, displayName, keepLoggedIn);
      } else {
        await signInWithEmail(email, password, keepLoggedIn);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สำเร็จ");
    } finally {
      setSubmittingEmail(false);
    }
  };

  const submitting = submittingGoogle || submittingAnon || submittingEmail;

  return (
    <div className="flex min-h-full items-center justify-center p-6 safe-top safe-bottom">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2V6z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">ยินดีต้อนรับ</h1>
          <p className="mt-1 text-sm text-slate-500">เลือกวิธีเข้าใช้งาน</p>
        </div>

        <label className="mb-4 flex select-none items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
          <input
            type="checkbox"
            checked={keepLoggedIn}
            onChange={(e) => setKeepLoggedIn(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
          <span className="flex-1 text-sm text-slate-700">
            ให้ระบบจำการเข้าสู่ระบบ
          </span>
          <span className="text-[11px] text-slate-400">
            {keepLoggedIn ? "อยู่ข้ามการปิด tab" : "หายเมื่อปิด tab"}
          </span>
        </label>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60"
        >
          <GoogleIcon className="h-5 w-5" />
          <span>
            {submittingGoogle ? "กำลังเข้าสู่ระบบ..." : "ดำเนินการต่อด้วย Google"}
          </span>
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>หรือ</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="mb-3 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setEmailMode("signin");
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              emailMode === "signin"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => {
              setEmailMode("signup");
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              emailMode === "signup"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            สมัครสมาชิก
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-2">
          <input
            type="text"
            inputMode="email"
            autoComplete={emailMode === "signup" ? "username" : "username"}
            autoCapitalize="none"
            autoCorrect="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมล หรือ username"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-brand-500 focus:ring-2"
          />
          <input
            type="password"
            autoComplete={emailMode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-brand-500 focus:ring-2"
          />
          {emailMode === "signup" && (
            <input
              type="text"
              maxLength={30}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ชื่อที่แสดง (ไม่ใส่ก็ได้ ระบบจะใช้ username)"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-brand-500 focus:ring-2"
            />
          )}
          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full rounded-xl bg-brand-500 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
          >
            {submittingEmail
              ? emailMode === "signup"
                ? "กำลังสมัคร..."
                : "กำลังเข้าสู่ระบบ..."
              : emailMode === "signup"
                ? "สมัครสมาชิก"
                : "เข้าสู่ระบบ"}
          </button>
          {emailMode === "signup" && (
            <p className="pt-1 text-[11px] text-slate-400">
              username: a-z, 0-9, _ . - ความยาว 3–20 ตัว (หรือจะใช้อีเมลก็ได้)
            </p>
          )}
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>หรือ</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleAnonSignIn} className="space-y-2">
          <label htmlFor="nickname" className="block text-sm font-medium text-slate-700">
            เข้าใช้แบบชั่วคราว
          </label>
          <input
            id="nickname"
            type="text"
            required
            maxLength={30}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="ตั้งชื่อเล่น"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-brand-500 focus:ring-2"
          />
          <button
            type="submit"
            disabled={submitting || !nickname.trim()}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
          >
            {submittingAnon ? "กำลังเข้าใช้..." : "เข้าใช้โดยไม่ต้องล็อกอิน"}
          </button>
          <p className="text-xs text-slate-400">
            session จะหายเมื่อปิด tab — เหมาะสำหรับการใช้งานชั่วคราว
          </p>
        </form>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
