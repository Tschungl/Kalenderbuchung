import { db } from "@/lib/db";
import { canManage, requireMember } from "@/lib/session";
import { changeRole, inviteMember, removeMember, revokeInvitation } from "./actions";

const ROLE_LABEL = { OWNER: "Inhaber", ADMIN: "Admin", MEMBER: "Mitglied" } as const;

export default async function TeamPage() {
  const { org, membership: me } = await requireMember();
  const manager = canManage(me.role);
  const [members, invitations] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: org.id },
      include: {
        user: {
          include: {
            accounts: { where: { provider: "google" }, select: { refresh_token: true, scope: true } },
            hostOf: { where: { eventType: { organizationId: org.id } }, select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    manager
      ? db.invitation.findMany({
          where: { organizationId: org.id, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Team</h1>

      {manager && (
        <form action={inviteMember} className="card flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className="label" htmlFor="email">Mitglied einladen</label>
            <input className="input" id="email" name="email" type="email" placeholder="name@firma.de" required />
          </div>
          <div>
            <label className="label" htmlFor="role">Rolle</label>
            <select className="input" id="role" name="role" defaultValue="MEMBER">
              <option value="MEMBER">Mitglied</option>
              <option value="ADMIN">Admin</option>
              {me.role === "OWNER" && <option value="OWNER">Inhaber</option>}
            </select>
          </div>
          <button className="btn">Einladung senden</button>
        </form>
      )}

      <div className="card divide-y divide-slate-100 p-0">
        {members.map((m) => {
          const google = m.user.accounts[0];
          const calendarOk = !!google?.refresh_token && !!google.scope?.includes("calendar");
          return (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
              <div>
                <p className="font-medium">{m.user.name ?? m.user.email}</p>
                <p className="text-sm text-slate-500">
                  {m.user.email} · {m.user.hostOf.length} Meeting-Typen ·{" "}
                  {calendarOk ? (
                    <span className="text-green-700">Kalender verbunden</span>
                  ) : (
                    <span className="text-amber-700">Kalender nicht verbunden (neu anmelden)</span>
                  )}
                </p>
              </div>
              {manager ? (
                <div className="flex items-center gap-2">
                  <form action={changeRole.bind(null, m.id)} className="flex items-center gap-2">
                    <select className="input py-1" name="role" defaultValue={m.role}>
                      <option value="MEMBER">Mitglied</option>
                      <option value="ADMIN">Admin</option>
                      <option value="OWNER">Inhaber</option>
                    </select>
                    <button className="btn-secondary py-1">Ändern</button>
                  </form>
                  <form action={removeMember.bind(null, m.id)}>
                    <button className="text-sm text-red-600 hover:underline">Entfernen</button>
                  </form>
                </div>
              ) : (
                <span className="text-sm text-slate-500">{ROLE_LABEL[m.role]}</span>
              )}
            </div>
          );
        })}
      </div>

      {invitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Offene Einladungen</h2>
          <div className="card divide-y divide-slate-100 p-0">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-3 text-sm">
                <span>
                  {inv.email} · {ROLE_LABEL[inv.role]} · gültig bis {inv.expiresAt.toLocaleDateString("de-DE")}
                </span>
                <form action={revokeInvitation.bind(null, inv.id)}>
                  <button className="text-red-600 hover:underline">Zurückziehen</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
