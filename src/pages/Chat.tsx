import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { markRead, sendMessage, subscribeMessages } from "../lib/chat";
import { acceptFriendship, otherUidOf } from "../lib/friends";
import {
  formatLastSeen,
  subscribePresence,
  type PresenceState,
} from "../lib/presence";
import { createTypingController, subscribeTyping } from "../lib/typing";
import { canSend, hasAccepted, type Friendship, type Message } from "../lib/types";
import {
  formatDateSeparator,
  formatTime,
  shouldShowDateSeparator,
} from "../lib/time";
import { Avatar } from "../components/Avatar";
import { Spinner } from "../components/Spinner";

const PAGE_SIZE = 30;

export function ChatPage() {
  const { pairId = "" } = useParams<{ pairId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [friendshipLoading, setFriendshipLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [msgLimit, setMsgLimit] = useState(PAGE_SIZE);
  const [reachedTop, setReachedTop] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherPresence, setOtherPresence] = useState<PresenceState | null>(null);
  const [otherIsTyping, setOtherIsTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const typingRef = useRef<ReturnType<typeof createTypingController> | null>(null);
  // When we bump msgLimit to load older, we record the scrollHeight BEFORE the
  // prepend fires so the next render can restore scrollTop such that the user
  // stays on the same visible message. Cleared after the adjustment applies.
  const pendingScrollAnchorRef = useRef<number | null>(null);
  const prevMessagesRef = useRef<Message[]>([]);

  // Subscribe to friendship doc to get other user info + validate access
  useEffect(() => {
    if (!pairId || !user) return;
    const unsub = onSnapshot(
      doc(db, "friendships", pairId),
      (snap) => {
        if (!snap.exists()) {
          setFriendship(null);
          setFriendshipLoading(false);
          return;
        }
        const data = snap.data() as Omit<Friendship, "id">;
        if (!data.users.includes(user.uid)) {
          setFriendship(null);
        } else {
          setFriendship({ id: snap.id, ...data } as Friendship);
        }
        setFriendshipLoading(false);
      },
      (err) => {
        console.error("friendship subscribe failed", err);
        setFriendship(null);
        setFriendshipLoading(false);
      },
    );
    return unsub;
  }, [pairId, user]);

  // Reset pagination state when the conversation changes.
  useEffect(() => {
    setMsgLimit(PAGE_SIZE);
    setReachedTop(false);
    setLoadingOlder(false);
    setMessages([]);
    setLoadingMessages(true);
    prevMessagesRef.current = [];
    pendingScrollAnchorRef.current = null;
  }, [pairId]);

  // Subscribe to messages. Re-subscribes whenever msgLimit grows so realtime
  // updates cover every visible message (important for read receipts).
  useEffect(() => {
    if (!pairId || !user || !friendship) return;
    const unsub = subscribeMessages(
      pairId,
      (items, top) => {
        setMessages(items);
        setReachedTop(top);
        setLoadingMessages(false);
        setLoadingOlder(false);
      },
      msgLimit,
    );
    return unsub;
  }, [pairId, user, friendship, msgLimit]);

  // Scroll management:
  //  - First-ever load for this conversation -> jump to bottom.
  //  - New message appended at the bottom -> scroll to bottom (follow).
  //  - Older messages prepended (msgLimit bumped) -> restore scroll offset so
  //    the message the user was looking at stays visually anchored.
  useLayoutEffect(() => {
    const prev = prevMessagesRef.current;
    const curr = messages;
    prevMessagesRef.current = curr;
    if (curr.length === 0) return;

    // Older messages prepended for pagination.
    if (pendingScrollAnchorRef.current != null) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight - pendingScrollAnchorRef.current;
      }
      pendingScrollAnchorRef.current = null;
      return;
    }

    // First paint for this conversation — jump to bottom without animation.
    if (prev.length === 0) {
      endRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }

    // New message appended at the bottom — follow it.
    const prevLastId = prev[prev.length - 1]?.id;
    const currLastId = curr[curr.length - 1]?.id;
    if (prevLastId !== currLastId) {
      endRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  // Typing bubble appears -> keep the view pinned to the bottom.
  useLayoutEffect(() => {
    if (otherIsTyping) endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [otherIsTyping]);

  // Scroll-up trigger for loading older messages.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (loadingOlder || reachedTop || loadingMessages) return;
    if (messages.length < msgLimit) return; // nothing more to load
    if (el.scrollTop <= 80) {
      pendingScrollAnchorRef.current = el.scrollHeight - el.scrollTop;
      setLoadingOlder(true);
      setMsgLimit((n) => n + PAGE_SIZE);
    }
  };

  // Mark unread messages as read
  useEffect(() => {
    if (!user || !pairId || messages.length === 0) return;
    const unread = messages
      .filter((m) => m.senderUid !== user.uid && !m.readBy?.[user.uid])
      .map((m) => m.id);
    if (unread.length > 0) {
      markRead(user.uid, pairId, unread).catch(() => {});
    }
  }, [messages, user, pairId]);

  const otherUid = useMemo(
    () => (friendship && user ? otherUidOf(friendship, user.uid) : null),
    [friendship, user],
  );
  const otherInfo = friendship && otherUid ? friendship.userInfo?.[otherUid] : null;
  const otherName = otherInfo?.displayName ?? otherInfo?.email ?? "เพื่อน";
  const otherIsAnon = !!otherInfo?.isAnonymous;
  const iCanSend = friendship && user ? canSend(friendship, user.uid) : false;
  const theyAccepted =
    friendship && otherUid ? hasAccepted(friendship, otherUid) : false;

  // Subscribe to other user's presence
  useEffect(() => {
    if (!otherUid) return;
    const unsub = subscribePresence(otherUid, setOtherPresence);
    return unsub;
  }, [otherUid]);

  // Subscribe to other user's typing state
  useEffect(() => {
    if (!pairId || !otherUid) return;
    const unsub = subscribeTyping(pairId, otherUid, setOtherIsTyping);
    return unsub;
  }, [pairId, otherUid]);

  // Create typing controller for me, clean up on unmount
  useEffect(() => {
    if (!pairId || !user) return;
    typingRef.current = createTypingController(pairId, user.uid);
    return () => {
      typingRef.current?.dispose();
      typingRef.current = null;
    };
  }, [pairId, user]);

  if (!user) return null;

  if (friendshipLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!friendship || !otherUid) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">ไม่พบห้องแชทนี้</p>
        <Link to="/" className="mt-4 text-brand-600 hover:underline dark:text-brand-500">
          กลับไปหน้าแชท
        </Link>
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    setError(null);
    const text = input;
    setInput("");
    typingRef.current?.stop();
    try {
      await sendMessage(user, otherUid, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งไม่สำเร็จ");
      setInput(text); // restore
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    if (value.trim()) {
      typingRef.current?.ping();
    } else {
      typingRef.current?.stop();
    }
  };

  const handleAccept = async () => {
    if (!pairId || !user || accepting) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptFriendship(user, pairId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "รับเพื่อนไม่สำเร็จ");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <header className="safe-top sticky top-0 z-10 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 px-2 py-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="ย้อนกลับ"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="relative">
            <Avatar name={otherName} photoURL={otherInfo?.photoURL} size={36} />
            {otherPresence?.state === "online" && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold">{otherName}</span>
              {otherIsAnon && <StatusChip tone="slate">anonymous</StatusChip>}
              {iCanSend && !theyAccepted && (
                <StatusChip tone="amber">ยังไม่ได้รับเพื่อน</StatusChip>
              )}
            </div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              {otherPresence?.state === "online"
                ? "ออนไลน์"
                : otherPresence?.lastChanged
                  ? `ออนไลน์ล่าสุด ${formatLastSeen(otherPresence.lastChanged)}`
                  : otherInfo?.email}
            </div>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {loadingMessages ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
            <p className="text-sm">ยังไม่มีข้อความ ทักทายกันได้เลย</p>
          </div>
        ) : (
          <>
            {loadingOlder ? (
              <div className="flex items-center justify-center py-2">
                <Spinner className="h-4 w-4 border-[1.5px]" />
              </div>
            ) : reachedTop ? (
              <div className="py-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
                จุดเริ่มต้นของการสนทนา
              </div>
            ) : null}
            <MessagesList messages={messages} myUid={user.uid} otherUid={otherUid} />
          </>
        )}
        {otherIsTyping && <TypingBubble />}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="px-4 pb-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </div>
      )}

      {iCanSend ? (
        <form
          onSubmit={handleSend}
          className="sticky bottom-0 border-t border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={handleInputChange}
              onBlur={() => typingRef.current?.stop()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as unknown as React.FormEvent);
                }
              }}
              rows={1}
              placeholder="พิมพ์ข้อความ..."
              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base outline-none ring-brand-500 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="ส่ง"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M3.4 20.3L21 12 3.4 3.7 3 10l12 2-12 2 .4 6.3z" />
              </svg>
            </button>
          </div>
        </form>
      ) : (
        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-center text-sm text-slate-600 dark:text-slate-400">
            {otherIsAnon
              ? `${otherName} ส่งข้อความมาแบบ anonymous — กดรับเพื่อนเพื่อตอบกลับ`
              : `${otherName} เพิ่มคุณเป็นเพื่อน — กดรับเพื่อนเพื่อตอบกลับ`}
          </p>
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting}
            className="w-full rounded-xl bg-brand-500 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
          >
            {accepting ? "กำลังรับ..." : "รับเพื่อน"}
          </button>
        </div>
      )}
    </div>
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

function MessagesList({
  messages,
  myUid,
  otherUid,
}: {
  messages: Message[];
  myUid: string;
  otherUid: string;
}) {
  return (
    <ul className="space-y-1">
      {messages.map((m, idx) => {
        const prev = idx > 0 ? messages[idx - 1] : undefined;
        const next = idx < messages.length - 1 ? messages[idx + 1] : undefined;
        const isMine = m.senderUid === myUid;
        const showDateSep = shouldShowDateSeparator(prev?.createdAt, m.createdAt);
        const sameAsNext = next?.senderUid === m.senderUid;
        const sameAsPrev = prev?.senderUid === m.senderUid && !showDateSep;
        const isLastFromMe = isMine && !sameAsNext;
        const readByOther = !!m.readBy?.[otherUid];

        return (
          <li key={m.id}>
            {showDateSep && (
              <div className="my-3 flex items-center justify-center">
                <span className="rounded-full bg-slate-200/70 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {formatDateSeparator(m.createdAt)}
                </span>
              </div>
            )}
            <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] break-words px-3.5 py-2 text-[15px] leading-relaxed shadow-sm ${
                  isMine
                    ? "bg-brand-500 text-white"
                    : "bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                } ${bubbleRadius(isMine, sameAsPrev, sameAsNext)}`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div
                  className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                    isMine ? "text-white/70 justify-end" : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  <span>{formatTime(m.createdAt)}</span>
                  {isLastFromMe && (
                    <span>{readByOther ? "อ่านแล้ว" : "ส่งแล้ว"}</span>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TypingBubble() {
  return (
    <div className="mt-1 flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <span className="h-2 w-2 animate-typing-dot rounded-full bg-slate-400 [animation-delay:0ms] dark:bg-slate-500" />
        <span className="h-2 w-2 animate-typing-dot rounded-full bg-slate-400 [animation-delay:150ms] dark:bg-slate-500" />
        <span className="h-2 w-2 animate-typing-dot rounded-full bg-slate-400 [animation-delay:300ms] dark:bg-slate-500" />
      </div>
    </div>
  );
}

function bubbleRadius(isMine: boolean, sameAsPrev: boolean, sameAsNext: boolean): string {
  // Group bubbles: tighten corners when previous/next message is from same sender.
  const base = "rounded-2xl";
  if (!sameAsPrev && !sameAsNext) return base;
  if (isMine) {
    if (sameAsPrev && sameAsNext) return "rounded-2xl rounded-r-md";
    if (sameAsPrev) return "rounded-2xl rounded-tr-md";
    return "rounded-2xl rounded-br-md";
  }
  if (sameAsPrev && sameAsNext) return "rounded-2xl rounded-l-md";
  if (sameAsPrev) return "rounded-2xl rounded-tl-md";
  return "rounded-2xl rounded-bl-md";
}
