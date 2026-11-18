import Link from "next/link";
import { RouteMini } from "@/components/route-line";
import { dayLabel } from "@/lib/format";
import { nameOf, type InboxRow } from "./data";

export function ChatList({ rows, activeId }: { rows: InboxRow[]; activeId?: string }) {
  return (
    <ul className="mt-6 border-t border-line">
      {rows.map((r) => (
        <li key={r.match_id} className="border-b border-line">
          <Link
            href={`/inbox/${r.match_id}`}
            aria-current={r.match_id === activeId ? "page" : undefined}
            className="flex min-h-16 items-center gap-3 px-2 py-3 hover:bg-raised/60 aria-[current=page]:bg-raised"
          >
            <RouteMini mode={r.mode} state={r.status === "accepted" ? "active" : "resting"} />
            <span className="min-w-0 flex-1">
              <span className={`block font-medium break-words ${r.other_first_name ? "" : "text-ink-soft"}`}>{nameOf(r)}</span>
              <span className="tnum block truncate text-small text-ink-soft">
                {r.to_hub} · {dayLabel(r.travel_date)}
                {r.status !== "accepted" && " · closed"}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
