import { db } from "@/lib/db";
import { appUrl } from "@/lib/booking";
import { canManage, requireMember } from "@/lib/session";
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABEL } from "@/lib/integrations/webhooks";
import { ApiKeyForm } from "./ApiKeyForm";
import { CopyField } from "./CopyField";
import { createWebhook, deleteApiKey, deleteWebhook, saveReminders, testWebhook, toggleWebhook } from "./actions";

const REMINDER_CHOICES = [10080, 2880, 1440, 240, 120, 60, 30, 15];
function offsetLabel(min: number) {
  if (min % 1440 === 0) return min === 1440 ? "1 Tag" : `${min / 1440} Tage`;
  if (min % 60 === 0) return min === 60 ? "1 Stunde" : `${min / 60} Stunden`;
  return `${min} Minuten`;
}
const dt = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });

export default async function IntegrationsPage() {
  const { org, membership } = await requireMember();
  const manager = canManage(membership.role);
  const [eventTypes, webhooks, apiKeys] = await Promise.all([
    db.eventType.findMany({ where: { organizationId: org.id, active: true }, orderBy: { createdAt: "asc" } }),
    manager
      ? db.webhook.findMany({
          where: { organizationId: org.id },
          include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
          orderBy: { createdAt: "asc" },
        })
      : [],
    manager ? db.apiKey.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "asc" } }) : [],
  ]);
  const base = appUrl();
  const firstEvent = eventTypes[0]?.slug ?? "meeting-typ";
  const scriptSnippet = `<div data-kalender="${org.slug}/${firstEvent}"></div>\n<script src="${base}/embed.js" async></script>`;
  const iframeSnippet = `<iframe src="${base}/embed/${org.slug}/${firstEvent}" style="width:100%;min-height:700px;border:0" loading="lazy"></iframe>`;
  const buttonSnippet = `<a href="${base}/${org.slug}/${firstEvent}" data-kalender-popup>Termin buchen</a>\n<script src="${base}/embed.js" async></script>`;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Integrationen</h1>

      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Auf der eigenen Webseite einbinden</h2>
          <p className="text-sm text-slate-600">
            Einfach den Code in die Webseite kopieren. Die Höhe passt sich automatisch an. Den Meeting-Typ im Code bei Bedarf
            austauschen{eventTypes.length > 1 ? `: ${eventTypes.map((e) => e.slug).join(", ")}` : ""}.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="label">Eingebettet (empfohlen)</p>
            <CopyField value={scriptSnippet} />
          </div>
          <div>
            <p className="label">Als Button mit Popup</p>
            <CopyField value={buttonSnippet} />
          </div>
          <div>
            <p className="label">Reiner iframe</p>
            <CopyField value={iframeSnippet} rows={4} />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Erinnerungen</h2>
          <p className="text-sm text-slate-600">E-Mail an Kunden, Gäste und Gastgeber vor dem Termin.</p>
        </div>
        <form action={saveReminders} className="space-y-3">
          <fieldset disabled={!manager} className="flex flex-wrap gap-4">
            {REMINDER_CHOICES.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="reminder" value={m} defaultChecked={org.reminderOffsetsMin.includes(m)} />
                {offsetLabel(m)} vorher
              </label>
            ))}
          </fieldset>
          {manager && <button className="btn-secondary">Speichern</button>}
        </form>
      </section>

      {!manager ? (
        <p className="text-sm text-slate-500">Webhooks und API-Schlüssel können nur Inhaber und Admins verwalten.</p>
      ) : (
        <>
          <section className="card space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Webhooks</h2>
              <p className="text-sm text-slate-600">
                Bei jedem Ereignis schicken wir ein signiertes JSON per POST an deine Adresse, z.B. für CRM, Zapier oder n8n.
                Prüfen: HMAC-SHA256 über <code>{"<t>.<body>"}</code> mit dem Geheimnis, verglichen mit <code>v1</code> im
                Header <code>X-Kalender-Signature</code>.
              </p>
            </div>
            {webhooks.map((h) => (
              <div key={h.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium break-all">{h.url}</p>
                    <p className="text-slate-500">
                      {h.events.map((e) => WEBHOOK_EVENT_LABEL[e as keyof typeof WEBHOOK_EVENT_LABEL] ?? e).join(" · ")}
                      {!h.active && " · pausiert"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={testWebhook.bind(null, h.id)}><button className="btn-secondary">Testen</button></form>
                    <form action={toggleWebhook.bind(null, h.id)}>
                      <button className="btn-secondary">{h.active ? "Pausieren" : "Aktivieren"}</button>
                    </form>
                    <form action={deleteWebhook.bind(null, h.id)}><button className="btn-secondary text-red-600">Löschen</button></form>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-slate-500">Geheimnis und letzte Aufrufe</summary>
                  <code className="mt-2 block break-all rounded bg-slate-50 p-2 text-xs">{h.secret}</code>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {h.deliveries.length === 0 && <li>Noch keine Aufrufe.</li>}
                    {h.deliveries.map((d) => (
                      <li key={d.id}>
                        {d.error ? "❌" : "✅"} {dt.format(d.createdAt)} · {d.event} · {d.statusCode ?? "-"} {d.error ?? ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
            <form action={createWebhook} className="space-y-3 rounded-lg border border-dashed border-slate-300 p-4">
              <div>
                <label className="label" htmlFor="hookUrl">Neue Webhook-Adresse</label>
                <input className="input" id="hookUrl" name="url" type="url" placeholder="https://example.com/webhooks/termine" required />
              </div>
              <div className="flex flex-wrap gap-4">
                {WEBHOOK_EVENTS.map((e) => (
                  <label key={e} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="events" value={e} defaultChecked={e !== "negotiation.approval_requested"} />
                    {WEBHOOK_EVENT_LABEL[e]}
                  </label>
                ))}
              </div>
              <button className="btn-secondary">Hinzufügen</button>
            </form>
          </section>

          <section className="card space-y-4">
            <div>
              <h2 className="text-lg font-semibold">API-Schlüssel</h2>
              <p className="text-sm text-slate-600">
                Für die REST-API unter <code>{base}/api/v1</code>: Meeting-Typen, freie Zeiten, Buchungen lesen, anlegen und
                absagen. Aufruf mit <code>Authorization: Bearer kb_…</code>.
              </p>
            </div>
            {apiKeys.length > 0 && (
              <ul className="divide-y divide-slate-100 text-sm">
                {apiKeys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-medium">{k.name}</span>{" "}
                      <code className="text-slate-500">{k.prefix}…</code>
                      <span className="ml-2 text-xs text-slate-400">
                        {k.lastUsedAt ? `zuletzt genutzt ${dt.format(k.lastUsedAt)}` : "noch nie genutzt"}
                      </span>
                    </span>
                    <form action={deleteApiKey.bind(null, k.id)}>
                      <button className="text-sm text-red-600 hover:underline">Widerrufen</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <ApiKeyForm />
          </section>
        </>
      )}
    </div>
  );
}
