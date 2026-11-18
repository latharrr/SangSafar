import Link from "next/link";
import { RouteMini } from "@/components/route-line";
import { TravelledBadge } from "@/components/badges";
import { dayLabel, MODE_LABEL, windowLabel } from "@/lib/format";
import type { Mode } from "@/lib/config";

export type MyTrip = {
  id: string;
  mode: Mode;
  from_hub: string;
  from_point: string | null;
  to_hub: string;
  to_point: string | null;
  travel_date: string;
  depart_start: string;
  depart_end: string;
  women_only: boolean;
  status: "draft" | "live" | "archived";
  share_token: string;
  vehicle_no: string | null;
  meetup_point: string | null;
  notes: string | null;
  incoming_pending: number;
  connected: number;
  travelled_together: boolean;
};

const STATUS: Record<MyTrip["status"], string> = { live: "", draft: "Hidden", archived: "Past" };

/** A trip as one row: compact route line, places, date + window, state. */
export function TripRow({ trip }: { trip: MyTrip }) {
  const state = [
    STATUS[trip.status],
    trip.incoming_pending ? `${trip.incoming_pending} new request${trip.incoming_pending > 1 ? "s" : ""}` : "",
    trip.connected ? `${trip.connected} connected` : "",
  ].filter(Boolean);
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={`/trips/${trip.id}`} className="flex min-h-16 items-center gap-4 py-4 hover:bg-raised/60 sm:px-3">
        <RouteMini mode={trip.mode} state={trip.status === "live" ? "active" : "resting"} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium break-words">
            {trip.from_hub} to {trip.to_hub}
          </span>
          <span className="tnum block text-small text-ink-soft">
            {dayLabel(trip.travel_date)} · {windowLabel(trip.depart_start, trip.depart_end)} · {MODE_LABEL[trip.mode]}
            {trip.women_only && " · Women-only"}
          </span>
          {(trip.travelled_together || state.length > 0) && (
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
              {trip.travelled_together && <TravelledBadge />}
              {state.map((s) => (
                <span key={s} className={s.includes("request") ? "font-medium text-accent" : "text-ink-soft"}>
                  {s}
                </span>
              ))}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
