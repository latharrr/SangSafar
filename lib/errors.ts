// Database error codes (raised in supabase/migrations) -> copy that names the problem and the fix.
const COPY: Record<string, string> = {
  not_allowed: "You can't do that from this account. Sign in again and retry.",
  not_eligible: "This trip isn't available to connect with any more. It may have changed, been hidden or already left.",
  duplicate_request: "You already have an open request with this trip.",
  rate_limited: "You've reached today's limit. Try again tomorrow.",
  not_pending: "This request was already answered, cancelled or expired.",
  expired: "This request expired before it was accepted.",
  not_found: "We couldn't find that request.",
  too_early: "You can confirm once the travel day arrives.",
  unknown_hub: "Pick both places from the list.",
  same_route: "From and to are the same place. Pick a different destination.",
  window_order: "The window must end after it starts. For a trip across midnight, post two trips.",
  in_past: "That departure window has already passed. Pick a later time or date.",
  too_far: "Trips can be posted up to 6 months ahead.",
  bad_mode: "Pick how you're travelling.",
  women_only_not_eligible: "Women-only matching needs your profile set to woman with the comfort filter turned on.",
  college_domain_not_active: "That email domain isn't linked to a college yet. Request it below.",
  email_change_not_allowed: "Email changes aren't supported. Delete your data and sign up again with the new address.",
  bad_college: "Add a name, a code and at least two hubs.",
  public_email_domain: "Use your college email. Personal addresses like Gmail can't join.",
  college_rejected: "We couldn't verify this domain as a college. Use your college-issued email.",
  bad_domain: "That doesn't look like a college email domain.",
};

export function errorCopy(error: { message?: string } | null | undefined, fallback = "Something went wrong. Please try again.") {
  if (!error?.message) return fallback;
  const code = Object.keys(COPY).find((k) => error.message!.includes(k));
  return code ? COPY[code] : fallback;
}

export type ActionState = { error?: string; ok?: boolean; fields?: Record<string, string> } | undefined;
