# Kalenderbuchung

Terminbuchungs-Plattform für Firmen. Sie ist an Google Kalender und Outlook angebunden, unterstützt Teams und verhandelt Termine mit KI-Unterstützung.
Mandantenfähig: Jede Firma ist eine eigene Organisation mit eigenen Mitgliedern, Meeting-Typen, Buchungsseite und optional eigener Domain.

## Funktionen

**Buchen**
- Öffentliche Buchungsseite `/<organisation>/<meeting-typ>` mit Wochenansicht in der Zeitzone des Kunden
- Vor dem Buchen wird der Slot erneut geprüft, dann landet der Termin im Kalender des Gastgebers: Google mit Meet-Link oder Outlook mit Teams-Link. Die Einladungen verschickt der Kalender.
- Bestätigungsmail mit Link zum Verschieben oder Absagen; Erinnerungsmails vorher (Zeitpunkte wählbar)
- Kein Kalender erreichbar = keine Slots, damit es keine Doppelbuchungen gibt

**Meeting-Typen und Teams**
- Pro Meeting-Typ einstellbar: Dauer, Puffer, Vorlauf, Zeitraster, Ort und Gäste
- Gastgeber-Modi: einzeln, kollektiv (alle Pflicht-Gastgeber müssen frei sein, optionale nicht), Round Robin mit Gewichtung
- Mitglieder per E-Mail einladen, Rollen Inhaber / Admin / Mitglied, mehrere Organisationen pro Person
- Verfügbarkeit pro Wochentag und Zeitzone, zentrale Buchungsübersicht, Statistik

**KI-Terminverhandlung** (Claude API)
- Passt keine angebotene Zeit, schreibt der Kunde frei, wann er kann
- Der Assistent prüft Zeiten und schlägt sie vor, bucht direkt oder fragt beim Gastgeber nach. Er handelt nur über Werkzeuge, die serverseitig gegen die Regeln prüfen.
- Pro Meeting-Typ einstellbar: erweiterte Zeiten, Wochenende, kürzerer Vorlauf, direkt buchen oder Freigabe, Hinweise

**Gestaltung und Ausbau**
- Gestaltung der Buchungsseite mit Live-Vorschau: Farbe, Logo, Texte, Schrift, Buttons, Hintergrund (hell, getönt, dunkel)
- Eigene Domain pro Organisation (z.B. `termine.firma.de`) mit automatischem HTTPS
- Einbettung auf Firmenwebseiten (Skript, Popup-Button oder iframe)
- Webhooks und REST-API mit API-Schlüsseln

## Schnellstart lokal

```bash
cp .env.example .env          # mindestens AUTH_SECRET und Google-Zugang eintragen
docker compose up -d db       # nur die Datenbank
npm install --legacy-peer-deps
npx prisma migrate dev
npm run dev                   # http://localhost:3000
npm test                      # Tests (mit DATABASE_URL auch die Datenbank-Tests)
```

Zum Ausprobieren ohne Google-Zugang: `DEMO_CALENDAR=1` setzen. Dann gibt es simulierte belegte Zeiten, und Buchungen bekommen einen Beispiel-Videolink. Nicht im echten Betrieb verwenden.

## Betrieb auf einem Server

Voraussetzungen: ein Server mit Docker, eine Domain (z.B. `termine.example.com`), deren DNS auf den Server zeigt.

```bash
git clone https://github.com/Tschungl/Kalenderbuchung.git && cd Kalenderbuchung
cp .env.example .env
# In .env setzen:
#   APP_URL=https://termine.example.com   AUTH_URL=https://termine.example.com
#   APP_DOMAIN=termine.example.com        ACME_EMAIL=du@example.com
#   AUTH_SECRET=$(openssl rand -base64 32)
#   Google- (und optional Microsoft-)Zugangsdaten, SMTP, ANTHROPIC_API_KEY
docker compose --profile proxy up -d --build
```

Das startet Datenbank, App und den Reverse Proxy Caddy. Caddy holt die HTTPS-Zertifikate automatisch, auch für die eigenen Domains der Kunden (nur für geprüfte Domains). Datenbank-Migrationen laufen beim Start der App. Updates: `git pull && docker compose --profile proxy up -d --build`.

Datensicherung: `docker compose exec db pg_dump -U kalender kalender > backup.sql`.

## Google einrichten

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt anlegen.
2. Unter „APIs & Dienste“ die **Google Calendar API** aktivieren.
3. „OAuth-Zustimmungsbildschirm“ konfigurieren: Typ „Extern“, damit sich auch andere Firmen anmelden können. Diese Bereiche hinzufügen: `calendar.readonly`, `calendar.events`, `openid`, `email`, `profile`.
4. Unter „Anmeldedaten“ eine **OAuth-Client-ID** vom Typ „Webanwendung“ erstellen.
   Autorisierte Weiterleitungs-URI: `https://<deine-domain>/api/auth/callback/google` (lokal: `http://localhost:3000/api/auth/callback/google`).
5. Client-ID und Secret in `.env` als `AUTH_GOOGLE_ID` und `AUTH_GOOGLE_SECRET` eintragen.

Solange die App im Google-Testmodus ist, können sich nur eingetragene Testnutzer anmelden. Für den Betrieb als Produkt muss Google die App verifizieren, weil die Kalender-Bereiche als „sensibel“ gelten.

## Microsoft 365 / Outlook einrichten (optional)

1. Im [Azure Portal](https://portal.azure.com/) unter „App-Registrierungen“ eine neue App anlegen.
   Kontotypen: „Konten in allen Organisationsverzeichnissen und persönliche Microsoft-Konten“.
2. Umleitungs-URI (Web): `https://<deine-domain>/api/auth/callback/microsoft-entra-id`.
3. Unter „API-Berechtigungen“ für Microsoft Graph (delegiert) hinzufügen: `openid`, `profile`, `email`, `offline_access`, `User.Read`, `Calendars.ReadWrite`.
4. Unter „Zertifikate & Geheimnisse“ einen geheimen Clientschlüssel erstellen.
5. In `.env` eintragen: `AUTH_MICROSOFT_ENTRA_ID_ID` (Anwendungs-ID), `AUTH_MICROSOFT_ENTRA_ID_SECRET` (Wert des Schlüssels).

Danach erscheint auf der Login-Seite zusätzlich „Mit Microsoft 365 / Outlook anmelden“. Wer sich so anmeldet, bekommt Belegt-Zeiten aus Outlook, und Buchungen landen in seinem Outlook-Kalender. Bei Firmenkonten kommt automatisch ein Teams-Link dazu, private Microsoft-Konten erhalten einen Termin ohne Teams. In einem Team können Google- und Outlook-Nutzer gemischt sein.

## Eigene Domains

Im Dashboard unter „Gestaltung“ trägt eine Organisation ihre Domain ein (z.B. `termine.firma.de`) und legt beim Domain-Anbieter zwei Einträge an:

| Typ | Name | Wert |
| --- | --- | --- |
| CNAME | `termine.firma.de` | Adresse der App, z.B. `termine.example.com` |
| TXT | `_kalender.termine.firma.de` | `kalender-verify=<Token aus dem Dashboard>` |

Nach „Prüfen“ ist die Domain aktiv. Caddy holt das Zertifikat beim ersten Aufruf (`/api/domains/check` erlaubt nur geprüfte Domains). Unter der eigenen Domain zeigt `/` die Startseite der Organisation und `/<meeting-typ>` die Buchung. Das Dashboard bleibt auf der Hauptadresse.

## KI-Terminverhandlung

`ANTHROPIC_API_KEY` setzen (Schlüssel von [console.anthropic.com](https://console.anthropic.com/)). Ohne Schlüssel ist die Funktion ausgeblendet. Optional wählt `NEGOTIATION_MODEL` ein anderes Modell (Standard: `claude-opus-5-5`). Aktiviert wird sie pro Meeting-Typ.

## E-Mail

SMTP-Zugang (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`) eintragen, z.B. von Postmark, Brevo, Mailgun oder dem eigenen Mailserver. Ohne SMTP werden Mails nur ins Log geschrieben.

Erinnerungen verschickt die App selbst im Minutentakt. Bei mehreren App-Instanzen `DISABLE_REMINDER_LOOP=1` setzen und stattdessen `POST /api/cron/reminders` mit `Authorization: Bearer <CRON_SECRET>` per Cron aufrufen.

## Einbettung

Im Dashboard unter „Integrationen“ steht fertiger Code, zum Beispiel:

```html
<div data-kalender="firma/beratung"></div>
<script src="https://termine.example.com/embed.js" async></script>
```

Die Höhe passt sich automatisch an. Ein Popup statt der eingebetteten Ansicht gibt es mit `<a href="…/firma/beratung" data-kalender-popup>Termin buchen</a>`. Nach einer Buchung löst die Seite das Ereignis `kalender:booked` auf `window` aus.

## REST-API

Schlüssel unter Dashboard → Integrationen erzeugen, dann mit `Authorization: Bearer kb_…` aufrufen.

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/api/v1/event-types` | Meeting-Typen mit Gastgebern |
| GET | `/api/v1/slots?eventTypeId=…&from=ISO&to=ISO` | Freie Zeiten (max. 6 Wochen) |
| GET | `/api/v1/bookings?from=&to=&status=&limit=` | Buchungen |
| POST | `/api/v1/bookings` | Buchen (`eventTypeId`, `start`, `name`, `email`, optional `guests`, `notes`, `timeZone`) |
| GET | `/api/v1/bookings/:id` | Eine Buchung |
| POST | `/api/v1/bookings/:id/reschedule` | Verschieben (`start`), liefert die neue Buchung |
| DELETE | `/api/v1/bookings/:id` | Absagen, Kalender-Event wird mitgelöscht |

## Webhooks

Ereignisse: `booking.created`, `booking.cancelled`, `booking.rescheduled`, `negotiation.approval_requested`.
Jeder Aufruf ist ein POST mit JSON `{ event, createdAt, data }` und dem Header `X-Kalender-Signature: t=<unix>,v1=<hex>`, wobei `v1 = HMAC-SHA256(geheimnis, "<t>.<body>")`.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `prisma/schema.prisma` | Datenmodell |
| `src/lib/availability.ts` | Verfügbarkeits-Engine (reine Funktionen) |
| `src/lib/slots.ts` | Lädt Arbeitszeiten und Belegt-Zeiten, berechnet Slots |
| `src/lib/calendar.ts` | Kalender-Schicht: wählt pro Gastgeber Google oder Outlook |
| `src/lib/google.ts`, `src/lib/microsoft.ts` | Google Calendar API und Microsoft Graph |
| `src/lib/booking.ts` | Buchen, Verschieben, Absagen |
| `src/lib/negotiation/` | KI-Verhandlung: Regeln, Agent, Freigaben |
| `src/lib/integrations/` | Webhooks, API-Schlüssel |
| `src/lib/reminders.ts` | Erinnerungsmails (Takt startet in `src/instrumentation.ts`) |
| `src/lib/domains.ts`, `src/middleware.ts` | Eigene Domains |
| `src/lib/stats.ts` | Auswertungen für die Statistik |
| `src/app/dashboard` | Verwaltung |
| `src/app/[org]`, `src/app/site`, `src/app/embed` | Öffentliche Buchungsseiten (normal, eigene Domain, eingebettet) |
| `src/app/api` | Interne API, `api/v1` (öffentliche API) |
| `public/embed.js` | Einbettungsskript |
| `Caddyfile` | Reverse Proxy mit HTTPS |

## Qualität

GitHub Actions prüft bei jedem Push und Pull Request: Typen, Lint, alle Tests gegen eine echte PostgreSQL, Next.js-Build und Docker-Image.

## Mögliche Erweiterungen

- Zahlungen vor der Buchung (z.B. Stripe)
- Eigene Fragen im Buchungsformular
- Kalender-Auswahl pro Person (mehrere Kalender für Belegt-Zeiten)
- SMS-Erinnerungen
