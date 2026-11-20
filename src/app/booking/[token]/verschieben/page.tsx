import { notFound, redirect } from "next/navigation";
import { BookingWidget } from "@/components/BookingWidget";
import { BrandedPage, BrandHeader } from "@/components/BrandedPage";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/mail";

export default async function ReschedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await db.booking.findUnique({
    where: { manageToken: token },
    include: { eventType: { include: { organization: true } }, attendees: true },
  });
  if (!booking) notFound();
  if (booking.status !== "CONFIRMED" || booking.startTime < new Date() || !booking.eventType.active) {
    redirect(`/booking/${token}`);
  }
  const et = booking.eventType;
  const org = et.organization;
  const tz = booking.attendees.find((a) => !a.isGuest)?.timeZone ?? "Europe/Berlin";
  return (
    <BrandedPage org={org}>
      <BrandHeader org={org} />
      <div className="card grid gap-8 md:grid-cols-[260px_1fr]">
        <aside className="space-y-3 border-slate-100 md:border-r md:pr-6">
          <h1 className="text-2xl font-semibold">{et.title} verschieben</h1>
          <p className="text-sm text-slate-600">Bisher: {formatDateTime(booking.startTime, tz)}</p>
          <a href={`/booking/${token}`} className="text-sm underline">Abbrechen</a>
        </aside>
        <BookingWidget
          org={org.slug}
          event={et.slug}
          durationMin={et.durationMin}
          maxGuests={0}
          brandColor={org.brandColor}
          confirmationText={org.confirmationText}
          rescheduleToken={token}
          anrede={org.salutation}
        />
      </div>
    </BrandedPage>
  );
}
