import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { activateCollege, rejectCollege, setIdChecked, setSuspended } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

type Report = {
  user_id: string;
  first_name: string;
  college_code: string;
  is_suspended: boolean;
  distinct_reporters: number;
  last_report_at: string;
  reports: { reason: string; context: string; at: string }[];
};
type Requested = { id: string; domain: string; created_at: string; students: number; hubs: string[] };
type AdminUser = { user_id: string; first_name: string; college_code: string; year: number | null; id_checked: boolean; id_checked_on: string | null; is_suspended: boolean };

const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const viewer = await requireViewer("/admin");
  if (!viewer.isAdmin) notFound();
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const [reports, colleges, users] = await Promise.all([
    supabase.rpc("admin_report_queue"),
    supabase.rpc("admin_requested_colleges"),
    supabase.rpc("admin_users", { p_query: q }),
  ]);

  return (
    <div>
      <h1 className="text-h1 font-bold md:text-h1-lg">Moderation</h1>
      <p className="mt-2 max-w-[65ch] text-small text-ink-soft">
        Reporter identities are never shown. Accounts auto-suspend at the configured number of distinct reporters
        (app_settings.suspend_threshold) and wait here for review.
      </p>

      <section aria-labelledby="reports-title" className="mt-12">
        <h2 id="reports-title" className="text-h2 font-semibold">
          Report queue
        </h2>
        {(reports.data as Report[] | null)?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-small">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Reporters</th>
                  <th className="py-2 pr-4 font-medium">Reasons</th>
                  <th className="py-2 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {(reports.data as Report[]).map((r) => (
                  <tr key={r.user_id} className="border-b border-line align-top">
                    <td className="py-3 pr-4">
                      <span className="font-medium">{r.first_name}</span> · {r.college_code}
                      {r.is_suspended && <span className="mt-1 block text-warn">Suspended, pending review</span>}
                    </td>
                    <td className="tnum py-3 pr-4">{r.distinct_reporters}</td>
                    <td className="py-3 pr-4">
                      <ul className="grid gap-2">
                        {r.reports.map((x, i) => (
                          <li key={i}>
                            {x.reason} <span className="tnum text-ink-soft">({x.context}, {when(x.at)})</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {r.is_suspended ? (
                          <ActionForm action={setSuspended} fields={{ userId: r.user_id, suspend: "0" }} label="Restore access" />
                        ) : (
                          <ActionForm action={setSuspended} fields={{ userId: r.user_id, suspend: "1" }} label="Suspend" className="btn btn-quiet text-warn" />
                        )}
                        <ActionForm action={setSuspended} fields={{ userId: r.user_id, suspend: r.is_suspended ? "1" : "0" }} label="Close reports" className="btn btn-ghost" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-body text-ink-soft">No open reports.</p>
        )}
      </section>

      <section aria-labelledby="colleges-title" className="mt-16">
        <h2 id="colleges-title" className="text-h2 font-semibold">
          Colleges awaiting approval
        </h2>
        <p className="mt-1 max-w-[65ch] text-small text-ink-soft">
          Students on these domains signed in provisionally and only match each other. Approve to set the real name and hubs, or
          reject to switch their accounts off.
        </p>
        {(colleges.data as Requested[] | null)?.length ? (
          <ul className="mt-3 border-t border-line">
            {(colleges.data as Requested[]).map((c) => (
              <li key={c.id} className="border-b border-line py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium">
                    {c.domain}{" "}
                    <span className="tnum font-normal text-ink-soft">
                      · {c.students} verified student{c.students === 1 ? "" : "s"} · requested {when(c.created_at)}
                    </span>
                  </p>
                  <ActionForm
                    action={rejectCollege}
                    fields={{ id: c.id }}
                    label="Reject"
                    className="btn btn-ghost text-warn"
                    confirm={{
                      title: `Reject ${c.domain}?`,
                      body: "Every account on this domain loses access now: their trips leave matching and their chats close. They can't sign up again with this domain.",
                      confirmLabel: "Reject domain",
                    }}
                  />
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-small underline">Approve this college</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <ActionForm action={activateCollege} fields={{ id: c.id }} label="Approve college" className="btn btn-trust sm:col-span-2 sm:justify-self-start">
                      <Field id={c.id} name="name" label="College name" />
                      <Field id={c.id} name="code" label="Short code" />
                      <Field id={c.id} name="city" label="City" />
                      <Field id={c.id} name="timezone" label="Timezone" placeholder="Asia/Kolkata" value="Asia/Kolkata" />
                      <Field id={c.id} name="hubs" label="Hubs, comma-separated (campus first)" placeholder="Campus, Delhi, Airport" value={c.hubs.join(", ")} wide />
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-body text-ink-soft">No pending requests.</p>
        )}
      </section>

      <section aria-labelledby="id-title" className="mt-16">
        <h2 id="id-title" className="text-h2 font-semibold">
          ID check review
        </h2>
        <p className="mt-1 max-w-[65ch] text-small text-ink-soft">
          Check a college ID in person or on a call, then record the result. No document is uploaded or stored. Never accept tickets,
          PNRs or boarding passes as ID.
        </p>
        <form className="mt-4 flex max-w-md gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            Search by first name
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Search by first name" className="field" />
          <button className="btn btn-quiet">Search</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-small">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 pr-4 font-medium">ID check</th>
                <th className="py-2 font-medium">Record</th>
              </tr>
            </thead>
            <tbody>
              {((users.data ?? []) as AdminUser[]).map((u) => (
                <tr key={u.user_id} className="border-b border-line">
                  <td className="py-3 pr-4">
                    <span className="font-medium">{u.first_name}</span> · {u.college_code}
                    {u.year ? ` · year ${u.year}` : ""}
                    {u.is_suspended && <span className="text-warn"> · suspended</span>}
                  </td>
                  <td className="tnum py-3 pr-4">{u.id_checked ? `Checked ${u.id_checked_on}` : "Not checked"}</td>
                  <td className="py-3">
                    <ActionForm
                      action={setIdChecked}
                      fields={{ userId: u.user_id, checked: u.id_checked ? "0" : "1" }}
                      label={u.id_checked ? "Remove" : "Mark ID checked"}
                      className="btn btn-ghost"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const Field = ({ id, name, label, placeholder, wide, value }: { id: string; name: string; label: string; placeholder?: string; wide?: boolean; value?: string }) => (
  <div className={wide ? "sm:col-span-2" : ""}>
    <label htmlFor={`${id}-${name}`} className="label">
      {label}
    </label>
    <input id={`${id}-${name}`} name={name} placeholder={placeholder} defaultValue={value} className="field" required={name !== "city"} />
  </div>
);
