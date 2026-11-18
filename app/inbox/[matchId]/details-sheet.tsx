"use client";

import { useEffect, useRef } from "react";
import { dayLabel, MODE_LABEL, windowLabel } from "@/lib/format";
import type { Mode } from "@/lib/config";

export type DetailRow = {
  side: "me" | "them";
  first_name: string;
  mode: Mode;
  from_point: string | null;
  to_point: string | null;
  travel_date: string;
  depart_start: string;
  depart_end: string;
  vehicle_no: string | null;
  meetup_point: string | null;
  notes: string | null;
};

/** Unlocked trip details, pinned above the chat. Unfolds once, the first time the accept lands. */
export function DetailsSheet({ matchId, rows }: { matchId: string; rows: DetailRow[] }) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    // Only a "seen" flag is stored, never the details themselves.
    try {
      const key = `details-seen:${matchId}`;
      if (!localStorage.getItem(key)) {
        sheet.current?.classList.add("unfold");
        localStorage.setItem(key, "1");
      }
    } catch {}
  }, [matchId]);

  const ordered = [...rows.filter((r) => r.side === "them"), ...rows.filter((r) => r.side === "me")];
  if (!ordered.length) return null;
  return (
    <section ref={sheet} aria-label="Trip details" className="sheet mt-4 grid gap-4 p-4 sm:grid-cols-2">
      {ordered.map((d) => (
        <div key={d.side} className="min-w-0">
          <h3 className="text-small font-semibold">{d.side === "me" ? "Your trip" : `${d.first_name}'s trip`}</h3>
          <dl className="tnum mt-2 grid gap-1 text-small">
            <Row k="Leaving" v={`${dayLabel(d.travel_date)} · ${windowLabel(d.depart_start, d.depart_end)} · ${MODE_LABEL[d.mode]}`} />
            {(d.from_point || d.to_point) && <Row k="Route" v={`${d.from_point ?? "?"} to ${d.to_point ?? "?"}`} />}
            {d.vehicle_no && <Row k={d.mode === "flight" ? "Flight" : "Train"} v={d.vehicle_no} />}
            {d.meetup_point && <Row k="Meetup" v={d.meetup_point} />}
            {d.notes && <Row k="Notes" v={d.notes} />}
            {!d.vehicle_no && !d.meetup_point && !d.notes && <p className="text-ink-soft">No extra details added.</p>}
          </dl>
        </div>
      ))}
    </section>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="grid grid-cols-[64px_1fr] gap-2">
    <dt className="text-ink-soft">{k}</dt>
    <dd className="break-words">{v}</dd>
  </div>
);
