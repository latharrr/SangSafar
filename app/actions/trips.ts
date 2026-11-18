"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { errorCopy, type ActionState } from "@/lib/errors";
import { campusNow, validateTrip } from "@/lib/matching";
import { notifyUser, track } from "@/lib/notify";
import { requireViewer } from "@/lib/session";

function readTrip(data: FormData) {
  const s = (k: string) => String(data.get(k) ?? "").trim();
  return {
    p_mode: s("mode"),
    p_from_hub: s("fromHub"),
    p_from_point: s("fromPoint"),
    p_to_hub: s("toHub"),
    p_to_point: s("toPoint"),
    p_date: s("date"),
    p_start: s("start"),
    p_end: s("end"),
    p_women_only: data.get("womenOnly") === "on",
    p_vehicle_no: s("vehicleNo"),
    p_meetup: s("meetup"),
    p_notes: s("notes"),
  };
}

async function checkFields(args: ReturnType<typeof readTrip>) {
  const viewer = await requireViewer("/post");
  const fields = validateTrip(
    { fromHub: args.p_from_hub, toHub: args.p_to_hub, date: args.p_date, start: args.p_start, end: args.p_end },
    viewer.college.hubs,
    campusNow(viewer.college.timezone),
  ) as Record<string, string>;
  if (!["train", "bus", "flight", "cab"].includes(args.p_mode)) fields.mode = "Pick how you're travelling.";
  return { viewer, fields };
}

export async function createTrip(_: ActionState, data: FormData): Promise<ActionState> {
  const args = readTrip(data);
  const { viewer, fields } = await checkFields(args);
  if (Object.keys(fields).length) return { fields, error: "Fix the highlighted fields." };

  const supabase = await createClient();
  const { data: trip, error } = await supabase.rpc("create_trip", args).single<{ id: string }>();
  if (error || !trip) return { error: errorCopy(error) };

  after(async () => {
    await track("trip_posted", viewer.id);
    // "Match found" for everyone this trip newly matches. Gates run in the database.
    const { data: cands } = await createAdminClient().rpc("match_candidates", { p_viewer: viewer.id, p_trip: trip.id });
    const owners = new Set<string>((cands ?? []).map((c: { owner_id: string }) => c.owner_id));
    await Promise.all([...owners].map((id) => notifyUser(id, "match_found")));
  });
  redirect(`/trips/${trip.id}?posted=1`);
}

export async function updateTrip(_: ActionState, data: FormData): Promise<ActionState> {
  const id = String(data.get("tripId"));
  const args = readTrip(data);
  const { fields } = await checkFields(args);
  if (Object.keys(fields).length) return { fields, error: "Fix the highlighted fields." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_trip", { p_trip: id, ...args });
  if (error) return { error: errorCopy(error) };
  redirect(`/trips/${id}`);
}

export async function setTripStatus(_: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_trip_status", { p_trip: String(data.get("tripId")), p_status: String(data.get("status")) });
  if (error) return { error: errorCopy(error) };
  revalidatePath("/trips", "layout");
  return { ok: true };
}

export async function deleteTrip(_: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_trip", { p_trip: String(data.get("tripId")) });
  if (error) return { error: errorCopy(error) };
  redirect("/trips");
}
