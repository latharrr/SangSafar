import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmTravelled } from "@/app/actions/requests";
import { ActionForm } from "@/components/action-form";
import { TravelledBadge } from "@/components/badges";
import { BackIcon } from "@/components/icons";
import { SafetyMenu } from "@/components/safety-menu";
import { dayLabel } from "@/lib/format";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ChatList } from "../chat-list";
import { CLOSED_COPY, getInbox, isChat, nameOf } from "../data";
import { ChatThread, type Message } from "./chat-thread";
import { DetailsSheet, type DetailRow } from "./details-sheet";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const viewer = await requireViewer(`/inbox/${matchId}`);
  const { rows } = await getInbox();
  const r = rows.find((x) => x.match_id === matchId);
  if (!r) notFound();
  const name = nameOf(r);
  const open = r.status === "accepted";

  // Both reads are empty unless the chat is open (RLS + match_details check it).
  const supabase = await createClient();
  const [{ data: details }, { data: messages }] = open
    ? await Promise.all([
        supabase.rpc("match_details", { p_match: matchId }),
        supabase.from("messages").select("id, sender_id, body, created_at, client_id").eq("match_id", matchId).order("created_at").limit(500),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="grid gap-8 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden md:block" aria-label="Conversations">
        <h1 className="text-h2 font-semibold">Chats</h1>
        <ChatList rows={rows.filter(isChat)} activeId={matchId} />
      </aside>

      <section className="flex min-h-[calc(100dvh-8rem)] flex-col" aria-label={`Chat with ${name}`}>
        <header className="flex items-center gap-2 border-b border-line pb-3">
          <Link href="/inbox?tab=chats" className="btn btn-ghost -ml-3 w-11 px-0 md:hidden" aria-label="Back to inbox">
            <BackIcon />
          </Link>
          <div className="min-w-0 flex-1">
            <h2 className={`truncate text-h2 font-semibold ${r.other_first_name ? "" : "text-ink-soft"}`}>{name}</h2>
            <p className="tnum truncate text-small text-ink-soft">
              {r.from_hub} to {r.to_hub} · {dayLabel(r.travel_date)}
            </p>
          </div>
          {r.other_user_id && <SafetyMenu userId={r.other_user_id} name={name} context={`match:${matchId}`} after="/inbox?tab=chats" />}
        </header>

        {open ? (
          <>
            <DetailsSheet matchId={matchId} rows={(details ?? []) as DetailRow[]} />
            {(r.can_confirm || r.me_confirmed) && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-line pb-4">
                {r.me_confirmed && r.them_confirmed ? (
                  <TravelledBadge />
                ) : r.me_confirmed ? (
                  <p className="text-small text-ink-soft">You confirmed. Waiting for {name} to confirm too.</p>
                ) : (
                  <>
                    <p className="text-small">Did you and {name} travel together?</p>
                    <ActionForm action={confirmTravelled} fields={{ matchId }} label="Yes, we travelled together" className="btn btn-quiet" />
                  </>
                )}
              </div>
            )}
            <ChatThread matchId={matchId} me={viewer.id} otherName={name} initial={(messages ?? []) as Message[]} />
          </>
        ) : (
          <p className="mt-8 max-w-[60ch] text-body text-ink-soft" role="status">
            {(r.closed_reason && CLOSED_COPY[r.closed_reason]) ??
              (r.status === "pending" ? "This chat opens once the request is accepted." : "This chat is closed.")}
          </p>
        )}
      </section>
    </div>
  );
}
