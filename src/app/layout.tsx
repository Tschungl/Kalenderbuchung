import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kalenderbuchung",
  description: "Termine buchen, direkt aus dem eigenen Kalender (Google oder Outlook)",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
