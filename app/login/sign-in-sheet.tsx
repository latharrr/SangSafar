"use client";

import { useActionState, useEffect, useState } from "react";
import { authFlow, type CodeState } from "@/app/actions/auth";
import { CheckIcon } from "@/components/icons";
import { OTP_LENGTH } from "@/lib/config";

export function SignInSheet({ next }: { next: string }) {
  const [state, run, pending] = useActionState(authFlow, { step: "email" } as CodeState);

  return (
    <div className="sheet mt-6 p-6">
      {state.step === "email" && (
        <form action={run} noValidate>
          <label htmlFor="email" className="label">
            College email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            className="field"
            placeholder="name@college.edu"
            aria-invalid={!!state.error}
            aria-describedby={state.error ? "email-error" : undefined}
          />
          {state.error && (
            <p id="email-error" role="alert" className="error-text">
              {state.error}
            </p>
          )}
          <button className="btn btn-primary mt-6 w-full" disabled={pending}>
            {pending ? "Sending code…" : "Send me a code"}
          </button>
        </form>
      )}

      {state.step === "code" && <CodeStep key={state.sentAt} state={state} run={run} pending={pending} next={next} />}

    </div>
  );
}

function CodeStep({
  state,
  run,
  pending,
  next,
}: {
  state: Extract<CodeState, { step: "code" }>;
  run: (d: FormData) => void;
  pending: boolean;
  next: string;
}) {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(true);
  const [now, setNow] = useState(() => state.sentAt);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const wait = Math.max(0, 30 - Math.floor((now - state.sentAt) / 1000));

  return (
    <div>
      {state.pending ? (
        <p className="text-body" role="status">
          We don&apos;t have <strong>{state.college}</strong> on SangSafar yet. You can sign in now, and we&apos;ll verify your
          college as soon as possible. Until then you&apos;ll only match with students from the same email domain.
        </p>
      ) : (
        <p className="flex items-start gap-2 text-body">
          <CheckIcon className="mt-0.5 size-5 shrink-0 text-trust" />
          <span>
            You&apos;re signing up with <strong>{state.college}</strong>.
          </span>
        </p>
      )}
      <form action={run} className="mt-6">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="code" className="label">
          Enter the {OTP_LENGTH}-digit code sent to <span className="break-all">{state.email}</span>
        </label>
        <div className="relative">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${OTP_LENGTH}, minmax(0, 1fr))` }} aria-hidden>
            {Array.from({ length: OTP_LENGTH }, (_, i) => (
              <span
                key={i}
                className={`tnum flex h-14 items-center justify-center rounded-sheet border bg-raised text-h1 font-semibold transition-colors duration-150 ${
                  focused && i === Math.min(code.length, OTP_LENGTH - 1) ? "border-ink" : state.error ? "border-warn" : "border-line"
                }`}
              >
                {code[i] ?? ""}
              </span>
            ))}
          </div>
          {/* One real input over the boxes: paste works, iOS/Android one-time-code autofill works. */}
          <input
            id="code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern={`\\d{${OTP_LENGTH}}`}
            maxLength={OTP_LENGTH}
            autoFocus
            required
            aria-invalid={!!state.error}
            aria-describedby={state.error ? "code-error" : undefined}
            className="absolute inset-0 h-full w-full cursor-text text-transparent caret-transparent opacity-0"
          />
        </div>
        {state.error && (
          <p id="code-error" role="alert" className="error-text">
            {state.error}
          </p>
        )}
        <button name="intent" value="verify" className="btn btn-primary mt-6 w-full" disabled={pending || code.length !== OTP_LENGTH}>
          {pending ? "Checking…" : "Verify and continue"}
        </button>
      </form>
      <form action={run} className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <input type="hidden" name="email" value={state.email} />
        <button name="intent" value="change" className="btn btn-ghost -ml-4">
          Change email
        </button>
        <button name="intent" value="send" className="btn btn-ghost -mr-4" disabled={wait > 0 || pending}>
          {wait > 0 ? <span className="tnum">Resend code in {wait}s</span> : "Resend code"}
        </button>
      </form>
    </div>
  );
}
