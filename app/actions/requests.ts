"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCopy, type ActionState } from "@/lib/errors";
import { notifyUser, track } from "@/lib/notify";
import { getUserId } from "@/lib/session";

// All checks (ownership, gates, blocks, rate limit, duplicates, expiry) run in
// the database functions; these actions only relay and notify.

export async function sendRequest(_: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: matchId, error } = await supabase.rpc("send_connect_request", {
    p_my_trip: String(data.get("myTrip")),
    p_their_trip: String(data.get("theirTrip")),
  });
  if (error) return { error: errorCopy(error) };
  const uid = await getUserId();
  const { data: match } = await supabase.from("matches").select("addressee_id").eq("id", matchId).maybeSingle();
  after(async () => {
    if (uid) await track("request_sent", uid);
    await notifyUser(match?.addressee_id, "request_received");
  });
  revalidatePath("/trips", "layout");
  return { ok: true };
}

export async function respondToRequest(_: ActionState, data: FormData): Promise<ActionState> {
  const accept = data.get("accept") === "1";
  const matchId = String(data.get("matchId"));
  const supabase = await createClient();
  const { data: requesterId, error } = await supabase.rpc("respond_to_request", { p_match: matchId, p_accept: accept });
  if (error) return { error: errorCopy(error) };
  if (accept) {
    const uid = await getUserId();
    after(async () => {
      if (uid) await track("request_accepted", uid);
      await notifyUser(requesterId as string, "request_accepted");
    });
  }
  revalidatePath("/inbox", "layout");
  return { ok: true };
}

export async function cancelRequest(_: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_request", { p_match: String(data.get("matchId")) });
  if (error) return { error: errorCopy(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function confirmTravelled(_: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_travelled", { p_match: String(data.get("matchId")) });
  if (error) return { error: errorCopy(error) };
  const uid = await getUserId();
  if (uid) after(() => track("travel_confirmed", uid));
  revalidatePath("/", "layout");
  return { ok: true };
}
