"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { addDays, campusNow } from "@/lib/matching";
import { dayLabel } from "@/lib/format";
import type { College } from "@/lib/session";

type Day = { day: string; students: number | null };

// Fixed density scale for unsuppressed counts (always >= 5). Suppressed days
// all get the same single hollow dot, so dots never encode a hidden value.
const dotsFor = (n: number) => (n >= 40 ? 6 : n >= 20 ? 5 : n >= 10 ? 4 : 3);

export function DemandStepper({ colleges, collegeId, signedIn }: { colleges: College[]; collegeId?: string; signedIn: boolean }) {
  const [cid, setCid] = useState(collegeId ?? colleges[0]?.id);
  const college = colleges.find((c) => c.id === cid) ?? colleges[0];
  const today = college ? campusNow(college.timezone).today : "";
  const [from, setFrom] = useState(college?.hubs[0] ?? "");
  const [to, setTo] = useState(college?.hubs[1] ?? "");
  const [start, setStart] = useState(today);
  const [selected, setSelected] = useState(today);
  const [attempt, setAttempt] = useState(0);
  // Results are keyed by the query, so a changed route shows loading without resetting state in the effect.
  const key = `${college?.id}|${from}|${to}|${start}|${attempt}`;
  const [result, setResult] = useState<{ key: string; days?: Day[]; failed?: boolean }>({ key: "" });
  const days = result.key === key ? (result.days ?? null) : null;
  const failed = result.key === key && !!result.failed;

  useEffect(() => {
    if (!college || !from || !to || from === to) return;
    let live = true;
    createClient()
      .rpc("demand_strip", { p_college: college.id, p_from: from, p_to: to, p_start: start })
      .then(({ data, error }) => {
        if (!live) return;
        setResult(error ? { key, failed: true } : { key, days: data as Day[] });
      });
    return () => {
      live = false;
    };
  }, [college, from, to, start, key]);

  if (!college) return <p className="text-body text-ink-soft">No campus is live yet.</p>;

  const pick = (c: College) => {
    setCid(c.id);
    setFrom(c.hubs[0]);
    setTo(c.hubs[1]);
  };
  const sel = days?.find((d) => d.day === selected);
  const postHref = `/post?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${selected}`;
  const canBack = start > today;
  const canForward = addDays(start, 7) <= addDays(today, 60);

  return (
    <section aria-labelledby="demand-title" className="w-full">
      <h2 id="demand-title" className="text-h2 font-semibold md:text-h2-lg">
        Who&apos;s travelling your way
      </h2>
      {colleges.length > 1 && (
        <div className="mt-4 max-w-xs">
          <label htmlFor="college" className="label">
            Campus
          </label>
          <select id="college" className="field" value={cid} onChange={(e) => pick(colleges.find((c) => c.id === e.target.value)!)}>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <label htmlFor="demand-from" className="label">
            From
          </label>
          <select id="demand-from" className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
            {college.hubs.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="mb-0 flex h-11 w-12 items-center justify-center rounded-full hover:bg-line/50"
          aria-label="Swap from and to"
        >
          <svg viewBox="0 0 48 16" className="w-11" aria-hidden>
            <path d="M5 8H43" stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" />
            <circle cx="5" cy="8" r="4" fill="var(--paper-raised)" stroke="var(--ink)" strokeWidth={1.75} />
            <circle cx="43" cy="8" r="4" fill="var(--accent)" stroke="var(--ink)" strokeWidth={1.75} />
          </svg>
        </button>
        <div className="max-sm:col-span-2">
          <label htmlFor="demand-to" className="label">
            To
          </label>
          <select id="demand-to" className="field" value={to} onChange={(e) => setTo(e.target.value)}>
            {college.hubs.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>

      {from === to ? (
        <p className="mt-6 text-body text-ink-soft">Pick two different places to see demand.</p>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between">
            <p className="text-small text-ink-soft">
              {dayLabel(start, { day: "numeric", month: "short" })} – {dayLabel(addDays(start, 6), { day: "numeric", month: "short" })}
            </p>
            <div className="flex gap-1">
              <button type="button" className="btn btn-ghost w-11 px-0" disabled={!canBack} onClick={() => setStart(addDays(start, -7) < today ? today : addDays(start, -7))} aria-label="Previous 7 days">
                <ChevronIcon dir="left" />
              </button>
              <button type="button" className="btn btn-ghost w-11 px-0" disabled={!canForward} onClick={() => setStart(addDays(start, 7))} aria-label="Next 7 days">
                <ChevronIcon />
              </button>
            </div>
          </div>

          {failed ? (
            <div role="alert" className="mt-3 flex items-center gap-3 text-body">
              Couldn&apos;t load demand.
              <button type="button" className="btn btn-quiet" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </button>
            </div>
          ) : (
            <ol className="mt-3 grid grid-cols-7 border-y border-line" aria-busy={!days}>
              {Array.from({ length: 7 }, (_, i) => {
                const date = addDays(start, i);
                const d = days?.[i];
                const isSel = date === selected;
                const label = d
                  ? `${dayLabel(date, { weekday: "long", day: "numeric", month: "long" })}: ${d.students === null ? "low demand, fewer than 5 students" : `${d.students} students`}`
                  : "Loading";
                return (
                  <li key={date} className="border-line not-first:border-l">
                    <button
                      type="button"
                      aria-pressed={isSel}
                      aria-label={label}
                      onClick={() => setSelected(date)}
                      className={`flex h-full min-h-28 w-full flex-col items-center gap-1 px-1 pb-3 pt-3 transition-colors duration-150 ${isSel ? "bg-raised shadow-[inset_0_-2px_0_var(--accent)]" : "hover:bg-raised/60"}`}
                    >
                      <span className="text-micro text-ink-soft">{dayLabel(date, { weekday: "short" })}</span>
                      <span className="tnum font-display text-h2 font-semibold">{dayLabel(date, { day: "numeric" })}</span>
                      <span className="mt-auto flex h-2 items-center gap-0.5">
                        {!d ? (
                          <span className="skeleton h-1.5 w-8" />
                        ) : d.students === null ? (
                          <span className="size-1.5 rounded-full border border-ink-soft" />
                        ) : (
                          Array.from({ length: dotsFor(d.students) }, (_, k) => <span key={k} className="size-1.5 rounded-full bg-ink" />)
                        )}
                      </span>
                      <span className="tnum min-h-4 text-micro leading-tight text-ink-soft">
                        {d ? (d.students === null ? <span className="hidden sm:inline">Low demand</span> : d.students) : ""}
                        {d && d.students === null && <span className="sm:hidden">Low</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
            <p className="text-body">
              {!sel ? (
                <span className="text-ink-soft">Counting students…</span>
              ) : sel.students === null ? (
                <>
                  <strong>Low demand</strong> on {dayLabel(selected)}: fewer than 5 students so far. Post yours and be the one
                  others find.
                </>
              ) : (
                <>
                  <strong className="tnum">{sel.students} students</strong> from {college.name} are going {from} to {to} on{" "}
                  {dayLabel(selected)}.
                </>
              )}
            </p>
            <Link href={signedIn ? postHref : `/login?next=${encodeURIComponent(postHref)}`} className="btn btn-quiet shrink-0">
              Post this trip
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
