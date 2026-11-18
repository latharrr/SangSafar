"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/icons";

export function CopyLink({ url, primary }: { url: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <input readOnly value={url} aria-label="Share link" className="field min-w-0 flex-1 text-small text-ink-soft" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className={`btn ${primary ? "btn-primary" : "btn-quiet"} shrink-0`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        <CopyIcon className="size-4" />
        <span aria-live="polite">{copied ? "Copied" : "Copy share link"}</span>
      </button>
    </div>
  );
}
