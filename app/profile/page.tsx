import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { deleteMyData } from "@/app/actions/profile";
import { ActionForm } from "@/components/action-form";
import { VerifiedBadge } from "@/components/badges";
import { TripRow, type MyTrip } from "@/components/trip-row";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const viewer = await requireViewer("/profile");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_trips");
  const history = ((data ?? []) as MyTrip[]).filter((t) => t.status === "archived" || t.travelled_together);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h1 font-bold md:text-h1-lg">{viewer.firstName}</h1>
      <p className="mt-1 text-body text-ink-soft">{viewer.college.name}</p>
      <div className="mt-3">
        <VerifiedBadge idChecked={viewer.idChecked} pendingCollege={viewer.college.status !== "active"} />
      </div>
      <p className="mt-3 max-w-[65ch] text-small text-ink-soft">
        &ldquo;College email verified&rdquo; means you controlled a college inbox when you signed up. It isn&apos;t proof of current
        enrolment or identity. &ldquo;ID checked&rdquo; appears only after a moderator reviews a college ID by hand.
      </p>

      <section aria-labelledby="details-title" className="mt-16">
        <h2 id="details-title" className="text-h2 font-semibold md:text-h2-lg">
          Your details
        </h2>
        <p className="mt-1 text-small text-ink-soft">
          Other students only ever see your first name, college, year and badges. Everything else here is just for you.
        </p>
        <ProfileForm viewer={viewer} />
      </section>

      <section aria-labelledby="history-title" className="mt-16">
        <h2 id="history-title" className="text-h2 font-semibold md:text-h2-lg">
          Trip history
        </h2>
        {history.length ? (
          <ul className="mt-3 border-t border-line">
            {history.map((t) => (
              <TripRow key={t.id} trip={t} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-body text-ink-soft">Past trips and who you travelled with will show here.</p>
        )}
      </section>

      <section aria-labelledby="settings-title" className="mt-16 border-t border-line pt-10">
        <h2 id="settings-title" className="text-h2 font-semibold md:text-h2-lg">
          Settings
        </h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={signOut}>
            <button className="btn btn-quiet">Sign out</button>
          </form>
        </div>
        <h3 className="mt-10 font-display text-h2 font-semibold">Delete my data</h3>
        <p className="mt-2 max-w-[65ch] text-body text-ink-soft">
          Permanently deletes your profile, email, trips and their private details, your messages, connections, travel
          confirmations, any reports you made or that were made about you, and your blocks. Your sign-in account is closed so this
          email can&apos;t sign back in to it. Students you chatted with will see &ldquo;Deleted user&rdquo; and a closed chat with no
          messages. We keep nothing.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ActionForm
            action={deleteMyData}
            label="Delete my data"
            pendingLabel="Deleting…"
            className="btn btn-danger"
            confirm={{
              title: "Delete everything?",
              body: "Your profile, trips, messages, connections and reports are deleted now and can't be recovered. Provider backups roll off on their own schedule (see the privacy notes).",
              confirmLabel: "Delete permanently",
            }}
          />
        </div>
      </section>
    </div>
  );
}
