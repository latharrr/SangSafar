"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ChevronIcon, ModeIcon } from "@/components/icons";
import { RouteLine } from "@/components/route-line";
import { MODES, type Mode } from "@/lib/config";
import type { ActionState } from "@/lib/errors";
import { MODE_LABEL } from "@/lib/format";
import { toMinutes } from "@/lib/matching";

export type TripDefaults = {
  tripId?: string;
  mode?: Mode;
  fromHub?: string;
  fromPoint?: string | null;
  toHub?: string;
  toPoint?: string | null;
  date?: string;
  start?: string;
  end?: string;
  womenOnly?: boolean;
  vehicleNo?: string | null;
  meetup?: string | null;
  notes?: string | null;
};

type Props = {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  hubs: string[];
  today: string;
  defaults: TripDefaults;
  /** null: user didn't self-declare as a woman, so the toggle doesn't exist. */
  womenOnly: "available" | "needs-optin" | null;
  submitLabel: string;
  editWarning?: string;
};

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function TripForm({ action, hubs, today, defaults, womenOnly, submitLabel, editWarning }: Props) {
  const [state, run, pending] = useActionState(action, undefined);
  const [from, setFrom] = useState(defaults.fromHub ?? hubs[0]);
  const [to, setTo] = useState(defaults.toHub ?? hubs[1]);
  const [mode, setMode] = useState<Mode>(defaults.mode ?? "train");
  const [start, setStart] = useState(defaults.start?.slice(0, 5) ?? "17:00");
  const [end, setEnd] = useState(defaults.end?.slice(0, 5) ?? "19:00");
  const hasDetails = !!(defaults.vehicleNo || defaults.meetup || defaults.notes);
  const f = state?.fields ?? {};
  const err = (k: string) =>
    f[k] ? (
      <p id={`${k}-error`} className="error-text" role="alert">
        {f[k]}
      </p>
    ) : null;
  const inv = (k: string) => ({ "aria-invalid": !!f[k], "aria-describedby": f[k] ? `${k}-error` : undefined });

  return (
    <form action={run} className="mx-auto max-w-2xl" noValidate>
      {defaults.tripId && <input type="hidden" name="tripId" value={defaults.tripId} />}
      <div className="mb-10" aria-live="polite">
        <RouteLine from={from || "From"} to={to || "To"} mode={mode} state={from && to && from !== to ? "active" : "resting"} />
      </div>

      <fieldset className="grid gap-6 sm:grid-cols-2">
        <legend className="sr-only">Route</legend>
        <div>
          <label htmlFor="fromHub" className="label">
            From
          </label>
          <select id="fromHub" name="fromHub" className="field" value={from} onChange={(e) => setFrom(e.target.value)} {...inv("fromHub")}>
            {hubs.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
          {err("fromHub")}
          <label htmlFor="fromPoint" className="label mt-3">
            Pickup spot <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input id="fromPoint" name="fromPoint" className="field" maxLength={60} defaultValue={defaults.fromPoint ?? ""} placeholder="e.g. Main Gate" />
        </div>
        <div>
          <label htmlFor="toHub" className="label">
            To
          </label>
          <select id="toHub" name="toHub" className="field" value={to} onChange={(e) => setTo(e.target.value)} {...inv("toHub")}>
            {hubs.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
          {err("toHub")}
          <label htmlFor="toPoint" className="label mt-3">
            Drop spot <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input id="toPoint" name="toPoint" className="field" maxLength={60} defaultValue={defaults.toPoint ?? ""} placeholder="e.g. New Delhi Rly Stn" />
        </div>
      </fieldset>
      <p className="hint">Pickup and drop spots show on your card so people can see how close you are. Keep them general.</p>

      <fieldset className="mt-10">
        <legend className="label">How are you travelling?</legend>
        <div role="radiogroup" className="grid grid-cols-4 gap-1 rounded-full border border-line bg-raised p-1">
          {MODES.map((m) => (
            <label
              key={m}
              className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-small font-medium text-ink-soft transition-colors duration-150 has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-ink"
            >
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
              <ModeIcon mode={m} className="size-5" />
              <span className="hidden sm:inline">{MODE_LABEL[m]}</span>
              <span className="sr-only sm:hidden">{MODE_LABEL[m]}</span>
            </label>
          ))}
        </div>
        {err("mode")}
      </fieldset>

      <div className="mt-10 grid gap-6 sm:grid-cols-[1fr_2fr]">
        <div>
          <label htmlFor="date" className="label">
            Date
          </label>
          <input id="date" name="date" type="date" min={today} className="field" defaultValue={defaults.date ?? today} required {...inv("date")} />
          {err("date")}
        </div>
        <fieldset>
          <legend className="label">Departure window</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="start" className="sr-only">
                Earliest departure
              </label>
              <input id="start" name="start" type="time" step={300} className="field" value={start} onChange={(e) => setStart(e.target.value)} {...inv("start")} />
              <span className="hint block">Earliest</span>
            </div>
            <div>
              <label htmlFor="end" className="sr-only">
                Latest departure
              </label>
              <input id="end" name="end" type="time" step={300} className="field" value={end} onChange={(e) => setEnd(e.target.value)} {...inv("end")} />
              <span className="hint block">Latest</span>
            </div>
          </div>
          {err("start")}
          {err("end")}
        </fieldset>
      </div>
      <WindowDrag start={start} end={end} onChange={(s, e) => (setStart(s), setEnd(e))} />

      {womenOnly === "available" && (
        <div className="mt-10 border-t border-line pt-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="womenOnly" defaultChecked={defaults.womenOnly} className="mt-1 size-5 accent-[var(--ink)]" />
            <span>
              <span className="block font-medium">Match me only with other women on this trip</span>
              <span className="mt-1 block text-small text-ink-soft">
                A comfort filter: this trip is shown only to students who also set their profile to woman and turned this filter on.
                It relies on what people declare, it doesn&apos;t verify gender and it isn&apos;t a safety guarantee.
              </span>
            </span>
          </label>
        </div>
      )}
      {womenOnly === "needs-optin" && (
        <p className="mt-10 border-t border-line pt-6 text-small text-ink-soft">
          Want women-only matching? Turn on the comfort filter in your{" "}
          <Link href="/profile" className="underline">
            profile
          </Link>{" "}
          first.
        </p>
      )}

      <details className="group mt-10 border-t border-line pt-6" open={hasDetails}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center font-medium">
          <ChevronIcon className="mr-2 size-4 transition-transform duration-150 group-open:rotate-90" />
          Add train number, meetup point, notes
        </summary>
        <p className="hint">Private. Only shown to someone after you both accept a connection.</p>
        <div className="mt-4 grid gap-6">
          {(mode === "train" || mode === "flight") && (
            <div>
              <label htmlFor="vehicleNo" className="label">
                {mode === "train" ? "Train number" : "Flight number"}
              </label>
              <input id="vehicleNo" name="vehicleNo" className="field max-w-60" maxLength={20} defaultValue={defaults.vehicleNo ?? ""} autoComplete="off" />
              <p className="hint">Never your PNR, seat or ticket. We don&apos;t collect those.</p>
            </div>
          )}
          <div>
            <label htmlFor="meetup" className="label">
              Meetup point
            </label>
            <input id="meetup" name="meetup" className="field" maxLength={120} defaultValue={defaults.meetup ?? ""} />
          </div>
          <div>
            <label htmlFor="notes" className="label">
              Notes
            </label>
            <textarea id="notes" name="notes" rows={3} maxLength={500} className="field py-2" defaultValue={defaults.notes ?? ""} />
          </div>
        </div>
      </details>

      {editWarning && (
        <p className="mt-10 border-t border-line pt-6 text-body" role="note">
          {editWarning}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="error-text mt-6">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary mt-8 w-full sm:w-auto sm:px-8" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

/**
 * Pointer shortcut for the window: drag the bar to move it, its ends to resize.
 * The time fields above are the accessible, keyboard path, so this is aria-hidden.
 */
function WindowDrag({ start, end, onChange }: { start: string; end: string; onChange: (s: string, e: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const valid = /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && toMinutes(end) > toMinutes(start);
  const s = valid ? toMinutes(start) : 0;
  const e = valid ? toMinutes(end) : 0;

  function drag(kind: "move" | "start" | "end", ev: React.PointerEvent) {
    const el = track.current;
    if (!el) return;
    ev.preventDefault();
    const rect = el.getBoundingClientRect();
    const x0 = ev.clientX;
    const [s0, e0] = [s, e];
    const move = (pe: PointerEvent) => {
      const delta = Math.round((((pe.clientX - x0) / rect.width) * 1440) / 5) * 5;
      if (kind === "move") {
        const d = Math.max(-s0, Math.min(1439 - e0, delta));
        onChange(fmt(s0 + d), fmt(e0 + d));
      } else if (kind === "start") onChange(fmt(Math.max(0, Math.min(e0 - 15, s0 + delta))), fmt(e0));
      else onChange(fmt(s0), fmt(Math.min(1439, Math.max(s0 + 15, e0 + delta))));
    };
    const up = () => (window.removeEventListener("pointermove", move), window.removeEventListener("pointerup", up));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div aria-hidden className="mt-4 select-none">
      <div ref={track} className="relative h-11 touch-none">
        <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
        {valid && (
          <span
            className="absolute top-1/2 h-3 -translate-y-1/2 cursor-grab rounded-full bg-ink active:cursor-grabbing"
            style={{ left: `${(s / 1440) * 100}%`, width: `${((e - s) / 1440) * 100}%` }}
            onPointerDown={(ev) => drag("move", ev)}
          >
            <span className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-ink bg-raised" onPointerDown={(ev) => (ev.stopPropagation(), drag("start", ev))} />
            <span className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-ink bg-accent" onPointerDown={(ev) => (ev.stopPropagation(), drag("end", ev))} />
          </span>
        )}
      </div>
      <div className="tnum relative h-4 text-micro text-ink-soft">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${(h / 24) * 100}%` }}>
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}
