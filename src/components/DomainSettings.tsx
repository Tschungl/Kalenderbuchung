import { appHost, verifyRecordName, verifyRecordValue } from "@/lib/domains";
import { removeCustomDomain, setCustomDomain, verifyCustomDomain } from "@/app/dashboard/settings/actions";

type Props = { customDomain: string | null; domainToken: string; domainVerifiedAt: Date | null; manager: boolean };

export function DomainSettings({ customDomain, domainToken, domainVerifiedAt, manager }: Props) {
  const target = appHost().replace(/:\d+$/, "");
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Eigene Domain</h2>
        <p className="text-sm text-slate-600">
          Die Buchungsseite unter einer eigenen Adresse anbieten, z.B. <code>termine.firma.de</code>. HTTPS wird automatisch
          eingerichtet.
        </p>
      </div>
      {customDomain ? (
        <div className="space-y-3 text-sm">
          <p>
            <span className="font-medium">{customDomain}</span>{" "}
            {domainVerifiedAt ? (
              <span className="text-green-700">✓ aktiv</span>
            ) : (
              <span className="text-amber-700">wartet auf DNS-Prüfung</span>
            )}
          </p>
          {!domainVerifiedAt && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <p>Beim Domain-Anbieter zwei Einträge anlegen, dann auf „Prüfen“ klicken:</p>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr><th className="pr-3">Typ</th><th className="pr-3">Name</th><th>Wert</th></tr>
                </thead>
                <tbody className="font-mono">
                  <tr><td className="pr-3">CNAME</td><td className="pr-3 break-all">{customDomain}</td><td className="break-all">{target}</td></tr>
                  <tr><td className="pr-3">TXT</td><td className="pr-3 break-all">{verifyRecordName(customDomain)}</td><td className="break-all">{verifyRecordValue(domainToken)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {manager && (
            <div className="flex gap-2">
              {!domainVerifiedAt && (
                <form action={verifyCustomDomain}><button className="btn-secondary">Prüfen</button></form>
              )}
              <form action={removeCustomDomain}><button className="btn-secondary text-red-600">Entfernen</button></form>
            </div>
          )}
        </div>
      ) : manager ? (
        <form action={setCustomDomain} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className="label" htmlFor="domain">Domain</label>
            <input className="input" id="domain" name="domain" placeholder="termine.firma.de" required />
          </div>
          <button className="btn-secondary">Hinzufügen</button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Keine eigene Domain eingerichtet.</p>
      )}
    </section>
  );
}
