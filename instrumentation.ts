import * as Sentry from "@sentry/nextjs";
import { PRIVACY } from "@/lib/sentry-scrub";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({ dsn: process.env.SENTRY_DSN, ...PRIVACY });
}

export const onRequestError = Sentry.captureRequestError;
