import Link from "next/link";
import { DemandStepper } from "@/components/demand-stepper";
import { RouteLine } from "@/components/route-line";
import { TripRow, type MyTrip } from "@/components/trip-row";
import { TAGLINE } from "@/lib/config";
import { getActiveColleges, getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const [{ deleted }, viewer, colleges] = await Promise.all([searchParams, getViewer(), getActiveColleges()]);

  if (!viewer || viewer === "orphan") {
    return (
      <div>
        {deleted && (
          <p role="status" className="mb-6 border-b border-line pb-4 text-body">
            Your data has been deleted and your account is closed.
          </p>
        )}
        <section className="mx-auto max-w-3xl pb-16 pt-4 md:pb-24 md:pt-10">
          <div className="mx-auto max-w-xl">
            <RouteLine from="Campus" to="Home" mode="train" draw />
          </div>
          <h1 className="mt-10 text-center font-display text-display font-bold tracking-[-0.04em] md:text-display-lg">{TAGLINE}</h1>
          <p className="mx-auto mt-4 max-w-[52ch] text-center text-body text-ink-soft">
            Find a student from your college making the same journey, and decide together whether to travel together. Verified
            college emails, nothing shared until you both say yes.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/login" className="btn btn-primary px-6">
              Find your people
            </Link>
          </div>
        </section>
        <div className="mx-auto max-w-3xl border-t border-line pt-10">
          <DemandStepper colleges={colleges} signedIn={false} />
          <p className="mt-10 max-w-[65ch] text-small text-ink-soft">
            Counts are students, not trips, and anything under 5 shows as &ldquo;low demand&rdquo; so no one&apos;s plans can be
            picked out. Not a booking site: no tickets, no payments, no PNRs.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("my_trips");
  const live = ((data ?? []) as MyTrip[]).filter((t) => t.status === "live").reverse();

  return (
    <div className="grid gap-16 md:grid-cols-[minmax(0,1fr)_320px] md:gap-10">
      <div>
        <h1 className="mb-6 text-h1 font-bold md:text-h1-lg">Hi {viewer.firstName}. Where to?</h1>
        {/* Signed in: your own campus only (v1 is same-campus). */}
        <DemandStepper colleges={[viewer.college]} collegeId={viewer.college.id} signedIn />
      </div>
      <section aria-labelledby="live-title">
        <h2 id="live-title" className="text-h2 font-semibold">
          Your live trips
        </h2>
        {live.length ? (
          <ul className="mt-3 border-t border-line">
            {live.map((t) => (
              <TripRow key={t.id} trip={t} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-body text-ink-soft">
            Nothing posted yet. Post a trip and we&apos;ll rank the students going your way.
          </p>
        )}
      </section>
    </div>
  );
}
