import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type College = { id: string; name: string; code: string; hubs: string[]; timezone: string; status?: "active" | "requested" | "rejected" };

export type Viewer = {
  id: string;
  firstName: string;
  year: number | null;
  emailVerified: boolean;
  idChecked: boolean;
  idCheckedOn: string | null;
  fullName: string | null;
  branch: string | null;
  gender: string | null;
  womenOnlyOptin: boolean;
  suspended: boolean;
  isAdmin: boolean;
  college: College;
};

export const getActiveColleges = cache(async (): Promise<College[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("active_colleges");
  return (data ?? []) as College[];
});

/** Signed-in user id from the verified JWT, or null. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

/**
 * The signed-in user with profile, or:
 *  - null when signed out
 *  - "orphan" when a session exists but the profile is gone (deletion did not finish)
 */
export const getViewer = cache(async (): Promise<Viewer | "orphan" | null> => {
  const id = await getUserId();
  if (!id) return null;
  const supabase = await createClient();
  const [{ data: pub }, { data: priv }, { data: mine }] = await Promise.all([
    supabase.from("public_profiles").select("*").eq("user_id", id).maybeSingle(),
    supabase.from("private_profiles").select("full_name, branch, gender, women_only_optin, is_suspended").eq("user_id", id).maybeSingle(),
    supabase.rpc("my_college"),
  ]);
  if (!pub || !priv) return "orphan";
  // The viewer's own college, active or still under review.
  const college = ((mine ?? []) as College[])[0];
  if (!college) return "orphan";
  const { data: admin } = await createAdminClient().from("admins").select("user_id").eq("user_id", id).maybeSingle();
  return {
    id,
    firstName: pub.first_name,
    year: pub.year,
    emailVerified: pub.email_verified,
    idChecked: pub.id_checked,
    idCheckedOn: pub.id_checked_on,
    fullName: priv.full_name,
    branch: priv.branch,
    gender: priv.gender,
    womenOnlyOptin: priv.women_only_optin,
    suspended: priv.is_suspended,
    isAdmin: !!admin,
    college,
  };
});

/** For pages behind sign-in. `next` brings the user back after the code. */
export async function requireViewer(next: string): Promise<Viewer> {
  const v = await getViewer();
  if (v === "orphan") redirect("/profile/finish-deletion");
  if (!v) redirect(`/login?next=${encodeURIComponent(next)}`);
  return v;
}

/** The women-only toggle exists only for users who self-declared as women; it works once they opt in. */
export const womenOnlyAccess = (v: Viewer) => (v.gender !== "woman" ? null : v.womenOnlyOptin ? ("available" as const) : ("needs-optin" as const));
