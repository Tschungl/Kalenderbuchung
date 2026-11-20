import { db } from "@/lib/db";
import { canManage, requireMember } from "@/lib/session";
import { BrandingEditor } from "@/components/BrandingEditor";
import { DomainSettings } from "@/components/DomainSettings";
import { createOrganization, updateOrganization } from "../team/actions";
import { updateBranding } from "./actions";

export default async function SettingsPage() {
  const { org, membership } = await requireMember();
  const manager = canManage(membership.role);
  const events = await db.eventType.findMany({
    where: { organizationId: org.id, active: true },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { title: true, durationMin: true },
  });
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Gestaltung und Einstellungen</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Buchungsseite gestalten</h2>
        <BrandingEditor
          initial={{
            brandColor: org.brandColor,
            logoUrl: org.logoUrl,
            welcomeTitle: org.welcomeTitle,
            welcomeText: org.welcomeText,
            confirmationText: org.confirmationText,
            fontStyle: org.fontStyle,
            buttonStyle: org.buttonStyle,
            pageTheme: org.pageTheme,
            salutation: org.salutation,
          }}
          orgName={org.name}
          sampleEvents={events}
          disabled={!manager}
          action={updateBranding}
        />
      </section>

      <form action={updateOrganization} className="card space-y-4">
        <h2 className="text-lg font-semibold">Organisation</h2>
        <fieldset disabled={!manager} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Name der Organisation</label>
              <input className="input" id="name" name="name" defaultValue={org.name} required />
            </div>
            <div>
              <label className="label" htmlFor="slug">Adresse der Buchungsseite</label>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                /<input className="input" id="slug" name="slug" defaultValue={org.slug} required />
              </div>
            </div>
          </div>
          {manager && <button className="btn">Speichern</button>}
        </fieldset>
        {!manager && <p className="text-sm text-slate-500">Nur Inhaber und Admins können das ändern.</p>}
      </form>

      <DomainSettings
        customDomain={org.customDomain}
        domainToken={org.domainToken}
        domainVerifiedAt={org.domainVerifiedAt}
        manager={manager}
      />

      <form action={createOrganization} className="card flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="newOrg">Weitere Organisation anlegen</label>
          <input className="input" id="newOrg" name="name" placeholder="z.B. Zweitfirma GmbH" required />
        </div>
        <button className="btn-secondary">Anlegen</button>
      </form>
    </div>
  );
}
