"use client";

import { useActionState, useState } from "react";
import { updateProfile } from "@/app/actions/profile";
import type { Viewer } from "@/lib/session";

export function ProfileForm({ viewer }: { viewer: Viewer }) {
  const [state, run, pending] = useActionState(updateProfile, undefined);
  const [gender, setGender] = useState(viewer.gender ?? "");
  const f = state?.fields ?? {};

  return (
    <form action={run} className="mt-6 grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="label">
            First name
          </label>
          <input id="firstName" name="firstName" className="field" maxLength={40} defaultValue={viewer.firstName} required aria-invalid={!!f.firstName} aria-describedby={f.firstName ? "firstName-error" : undefined} />
          {f.firstName && (
            <p id="firstName-error" className="error-text">
              {f.firstName}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="year" className="label">
            Year
          </label>
          <select id="year" name="year" className="field" defaultValue={viewer.year ?? ""}>
            <option value="">Not shown</option>
            {[1, 2, 3, 4, 5, 6, 7].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fullName" className="label">
            Full name <span className="font-normal text-ink-soft">(private)</span>
          </label>
          <input id="fullName" name="fullName" className="field" maxLength={80} defaultValue={viewer.fullName ?? ""} />
        </div>
        <div>
          <label htmlFor="branch" className="label">
            Branch <span className="font-normal text-ink-soft">(private)</span>
          </label>
          <input id="branch" name="branch" className="field" maxLength={60} defaultValue={viewer.branch ?? ""} />
        </div>
        <div>
          <label htmlFor="gender" className="label">
            Gender <span className="font-normal text-ink-soft">(private, optional)</span>
          </label>
          <select id="gender" name="gender" className="field" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Not set</option>
            <option value="woman">Woman</option>
            <option value="man">Man</option>
            <option value="non_binary">Non-binary</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
          <p className="hint">Never shown to anyone. Used only for the optional women-only comfort filter.</p>
        </div>
      </div>

      {gender === "woman" && (
        <label className="flex cursor-pointer items-start gap-3 border-t border-line pt-6">
          <input type="checkbox" name="womenOnly" defaultChecked={viewer.womenOnlyOptin} className="mt-1 size-5 accent-[var(--ink)]" />
          <span>
            <span className="block font-medium">Turn on the women-only comfort filter</span>
            <span className="mt-1 block text-small text-ink-soft">
              Lets you mark a trip &ldquo;match me only with other women&rdquo;, and lets other women&apos;s women-only trips match
              with yours. It filters who you&apos;re matched with based on what people declare. It doesn&apos;t verify anyone&apos;s gender
              and it isn&apos;t a safety feature. Ordinary matching stays on either way.
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </button>
        {state?.ok && (
          <p role="status" className="text-small text-trust">
            Saved
          </p>
        )}
        {state?.error && (
          <p role="alert" className="error-text">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
