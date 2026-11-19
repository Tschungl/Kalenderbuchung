# Kalenderbuchung

Terminbuchungs-Plattform mit Google-Kalender-Anbindung, Teams und (ab Phase 3) KI-gestützter Terminverhandlung.
Mandantenfähig: jede Firma ist eine eigene Organisation mit eigenen Mitgliedern, Meeting-Typen und Buchungsseite.

## Stand: Phase 1 (MVP)

- Anmeldung mit Google, dabei Freigabe für den Kalender
- Beim ersten Login: eigene Organisation, Arbeitszeiten Mo–Fr 9–17 Uhr, erster Meeting-Typ
- Meeting-Typen mit Dauer, Puffern, Vorlauf, Zeitraster, Ort und erlaubten Gästen
- Gastgeber-Modi: einzeln, kollektiv (alle müssen frei sein), Round Robin
- Verfügbarkeit pro Wochentag und Zeitzone
- Öffentliche Buchungsseite `/<organisation>/<meeting-typ>` mit Wochenansicht
- Buchung prüft den Slot erneut, legt das Google-Event mit Meet-Link an (Google verschickt die Einladungen) und schickt eine Bestätigungsmail
- Absage per Link oder im Dashboard (Google-Event wird mitgelöscht)
- Kein Kalender erreichbar = keine Slots, damit es keine Doppelbuchungen gibt

## Phase 2 (Teams)

- Mitglieder per E-Mail einladen, Rollen Inhaber / Admin / Mitglied
- Teamseite mit Kalender-Status je Mitglied, Rollen ändern, Mitglieder entfernen
- Mehrere Organisationen pro User mit Umschalter
- Einstellungen: Name, Adresse der Buchungsseite, Markenfarbe, Logo
- Kollektive Termine mit optionalen Gastgebern, Round Robin mit Gewichtung
- Zentrale Buchungsübersicht mit Filter nach Gastgeber

## Lokal starten

```bash
cp .env.example .env          # Werte eintragen, siehe unten
docker compose up -d db       # nur die Datenbank
npm install --legacy-peer-deps
npx prisma migrate dev
npm run dev                   # http://localhost:3000
npm test                      # Tests (mit DATABASE_URL auch die DB-Integrationstests)
```

## Mit Docker betreiben

```bash
cp .env.example .env          # APP_URL/AUTH_URL auf die echte Domain setzen
docker compose up -d --build
```

Die App läuft auf Port 3000, Migrationen werden beim Start automatisch angewendet. Davor gehört ein Reverse Proxy mit HTTPS (z.B. Caddy oder Traefik).

## Google einrichten

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt anlegen.
2. Unter „APIs & Dienste“ die **Google Calendar API** aktivieren.
3. „OAuth-Zustimmungsbildschirm“ konfigurieren (Typ „Extern“, damit sich auch andere Firmen anmelden können) und diese Bereiche hinzufügen:
   `calendar.readonly`, `calendar.events`, dazu `openid`, `email`, `profile`.
4. Unter „Anmeldedaten“ eine **OAuth-Client-ID** vom Typ „Webanwendung“ erstellen.
   Autorisierte Weiterleitungs-URI: `https://<deine-domain>/api/auth/callback/google` (lokal: `http://localhost:3000/api/auth/callback/google`).
5. Client-ID und Secret in `.env` als `AUTH_GOOGLE_ID` und `AUTH_GOOGLE_SECRET` eintragen.

Solange die App im Google-Testmodus ist, können sich nur eingetragene Testnutzer anmelden. Für den Betrieb als Produkt
muss die App von Google verifiziert werden (Kalender-Bereiche gelten als „sensibel“).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `prisma/schema.prisma` | Datenmodell (Organisation, User, Meeting-Typen, Buchungen, …) |
| `src/lib/availability.ts` | Verfügbarkeits-Engine (reine Funktionen, getestet) |
| `src/lib/slots.ts` | Lädt Arbeitszeiten und Belegt-Zeiten, berechnet Slots |
| `src/lib/booking.ts` | Buchen und Absagen |
| `src/lib/google.ts` | Google Calendar: freeBusy, Events anlegen/löschen |
| `src/app/dashboard` | Verwaltung: Meeting-Typen, Verfügbarkeit, Buchungen |
| `src/app/[org]` | Öffentliche Buchungsseiten |
| `src/app/api` | `GET /api/slots`, `POST /api/bookings`, Absage |

## Nächste Phasen

3. KI-Verhandlung: Agent (Claude API) schlägt bei „Keine Zeit passt“ Alternativen innerhalb fester Regeln vor
4. Gestaltung und Ausbau: Branding-Editor, eigene Domains, Erinnerungen, Webhooks, Einbettung, Outlook
