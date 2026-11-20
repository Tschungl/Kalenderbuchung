import { notFound } from "next/navigation";
import { NegotiationChat } from "@/components/NegotiationChat";
import { db } from "@/lib/db";
import type { TranscriptEntry } from "@/lib/negotiation/agent";

export default async function NegotiationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const neg = await db.negotiation.findUnique({
    where: { token },
    include: { eventType: { include: { organization: true } } },
  });
  if (!neg) notFound();
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="card space-y-4">
        <p className="text-sm text-slate-500">{neg.eventType.organization.name}</p>
        <h1 className="text-2xl font-semibold">{neg.eventType.title}</h1>
        <NegotiationChat
          mode="resume"
          token={neg.token}
          brandColor={neg.eventType.organization.brandColor}
          anrede={neg.eventType.organization.salutation}
          initialTranscript={neg.transcript as unknown as TranscriptEntry[]}
          initialStatus={neg.status}
        />
      </div>
    </main>
  );
}
