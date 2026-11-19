import nodemailer from "nodemailer";

/**
 * E-Mail-Versand über SMTP. Ohne SMTP_HOST wird nur geloggt,
 * damit die App lokal auch ohne Mailserver läuft.
 */
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    })
  : null;

export async function sendMail(to: string, subject: string, text: string) {
  if (!transporter) {
    console.info(`[mail] (kein SMTP konfiguriert) an ${to}: ${subject}\n${text}`);
    return;
  }
  await transporter.sendMail({ from: process.env.MAIL_FROM ?? "termine@example.com", to, subject, text });
}

export function formatDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
