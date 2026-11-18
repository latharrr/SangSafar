"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { errorCopy, type ActionState } from "@/lib/errors";
import { getUserId } from "@/lib/session";

const GENDERS = ["woman", "man", "non_binary", "prefer_not_to_say"];

export async function updateProfile(_: ActionState, data: FormData): Promise<ActionState> {
  const uid = await getUserId();
  if (!uid) redirect("/login?next=/profile");
  const firstName = String(data.get("firstName") ?? "").trim();
  if (!firstName || firstName.length > 40) return { fields: { firstName: "Add a first name (up to 40 characters)." } };
  const yearRaw = String(data.get("year") ?? "");
  const year = yearRaw ? Number(yearRaw) : null;
  const genderRaw = String(data.get("gender") ?? "");
  const gender = GENDERS.includes(genderRaw) ? genderRaw : null;
  // The toggle only exists for self-declared women; the database constraint enforces it too.
  const optin = gender === "woman" && data.get("womenOnly") === "on";

  const supabase = await createClient();
  const [a, b] = await Promise.all([
    supabase.from("public_profiles").update({ first_name: firstName, year }).eq("user_id", uid),
    supabase
      .from("private_profiles")
      .update({
        full_name: String(data.get("fullName") ?? "").trim() || null,
        branch: String(data.get("branch") ?? "").trim() || null,
        gender,
        women_only_optin: optin,
      })
      .eq("user_id", uid),
  ]);
  if (a.error || b.error) return { error: errorCopy(a.error ?? b.error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Delete-my-data: purge every row (ordered, in one transaction), then delete the
 * auth user so the old identity can never sign in. Safe to retry if step 2 fails.
 */
export async function deleteMyData(): Promise<ActionState> {
  const uid = await getUserId();
  if (!uid) redirect("/");
  const admin = createAdminClient();
  const purge = await admin.rpc("purge_user", { p_user: uid });
  if (purge.error) return { error: "Deletion didn't finish. Nothing was half-deleted; try again." };
  const del = await admin.auth.admin.deleteUser(uid);
  if (del.error) return { error: "Your data is deleted, but closing the sign-in account failed. Press delete again to finish." };
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
