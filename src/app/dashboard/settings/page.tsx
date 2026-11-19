import { canManage, requireMember } from "@/lib/session";
import { createOrganization, updateOrganization } from "../team/actions";

export default async function SettingsPage() {
  const { org, membership } = await requireMember();
  const manager = canManage(membership.role);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <form action={updateOrganization} className="card space-y-4">
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
            <div>
              <label className="label" htmlFor="brandColor">Markenfarbe</label>
              <input className="h-10 w-20 rounded border border-slate-300" type="color" id="brandColor" name="brandColor" defaultValue={org.brandColor} />
            </div>
            <div>
              <label className="label" htmlFor="logoUrl">Logo (URL)</label>
              <input className="input" id="logoUrl" name="logoUrl" type="url" defaultValue={org.logoUrl ?? ""} placeholder="https://…" />
            </div>
          </div>
          {manager && <button className="btn">Speichern</button>}
        </fieldset>
        {!manager && <p className="text-sm text-slate-500">Nur Inhaber und Admins können das ändern.</p>}
      </form>

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
