import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { bootstrapNewUser } from "@/lib/org";
import { MS_PROVIDER, MS_SCOPES } from "@/lib/microsoft";

/** Outlook-Login nur anbieten, wenn eine Microsoft-App eingerichtet ist. */
export const microsoftEnabled = !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID;

/** Google-Berechtigungen: Login + Kalender lesen (Belegt-Zeiten) + Termine anlegen. */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    Google({
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline", // liefert Refresh-Token für Hintergrundzugriff
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    }),
    ...(microsoftEnabled
      ? [
          MicrosoftEntraID({
            // Profilbild nicht als Base64 in der Datenbank speichern
            profilePhotoSize: 48,
            authorization: { params: { scope: MS_SCOPES, prompt: "select_account" } },
          }),
        ]
      : []),
  ],
  pages: { signIn: "/login" },
  events: {
    async createUser({ user }) {
      if (user.id) await bootstrapNewUser({ id: user.id, name: user.name, email: user.email });
    },
    async signIn({ account }) {
      // Bei erneutem Login neue Tokens speichern (Google schickt Refresh-Token nur mit prompt=consent)
      if ((account?.provider === "google" || account?.provider === MS_PROVIDER) && account.refresh_token) {
        await db.account.updateMany({
          where: { provider: account.provider, providerAccountId: account.providerAccountId },
          data: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            scope: account.scope,
          },
        });
      }
    },
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
