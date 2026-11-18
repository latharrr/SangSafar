import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { VerifiedBadge } from "@/components/badges";
import { RouteLine } from "@/components/route-line";
import { APP_NAME, type Mode } from "@/lib/config";
import { dayLabel, MODE_LABEL, windowLabel, yearLabel } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Card = {
  trip_id: string | null;
  mode: Mode;
  from_hub: string;
  to_hub: string;
  travel_date: string;
  college_name: string | null;
  first_name: string | null;
  year: number | null;
  id_checked: boolean | null;
  depart_start: string | null;
  depart_end: string | null;
  is_own: boolean;
};

// share_card decides what this viewer may see; the page renders only what comes back.
const getCard = cache(async (token: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("share_card", { p_token: token });
  return ((data ?? []) as Card[])[0] ?? null;
});

// Preview metadata is generic route/date/mode only, for every viewer.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const card = await getCard((await params).token);
  if (!card) return { title: "Trip unavailable", robots: { index: false } };
  const title = `${card.from_hub} to ${card.to_hub}, ${dayLabel(card.travel_date)}`;
  const description = `A student is travelling by ${card.mode} on ${APP_NAME}. Find your people.`;
  return { title, description, robots: { index: false }, openGraph: { title, description } };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const [card, viewer] = await Promise.all([getCard((await params).token), getViewer()]);
  // A full card is only ever returned to a same-college viewer, so their college's review status applies.
  const pendingCollege = !!viewer && viewer !== "orphan" && viewer.college.status !== "active";

  if (!card) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <h1 className="text-h1 font-bold">This trip isn&apos;t available</h1>
        <p className="mt-3 text-body text-ink-soft">It may have already left, been hidden or been removed.</p>
        <Link href="/" className="btn btn-primary mt-8">
          Find your people
        </Link>
      </div>
    );
  }

  const post = `/post?from=${encodeURIComponent(card.from_hub)}&to=${encodeURIComponent(card.to_hub)}&date=${card.travel_date}`;
  return (
    <div className="mx-auto max-w-2xl py-6 md:py-10">
      <RouteLine from={card.from_hub} to={card.to_hub} mode={card.mode} />
      <p className="mt-10 font-display text-display font-bold tracking-[-0.03em] md:text-display-lg">
        <time dateTime={card.travel_date}>{dayLabel(card.travel_date, { weekday: "long", day: "numeric", month: "long" })}</time>
      </p>
      <p className="tnum mt-2 text-h2 text-ink-soft">
        By {MODE_LABEL[card.mode].toLowerCase()}
        {card.depart_start && card.depart_end && <> · leaving {windowLabel(card.depart_start, card.depart_end)}</>}
      </p>

      {card.first_name && !card.is_own && (
        <div className="mt-8 border-t border-line pt-6">
          <p className="font-medium">
            {card.first_name}
            <span className="font-normal text-ink-soft">
              {" "}
              · {card.college_name}
              {card.year ? ` · ${yearLabel(card.year)}` : ""}
            </span>
          </p>
          <VerifiedBadge idChecked={card.id_checked} pendingCollege={pendingCollege} />
          <p className="mt-3 text-small text-ink-soft">
            Post the same trip to request a connection. Their train number, meetup point and notes stay private until you both accept.
          </p>
        </div>
      )}
      {card.is_own && <p className="mt-8 border-t border-line pt-6 text-body text-ink-soft">This is your trip&apos;s public link.</p>}
      {!card.first_name && (
        <p className="mt-8 border-t border-line pt-6 text-body text-ink-soft">
          Someone from a college on {APP_NAME} is making this journey. Sign in with your college email to see who&apos;s going and
          ask to travel together.
        </p>
      )}

      {!card.is_own && (
        <Link href={card.first_name ? post : `/login?next=${encodeURIComponent(post)}`} className="btn btn-primary mt-8 px-6">
          Find your people
        </Link>
      )}
    </div>
  );
}
