import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Avatar } from "../components/Avatar";
import { Spinner } from "../components/Spinner";
import { ThemeToggle } from "../components/ThemeToggle";
import {
  FriendError,
  addFriend,
  otherUidOf,
  subscribeFriendships,
} from "../lib/friends";
import { subscribePresence, type PresenceState } from "../lib/presence";
import { canSend, hasAccepted, type Friendship } from "../lib/types";
import { formatChatListTimestamp } from "../lib/time";
import { isSyntheticEmail, usernameFromSyntheticEmail } from "../lib/username";

type Tab = "chats" | "add";

export function FriendsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("chats");
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeFriendships(user.uid, (items) => {
      setFriendships(items);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <header className="safe-top sticky top-0 z-10 border-b border-slate-100 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.displayName ?? user.email ?? "me"} photoURL={user.photoURL} size={36} />
            <div className="leading-tight">
              <div className="text-sm font-semibold">{user.displayName ?? "คุณ"}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isSyntheticEmail(user.email)
                  ? `@${usernameFromSyntheticEmail(user.email)}`
                  : (user.email ?? "anonymous")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
        <nav className="flex gap-1 px-2">
          <TabButton active={tab === "chats"} onClick={() => setTab("chats")}>
            แชท
          </TabButton>
          <TabButton active={tab === "add"} onClick={() => setTab("add")}>
            เพิ่มเพื่อน
          </TabButton>
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : tab === "chats" ? (
          <ChatList friendships={friendships} myUid={user.uid} />
        ) : (
          <AddFriendForm
            onAdded={(pairId) => {
              setTab("chats");
              navigate(`/chat/${pairId}`);
            }}
          />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "text-brand-600 dark:text-brand-500"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      <span>{children}</span>
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-500" />
      )}
    </button>
  );
}

function ChatList({ friendships, myUid }: { friendships: Friendship[]; myUid: string }) {
  if (friendships.length === 0) {
    return (
      <EmptyState
        title="ยังไม่มีแชท"
        description="เพิ่มเพื่อนด้วยอีเมลแล้วเริ่มคุยกันได้เลย"
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {friendships.map((f) => (
        <ChatListRow key={f.id} friendship={f} myUid={myUid} />
      ))}
    </ul>
  );
}

function ChatListRow({ friendship, myUid }: { friendship: Friendship; myUid: string }) {
  const otherUid = otherUidOf(friendship, myUid);
  const other = friendship.userInfo?.[otherUid];
  const name = other?.displayName ?? other?.email ?? "เพื่อน";
  const isMine = friendship.lastMessage?.senderUid === myUid;
  const preview = friendship.lastMessage?.text
    ? (isMine ? "คุณ: " : "") + friendship.lastMessage.text
    : "เริ่มคุยกันเลย";

  const [presence, setPresence] = useState<PresenceState | null>(null);
  useEffect(() => {
    const unsub = subscribePresence(otherUid, setPresence);
    return unsub;
  }, [otherUid]);

  // Friendship status badges (Phase 3 will polish; minimal hints here).
  const iCanSend = canSend(friendship, myUid);
  const theyAccepted = hasAccepted(friendship, otherUid);
  const isAnon = !!other?.isAnonymous;

  return (
    <li>
      <Link
        to={`/chat/${friendship.id}`}
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60 dark:active:bg-slate-800"
      >
        <div className="relative">
          <Avatar name={name} photoURL={other?.photoURL} size={48} />
          {presence?.state === "online" && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{name}</span>
            <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
              {formatChatListTimestamp(
                friendship.lastMessage?.createdAt ?? friendship.createdAt,
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="truncate text-sm text-slate-500 dark:text-slate-400">{preview}</div>
            {isAnon && <StatusChip tone="slate">anonymous</StatusChip>}
            {iCanSend && !theyAccepted && (
              <StatusChip tone="amber">ยังไม่ได้รับเพื่อน</StatusChip>
            )}
            {!iCanSend && theyAccepted && (
              <StatusChip tone="rose">ไม่ได้เป็นเพื่อน</StatusChip>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "slate" | "amber" | "rose";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800"
      : tone === "rose"
        ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800"
        : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${toneClass}`}
    >
      {children}
    </span>
  );
}

function AddFriendForm({ onAdded }: { onAdded: (pairId: string) => void }) {
  const { user } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const pairId = await addFriend(user, identifier);
      setIdentifier("");
      setMessage({ kind: "ok", text: "เพิ่มเพื่อนแล้ว เริ่มคุยได้เลย" });
      onAdded(pairId);
    } catch (err) {
      const text =
        err instanceof FriendError
          ? err.message
          : err instanceof Error
            ? err.message
            : "เกิดข้อผิดพลาด";
      setMessage({ kind: "err", text });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
        <label htmlFor="friend-identifier" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          อีเมล หรือ username ของเพื่อน
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          อีกฝ่ายต้องลงทะเบียนในระบบแล้ว (Google / อีเมล / username / anonymous)
          กดเพิ่มแล้วคุณส่งข้อความได้ทันทีโดยไม่ต้องรออีกฝ่ายตอบรับ
        </p>
        <input
          id="friend-identifier"
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="someone@gmail.com หรือ username"
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-brand-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={submitting || !identifier}
          className="mt-3 w-full rounded-xl bg-brand-500 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? "กำลังเพิ่ม..." : "เพิ่มเพื่อน"}
        </button>
        {message && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              message.kind === "ok"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
            }`}
            role="status"
          >
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden>
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2V6z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}
