"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelBookingButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch(`/api/bookings/${token}/cancel`, { method: "POST" });
          setBusy(false);
          if (res.ok) router.refresh();
          else setError((await res.json().catch(() => ({}))).error ?? "Absage fehlgeschlagen");
        }}
      >
        {busy ? "Wird abgesagt…" : "Termin absagen"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
