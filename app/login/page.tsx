import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInSheet } from "./sign-in-sheet";
import { getViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  const viewer = await getViewer();
  if (viewer && viewer !== "orphan") redirect(next.startsWith("/") ? next : "/");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-h1 font-bold md:text-h1-lg">Sign in with your college email</h1>
      <p className="mt-3 text-body text-ink-soft">
        We send a one-time code to your college inbox. No passwords, and your email is never shown to other students.
      </p>
      <SignInSheet next={next} />
      <p className="mt-6 text-small text-ink-soft">
        Verifying your email proves you controlled a college inbox when you signed up. It doesn&apos;t prove current
        enrolment, identity or intent, so meet in public places and trust your judgement.
      </p>
    </div>
  );
}
