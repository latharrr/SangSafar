import type { Metadata } from "next";
import Link from "next/link";
import { cancelRequest, respondToRequest } from "@/app/actions/requests";
import { ActionForm } from "@/components/action-form";
import { VerifiedBadge } from "@/components/badges";
import { RouteMini } from "@/components/route-line";
import { SafetyMenu } from "@/components/safety-menu";
import { TimeRuler } from "@/components/time-ruler";
import { dayLabel, relativeHours, yearLabel } from "@/lib/format";
import { requireViewer } from "@/lib/session";
import { ChatList } from "./chat-list";
import { getInbox, isChat, nameOf, type InboxRow } from "./data";

export const metadata: Metadata = { title: "Inbox" };

const TABS = [
  { id: "chats", label: "Chats" },
  { id: "incoming", label: "Requests in" },
  { id: "outgoing", label: "Sent" },
] as const;

const STATE_COPY: Record<string, string> = {
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
  closed: "Closed",
};

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireViewer("/inbox");
  const pendingCollege = viewer.college.status !== "active";
  const [{ tab: tabParam }, { rows, error }] = await Promise.all([searchParams, getInbox()]);
  const incoming = rows.filter((r) => r.direction === "incoming" && r.status === "pending");
  const outgoing = rows.filter((r) => r.direction === "outgoing" && !isChat(r));
  const chats = rows.filter(isChat);
  const tab = TABS.some((t) => t.id === tabParam) ? tabParam : incoming.length ? "incoming" : "chats";
  const count = { chats: chats.length, incoming: incoming.length, outgoing: outgoing.filter((r) => r.status === "pending").length };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h1 font-bold md:text-h1-lg">Inbox</h1>
      <nav aria-label="Inbox sections" className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link key={t.id} href={`/inbox?tab=${t.id}`} className="chip shrink-0" aria-current={tab === t.id ? "page" : undefined}>
            {t.label}
            {count[t.id] > 0 && <span className="tnum">{count[t.id]}</span>}
          </Link>
        ))}
      </nav>

      {error && (
        <p role="alert" className="mt-8 text-body">
          Couldn&apos;t load your inbox. Reload to try again.
        </p>
      )}

      {tab === "chats" &&
        (chats.length ? (
          <ChatList rows={chats} />
        ) : (
          <Empty text="No chats yet. A chat opens when someone accepts your request, or you accept theirs." />
        ))}

      {tab === "incoming" &&
        (incoming.length ? (
          <ul className="mt-6 border-t border-line">
            {incoming.map((r) => (
              <Incoming key={r.match_id} r={r} pendingCollege={pendingCollege} />
            ))}
          </ul>
        ) : (
          <Empty text="No requests waiting. When someone asks to travel with you, it shows up here." />
        ))}

      {tab === "outgoing" &&
        (outgoing.length ? (
          <ul className="mt-6 border-t border-line">
            {outgoing.map((r) => (
              <li key={r.match_id} className="flex flex-wrap items-center gap-4 border-b border-line py-4">
                <RouteMini mode={r.mode} state={r.status === "pending" ? "active" : "resting"} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{nameOf(r)}</p>
                  <p className="tnum text-small text-ink-soft">
                    {r.from_hub} to {r.to_hub} · {dayLabel(r.travel_date)}
                  </p>
                </div>
                {r.status === "pending" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tnum text-small text-ink-soft">Waiting · {relativeHours(r.expires_at)}</span>
                    <ActionForm action={cancelRequest} fields={{ matchId: r.match_id }} label="Cancel" className="btn btn-ghost" />
                  </div>
                ) : (
                  <span className="text-small text-ink-soft">{STATE_COPY[r.status] ?? r.status}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="You haven't sent any requests. Open one of your trips to see who's going your way." />
        ))}
    </div>
  );
}

function Incoming({ r, pendingCollege }: { r: InboxRow; pendingCollege: boolean }) {
  const name = nameOf(r);
  return (
    <li className="border-b border-line py-6">
      <div className="flex items-start gap-3">
        <RouteMini mode={r.mode} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            <span className="break-words">{name}</span>
            {r.other_year && <span className="font-normal text-ink-soft"> · {yearLabel(r.other_year)}</span>}
          </p>
          <VerifiedBadge idChecked={r.other_id_checked} pendingCollege={pendingCollege} />
          <p className="tnum mt-1 text-small text-ink-soft">
            {r.from_point ?? r.from_hub} to {r.to_point ?? r.to_hub} · {dayLabel(r.travel_date)} · {relativeHours(r.expires_at)}
          </p>
        </div>
        {r.other_user_id && <SafetyMenu userId={r.other_user_id} name={name} context={`match:${r.match_id}`} after="/inbox" />}
      </div>
      {r.their_start && r.their_end && (
        <div className="mt-4">
          <TimeRuler
            mine={r.my_start && r.my_end ? { start: r.my_start, end: r.my_end } : null}
            theirs={{ start: r.their_start, end: r.their_end }}
            theirName={name}
          />
        </div>
      )}
      <p className="mt-4 text-small text-ink-soft">
        Accepting opens a chat and shows each of you the other&apos;s train or flight number, meetup point and notes.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionForm action={respondToRequest} fields={{ matchId: r.match_id, accept: "1" }} label="Accept" pendingLabel="Accepting…" className="btn btn-trust" />
        <ActionForm action={respondToRequest} fields={{ matchId: r.match_id, accept: "0" }} label="Decline" pendingLabel="Declining…" className="btn btn-ghost" />
      </div>
    </li>
  );
}

const Empty = ({ text }: { text: string }) => <p className="mt-8 max-w-[60ch] text-body text-ink-soft">{text}</p>;
