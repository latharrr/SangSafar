import { describe, expect, it } from "vitest";
import {
  campusNow,
  gapMinutes,
  rankCandidates,
  rankReason,
  routeScore,
  scoreMatch,
  timeScore,
  validateTrip,
  type CandidateShape,
  type TripShape,
} from "./matching";

const mine: TripShape = {
  id: "t1",
  ownerId: "u1",
  travelDate: "2026-12-01",
  fromHub: "Demo Campus",
  fromPoint: "Main Gate",
  toHub: "Delhi",
  toPoint: "New Delhi Rly Stn",
  start: "18:00",
  end: "19:30",
};
const cand = (over: Partial<CandidateShape> = {}): CandidateShape => ({
  ...mine,
  id: "t2",
  ownerId: "u2",
  sameVehicle: false,
  sameCollege: true,
  ...over,
});

describe("route gate", () => {
  it("excludes unrelated routes even with perfect time and bonuses", () => {
    expect(scoreMatch(mine, cand({ toHub: "Chandigarh", sameVehicle: true }))).toBeNull();
  });
  it("excludes the reversed route", () => {
    expect(scoreMatch(mine, cand({ fromHub: "Delhi", toHub: "Demo Campus" }))).toBeNull();
  });
  it("scores 100 for same pickup and drop, 60 for same hubs only", () => {
    expect(routeScore(mine, cand())).toBe(100);
    expect(routeScore(mine, cand({ fromPoint: " main gate " }))).toBe(100);
    expect(routeScore(mine, cand({ toPoint: "ISBT Kashmere Gate" }))).toBe(60);
  });
});

describe("time decay", () => {
  it("is 40 when windows overlap and 0 at 4+ hours", () => {
    expect(gapMinutes(mine, cand({ start: "19:00", end: "20:00" }))).toBe(0);
    expect(timeScore(0)).toBe(40);
    expect(timeScore(90)).toBe(25);
    expect(timeScore(240)).toBe(0);
    expect(timeScore(600)).toBe(0);
  });
  it("measures the gap from either side", () => {
    expect(gapMinutes(mine, cand({ start: "20:30", end: "21:00" }))).toBe(60);
    expect(gapMinutes(mine, cand({ start: "16:00", end: "17:00" }))).toBe(60);
  });
});

describe("scoring", () => {
  it("adds +30 same vehicle and +20 same college", () => {
    expect(scoreMatch(mine, cand({ sameCollege: false }))).toBe(140);
    expect(scoreMatch(mine, cand())).toBe(160);
    expect(scoreMatch(mine, cand({ sameVehicle: true }))).toBe(190);
  });
  it("rejects matching a user's own trip", () => {
    expect(scoreMatch(mine, cand({ ownerId: "u1" }))).toBeNull();
    expect(scoreMatch(mine, cand({ id: "t1", ownerId: "u9" }))).toBeNull();
  });
  it("rejects a different date", () => {
    expect(scoreMatch(mine, cand({ travelDate: "2026-12-02" }))).toBeNull();
  });
  it("ranks route over time, and time over nothing", () => {
    const ranked = rankCandidates(mine, [
      cand({ id: "far", start: "23:00", end: "23:30" }),
      cand({ id: "hubonly", toPoint: "Anand Vihar" }),
      cand({ id: "best" }),
      cand({ id: "other-route", toHub: "Chandigarh" }),
    ]);
    expect(ranked.map((c) => c.id)).toEqual(["best", "far", "hubonly"]);
  });
});

describe("rank reason", () => {
  it("never mentions numbers of vehicles or scores", () => {
    const r = rankReason(mine, cand({ start: "16:30", end: "17:20" }));
    expect(r).toBe("Leaves 40 min before your window starts · same pickup and drop");
    expect(rankReason(mine, cand({ start: "18:15", end: "19:00" }))).toMatch(/^Leaves within your window/);
    expect(rankReason(mine, cand({ start: "19:00", end: "21:00", toPoint: "x" }))).toBe("Windows overlap by 30 min");
    expect(rankReason(mine, cand({ start: "17:00", end: "18:00", toPoint: "x" }))).toBe("Leaves just as your window starts");
  });
});

describe("dates and timezones", () => {
  it("uses campus time, not UTC", () => {
    // 20:00 UTC on 30 Nov is 01:30 on 1 Dec in India
    const now = campusNow("Asia/Kolkata", new Date("2026-11-30T20:00:00Z"));
    expect(now).toEqual({ today: "2026-12-01", minutes: 90 });
  });
  const hubs = ["Demo Campus", "Delhi"];
  const now = { today: "2026-12-01", minutes: 600 };
  const ok = { fromHub: "Demo Campus", toHub: "Delhi", date: "2026-12-01", start: "18:00", end: "19:00" };
  it("accepts a valid trip", () => expect(validateTrip(ok, hubs, now)).toEqual({}));
  it("rejects past dates, same route, reversed and overnight windows, passed windows", () => {
    expect(validateTrip({ ...ok, date: "2026-11-30" }, hubs, now).date).toBeTruthy();
    expect(validateTrip({ ...ok, toHub: "Demo Campus" }, hubs, now).toHub).toBeTruthy();
    expect(validateTrip({ ...ok, start: "23:00", end: "01:00" }, hubs, now).end).toMatch(/midnight/);
    expect(validateTrip({ ...ok, start: "08:00", end: "09:00" }, hubs, now).end).toMatch(/passed/);
    expect(validateTrip({ ...ok, toHub: "Mumbai" }, hubs, now).toHub).toBeTruthy();
  });
});
