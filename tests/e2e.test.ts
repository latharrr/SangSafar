// End-to-end paths at the API level: the same calls the app's server actions
// and browser client make, in order, as two real signed-in students.
import { describe, expect, it } from "vitest";
import { rankCandidates } from "../lib/matching";
import { admin, anon, campusDay, candidates, hasDb, newStudent, postTrip } from "./helpers";

describe.skipIf(!hasDb)("end to end", () => {
  it("happy path: post, match, request, accept, chat, confirm travelled together", async () => {
    const a = await newStudent({ name: "Riya" });
    const b = await newStudent({ name: "Dev" });
    const date = campusDay(30);
    const ta = await postTrip(a, { date, start: "09:00", end: "10:30", vehicle: "22222", meetup: "Gate 2", notes: "one bag" });
    const tb = await postTrip(b, { date, start: "10:00", end: "11:00", vehicle: "22222" });

    // Match: gated candidates from the DB, ranked by the scorer.
    const cands = await candidates(a, ta.id);
    const ranked = rankCandidates(
      { id: ta.id, ownerId: a.id, travelDate: date, fromHub: "Demo Airport", fromPoint: "Arrivals", toHub: "Chandigarh", toPoint: "Chandigarh Jn", start: "09:00", end: "10:30" },
      cands.map((c) => ({ ...(c as never as Record<string, string>), id: c.trip_id, ownerId: c.owner_id, travelDate: date, fromHub: "Demo Airport", fromPoint: "Arrivals", toHub: "Chandigarh", toPoint: "Chandigarh Jn", start: "10:00", end: "11:00", sameVehicle: c.same_vehicle, sameCollege: true })),
    );
    expect(ranked.map((c) => c.id)).toEqual([tb.id]);
    expect(cands[0].same_vehicle).toBe(true);

    // Request -> B sees it incoming, with no private details yet.
    const { data: matchId, error } = await a.client.rpc("send_connect_request", { p_my_trip: ta.id, p_their_trip: tb.id });
    expect(error).toBeNull();
    const inboxB = (await b.client.rpc("my_inbox")).data;
    expect(inboxB[0]).toMatchObject({ match_id: matchId, direction: "incoming", status: "pending", other_first_name: "Riya" });
    expect(JSON.stringify(inboxB)).not.toContain("22222");
    expect((await b.client.rpc("match_details", { p_match: matchId })).data).toEqual([]);

    // Accept -> both unlock symmetrically, chat opens.
    expect((await b.client.rpc("respond_to_request", { p_match: matchId, p_accept: true })).data).toBe(a.id);
    const detailsB = (await b.client.rpc("match_details", { p_match: matchId })).data;
    expect(detailsB.find((d: { side: string }) => d.side === "them")).toMatchObject({ vehicle_no: "22222", meetup_point: "Gate 2", notes: "one bag" });
    const clientId = crypto.randomUUID();
    expect((await a.client.from("messages").insert({ match_id: matchId, body: "Are you at the north gate?", client_id: clientId })).error).toBeNull();
    // A retried send with the same idempotency key never duplicates.
    expect((await a.client.from("messages").insert({ match_id: matchId, body: "Are you at the north gate?", client_id: clientId })).error?.code).toBe("23505");
    expect((await b.client.from("messages").select("body").eq("match_id", matchId)).data).toEqual([{ body: "Are you at the north gate?" }]);

    // Too early to confirm; then the travel day passes.
    expect((await a.client.rpc("confirm_travelled", { p_match: matchId })).error?.message).toContain("too_early");
    await admin().from("trips").update({ travel_date: campusDay(-1) }).in("id", [ta.id, tb.id]);
    await a.client.rpc("confirm_travelled", { p_match: matchId });
    const halfway = (await b.client.rpc("my_inbox")).data[0];
    expect(halfway).toMatchObject({ me_confirmed: false, them_confirmed: true }); // one side is not a pair
    expect((await a.client.rpc("my_trips")).data[0].travelled_together).toBe(false);
    await b.client.rpc("confirm_travelled", { p_match: matchId });
    expect((await a.client.rpc("my_trips")).data[0].travelled_together).toBe(true);
    expect((await b.client.rpc("my_trips")).data[0].travelled_together).toBe(true);
  });

  it("deletion: the user appears nowhere afterwards", async () => {
    const c = await newStudent({ name: "Zoya", gender: "woman" });
    const d = await newStudent({ name: "Om" });
    const date = campusDay(31);
    const tc = await postTrip(c, { date, notes: "ZOYA-SECRET-NOTE", vehicle: "33333" });
    const td = await postTrip(d, { date });
    const { data: matchId } = await c.client.rpc("send_connect_request", { p_my_trip: tc.id, p_their_trip: td.id });
    await d.client.rpc("respond_to_request", { p_match: matchId, p_accept: true });
    await c.client.from("messages").insert({ match_id: matchId, body: "ZOYA-SECRET-MESSAGE", client_id: crypto.randomUUID() });
    await d.client.rpc("report_user", { p_user: c.id, p_context: "profile", p_reason: "test" });

    // The same two steps the deleteMyData action runs.
    expect((await admin().rpc("purge_user", { p_user: c.id })).error).toBeNull();
    expect((await admin().auth.admin.deleteUser(c.id)).error).toBeNull();

    // Counterpart: a closed thread from "Deleted user", no messages, no details.
    const row = (await d.client.rpc("my_inbox")).data[0];
    expect(row).toMatchObject({ match_id: matchId, other_first_name: null, other_user_id: null, status: "closed", closed_reason: "user_deleted" });
    expect((await d.client.from("messages").select("*").eq("match_id", matchId)).data).toEqual([]);
    expect((await d.client.rpc("match_details", { p_match: matchId })).data).toEqual([]);
    expect(await candidates(d, td.id)).toEqual([]);
    // Share link is gone.
    expect((await anon().rpc("share_card", { p_token: tc.share_token })).data).toEqual([]);
    // The auth identity is gone.
    expect((await admin().auth.admin.getUserById(c.id)).error).toBeTruthy();
    // Nothing in any table (service role sees everything) mentions them.
    const tables = ["public_profiles", "private_profiles", "trips", "private_trip_details", "matches", "messages", "reports", "blocks", "travel_confirmations", "admins"];
    const everything: string[] = [];
    for (const t of tables) everything.push(JSON.stringify((await admin().from(t).select("*")).data));
    const dump = everything.join("\n");
    for (const s of [c.id, c.email, "ZOYA-SECRET-NOTE", "ZOYA-SECRET-MESSAGE", "33333", tc.id]) expect(dump, s).not.toContain(s);
  });
});
