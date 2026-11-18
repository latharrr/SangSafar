// Section 4.1 required test: with the anon key exactly as the browser has it
// (and as a signed-in student), direct reads of every base table must never
// reach anyone else's private fields.
import { describe, expect, it } from "vitest";
import { admin, anon, campusDay, hasDb, SEED, signIn } from "./helpers";

const TABLES = [
  "colleges", "app_settings", "admins", "public_profiles", "private_profiles", "trips", "private_trip_details",
  "matches", "messages", "reports", "blocks", "travel_confirmations", "cab_pools",
];

// Private values present in the seed that belong to people other than Aarav.
const OTHERS_PRIVATE = [
  "ishaan@example.edu", "meera@example.edu", "Ishaan (fictional)", "Electronics", "woman",
  "12011", "6E 2134", "Coach B2", "Leaving straight after", "Hostel 4 parking", "Kept messaging",
  "Train's 20 min late", // a chat Aarav is not part of
];

describe.skipIf(!hasDb)("privacy sweep", () => {
  it("anon can select nothing from any base table", async () => {
    const db = anon();
    for (const table of TABLES) {
      const { data } = await db.from(table).select("*").limit(50);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("a signed-in student sees only their own rows, and no one else's private fields", async () => {
    const aarav = await signIn("aarav@example.edu");
    const dump: string[] = [];
    for (const table of TABLES) {
      const { data } = await aarav.from(table).select("*").limit(200);
      dump.push(JSON.stringify(data ?? []));
    }
    const all = dump.join("\n");
    for (const secret of OTHERS_PRIVATE) expect(all, secret).not.toContain(secret);
    // Own data is visible (so the sweep is actually reading).
    expect(all).toContain("aarav@example.edu");
  });

  it("server-only and admin functions are closed to the browser", async () => {
    const db = anon();
    expect((await db.rpc("match_candidates", { p_viewer: SEED.user(1), p_trip: SEED.trip(1) })).error).toBeTruthy();
    expect((await db.rpc("purge_user", { p_user: SEED.user(1) })).error).toBeTruthy();
    expect((await db.rpc("run_housekeeping")).error).toBeTruthy();
    const aarav = await signIn("aarav@example.edu");
    expect((await aarav.rpc("match_candidates", { p_viewer: SEED.user(1), p_trip: SEED.trip(1) })).error).toBeTruthy();
    expect((await aarav.rpc("admin_report_queue")).error?.message).toContain("not_allowed");
    expect((await aarav.rpc("admin_set_suspended", { p_user: SEED.user(3), p_suspended: true })).error?.message).toContain("not_allowed");
  });

  it("badges, suspension and email are not user-editable", async () => {
    const aarav = await signIn("aarav@example.edu");
    expect((await aarav.from("public_profiles").update({ id_checked: true }).eq("user_id", SEED.user(1))).error).toBeTruthy();
    expect((await aarav.from("private_profiles").update({ is_suspended: false }).eq("user_id", SEED.user(1))).error).toBeTruthy();
    expect((await aarav.from("private_profiles").update({ email: "x@example.edu" }).eq("user_id", SEED.user(1))).error).toBeTruthy();
    // and can't edit someone else's allowed columns either
    await aarav.from("public_profiles").update({ first_name: "Hacked" }).eq("user_id", SEED.user(3));
    const { data } = await admin().from("public_profiles").select("first_name").eq("user_id", SEED.user(3)).single();
    expect(data!.first_name).toBe("Ishaan");
  });

  it("match details and chat stay locked before acceptance", async () => {
    // Kabir -> Rohan is pending in the seed.
    const kabir = await signIn("kabir@example.edu");
    const pending = SEED.match(4);
    expect((await kabir.rpc("match_details", { p_match: pending })).data).toEqual([]);
    expect((await kabir.from("messages").select("*").eq("match_id", pending)).data).toEqual([]);
    const send = await kabir.from("messages").insert({ match_id: pending, body: "hi", client_id: crypto.randomUUID() });
    expect(send.error).toBeTruthy();
    // Someone outside an accepted match can't read it either.
    expect((await kabir.from("messages").select("*").eq("match_id", SEED.match(2))).data).toEqual([]);
    expect((await kabir.rpc("match_details", { p_match: SEED.match(2) })).data).toEqual([]);
  });

  it("an accepted match unlocks both sides symmetrically", async () => {
    const aarav = await signIn("aarav@example.edu");
    const { data } = await aarav.rpc("match_details", { p_match: SEED.match(1) });
    expect(data.map((d: { side: string; vehicle_no: string }) => [d.side, d.vehicle_no]).sort()).toEqual([["me", "12046"], ["them", "12046"]]);
    expect((await aarav.from("messages").select("id").eq("match_id", SEED.match(1))).data!.length).toBe(4);
  });

  it("share links reveal only route, date and mode when logged out", async () => {
    const { data: trip } = await admin().from("trips").select("share_token").eq("id", SEED.trip(1)).single();
    const { data } = await anon().rpc("share_card", { p_token: trip!.share_token });
    expect(data).toHaveLength(1);
    const card = data[0];
    expect(card).toMatchObject({ from_hub: "Demo Campus", to_hub: "Delhi", mode: "train", first_name: null, college_name: null, depart_start: null, trip_id: null });
    // A verified same-college student gets the card, still without private details.
    const meera = await signIn("meera@example.edu");
    const { data: full } = await meera.rpc("share_card", { p_token: trip!.share_token });
    expect(full[0]).toMatchObject({ first_name: "Aarav", depart_start: "18:00:00" });
    expect(JSON.stringify(full)).not.toContain("12046");
  });

  it("demand counts distinct students and suppresses anything under 5", async () => {
    const { data } = await anon().rpc("demand_strip", { p_college: SEED.college, p_from: "Demo Campus", p_to: "Delhi", p_start: campusDay(0) });
    const byDay = Object.fromEntries(data.map((d: { day: string; students: number | null }) => [d.day, d.students]));
    expect(byDay[campusDay(2)]).toBe(7);
    expect(byDay[campusDay(3)]).toBeNull(); // 2 students: "low demand"
    expect(byDay[campusDay(0)]).toBeNull(); // 0 students looks identical to 1-4
    // Women-only trips never count: 7 trips on this day, 2 women-only, 5 shown.
    const chd = await anon().rpc("demand_strip", { p_college: SEED.college, p_from: "Demo Campus", p_to: "Chandigarh", p_start: campusDay(4) });
    expect(chd.data[0].students).toBe(5);
    // No arbitrary windows: past or far-future starts are refused.
    expect((await anon().rpc("demand_strip", { p_college: SEED.college, p_from: "Demo Campus", p_to: "Delhi", p_start: campusDay(-1) })).error).toBeTruthy();
  });
});
