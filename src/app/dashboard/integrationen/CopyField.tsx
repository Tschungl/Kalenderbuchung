"use client";

import { useState } from "react";

export function CopyField({ value, rows = 3 }: { value: string; rows?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <textarea readOnly className="input font-mono text-xs" rows={rows} value={value} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn-secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Kopiert ✓" : "Kopieren"}
      </button>
    </div>
  );
}
