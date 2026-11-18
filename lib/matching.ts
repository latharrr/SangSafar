// Ranking + validation. Pure functions, no I/O, unit-tested in matching.test.ts.
// The database (app.pair_eligible) enforces the same hard gates plus block,
// suspension and women-only rules; this file ranks what passes them.

export type TripShape = {
  id: string;
  ownerId: string;
  travelDate: string; // YYYY-MM-DD, campus-local
  fromHub: string;
  fromPoint: string | null;
  toHub: string;
  toPoint: string | null;
  start: string; // HH:MM or HH:MM:SS, campus-local
  end: string;
};

export type CandidateShape = TripShape & {
  sameVehicle: boolean; // server-only signal, never sent to the browser
  sameCollege: boolean;
};

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const hhmm = (t: string) => t.slice(0, 5);

/** Minutes between two windows; 0 when they overlap. */
export function gapMinutes(a: Pick<TripShape, "start" | "end">, b: Pick<TripShape, "start" | "end">) {
  return Math.max(0, toMinutes(b.start) - toMinutes(a.end), toMinutes(a.start) - toMinutes(b.end));
}

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();

/** 100 same pickup + drop, 60 same hubs only, 0 otherwise (excluded). */
export function routeScore(a: TripShape, b: TripShape) {
  if (a.fromHub !== b.fromHub || a.toHub !== b.toHub) return 0;
  return norm(a.fromPoint) === norm(b.fromPoint) && norm(a.toPoint) === norm(b.toPoint) ? 100 : 60;
}

/** 40 when windows overlap, minus 10 per hour apart, 0 at 4+ hours. */
export const timeScore = (gapMin: number) => Math.max(0, 40 - (10 * gapMin) / 60);

/** Score, or null when a hard gate fails. Route dominates, time decays, bonuses break ties. */
export function scoreMatch(mine: TripShape, theirs: CandidateShape): number | null {
  if (mine.ownerId === theirs.ownerId || mine.id === theirs.id) return null;
  if (mine.travelDate !== theirs.travelDate) return null;
  const route = routeScore(mine, theirs);
  if (route === 0) return null;
  return route + timeScore(gapMinutes(mine, theirs)) + (theirs.sameVehicle ? 30 : 0) + (theirs.sameCollege ? 20 : 0);
}

export function durationWords(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h} h ${m} min`;
  return h ? `${h} h` : `${m} min`;
}

/**
 * Why this person ranks where they do, in words. Uses route and departure
 * windows only: never the score, never same-train/flight inference.
 */
export function rankReason(mine: TripShape, theirs: TripShape) {
  const [ms, me, ts, te] = [mine.start, mine.end, theirs.start, theirs.end].map(toMinutes);
  const overlap = Math.min(me, te) - Math.max(ms, ts);
  const sameStops = routeScore(mine, theirs) === 100;
  let time: string;
  if (overlap > 0) {
    time = ts >= ms && te <= me ? "Leaves within your window" : `Windows overlap by ${durationWords(overlap)}`;
  } else if (te === ms) {
    time = "Leaves just as your window starts";
  } else if (ts === me) {
    time = "Leaves just as your window ends";
  } else if (te < ms) {
    time = `Leaves ${durationWords(ms - te)} before your window starts`;
  } else {
    time = `Leaves ${durationWords(ts - me)} after your window ends`;
  }
  return sameStops ? `${time} · same pickup and drop` : time;
}

export function rankCandidates<C extends CandidateShape>(mine: TripShape, candidates: C[]) {
  return candidates
    .map((c) => ({ c, score: scoreMatch(mine, c) }))
    .filter((x): x is { c: C; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score || toMinutes(a.c.start) - toMinutes(b.c.start))
    .map(({ c }) => c);
}

/** Today's date and minutes-past-midnight on campus. */
export function campusNow(timeZone: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { today: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type TripInput = { fromHub: string; toHub: string; date: string; start: string; end: string };

/** Field errors for the trip form. The database re-checks all of these. */
export function validateTrip(input: TripInput, hubs: string[], now: { today: string; minutes: number }) {
  const errors: Partial<Record<keyof TripInput, string>> = {};
  if (!hubs.includes(input.fromHub)) errors.fromHub = "Pick where you're leaving from.";
  if (!hubs.includes(input.toHub)) errors.toHub = "Pick where you're going.";
  else if (input.fromHub === input.toHub) errors.toHub = "From and to are the same place. Pick a different destination.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.date = "Pick a travel date.";
  else if (input.date < now.today) errors.date = "That date has passed. Pick today or later.";
  else if (input.date > addDays(now.today, 180)) errors.date = "Trips can be posted up to 6 months ahead.";
  const timeOk = /^\d{2}:\d{2}/;
  if (!timeOk.test(input.start)) errors.start = "Add the earliest time you could leave.";
  if (!timeOk.test(input.end)) errors.end = "Add the latest time you could leave.";
  else if (timeOk.test(input.start) && toMinutes(input.end) <= toMinutes(input.start)) {
    errors.end =
      "The window must end after it starts. For a trip across midnight, post two trips, one for each date.";
  } else if (!errors.date && input.date === now.today && toMinutes(input.end) <= now.minutes) {
    errors.end = "That window has already passed today.";
  }
  return errors;
}
