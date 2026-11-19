import { notFound } from "next/navigation";
import { EventTypeForm } from "@/components/EventTypeForm";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { deleteEventType, updateEventType } from "../../actions";

export default async function EditEventTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireMember();
  const eventType = await db.eventType.findFirst({ where: { id, organizationId: org.id }, include: { hosts: true } });
  if (!eventType) notFound();
  const members = await db.user.findMany({ where: { memberships: { some: { organizationId: org.id } } } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{eventType.title}</h1>
      <EventTypeForm
        action={updateEventType.bind(null, eventType.id)}
        eventType={eventType}
        members={members}
        selectedHosts={eventType.hosts}
      />
      <form action={deleteEventType.bind(null, eventType.id)}>
        <button className="text-sm text-red-600 hover:underline">Meeting-Typ löschen</button>
      </form>
    </div>
  );
}
