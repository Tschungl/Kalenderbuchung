import { EventTypeForm } from "@/components/EventTypeForm";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { createEventType } from "../../actions";

export default async function NewEventTypePage() {
  const { org, user } = await requireMember();
  const members = await db.user.findMany({ where: { memberships: { some: { organizationId: org.id } } } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Neuer Meeting-Typ</h1>
      <EventTypeForm action={createEventType} members={members} selectedHostIds={[user.id]} />
    </div>
  );
}
