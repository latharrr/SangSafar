import { afterAll, describe, expect, it } from "vitest";
import { admin, anon, campusDay, candidates, hasDb, newStudent, postTrip } from "./helpers";

// Each test uses its own date on a route the seed doesn't use, so they can't see each other's trips.
describe.skipIf(!hasDb)("matching gates, safety and limits", () => {
  afterAll(async () => {
    await admin().from("app_settings").update({ connect_daily_limit: 10, report_daily_limit: 5, suspend_threshold: 3 }).eq("id", true);
  });

  it("route gate: unrelated routes never match; self never matches", async () => {
    const a = await newStudent();
    const b = await newStudent();
    const date = campusDay(21);
    const mine = await postTrip(a, { date });
    await postTrip(a, { date }); // own second trip
    await postTrip(b, { date, to: "Delhi" }); // different destination
    const reverse = await postTrip(b, { date, from: "Chandigarh", to: "Demo Airport" });
    expect(await candidates(a, mine.id)).toEqual([]);
    expect((await a.client.rpc("send_connect_request", { p_my_trip: mine.id, p_their_trip: reverse.id })).error?.message).toContain("not_eligible");
  });

  it("rejects bad trips server-side (past, reversed window, unknown hub)", async () => {
    const a = await newStudent();
    await expect(postTrip(a, { date: campusDay(-1) })).rejects.toMatchObject({ message: expect.stringContaining("in_past") });
    await expect(postTrip(a, { date: campusDay(22), start: "23:00", end: "01:00" })).rejects.toBeTruthy();
    await expect(postTrip(a, { date: campusDay(22), to: "Mumbai" })).rejects.toMatchObject({ message: expect.stringContaining("unknown_hub") });
    await expect(postTrip(a, { date: campusDay(22), womenOnly: true })).rejects.toMatchObject({ message: expect.stringContaining("women_only") });
  });

  it("women-only is bidirectional and invisible to anyone ineligible", async () => {
    const w1 = await newStudent({ gender: "woman", optin: true });
    const w2 = await newStudent({ gender: "woman", optin: true });
    const w3 = await newStudent({ gender: "woman", optin: false });
    const m = await newStudent({ gender: "man" });
    const date = campusDay(23);
    const wo = await postTrip(w1, { date, womenOnly: true });
    const t2 = await postTrip(w2, { date });
    const t3 = await postTrip(w3, { date });
    const tm = await postTrip(m, { date });
    expect((await candidates(w2, t2.id)).map((c) => c.trip_id)).toContain(wo.id);
    expect((await candidates(w3, t3.id)).map((c) => c.trip_id)).not.toContain(wo.id);
    expect((await candidates(m, tm.id)).map((c) => c.trip_id)).not.toContain(wo.id);
    // ...and w1 doesn't see the ineligible people either, but ordinary matching for them is untouched.
    expect((await candidates(w1, wo.id)).map((c) => c.trip_id)).toEqual([t2.id]);
    expect((await candidates(m, tm.id)).map((c) => c.trip_id).sort()).toEqual([t2.id, t3.id].sort());
    // Share link and requests are closed too.
    expect((await anon().rpc("share_card", { p_token: wo.share_token })).data).toEqual([]);
    expect((await m.client.rpc("share_card", { p_token: wo.share_token })).data).toEqual([]);
    expect((await m.client.rpc("send_connect_request", { p_my_trip: tm.id, p_their_trip: wo.id })).error?.message).toContain("not_eligible");
  });

  it("connect requests: no duplicates, rate-limited, declined pairs never resurface", async () => {
    await admin().from("app_settings").update({ connect_daily_limit: 2 }).eq("id", true);
    const a = await newStudent();
    const others = await Promise.all([newStudent(), newStudent(), newStudent()]);
    const date = campusDay(24);
    const mine = await postTrip(a, { date });
    const theirs = await Promise.all(others.map((o) => postTrip(o, { date })));
    const send = (i: number) => a.client.rpc("send_connect_request", { p_my_trip: mine.id, p_their_trip: theirs[i].id });

    const first = await send(0);
    expect(first.error).toBeNull();
    expect((await send(0)).error?.message).toContain("duplicate_request");
    // the reverse direction is the same pair
    const back = await others[0].client.rpc("send_connect_request", { p_my_trip: theirs[0].id, p_their_trip: mine.id });
    expect(back.error?.message).toContain("duplicate_request");
    expect((await send(1)).error).toBeNull();
    expect((await send(2)).error?.message).toContain("rate_limited");

    await others[0].client.rpc("respond_to_request", { p_match: first.data, p_accept: false });
    expect((await candidates(a, mine.id)).map((c) => c.trip_id)).not.toContain(theirs[0].id);
  });

  it("block revokes everything immediately, in both directions", async () => {
    const a = await newStudent();
    const b = await newStudent();
    const date = campusDay(25);
    const ta = await postTrip(a, { date, vehicle: "11111" });
    const tb = await postTrip(b, { date, vehicle: "11111" });
    const { data: matchId } = await a.client.rpc("send_connect_request", { p_my_trip: ta.id, p_their_trip: tb.id });
    await b.client.rpc("respond_to_request", { p_match: matchId, p_accept: true });
    await a.client.from("messages").insert({ match_id: matchId, body: "see you", client_id: crypto.randomUUID() });
    expect((await b.client.rpc("match_details", { p_match: matchId })).data).toHaveLength(2);

    await b.client.rpc("block_user", { p_user: a.id });
    for (const s of [a, b]) {
      expect((await s.client.rpc("match_details", { p_match: matchId })).data).toEqual([]);
      expect((await s.client.from("messages").select("*").eq("match_id", matchId)).data).toEqual([]);
      expect((await s.client.rpc("my_inbox")).data).toEqual([]);
    }
    expect((await a.client.from("messages").insert({ match_id: matchId, body: "hello?", client_id: crypto.randomUUID() })).error).toBeTruthy();
    expect(await candidates(a, ta.id)).toEqual([]);
    expect((await a.client.rpc("share_card", { p_token: tb.share_token })).data).toEqual([]);
  });

  it("reports: deduplicated, rate-limited, auto-suspend on distinct reporters only", async () => {
    await admin().from("app_settings").update({ suspend_threshold: 2, report_daily_limit: 2 }).eq("id", true);
    const target = await newStudent();
    const r1 = await newStudent();
    const r2 = await newStudent();
    const date = campusDay(26);
    const tt = await postTrip(target, { date });
    const t1 = await postTrip(r1, { date });

    await r1.client.rpc("report_user", { p_user: target.id, p_context: "profile", p_reason: "rude" });
    await r1.client.rpc("report_user", { p_user: target.id, p_context: "profile", p_reason: "rude again" }); // deduped
    const suspended = async () => (await admin().from("private_profiles").select("is_suspended").eq("user_id", target.id).single()).data!.is_suspended;
    expect(await suspended()).toBe(false);
    expect((await r1.client.rpc("report_user", { p_user: target.id, p_context: "match:x", p_reason: "spam" })).error).toBeNull();
    expect((await r1.client.rpc("report_user", { p_user: r2.id, p_context: "profile", p_reason: "x" })).error?.message).toContain("rate_limited");
    expect(await suspended()).toBe(false); // still one distinct reporter

    await r2.client.rpc("report_user", { p_user: target.id, p_context: "profile", p_reason: "harassment" });
    expect(await suspended()).toBe(true);
    // Suspended: gone from matching, share links and demand; can't post.
    expect((await candidates(r1, t1.id)).map((c) => c.trip_id)).not.toContain(tt.id);
    expect((await anon().rpc("share_card", { p_token: tt.share_token })).data).toEqual([]);
    await expect(postTrip(target, { date: campusDay(27) })).rejects.toBeTruthy();
    // The reported person can't read reports about themselves.
    expect((await target.client.from("reports").select("*")).data).toEqual([]);
  });
});
