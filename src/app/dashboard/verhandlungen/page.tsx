import Link from "next/link";
import { db } from "@/lib/db";
import { negotiationAvailable, type TranscriptEntry } from "@/lib/negotiation/agent";
import { requireMember } from "@/lib/session";

const STATUS = {
  OPEN: ["läuft", "bg-blue-50 text-blue-700"],
  AWAITING_APPROVAL: ["wartet auf Freigabe", "bg-amber-50 text-amber-700"],
  BOOKED: ["gebucht", "bg-green-50 text-green-700"],
  DECLINED: ["abgelehnt", "bg-red-50 text-red-700"],
  CLOSED: ["beendet", "bg-slate-100 text-slate-600"],
} as const;

export default async function NegotiationsPage() {
  const { org } = await requireMember();
  const negotiations = await db.negotiation.findMany({
    where: { organizationId: org.id },
    include: { eventType: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Verhandlungen</h1>
      {!negotiationAvailable() && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Die KI-Verhandlung ist auf diesem Server nicht eingerichtet (ANTHROPIC_API_KEY fehlt).
        </p>
      )}
      <p className="text-sm text-slate-600">
        Hier siehst du, wie der Assistent mit Kunden Alternativen ausgehandelt hat. Aktivieren lässt sich die Verhandlung
        pro Meeting-Typ.
      </p>
      <div className="space-y-3">
        {negotiations.map((n) => {
          const [label, cls] = STATUS[n.status];
          const transcript = n.transcript as unknown as TranscriptEntry[];
          return (
            <details key={n.id} className="card p-0">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-6 py-4">
                <span>
                  <span className="font-medium">{n.customerName}</span>
                  <span className="text-sm text-slate-500"> · {n.eventType.title} · {n.updatedAt.toLocaleString("de-DE")}</span>
                </span>
                <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{label}</span>
              </summary>
              <div className="space-y-2 border-t border-slate-100 px-6 py-4 text-sm">
                {transcript.map((e, i) => (
                  <p key={i} className={e.role === "system" ? "text-xs text-slate-500" : ""}>
                    <span className="font-medium">{e.role === "customer" ? n.customerName : e.role === "assistant" ? "Assistent" : "System"}:</span>{" "}
                    {e.text}
                  </p>
                ))}
                {n.status === "AWAITING_APPROVAL" && n.approvalToken && (
                  <Link href={`/verhandlung/freigabe/${n.approvalToken}`} className="btn mt-2">Freigabe prüfen</Link>
                )}
              </div>
            </details>
          );
        })}
        {negotiations.length === 0 && <p className="text-slate-500">Noch keine Verhandlungen.</p>}
      </div>
    </div>
  );
}
