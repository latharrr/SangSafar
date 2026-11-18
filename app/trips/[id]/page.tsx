import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { deleteTrip, setTripStatus } from "@/app/actions/trips";
import { ActionForm } from "@/components/action-form";
import { VerifiedBadge } from "@/components/badges";
import { ConnectButton } from "@/components/connect-button";
import { CopyLink } from "@/components/copy-link";
import { RouteLine, RouteMini } from "@/components/route-line";
import { SafetyMenu } from "@/components/safety-menu";
import { TimeRuler } from "@/components/time-ruler";
import type { MyTrip } from "@/components/trip-row";
import { SITE_URL, type Mode } from "@/lib/config";
import { dayLabel, MODE_LABEL, windowLabel, yearLabel } from "@/lib/format";
import { rankCandidates, rankReason, type TripShape } from "@/lib/matching";
import { track } from "@/lib/notify";
import { requireViewer, womenOnlyAccess, type Viewer } from "@/lib/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trip" };

type Cand = {
  trip_id: string;
  owner_id: string;
  first_name: string;
  year: number | null;
  college_name: string;
  id_checked: boolean;
  mode: Mode;
  from_point: string | null;
  to_point: string | null;
  travel_date: string;
  depart_start: string;
  depart_end: string;
  same_vehicle: boolean;
  same_college: boolean;
  match_id: string | null;
  match_status: string | null;
  i_requested: boolean | null;
  women_only: boolean;
};

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ posted?: string; mode?: string; women?: string }>;
}) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const viewer = await requireViewer(`/trips/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_trips");
  const trip = ((data ?? []) as MyTrip[]).find((t) => t.id === id);
  if (!trip) notFound();
  const shareUrl = `${SITE_URL}/s/${trip.share_token}`;

  if (q.posted) {
    // Signature moment: the line draws once, the share link is the one primary action.
    return (
      <section className="mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center py-10">
        <RouteLine from={trip.from_hub} to={trip.to_hub} mode={trip.mode} fromDetail={trip.from_point} toDetail={trip.to_point} draw />
        <h1 className="mt-10 text-h1 font-bold md:text-h1-lg">Your trip is live</h1>
        <p className="tnum mt-2 text-body text-ink-soft">
          {dayLabel(trip.travel_date, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
          {windowLabel(trip.depart_start, trip.depart_end)} · {MODE_LABEL[trip.mode]}
        </p>
        <p className="mt-6 text-body">
          Post the link in your WhatsApp groups. People outside your college see only the route, date and mode, never your name.
        </p>
        <div className="mt-4">
          <CopyLink url={shareUrl} primary />
        </div>
        <Link href={`/trips/${trip.id}`} className="mt-6 self-start text-body font-medium underline">
          See who&apos;s going your way
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <TripSummary trip={trip} shareUrl={shareUrl} />
      </aside>
      <section aria-labelledby="matches-title">
        {trip.status === "live" ? (
          <Matches viewer={viewer} trip={trip} q={q} />
        ) : (
          <p className="text-body text-ink-soft">
            {trip.status === "draft"
              ? "This trip is hidden, so it isn't matched and its share link is off. Show it again to see matches."
              : "This trip has passed. Confirm who you travelled with from your inbox."}
          </p>
        )}
      </section>
    </div>
  );
}

function TripSummary({ trip, shareUrl }: { trip: MyTrip; shareUrl: string }) {
  return (
    <div>
      <RouteLine from={trip.from_hub} to={trip.to_hub} mode={trip.mode} fromDetail={trip.from_point} toDetail={trip.to_point} small />
      <p className="tnum mt-4 text-body">
        {dayLabel(trip.travel_date, { weekday: "long", day: "numeric", month: "long" })}
        <br />
        <span className="text-ink-soft">
          Leaving {windowLabel(trip.depart_start, trip.depart_end)} by {MODE_LABEL[trip.mode].toLowerCase()}
          {trip.women_only && " · women-only comfort filter on"}
        </span>
      </p>
      {(trip.vehicle_no || trip.meetup_point || trip.notes) && (
        <dl className="mt-6 grid gap-2 border-t border-line pt-4 text-small">
          <p className="text-micro text-ink-soft">Private until you both accept</p>
          {trip.vehicle_no && <Detail k={trip.mode === "flight" ? "Flight" : "Train"} v={trip.vehicle_no} />}
          {trip.meetup_point && <Detail k="Meetup" v={trip.meetup_point} />}
          {trip.notes && <Detail k="Notes" v={trip.notes} />}
        </dl>
      )}
      {trip.status === "live" && (
        <div className="mt-6 border-t border-line pt-4">
          <CopyLink url={shareUrl} />
        </div>
      )}
      {trip.status !== "archived" && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
          <Link href={`/trips/${trip.id}/edit`} className="btn btn-quiet">
            Edit
          </Link>
          <ActionForm
            action={setTripStatus}
            fields={{ tripId: trip.id, status: trip.status === "live" ? "draft" : "live" }}
            label={trip.status === "live" ? "Hide" : "Show again"}
          />
          <ActionForm
            action={deleteTrip}
            fields={{ tripId: trip.id }}
            label="Delete"
            className="btn btn-ghost text-warn"
            confirm={{
              title: "Delete this trip?",
              body: "The trip and its private details are deleted. Open requests are cancelled and chats about it close. This can't be undone.",
              confirmLabel: "Delete trip",
            }}
          />
        </div>
      )}
    </div>
  );
}

const Detail = ({ k, v }: { k: string; v: string }) => (
  <div className="grid grid-cols-[72px_1fr] gap-2">
    <dt className="text-ink-soft">{k}</dt>
    <dd className="break-words">{v}</dd>
  </div>
);

async function Matches({ viewer, trip, q }: { viewer: Viewer; trip: MyTrip; q: { mode?: string; women?: string } }) {
  // Service role, after ownership is established above (my_trips is owner-scoped).
  const { data, error } = await createAdminClient().rpc("match_candidates", { p_viewer: viewer.id, p_trip: trip.id });
  const mine: TripShape = {
    id: trip.id,
    ownerId: viewer.id,
    travelDate: trip.travel_date,
    fromHub: trip.from_hub,
    fromPoint: trip.from_point,
    toHub: trip.to_hub,
    toPoint: trip.to_point,
    start: trip.depart_start,
    end: trip.depart_end,
  };
  const ranked = rankCandidates(
    mine,
    ((data ?? []) as Cand[]).map((c) => ({
      ...c,
      id: c.trip_id,
      ownerId: c.owner_id,
      travelDate: c.travel_date,
      fromHub: trip.from_hub,
      fromPoint: c.from_point,
      toHub: trip.to_hub,
      toPoint: c.to_point,
      start: c.depart_start,
      end: c.depart_end,
      sameVehicle: c.same_vehicle,
      sameCollege: c.same_college,
    })),
  );
  // Rows are built from whitelisted fields only, so same_vehicle never reaches the browser.
  const rows = ranked.map((c) => ({
    trip_id: c.trip_id,
    owner_id: c.owner_id,
    first_name: c.first_name,
    year: c.year,
    college_name: c.college_name,
    id_checked: c.id_checked,
    mode: c.mode,
    from_point: c.from_point,
    to_point: c.to_point,
    travel_date: c.travel_date,
    depart_start: c.depart_start,
    depart_end: c.depart_end,
    match_id: c.match_id,
    match_status: c.match_status,
    i_requested: c.i_requested,
    women_only: c.women_only,
    // rankReason input (route + window only)
    ...{ id: c.id, ownerId: c.ownerId, travelDate: c.travelDate, fromHub: c.fromHub, fromPoint: c.fromPoint, toHub: c.toHub, toPoint: c.toPoint, start: c.start, end: c.end },
  }));
  if (rows.length) after(() => track("match_shown", viewer.id));

  const modes = [...new Set(rows.map((r) => r.mode))];
  const womenFilter = womenOnlyAccess(viewer) === "available" && rows.some((r) => r.women_only);
  const shown = rows.filter((r) => (!q.mode || r.mode === q.mode) && (!q.women || r.women_only));
  const href = (p: { mode?: string; women?: string }) => {
    const sp = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]);
    return `/trips/${trip.id}${sp.size ? `?${sp}` : ""}`;
  };
  const chip = (label: string, href: string, on: boolean) => (
    <Link key={label} href={href} className="chip" aria-current={on ? "page" : undefined} scroll={false}>
      {label}
    </Link>
  );

  return (
    <>
      <h2 id="matches-title" className="text-h1 font-bold md:text-h1-lg">
        Going your way
      </h2>
      <p className="mt-2 text-body text-ink-soft">
        Same route and day, ranked by how close your departure windows are.
      </p>
      {(modes.length > 1 || womenFilter) && (
        <nav aria-label="Filter matches" className="mt-6 flex flex-wrap gap-2">
          {modes.length > 1 && chip("All modes", href({ women: q.women }), !q.mode)}
          {modes.length > 1 && modes.map((m) => chip(MODE_LABEL[m], href({ mode: m, women: q.women }), q.mode === m))}
          {/* Comfort filter: narrows to trips whose owners chose women-only. Same weight as any chip. */}
          {womenFilter && chip("Women-only trips", href({ mode: q.mode, women: q.women ? undefined : "1" }), !!q.women)}
        </nav>
      )}

      {error ? (
        <p role="alert" className="mt-8 text-body">
          Couldn&apos;t load matches. Reload the page to try again.
        </p>
      ) : shown.length === 0 ? (
        <EmptyMatches />
      ) : (
        <ol className="mt-8 border-t border-line">
          {shown.map((c) => (
            <li key={c.trip_id} className="border-b border-line py-6">
              <div className="flex items-start gap-3">
                <RouteMini mode={c.mode} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="break-words">{c.first_name}</span>
                    <span className="font-normal text-ink-soft">
                      {" "}
                      · {c.college_name}
                      {c.year ? ` · ${yearLabel(c.year)}` : ""}
                    </span>
                  </p>
                  <VerifiedBadge idChecked={c.id_checked} pendingCollege={viewer.college.status !== "active"} />
                </div>
                <SafetyMenu userId={c.owner_id} name={c.first_name} context="profile" after={`/trips/${trip.id}`} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-8">
                <div>
                  <TimeRuler mine={{ start: trip.depart_start, end: trip.depart_end }} theirs={{ start: c.depart_start, end: c.depart_end }} theirName={c.first_name} />
                  <p className="mt-2 text-small text-ink">{rankReason(mine, c)}</p>
                  {(c.from_point || c.to_point) && (
                    <p className="text-small text-ink-soft">
                      {c.from_point ?? trip.from_hub} to {c.to_point ?? trip.to_hub}
                    </p>
                  )}
                </div>
                <div className="sm:w-56 sm:text-right">
                  <MatchAction c={c} myTrip={trip.id} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function MatchAction({ c, myTrip }: { c: Omit<Cand, "same_vehicle" | "same_college">; myTrip: string }) {
  if (c.match_status === "accepted")
    return (
      <Link href={`/inbox/${c.match_id}`} className="btn btn-trust w-full sm:w-auto">
        Open chat
      </Link>
    );
  if (c.match_status === "pending")
    return c.i_requested ? (
      <p className="text-small text-ink-soft">Request sent. Waiting for {c.first_name}.</p>
    ) : (
      <Link href="/inbox" className="btn btn-quiet w-full sm:w-auto">
        {c.first_name} asked you. Reply
      </Link>
    );
  return <ConnectButton myTrip={myTrip} theirTrip={c.trip_id} name={c.first_name} />;
}

function EmptyMatches() {
  return (
    <div className="mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
      <svg viewBox="0 0 160 64" className="w-40 shrink-0" aria-hidden>
        <path d="M8 20 C 60 20, 100 20, 152 20" fill="none" stroke="var(--line-strong)" strokeWidth={2} strokeLinecap="round" />
        <path d="M8 44 C 60 44, 100 44, 152 44" fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx="8" cy="20" r="5" fill="var(--paper-raised)" stroke="var(--line-strong)" strokeWidth={2} />
        <circle cx="152" cy="20" r="5" fill="var(--paper-raised)" stroke="var(--line-strong)" strokeWidth={2} />
        <circle cx="8" cy="44" r="5" fill="var(--paper-raised)" stroke="var(--ink)" strokeWidth={2} />
        <circle cx="152" cy="44" r="5" fill="var(--accent)" stroke="var(--ink)" strokeWidth={2} />
      </svg>
      <div>
        <p className="font-display text-h2 font-semibold">No one on your route that day, yet</p>
        <p className="mt-2 max-w-[60ch] text-body text-ink-soft">
          Your trip stays live and we&apos;ll email you when someone matches. Share the link in your hostel or batch group: every
          post makes the demand counts more useful for everyone.
        </p>
      </div>
    </div>
  );
}

