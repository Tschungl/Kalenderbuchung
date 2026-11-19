import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/BookingWidget";
import { loadEventType } from "@/lib/slots";
import { negotiationAvailable } from "@/lib/negotiation/agent";
import { parseRules } from "@/lib/negotiation/rules";

const LOCATION_LABEL = {
  GOOGLE_MEET: "Google Meet",
  PHONE: "Telefon",
  IN_PERSON: "Vor Ort",
  CUSTOM_LINK: "Online",
} as const;

export default async function EventPage({ params }: { params: Promise<{ org: string; event: string }> }) {
  const { org, event } = await params;
  const et = await loadEventType(org, event);
  if (!et) notFound();
  const hostNames = et.hosts.map((h) => h.user.name ?? "").filter(Boolean);
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="card grid gap-8 md:grid-cols-[280px_1fr]">
        <aside className="space-y-3 border-slate-100 md:border-r md:pr-6">
          <p className="text-sm text-slate-500">{et.organization.name}</p>
          <h1 className="text-2xl font-semibold">{et.title}</h1>
          <p className="text-sm text-slate-600">⏱ {et.durationMin} Minuten</p>
          <p className="text-sm text-slate-600">📍 {LOCATION_LABEL[et.locationType]}</p>
          {hostNames.length > 0 && <p className="text-sm text-slate-600">👤 {hostNames.join(", ")}</p>}
          {et.description && <p className="whitespace-pre-line text-sm text-slate-600">{et.description}</p>}
        </aside>
        <BookingWidget
          org={org}
          event={event}
          durationMin={et.durationMin}
          maxGuests={et.maxGuests}
          brandColor={et.organization.brandColor}
          negotiationEnabled={negotiationAvailable() && parseRules(et.negotiation).enabled}
        />
      </div>
    </main>
  );
}
