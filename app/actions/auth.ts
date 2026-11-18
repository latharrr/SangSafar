"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/notify";

export type CodeState =
  | { step: "email"; error?: string; email?: string }
  | { step: "code"; email: string; college: string; pending: boolean; error?: string; sentAt: number };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One state machine for the sign-in sheet: send / resend, verify, change email. */
export async function authFlow(state: CodeState, data: FormData): Promise<CodeState> {
  const intent = data.get("intent");
  if (intent === "change") return { step: "email", email: "email" in state ? state.email : "" };
  if (intent === "verify") return verifyCode(state, data);
  return requestCode(data);
}

/** Detect the college from the domain, then send a code (or queue the domain). */
async function requestCode(data: FormData): Promise<CodeState> {
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { step: "email", email, error: "Enter your full college email, like name@college.edu." };

  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("college_for_email", { p_email: email });
  const college = rows?.[0] as { status: string; name: string | null } | undefined;
  if (college?.status === "public")
    return { step: "email", email, error: "Use your college email. Personal addresses like Gmail can't join, because they don't show you're a student." };
  if (college?.status === "rejected")
    return { step: "email", email, error: "We couldn't verify this domain as a college. Use your college-issued email." };
  // Unlisted domain: queue it for admin review and let the student in provisionally.
  const pending = college?.status !== "active";
  if (pending) {
    const { error } = await supabase.rpc("request_college", { p_email: email });
    if (error) return { step: "email", email, error: "That doesn't look like a college email domain. Check it and try again." };
  }

  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    const wait = /security purposes|rate/i.test(error.message);
    return {
      step: "email",
      email,
      error: wait ? "A code was sent moments ago. Wait 30 seconds, then ask for another." : "We couldn't send a code right now. Try again in a minute.",
    };
  }
  return { step: "code", email, college: college?.name ?? email.split("@")[1], pending, sentAt: Date.now() };
}

/** Step 2: verify the code. Wrong and expired codes are both recoverable in place. */
async function verifyCode(state: CodeState, data: FormData): Promise<CodeState> {
  if (state.step !== "code") return state;
  const token = String(data.get("code") ?? "").replace(/\D/g, "");
  const next = String(data.get("next") ?? "/");
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.verifyOtp({ email: state.email, token, type: "email" });
  if (error || !auth.user) {
    const expired = /expired/i.test(error?.message ?? "");
    return {
      ...state,
      error: expired ? "That code has expired. Send a new one below." : "That code didn't match. Check the latest email and try again.",
    };
  }
  // First sign-in within a minute of account creation counts as a signup.
  if (Date.now() - new Date(auth.user.created_at).getTime() < 15 * 60_000) await track("signup", auth.user.id);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
