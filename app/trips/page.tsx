import type { Metadata } from "next";
import Link from "next/link";
import { TripRow, type MyTrip } from "@/components/trip-row";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My trips" };

export default async function TripsPage() {
  await requireViewer("/trips");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_trips");
  const trips = (data ?? []) as MyTrip[];
  const upcoming = trips.filter((t) => t.status !== "archived").reverse();
  const past = trips.filter((t) => t.status === "archived");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h1 font-bold md:text-h1-lg">My trips</h1>
      <section aria-labelledby="upcoming" className="mt-10">
        <h2 id="upcoming" className="text-h2 font-semibold">
          Upcoming
        </h2>
        {upcoming.length ? (
          <ul className="mt-3 border-t border-line">
            {upcoming.map((t) => (
              <TripRow key={t.id} trip={t} />
            ))}
          </ul>
        ) : (
          <div className="mt-3">
            <p className="text-body text-ink-soft">No upcoming trips.</p>
            <Link href="/post" className="btn btn-primary mt-4">
              Post a trip
            </Link>
          </div>
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="past" className="mt-16">
          <h2 id="past" className="text-h2 font-semibold">
            Past
          </h2>
          <ul className="mt-3 border-t border-line">
            {past.map((t) => (
              <TripRow key={t.id} trip={t} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
