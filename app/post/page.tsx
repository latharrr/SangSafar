import type { Metadata } from "next";
import { createTrip } from "@/app/actions/trips";
import { TripForm } from "@/components/trip-form";
import { campusNow } from "@/lib/matching";
import { requireViewer, womenOnlyAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Post a trip" };

export default async function PostPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; date?: string }> }) {
  const q = await searchParams;
  const viewer = await requireViewer(`/post?${new URLSearchParams(q as Record<string, string>)}`);
  const { today } = campusNow(viewer.college.timezone);
  if (viewer.suspended) return <p className="text-body">Posting is paused while your account is under review.</p>;
  const hub = (h?: string) => (h && viewer.college.hubs.includes(h) ? h : undefined);
  return (
    <>
      <h1 className="mx-auto mb-8 max-w-2xl text-h1 font-bold md:text-h1-lg">Post a trip</h1>
      <TripForm
        action={createTrip}
        hubs={viewer.college.hubs}
        today={today}
        defaults={{ fromHub: hub(q.from), toHub: hub(q.to), date: q.date && q.date >= today ? q.date : undefined }}
        womenOnly={womenOnlyAccess(viewer)}
        submitLabel="Post trip"
      />
    </>
  );
}
