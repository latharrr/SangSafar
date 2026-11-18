"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCopy, type ActionState } from "@/lib/errors";

// Every admin function re-checks the admin role inside the database.

export async function setSuspended(_: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_suspended", {
    p_user: String(data.get("userId")),
    p_suspended: data.get("suspend") === "1",
  });
  if (error) return { error: errorCopy(error) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function setIdChecked(_: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_id_checked", {
    p_user: String(data.get("userId")),
    p_checked: data.get("checked") === "1",
  });
  if (error) return { error: errorCopy(error) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectCollege(_: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reject_college", { p_id: String(data.get("id")) });
  if (error) return { error: errorCopy(error) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function activateCollege(_: ActionState, data: FormData): Promise<ActionState> {
  const s = (k: string) => String(data.get(k) ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_activate_college", {
    p_id: s("id"),
    p_name: s("name"),
    p_code: s("code"),
    p_city: s("city"),
    p_hubs: s("hubs").split(",").map((h) => h.trim()).filter(Boolean),
    p_timezone: s("timezone") || "Asia/Kolkata",
  });
  if (error) return { error: errorCopy(error, "Check the fields: the timezone must be a valid name like Asia/Kolkata.") };
  revalidatePath("/admin");
  return { ok: true };
}
