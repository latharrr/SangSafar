import type { Mode } from "@/lib/config";
import { ModeIcon } from "@/components/icons";

type Props = {
  from: string;
  to: string;
  mode?: Mode;
  /** Draws itself once (post success, landing). Reduced motion: appears complete. */
  draw?: boolean;
  /** resting = line-color stroke; active = ink stroke. */
  state?: "resting" | "active";
  fromDetail?: string | null;
  toDetail?: string | null;
  /** Narrow rails: one size step down so whole place names fit. */
  small?: boolean;
};

/** The identity object: origin node, one continuous stroke, accent destination node. */
export function RouteLine({ from, to, mode, draw, state = "active", fromDetail, toDetail, small }: Props) {
  const name = `font-display block font-semibold break-words ${small ? "text-h2" : "text-h2 md:text-h2-lg"}`;
  const stroke = state === "active" ? "var(--ink)" : "var(--line-strong)";
  return (
    <figure className="w-full" aria-label={`${from} to ${to}${mode ? ` by ${mode}` : ""}`}>
      <svg viewBox="0 0 320 56" className={`h-auto w-full overflow-visible ${draw ? "route-draw" : ""}`} aria-hidden>
        {/* Hand-tuned: a slight lift and settle, so it reads as a journey, not a divider. */}
        <path
          className="route-stroke"
          pathLength={1}
          d="M14 34 C 92 34, 112 14, 160 14 S 236 34, 306 34"
          fill="none"
          stroke={stroke}
          strokeWidth={state === "active" ? 2.5 : 2}
          strokeLinecap="round"
        />
        <circle cx="14" cy="34" r="7" fill="var(--paper-raised)" stroke="var(--ink)" strokeWidth={2} />
        <circle className="route-dest" cx="306" cy="34" r="7" fill="var(--accent)" stroke="var(--ink)" strokeWidth={2} />
        {mode && (
          <g className="route-mode">
            <circle cx="160" cy="14" r="13" fill="var(--paper)" stroke="var(--line)" strokeWidth={1.5} />
            <foreignObject x="150" y="4" width="20" height="20">
              <ModeIcon mode={mode} className="size-5 text-ink" />
            </foreignObject>
          </g>
        )}
      </svg>
      <figcaption className="mt-2 flex items-start justify-between gap-4">
        <span className="min-w-0 flex-1 basis-0">
          <span className={name}>{from}</span>
          {fromDetail && <span className="block text-small text-ink-soft break-words">{fromDetail}</span>}
        </span>
        <span className="min-w-0 flex-1 basis-0 text-right">
          <span className={name}>{to}</span>
          {toDetail && <span className="block text-small text-ink-soft break-words">{toDetail}</span>}
        </span>
      </figcaption>
    </figure>
  );
}

/** 24px inline variant for every trip and match row. */
export function RouteMini({ mode, state = "active" }: { mode: Mode; state?: "resting" | "active" }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center" aria-hidden>
      <svg viewBox="0 0 44 24" className="h-6 w-11">
        <path d="M5 12 H39" stroke={state === "active" ? "var(--ink)" : "var(--line-strong)"} strokeWidth={2} strokeLinecap="round" />
        <circle cx="5" cy="12" r="3.5" fill="var(--paper-raised)" stroke="var(--ink)" strokeWidth={1.75} />
        <circle cx="39" cy="12" r="3.5" fill="var(--accent)" stroke="var(--ink)" strokeWidth={1.75} />
      </svg>
      <ModeIcon mode={mode} className="ml-1 size-5 text-ink-soft" />
    </span>
  );
}
