/**
 * Anrede der Kunden (pro Organisation einstellbar): alle festen Texte, die Kunden
 * und Gäste auf Buchungsseiten, im Chat und in Mails sehen. Ohne Abhängigkeiten,
 * damit auch Client-Komponenten es nutzen können.
 */
export type Anrede = "SIE" | "DU";

export const SALUTATIONS = { SIE: "Sie (förmlich)", DU: "Du (persönlich)" } as const;

const SIE = {
  yourTimeZone: "Zeiten in Ihrer Zeitzone",
  tellUsWhen: "Sagen Sie uns, wann es Ihnen passt",
  intakeIntroDefault: "Unser Assistent klärt kurz ein paar Punkte und bucht dann den Termin für Sie.",
  negotiationIntro: "Schreiben Sie kurz, wann es Ihnen passt. Unser Assistent sucht Alternativen und fragt bei Bedarf beim Gastgeber nach.",
  yourName: "Ihr Name",
  yourEmail: "Ihre E-Mail",
  yourAnswer: "Ihre Antwort",
  whenSuitsYou: "Wann passt es Ihnen?",
  waitingForHost: "Wir fragen beim Gastgeber nach. Sie bekommen eine E-Mail.",
  waitingForHostError: "Wir warten noch auf die Rückmeldung des Gastgebers. Sie bekommen eine E-Mail.",
  maxTurns: "Die maximale Anzahl Nachrichten ist erreicht. Bitte wenden Sie sich direkt an den Gastgeber.",
  bookedFallback: "Ihr Termin ist gebucht. Die Einladung kommt per E-Mail.",
  retryFallback: "Entschuldigung, das hat gerade nicht geklappt. Möchten Sie es noch einmal versuchen?",
  refusalFallback: "Dabei kann ich leider nicht helfen. Gern suche ich mit Ihnen einen passenden Termin.",
  hello: (name?: string) => (name ? `Guten Tag ${name},` : "Guten Tag,"),
  confirmed: (title: string, host: string, rescheduled: boolean) =>
    `Ihr Termin "${title}" mit ${host} ist ${rescheduled ? "verschoben und neu " : ""}bestätigt.`,
  guestInvited: (booker: string, title: string, host: string, rescheduled: boolean) =>
    `${booker} hat Sie zum Termin "${title}" mit ${host} eingeladen.${rescheduled ? " Der Termin wurde verschoben." : ""}`,
  guestCalendarNote: (booker: string) =>
    `Die Einladung für Ihren Kalender kommt in einer separaten Mail. Verschieben oder absagen kann ${booker}.`,
  reminder: (title: string, org: string) => `wir erinnern Sie an den Termin "${title}" (${org}).`,
  declined: (title: string, when: string) => `die angefragte Zeit für "${title}" (${when}) ist leider nicht möglich.`,
  findOtherTime: (link: string) => `Hier können Sie direkt eine andere Zeit finden: ${link}`,
  invitedAlso: (names: string) => `Eine Kalendereinladung ist unterwegs, auch an ${names}.`,
  aiAddress: "Sprich den Kunden mit „Sie“ an (förmlich).",
};

type Texts = typeof SIE;

const DU: Texts = {
  yourTimeZone: "Zeiten in deiner Zeitzone",
  tellUsWhen: "Sag uns, wann es dir passt",
  intakeIntroDefault: "Unser Assistent klärt kurz ein paar Punkte und bucht dann den Termin für dich.",
  negotiationIntro: "Schreib kurz, wann es dir passt. Unser Assistent sucht Alternativen und fragt bei Bedarf beim Gastgeber nach.",
  yourName: "Dein Name",
  yourEmail: "Deine E-Mail",
  yourAnswer: "Deine Antwort",
  whenSuitsYou: "Wann passt es dir?",
  waitingForHost: "Wir fragen beim Gastgeber nach. Du bekommst eine E-Mail.",
  waitingForHostError: "Wir warten noch auf die Rückmeldung des Gastgebers. Du bekommst eine E-Mail.",
  maxTurns: "Die maximale Anzahl Nachrichten ist erreicht. Bitte wende dich direkt an den Gastgeber.",
  bookedFallback: "Dein Termin ist gebucht. Die Einladung kommt per E-Mail.",
  retryFallback: "Entschuldige, das hat gerade nicht geklappt. Magst du es noch einmal versuchen?",
  refusalFallback: "Dabei kann ich leider nicht helfen. Lass uns gern einen passenden Termin suchen.",
  hello: (name?: string) => (name ? `Hallo ${name},` : "Hallo,"),
  confirmed: (title, host, rescheduled) => `dein Termin "${title}" mit ${host} ist ${rescheduled ? "verschoben und neu " : ""}bestätigt.`,
  guestInvited: (booker, title, host, rescheduled) =>
    `${booker} hat dich zum Termin "${title}" mit ${host} eingeladen.${rescheduled ? " Der Termin wurde verschoben." : ""}`,
  guestCalendarNote: (booker) => `Die Einladung für deinen Kalender kommt in einer separaten Mail. Verschieben oder absagen kann ${booker}.`,
  reminder: (title, org) => `kurze Erinnerung an den Termin "${title}" (${org}).`,
  declined: (title, when) => `die angefragte Zeit für "${title}" (${when}) ist leider nicht möglich.`,
  findOtherTime: (link) => `Hier kannst du direkt eine andere Zeit finden: ${link}`,
  invitedAlso: (names) => `Eine Kalendereinladung ist unterwegs, auch an ${names}.`,
  aiAddress: "Duze den Kunden (persönlich, aber höflich).",
};

export function t(anrede: string | null | undefined): Texts {
  return anrede === "DU" ? DU : SIE;
}
