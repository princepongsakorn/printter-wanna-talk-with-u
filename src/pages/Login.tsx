import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from "../components/Spinner";

export function LoginPage() {
  const { user, loading, signInWithGoogle, signInAnonymouslyWithNickname } = useAuth();
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [submittingAnon, setSubmittingAnon] = useState(false);
  const [nickname, setNickname] = useState("");
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
      await signInWithGoogle();
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

  const submitting = submittingGoogle || submittingAnon;

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
