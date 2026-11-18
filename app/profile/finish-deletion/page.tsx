import { redirect } from "next/navigation";
import { deleteMyData } from "@/app/actions/profile";
import { ActionForm } from "@/components/action-form";
import { getViewer } from "@/lib/session";

// Reached only when a session exists but the profile is already purged:
// step 2 of deletion (closing the sign-in account) failed earlier.
export default async function FinishDeletion() {
  const viewer = await getViewer();
  if (viewer !== "orphan") redirect("/");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-h1 font-bold">Finish deleting your account</h1>
      <p className="mt-3 text-body text-ink-soft">
        Your data is already deleted, but closing your sign-in account didn&apos;t finish. Retry to complete it.
      </p>
      <div className="mt-6">
        <ActionForm action={deleteMyData} label="Retry deletion" pendingLabel="Deleting…" className="btn btn-danger" />
      </div>
    </div>
  );
}
