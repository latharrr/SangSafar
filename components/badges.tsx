import { CheckIcon } from "@/components/icons";

// Precise copy: email verification proves inbox control at signup, nothing more.
export function VerifiedBadge({ idChecked, pendingCollege }: { idChecked?: boolean | null; pendingCollege?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {pendingCollege ? (
        <span className="badge text-ink-soft" title="Controlled this inbox at signup. The domain hasn't been confirmed as a college yet.">
          Email verified · college under review
        </span>
      ) : (
        <span className="badge text-trust" title="Controlled a college inbox at signup. Not proof of current enrolment or identity.">
          <CheckIcon className="size-3.5" />
          College email verified
        </span>
      )}
      {idChecked && (
        <span className="badge text-trust" title="A moderator manually reviewed this student's college ID.">
          <CheckIcon className="size-3.5" />
          ID checked
        </span>
      )}
    </span>
  );
}

export function TravelledBadge() {
  return (
    <span className="badge text-trust">
      <CheckIcon className="size-3.5" />
      Travelled together
    </span>
  );
}
