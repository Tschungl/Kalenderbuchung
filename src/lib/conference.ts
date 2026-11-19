import type { LocationType } from "@prisma/client";
import { demoCalendar, providerFor } from "@/lib/calendar";
import { createZoomMeeting, hasZoom } from "@/lib/zoom";

/**
 * Entscheidet pro Buchung, wie die Videokonferenz entsteht:
 * - GOOGLE_MEET: Meet bei Google-Gastgebern, Teams bei Outlook-Gastgebern (über den Kalender)
 * - MS_TEAMS:    Teams-Meeting über Outlook; Google-Gastgeber nutzen den festen Link aus der Ortsangabe
 * - ZOOM:        Zoom-Meeting über das verbundene Zoom-Konto, sonst der feste Link aus der Ortsangabe
 * - sonst:       nur die Ortsangabe
 */
export type ConferencePlan = {
  /** Kalender soll selbst eine Konferenz anlegen (Meet bzw. Teams) */
  withMeet: boolean;
  /** Ort im Kalender-Event */
  location?: string;
  /** Link, der schon vor dem Kalender-Event feststeht (Zoom, fester Link) */
  meetingUrl?: string;
  zoomMeetingId?: string;
  /** Zeile für die Event-Beschreibung */
  descriptionLine?: string;
};

export const LOCATION_LABEL: Record<LocationType, string> = {
  GOOGLE_MEET: "Videokonferenz",
  MS_TEAMS: "Microsoft Teams",
  ZOOM: "Zoom",
  PHONE: "Telefon",
  IN_PERSON: "Vor Ort",
  CUSTOM_LINK: "Online",
};

function demoDigits(seed: string, n: number) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(h).padEnd(n, "7").slice(0, n);
}

export async function planConference(
  et: { locationType: LocationType; locationValue: string | null },
  organizerId: string,
  meeting: { topic: string; start: Date; durationMin: number; timeZone: string; agenda?: string; seed: string },
): Promise<ConferencePlan> {
  const fixed = et.locationValue?.trim() || undefined;
  const fixedLink = fixed && /^https?:\/\//i.test(fixed) ? fixed : undefined;

  switch (et.locationType) {
    case "GOOGLE_MEET":
      return { withMeet: true };

    case "MS_TEAMS": {
      if (demoCalendar()) {
        const url = `https://teams.microsoft.com/l/meetup-join/demo-${demoDigits(meeting.seed, 12)}`;
        return { withMeet: false, meetingUrl: url, location: "Microsoft Teams", descriptionLine: `Teams: ${url}` };
      }
      if ((await providerFor(organizerId)) === "microsoft") return { withMeet: true };
      return fixedLink
        ? { withMeet: false, meetingUrl: fixedLink, location: fixedLink, descriptionLine: `Teams: ${fixedLink}` }
        : { withMeet: false, location: "Microsoft Teams" };
    }

    case "ZOOM": {
      if (demoCalendar()) {
        const url = `https://zoom.us/j/${demoDigits(meeting.seed, 11)}`;
        return { withMeet: false, meetingUrl: url, location: url, zoomMeetingId: `demo-${meeting.seed}`, descriptionLine: `Zoom: ${url}` };
      }
      if (await hasZoom(organizerId)) {
        const { meetingId, joinUrl } = await createZoomMeeting(organizerId, meeting);
        return { withMeet: false, meetingUrl: joinUrl, location: joinUrl, zoomMeetingId: meetingId, descriptionLine: `Zoom: ${joinUrl}` };
      }
      return fixedLink
        ? { withMeet: false, meetingUrl: fixedLink, location: fixedLink, descriptionLine: `Zoom: ${fixedLink}` }
        : { withMeet: false, location: "Zoom" };
    }

    case "CUSTOM_LINK":
      return { withMeet: false, location: fixed, meetingUrl: fixedLink };

    default:
      return { withMeet: false, location: fixed };
  }
}
