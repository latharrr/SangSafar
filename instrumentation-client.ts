import * as Sentry from "@sentry/nextjs";
import { PRIVACY } from "@/lib/sentry-scrub";

// Errors only: no session replay, no PII, no breadcrumbs (they can carry chat text or URLs with ids).
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, ...PRIVACY });
}
