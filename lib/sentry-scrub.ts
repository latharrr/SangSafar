import type { ErrorEvent } from "@sentry/nextjs";

/** No user info, cookies, headers, bodies or query params: they can carry emails, chat or ids. */
export const PRIVACY = {
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  tracesSampleRate: 0,
  beforeSend: scrub,
  beforeBreadcrumb: () => null,
};

/** Keep the stack trace; drop everything that could hold personal data. */
export function scrub(event: ErrorEvent) {
  delete event.request;
  delete event.user;
  delete event.extra;
  delete event.contexts;
  return event;
}
