"use client";

import { useActionState, useRef } from "react";
import type { ActionState } from "@/lib/errors";

type Props = {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  fields?: Record<string, string>;
  label: string;
  pendingLabel?: string;
  className?: string;
  /** Interrupting confirmation, only for destructive acts (delete, block). */
  confirm?: { title: string; body: React.ReactNode; confirmLabel: string };
  children?: React.ReactNode;
};

/** A one-button server action with inline error, pending state and optional confirm. */
export function ActionForm({ action, fields = {}, label, pendingLabel, className = "btn btn-quiet", confirm, children }: Props) {
  const [state, run, pending] = useActionState(action, undefined);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={run} className="contents">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      {confirm ? (
        <>
          <button type="button" className={className} disabled={pending} onClick={() => dialog.current?.showModal()}>
            {pending ? (pendingLabel ?? "Working…") : label}
          </button>
          <dialog
            ref={dialog}
            className="sheet m-auto w-[min(28rem,calc(100vw-2rem))] p-6 text-ink backdrop:bg-ink/40"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title" className="text-h2 font-semibold">
              {confirm.title}
            </h2>
            <div className="mt-3 text-body text-ink-soft">{confirm.body}</div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" className="btn btn-quiet" onClick={() => dialog.current?.close()} autoFocus>
                Keep it
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  dialog.current?.close();
                  form.current?.requestSubmit();
                }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </dialog>
        </>
      ) : (
        <button type="submit" className={className} disabled={pending}>
          {pending ? (pendingLabel ?? "Working…") : label}
        </button>
      )}
      {state?.error && (
        <p role="alert" className="error-text basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
