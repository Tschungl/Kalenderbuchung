import { notFound } from "next/navigation";
import { BrandedPage } from "@/components/BrandedPage";
import { EventBookingView } from "@/components/EventBookingView";
import { loadEventType } from "@/lib/slots";

export default async function EventPage({ params }: { params: Promise<{ org: string; event: string }> }) {
  const { org, event } = await params;
  const et = await loadEventType(org, event);
  if (!et) notFound();
  return (
    <BrandedPage org={et.organization}>
      <EventBookingView et={et} />
    </BrandedPage>
  );
}
