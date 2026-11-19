import { BookingWidget } from "@/components/BookingWidget";
import { BrandHeader } from "@/components/BrandedPage";
import type { LoadedEventType } from "@/lib/slots";
import { negotiationAvailable } from "@/lib/negotiation/agent";
import { parseRules } from "@/lib/negotiation/rules";

const LOCATION_LABEL = {
  GOOGLE_MEET: "Google Meet",
  PHONE: "Telefon",
  IN_PERSON: "Vor Ort",
  CUSTOM_LINK: "Online",
} as const;

/** Inhalt einer Meeting-Typ-Seite; genutzt von der Buchungsseite und der Einbettung. */
export function EventBookingView({ et, embed }: { et: NonNullable<LoadedEventType>; embed?: boolean }) {
  const org = et.organization;
  const hostNames = et.hosts.map((h) => h.user.name ?? "").filter(Boolean);
  return (
    <>
      {!embed && <BrandHeader org={org} link />}
      <div className={`card grid gap-8 md:grid-cols-[260px_1fr] ${embed ? "shadow-none" : ""}`}>
        <aside className="space-y-3 border-slate-100 md:border-r md:pr-6">
          {embed && <p className="text-sm text-slate-500">{org.name}</p>}
          <h1 className="text-2xl font-semibold">{et.title}</h1>
          <p className="text-sm text-slate-600">⏱ {et.durationMin} Minuten</p>
          <p className="text-sm text-slate-600">📍 {LOCATION_LABEL[et.locationType]}</p>
          {hostNames.length > 0 && <p className="text-sm text-slate-600">👤 {hostNames.join(", ")}</p>}
          {et.description && <p className="whitespace-pre-line text-sm text-slate-600">{et.description}</p>}
        </aside>
        <BookingWidget
          org={org.slug}
          event={et.slug}
          durationMin={et.durationMin}
          maxGuests={et.maxGuests}
          brandColor={org.brandColor}
          confirmationText={org.confirmationText}
          embed={embed}
          negotiationEnabled={negotiationAvailable() && parseRules(et.negotiation).enabled}
        />
      </div>
    </>
  );
}
