"use client";

import { useActionState, useState } from "react";
import { sendRequest } from "@/app/actions/requests";

/** Two-step send: the consent copy is shown before the request goes out. */
export function ConnectButton({ myTrip, theirTrip, name }: { myTrip: string; theirTrip: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(sendRequest, undefined);

  if (state?.ok) return <p className="text-small font-medium text-trust" role="status">Request sent to {name}</p>;
  if (!open)
    return (
      <button type="button" className="btn btn-quiet w-full sm:w-auto" onClick={() => setOpen(true)}>
        Request to connect
      </button>
    );
  return (
    <form action={run} className="w-full sm:max-w-sm">
      <input type="hidden" name="myTrip" value={myTrip} />
      <input type="hidden" name="theirTrip" value={theirTrip} />
      <p className="text-small text-ink">
        If {name} accepts, you&apos;ll both see each other&apos;s train or flight number, meetup point and notes, and a chat
        opens. If they decline or it expires, nothing is shared.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Not now
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="error-text">
          {state.error}
        </p>
      )}
    </form>
  );
}
