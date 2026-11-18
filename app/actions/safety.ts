"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { errorCopy, type ActionState } from "@/lib/errors";

export async function blockUser(_: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_user", { p_user: String(data.get("userId")) });
  if (error) return { error: errorCopy(error) };
  redirect(String(data.get("after") || "/inbox"));
}

export async function reportUser(_: ActionState, data: FormData): Promise<ActionState> {
  const reason = String(data.get("reason") ?? "").trim();
  if (!reason) return { error: "Tell the moderators briefly what happened." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_user", {
    p_user: String(data.get("userId")),
    p_context: String(data.get("context") ?? "profile"),
    p_reason: reason.slice(0, 500),
  });
  if (error) return { error: errorCopy(error) };
  return { ok: true };
}
