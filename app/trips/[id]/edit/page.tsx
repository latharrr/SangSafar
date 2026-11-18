import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateTrip } from "@/app/actions/trips";
import { TripForm } from "@/components/trip-form";
import type { MyTrip } from "@/components/trip-row";
import { campusNow } from "@/lib/matching";
import { requireViewer, womenOnlyAccess } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit trip" };

export default async function EditTrip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/trips/${id}/edit`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_trips");
  const t = ((data ?? []) as MyTrip[]).find((x) => x.id === id);
  if (!t || t.status === "archived") notFound();
  const affected = t.incoming_pending + t.connected;

  return (
    <>
      <h1 className="mx-auto mb-8 max-w-2xl text-h1 font-bold md:text-h1-lg">Edit trip</h1>
      <TripForm
        action={updateTrip}
        hubs={viewer.college.hubs}
        today={campusNow(viewer.college.timezone).today}
        womenOnly={womenOnlyAccess(viewer)}
        submitLabel="Save changes"
        editWarning={
          "Saving any change cancels open requests on this trip" +
          (t.connected ? ` and closes your ${t.connected} chat${t.connected > 1 ? "s" : ""}` : "") +
          ", so nobody sees changed details without agreeing again." +
          (affected ? "" : " This trip has none right now.")
        }
        defaults={{
          tripId: t.id,
          mode: t.mode,
          fromHub: t.from_hub,
          fromPoint: t.from_point,
          toHub: t.to_hub,
          toPoint: t.to_point,
          date: t.travel_date,
          start: t.depart_start,
          end: t.depart_end,
          womenOnly: t.women_only,
          vehicleNo: t.vehicle_no,
          meetup: t.meetup_point,
          notes: t.notes,
        }}
      />
    </>
  );
}
