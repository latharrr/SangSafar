import "server-only";
import { APP_NAME, SITE_URL } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/server";

type Kind = "match_found" | "request_received" | "request_accepted";

// Plain text, no names, no route details: the email says something happened, the app shows what.
const TEMPLATES: Record<Kind, { subject: string; body: string; path: string }> = {
  match_found: {
    subject: "Someone from campus is travelling your way",
    body: "A student from your campus just posted a trip that matches one of yours.",
    path: "/trips",
  },
  request_received: {
    subject: "You have a new connect request",
    body: "A student from your campus wants to travel together. Accept or decline from your inbox.",
    path: "/inbox",
  },
  request_accepted: {
    subject: "Your connect request was accepted",
    body: "Your request was accepted. Your chat is open and you can now see each other's trip details.",
    path: "/inbox",
  },
};

/** Best-effort email. Without RESEND_API_KEY + EMAIL_FROM it does nothing (local/dev). */
export async function notifyUser(userId: string | null | undefined, kind: Kind) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !userId) return;
  const { data } = await createAdminClient().from("private_profiles").select("email").eq("user_id", userId).maybeSingle();
  if (!data?.email) return;
  const t = TEMPLATES[kind];
  const text = `${t.body}\n\nOpen ${APP_NAME}: ${SITE_URL}${t.path}\n\nYou're getting this because you have an account on ${APP_NAME}. Delete your data any time from your profile.`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: data.email, subject: t.subject, text }),
    });
  } catch {
    // Notification failure must never fail the user's action. Nothing is logged: the payload holds an email address.
  }
}

type Event = "signup" | "trip_posted" | "match_shown" | "request_sent" | "request_accepted" | "travel_confirmed";

/** Product analytics: event name + opaque user id only. No routes, names, chat or email. */
export async function track(event: Event, userId: string) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, event, distinct_id: userId, properties: { $process_person_profile: false } }),
    });
  } catch {}
}
