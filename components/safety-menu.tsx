"use client";

import { useActionState, useState } from "react";
import { blockUser, reportUser } from "@/app/actions/safety";
import { ActionForm } from "@/components/action-form";
import { MoreIcon } from "@/components/icons";

/** Report + block, available on every profile card and every chat. */
export function SafetyMenu({ userId, name, context, after }: { userId: string; name: string; context: string; after: string }) {
  const [reporting, setReporting] = useState(false);
  const [state, run, pending] = useActionState(reportUser, undefined);

  return (
    <details className="relative" onToggle={(e) => !(e.target as HTMLDetailsElement).open && setReporting(false)}>
      <summary className="btn btn-ghost w-11 list-none px-0" aria-label={`Safety options for ${name}`}>
        <MoreIcon />
      </summary>
      <div className="sheet absolute right-0 z-10 mt-2 w-[min(20rem,calc(100vw-2rem))] p-4">
        {state?.ok ? (
          <p role="status" className="text-small">
            Thanks. A moderator will review it. {name} isn&apos;t told who reported them.
          </p>
        ) : reporting ? (
          <form action={run}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="context" value={context} />
            <label htmlFor={`reason-${userId}`} className="label">
              What happened?
            </label>
            <textarea id={`reason-${userId}`} name="reason" rows={3} maxLength={500} required className="field py-2" />
            {state?.error && (
              <p role="alert" className="error-text">
                {state.error}
              </p>
            )}
            <button className="btn btn-quiet mt-3 w-full" disabled={pending}>
              {pending ? "Sending…" : `Report ${name}`}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" className="btn btn-quiet w-full" onClick={() => setReporting(true)}>
              Report {name}
            </button>
            <ActionForm
              action={blockUser}
              fields={{ userId, after }}
              label={`Block ${name}`}
              className="btn btn-quiet w-full text-warn"
              confirm={{
                title: `Block ${name}?`,
                body: "You won't see each other anywhere again. Open requests are cancelled and any chat closes now, with trip details hidden again. They aren't told.",
                confirmLabel: "Block",
              }}
            />
          </div>
        )}
      </div>
    </details>
  );
}
