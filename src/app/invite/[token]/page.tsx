import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButtons } from "@/components/SignInButtons";
import { db } from "@/lib/db";
import { acceptInvitation, CURRENT_ORG_COOKIE } from "@/lib/org";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await db.invitation.findUnique({ where: { token }, include: { organization: true } });
  if (!invitation) notFound();
  const session = await auth();
  const expired = invitation.expiresAt < new Date();
  const used = !!invitation.acceptedAt;

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <div className="card space-y-4">
        <h1 className="text-2xl font-semibold">Einladung zu {invitation.organization.name}</h1>
        {expired || used ? (
          <p className="text-slate-600">
            {used ? "Diese Einladung wurde bereits angenommen." : "Diese Einladung ist abgelaufen."} Bitte frag nach
            einer neuen.
          </p>
        ) : !session?.user?.id ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Melde dich an. Dabei wird dein Kalender verbunden, damit Kunden nur freie Zeiten sehen.
            </p>
            <SignInButtons redirectTo={`/invite/${token}`} suffix="anmelden und beitreten" />
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              const s = await auth();
              if (!s?.user?.id) redirect(`/invite/${token}`);
              const m = await acceptInvitation(invitation.id, s.user.id);
              if (m) {
                (await cookies()).set(CURRENT_ORG_COOKIE, m.organizationId, {
                  httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000,
                });
              }
              redirect("/dashboard");
            }}
            className="space-y-3"
          >
            <p className="text-sm text-slate-600">
              Angemeldet als {session.user.email}.
              {session.user.email?.toLowerCase() !== invitation.email && (
                <> Die Einladung ging an {invitation.email}.</>
              )}
            </p>
            <button className="btn w-full">Einladung annehmen</button>
          </form>
        )}
      </div>
    </main>
  );
}
