import { notFound } from "next/navigation";
import { BrandedPage } from "@/components/BrandedPage";
import { EventBookingView } from "@/components/EventBookingView";
import { EmbedResizer } from "@/components/EmbedResizer";
import { loadEventType } from "@/lib/slots";

export const metadata = { robots: { index: false } };

/** Schlanke Buchungsseite zum Einbetten per iframe (siehe public/embed.js). */
export default async function EmbedPage({ params }: { params: Promise<{ org: string; event: string }> }) {
  const { org, event } = await params;
  const et = await loadEventType(org, event);
  if (!et) notFound();
  return (
    <BrandedPage org={et.organization} compact>
      <EmbedResizer />
      <EventBookingView et={et} embed />
    </BrandedPage>
  );
}
