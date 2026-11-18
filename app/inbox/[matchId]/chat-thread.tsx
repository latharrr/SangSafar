"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dayLabel } from "@/lib/format";

export type Message = { id: string; sender_id: string; body: string; created_at: string; client_id: string };
type Outbox = { client_id: string; body: string; failed?: string };

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

export function ChatThread({ matchId, me, otherName, initial }: { matchId: string; me: string; otherName: string; initial: Message[] }) {
  const [supabase] = useState(createClient);
  const [messages, setMessages] = useState(initial);
  const [outbox, setOutbox] = useState<Outbox[]>([]);
  const [draft, setDraft] = useState("");
  const [closed, setClosed] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const merge = (m: Message) =>
    setMessages((list) => (list.some((x) => x.client_id === m.client_id) ? list : [...list, m].sort((a, b) => a.created_at.localeCompare(b.created_at))));

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, (p) => {
        const m = p.new as Message;
        merge(m);
        setOutbox((o) => o.filter((x) => x.client_id !== m.client_id));
      })
      .subscribe(async (status) => {
        // Fill any gap between the server render and the subscription going live.
        if (status !== "SUBSCRIBED") return;
        const { data } = await supabase.from("messages").select("id, sender_id, body, created_at, client_id").eq("match_id", matchId).order("created_at");
        data?.forEach((m) => merge(m as Message));
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, supabase]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, outbox.length]);

  async function send(item: Outbox) {
    setOutbox((o) => [...o.filter((x) => x.client_id !== item.client_id), { ...item, failed: undefined }]);
    // client_id is the idempotency key: a retry after a lost response can't duplicate.
    const { data, error } = await supabase
      .from("messages")
      .insert({ match_id: matchId, body: item.body, client_id: item.client_id })
      .select("id, sender_id, body, created_at, client_id")
      .maybeSingle();
    if (error && error.code !== "23505") {
      const revoked = error.code === "42501";
      if (revoked) setClosed(true);
      setOutbox((o) => o.map((x) => (x.client_id === item.client_id ? { ...x, failed: revoked ? "Chat closed. Not delivered." : "Not sent." } : x)));
      return;
    }
    if (data) merge(data as Message);
    setOutbox((o) => o.filter((x) => x.client_id !== item.client_id));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    send({ client_id: crypto.randomUUID(), body: body.slice(0, 2000) });
  }

  return (
    <>
      <ol className="flex flex-1 flex-col gap-2 py-6" aria-live="polite" aria-label="Messages">
        {messages.length === 0 && outbox.length === 0 && (
          <li className="my-auto text-center text-small text-ink-soft">Say hi to {otherName}. Sort out where to meet and when.</li>
        )}
        {messages.map((m, i) => {
          const day = localDay(m.created_at);
          const sep = i === 0 || localDay(messages[i - 1].created_at) !== day;
          const mine = m.sender_id === me;
          return (
            <li key={m.id} className="contents">
              {sep && (
                <div className="my-3 flex items-center gap-3 text-micro text-ink-soft" role="separator">
                  <span className="h-px flex-1 bg-line" />
                  <time className="tnum" dateTime={day}>
                    {dayLabel(day)}
                  </time>
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <div className={`flex max-w-[85%] flex-col ${mine ? "items-end self-end" : "items-start self-start"}`}>
                <p className={`rounded-sheet px-3 py-2 text-body break-words whitespace-pre-wrap ${mine ? "bg-ink text-paper" : "sheet text-ink"}`}>
                  <span className="sr-only">{mine ? "You" : otherName}: </span>
                  {m.body}
                </p>
                <time className="tnum mt-1 text-micro text-ink-soft" dateTime={m.created_at}>
                  {time(m.created_at)}
                </time>
              </div>
            </li>
          );
        })}
        {outbox.map((o) => (
          <li key={o.client_id} className="flex max-w-[85%] flex-col items-end self-end">
            <p className={`rounded-sheet px-3 py-2 text-body break-words whitespace-pre-wrap ${o.failed ? "border border-warn bg-raised text-ink" : "bg-ink/70 text-paper"}`}>
              {o.body}
            </p>
            {o.failed ? (
              <span className="mt-1 flex items-center gap-2 text-micro text-warn" role="alert">
                {o.failed}
                {!closed && (
                  <button type="button" className="underline" onClick={() => send(o)}>
                    Retry
                  </button>
                )}
              </span>
            ) : (
              <span className="mt-1 text-micro text-ink-soft">Sending…</span>
            )}
          </li>
        ))}
        {/* scroll target clears the sticky composer so the newest message is never hidden under it */}
        <div ref={end} className="scroll-mb-32" />
      </ol>

      {closed ? (
        <p role="status" className="border-t border-line py-4 text-body text-ink-soft">
          This chat is no longer open.
        </p>
      ) : (
        <form onSubmit={submit} className="sticky bottom-0 flex items-end gap-2 border-t border-line bg-paper pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
          <label htmlFor="composer" className="sr-only">
            Message {otherName}
          </label>
          <textarea
            id="composer"
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            placeholder={`Message ${otherName}`}
            className="field max-h-40 min-h-11 flex-1 resize-none py-2"
          />
          <button className="btn btn-primary" disabled={!draft.trim()}>
            Send
          </button>
        </form>
      )}
      <p className="pb-2 text-micro text-ink-soft">
        Phone numbers stay private unless you choose to share yours here.
      </p>
    </>
  );
}
