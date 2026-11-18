// Owner decision 18 Nov 2026: LPU is live; unlisted domains get provisional access pending admin review.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin, anon, campusDay, candidates, hasDb, newStudent, postTrip, signIn } from "./helpers";

describe.skipIf(!hasDb)("college registry and provisional access", () => {
  it("LPU is live on @lpu.in", async () => {
    const { data } = await anon().rpc("college_for_email", { p_email: "someone.12345678@lpu.in" });
    expect(data[0]).toEqual({ status: "active", name: "Lovely Professional University" });
  });

  it("webmail never gets in, even straight through the Auth API", async () => {
    expect((await anon().rpc("college_for_email", { p_email: "x@gmail.com" })).data[0].status).toBe("public");
    expect((await anon().rpc("request_college", { p_email: "x@gmail.com" })).error).toBeTruthy();
    expect((await admin().auth.admin.createUser({ email: `t-${randomUUID().slice(0, 6)}@gmail.com`, email_confirm: true })).error).toBeTruthy();
  });

  it("an unlisted domain signs in provisionally, matches only its own domain, and is switched off on reject", async () => {
    const domain = `college-${randomUUID().slice(0, 6)}.ac.in`;
    const a = await newStudent({ domain });
    const b = await newStudent({ domain });
    const outsider = await newStudent(); // example.edu, same hubs exist there too
    const { data: college } = await a.client.rpc("my_college");
    expect(college[0]).toMatchObject({ status: "requested", name: domain });

    const date = campusDay(40);
    const trip = (s: typeof a) => postTrip(s, { date, from: "Campus", to: "Delhi", fromPoint: "Gate" });
    const ta = await trip(a);
    const tb = await trip(b);
    await postTrip(outsider, { date, from: "Demo Campus", to: "Delhi" });
    expect((await candidates(a, ta.id)).map((c) => c.trip_id)).toEqual([tb.id]);

    // The queue shows it with its student count; a moderator rejects it.
    const kavya = await signIn("kavya@example.edu");
    const queue = (await kavya.rpc("admin_requested_colleges")).data as { id: string; domain: string; students: number }[];
    const row = queue.find((q) => q.domain === domain)!;
    expect(row.students).toBe(2);
    expect((await a.client.rpc("admin_reject_college", { p_id: row.id })).error?.message).toContain("not_allowed");
    expect((await kavya.rpc("admin_reject_college", { p_id: row.id })).error).toBeNull();

    expect(await candidates(b, tb.id)).toEqual([]);
    expect((await anon().rpc("share_card", { p_token: ta.share_token })).data).toEqual([]);
    await expect(trip(a)).rejects.toBeTruthy();
    expect((await admin().auth.admin.createUser({ email: `late@${domain}`, email_confirm: true })).error).toBeTruthy();
  });

  it("approving a provisional college makes it a normal live campus", async () => {
    const domain = `college-${randomUUID().slice(0, 6)}.edu.in`;
    const a = await newStudent({ domain });
    const kavya = await signIn("kavya@example.edu");
    const row = ((await kavya.rpc("admin_requested_colleges")).data as { id: string; domain: string }[]).find((q) => q.domain === domain)!;
    const { error } = await kavya.rpc("admin_activate_college", {
      p_id: row.id, p_name: "Test College", p_code: `T${randomUUID().slice(0, 4)}`, p_city: "Test City",
      p_hubs: ["Test Campus", "Delhi"], p_timezone: "Asia/Kolkata",
    });
    expect(error).toBeNull();
    expect((await a.client.rpc("my_college")).data[0]).toMatchObject({ status: "active", name: "Test College" });
    expect((await anon().rpc("active_colleges")).data.map((c: { name: string }) => c.name)).toContain("Test College");
  });
});
