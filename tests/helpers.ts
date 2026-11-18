import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const hasDb = !!(url && anonKey && serviceKey);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
/** Exactly what a logged-out browser has. */
export const anon = () => createClient(url, anonKey, opts);
export const admin = () => createClient(url, serviceKey, opts);

export const SEED = {
  college: "00000000-0000-4000-8000-0000000000c1",
  user: (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  trip: (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`,
  match: (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`,
};

/** Sign in with a real email OTP, the same verifyOtp call the app makes. */
export async function signIn(email: string) {
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const client = anon();
  const { error: e2 } = await client.auth.verifyOtp({ email, token: data.properties.email_otp, type: "email" });
  if (e2) throw e2;
  return client;
}

export type Student = { id: string; email: string; client: SupabaseClient };

/** A fresh fictional student on the seed campus. */
export async function newStudent(p: { gender?: string; optin?: boolean; name?: string; domain?: string } = {}): Promise<Student> {
  const email = `test-${randomUUID().slice(0, 8)}@${p.domain ?? "example.edu"}`;
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  if (p.gender || p.name) {
    await admin().from("private_profiles").update({ gender: p.gender ?? null, women_only_optin: !!p.optin }).eq("user_id", id);
    if (p.name) await admin().from("public_profiles").update({ first_name: p.name }).eq("user_id", id);
  }
  return { id, email, client: await signIn(email) };
}

export function campusDay(offset: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export async function postTrip(
  s: Student,
  t: { date: string; start?: string; end?: string; from?: string; to?: string; vehicle?: string; notes?: string; meetup?: string; womenOnly?: boolean; mode?: string; fromPoint?: string },
) {
  const { data, error } = await s.client
    .rpc("create_trip", {
      p_mode: t.mode ?? "train",
      p_from_hub: t.from ?? "Demo Airport",
      p_from_point: t.fromPoint ?? "Arrivals",
      p_to_hub: t.to ?? "Chandigarh",
      p_to_point: "Chandigarh Jn",
      p_date: t.date,
      p_start: t.start ?? "10:00",
      p_end: t.end ?? "12:00",
      p_women_only: !!t.womenOnly,
      p_vehicle_no: t.vehicle ?? "",
      p_meetup: t.meetup ?? "",
      p_notes: t.notes ?? "",
    })
    .single<{ id: string; share_token: string }>();
  if (error) throw error;
  return data!;
}

export async function candidates(viewer: Student, tripId: string) {
  const { data, error } = await admin().rpc("match_candidates", { p_viewer: viewer.id, p_trip: tripId });
  if (error) throw error;
  return data as { trip_id: string; owner_id: string; same_vehicle: boolean; match_status: string | null }[];
}
