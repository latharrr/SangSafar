import { createAdminClient } from "@/lib/supabase/server";

// Archives past trips and expires stale requests. Reads never depend on this
// (every query re-checks dates), it just keeps statuses tidy. Vercel Cron calls
// it with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { error } = await createAdminClient().rpc("run_housekeeping");
  return Response.json({ ok: !error }, { status: error ? 500 : 200 });
}
