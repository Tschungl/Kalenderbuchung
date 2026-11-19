import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/mail";
import { decideApproval } from "@/lib/negotiation/approval";

/**
 * Freigabe-Seite für den Gastgeber. Die Entscheidung läuft über Buttons (POST),
 * damit Link-Vorschauen in Mailprogrammen nichts auslösen.
 */
export default async function ApprovalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ergebnis?: string }>;
}) {
  const { token } = await params;
  const { ergebnis } = await searchParams;
  if (ergebnis) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="card"><p>{ergebnis}</p></div>
      </main>
    );
  }
  const neg = await db.negotiation.findUnique({
    where: { approvalToken: token },
    include: { eventType: { include: { hosts: { include: { user: true } } } } },
  });
  if (!neg || !neg.pendingStart) notFound();
  const hostTz = neg.eventType.hosts[0]?.user.timeZone ?? "Europe/Berlin";

  async function decide(approve: boolean) {
    "use server";
    const result = await decideApproval(token, approve);
    redirect(`/verhandlung/freigabe/${token}?ergebnis=${encodeURIComponent(result.message)}`);
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="card space-y-4">
        <h1 className="text-xl font-semibold">Ausnahmezeit freigeben?</h1>
        <p>
          <strong>{neg.customerName}</strong> ({neg.customerEmail}) möchte <strong>{neg.eventType.title}</strong> am{" "}
          <strong>{formatDateTime(neg.pendingStart, hostTz)}</strong> buchen.
        </p>
        {neg.pendingReason && <p className="text-sm text-slate-600">Begründung: {neg.pendingReason}</p>}
        <div className="flex gap-3">
          <form action={decide.bind(null, true)}><button className="btn">Freigeben und buchen</button></form>
          <form action={decide.bind(null, false)}><button className="btn-secondary">Ablehnen</button></form>
        </div>
      </div>
    </main>
  );
}
