import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Mode } from "@/lib/config";

export type InboxRow = {
  match_id: string;
  direction: "incoming" | "outgoing";
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled" | "closed";
  closed_reason: string | null;
  other_user_id: string | null;
  other_first_name: string | null; // null = deleted user
  other_year: number | null;
  other_id_checked: boolean | null;
  mode: Mode;
  from_hub: string;
  from_point: string | null;
  to_hub: string;
  to_point: string | null;
  travel_date: string;
  my_trip_id: string | null;
  my_start: string | null;
  my_end: string | null;
  their_start: string | null;
  their_end: string | null;
  expires_at: string;
  created_at: string;
  last_message_at: string | null;
  me_confirmed: boolean;
  them_confirmed: boolean;
  can_confirm: boolean;
};

export async function getInbox() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_inbox");
  return { rows: (data ?? []) as InboxRow[], error };
}

export const isChat = (r: InboxRow) => r.status === "accepted" || (r.status === "closed" && r.closed_reason !== "blocked");
export const nameOf = (r: InboxRow) => r.other_first_name ?? "Deleted user";

export const CLOSED_COPY: Record<string, string> = {
  user_deleted: "This student deleted their account. The chat is closed.",
  trip_edited: "A trip changed after you connected, so this chat closed. Send a new request to reconnect.",
  trip_deleted: "A trip in this connection was deleted, so this chat closed.",
  blocked: "This chat is closed.",
  college_rejected: "This chat closed because the college domain couldn't be verified.",
};
