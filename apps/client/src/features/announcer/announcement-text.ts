import type { WinAnnouncement } from "@riichimi/score-core";

const methodWord: Record<WinAnnouncement["method"], string> = {
  ron: "Ron",
  tsumo: "Tsumo",
};

function valueClause(announcement: WinAnnouncement): string | null {
  if (announcement.limit !== null) {
    return announcement.limit;
  }
  if (announcement.han === null) {
    return null;
  }
  return announcement.fu === null
    ? `${announcement.han} han`
    : `${announcement.han} han ${announcement.fu} fu`;
}

/**
 * Turns a scored win into a short spoken line. Wording lives here rather than in
 * the domain so a translation can replace it without touching scoring.
 */
function sentence(clauses: readonly (string | null)[]): string {
  const kept = clauses.filter((clause): clause is string => clause !== null);
  // Full stops between clauses so a voice reads them out one at a time.
  return kept.length === 0 ? "" : `${kept.join(". ")}.`;
}

export function announcementText(announcement: WinAnnouncement): string {
  const points = new Intl.NumberFormat("en-US").format(announcement.points);
  return sentence([
    methodWord[announcement.method],
    ...announcement.headline,
    valueClause(announcement),
    `${points} points`,
  ]);
}

/** The method and the yaku, read first — the build-up before the limit. */
export function announcementLead(announcement: WinAnnouncement): string {
  return sentence([methodWord[announcement.method], ...announcement.headline]);
}

/** The limit and the points — the climax, spoken as the stamp lands. */
export function announcementTail(announcement: WinAnnouncement): string {
  const points = new Intl.NumberFormat("en-US").format(announcement.points);
  return sentence([valueClause(announcement), `${points} points`]);
}
