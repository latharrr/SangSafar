import { toMinutes } from "@/lib/matching";
import { windowLabel } from "@/lib/format";

type Win = { start: string; end: string };
const pct = (t: string) => (toMinutes(t) / 1440) * 100;

function Bar({ w, className, row }: { w: Win; className: string; row: 0 | 1 }) {
  return (
    <span
      className={`absolute h-2 rounded-full ${className}`}
      style={{ left: `${pct(w.start)}%`, width: `${Math.max(pct(w.end) - pct(w.start), 0.6)}%`, top: row ? 14 : 4 }}
    />
  );
}

/**
 * 00:00–24:00 track, minute-accurate. Your window in ink, theirs in line color,
 * the overlap in vermilion across both lanes. Exact times are always in text too.
 */
export function TimeRuler({ mine, theirs, theirName }: { mine?: Win | null; theirs?: Win | null; theirName: string }) {
  const overlap =
    mine && theirs && Math.min(toMinutes(mine.end), toMinutes(theirs.end)) > Math.max(toMinutes(mine.start), toMinutes(theirs.start))
      ? {
          start: toMinutes(mine.start) > toMinutes(theirs.start) ? mine.start : theirs.start,
          end: toMinutes(mine.end) < toMinutes(theirs.end) ? mine.end : theirs.end,
        }
      : null;
  const label = [
    mine && `Your window ${windowLabel(mine.start, mine.end)}`,
    theirs && `${theirName}'s window ${windowLabel(theirs.start, theirs.end)}`,
    overlap ? `overlapping ${windowLabel(overlap.start, overlap.end)}` : mine && theirs ? "no overlap" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="w-full">
      <div className="relative h-6 w-full" role="img" aria-label={label}>
        <span className="absolute inset-x-0 top-[11px] h-px bg-line" />
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <span
            key={h}
            className={`absolute top-[7px] h-[9px] w-px bg-line ${h % 6 ? "hidden sm:block" : ""}`}
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}
        {theirs && <Bar w={theirs} row={0} className="bg-line-strong" />}
        {mine && <Bar w={mine} row={1} className="bg-ink" />}
        {overlap && (
          <>
            <Bar w={overlap} row={0} className="bg-accent" />
            <Bar w={overlap} row={1} className="bg-accent" />
          </>
        )}
      </div>
      <div className="tnum relative mt-1 h-4 text-micro text-ink-soft" aria-hidden>
        {[0, 6, 12, 18, 24].map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>
      <p className="tnum mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-soft">
        {theirs && (
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded-full bg-line-strong align-middle" />
            {theirName} {windowLabel(theirs.start, theirs.end)}
          </span>
        )}
        {mine && (
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded-full bg-ink align-middle" />
            You {windowLabel(mine.start, mine.end)}
          </span>
        )}
        {overlap && (
          <span className="text-accent">
            <span className="mr-1 inline-block h-2 w-3 rounded-full bg-accent align-middle" />
            Overlap {windowLabel(overlap.start, overlap.end)}
          </span>
        )}
      </p>
    </div>
  );
}
