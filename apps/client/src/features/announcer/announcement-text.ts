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
export function announcementText(announcement: WinAnnouncement): string {
  const points = new Intl.NumberFormat("en-US").format(announcement.points);
  const clauses = [
    methodWord[announcement.method],
    ...announcement.headline,
    valueClause(announcement),
    `${points} points`,
  ].filter((clause): clause is string => clause !== null);
  return `${clauses.join(", ")}.`;
}
