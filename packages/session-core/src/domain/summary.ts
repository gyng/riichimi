import type { Wind } from "@riichimi/score-core";

import type { RoundRecord, SessionState, TablePlayer } from "./session";

// A read-only derivation of a table's state into a shareable game summary:
// final standings, a win/draw tally, and a per-round log. Pure — it never
// mutates the session, so it is safe to run at any time.

const startingScore = 25_000;

export interface StandingEntry {
  readonly placement: number;
  readonly playerId: string;
  readonly name: string;
  readonly score: number;
  readonly net: number;
}

export interface RoundSummaryLine {
  readonly handNumber: number;
  readonly roundWind: Wind;
  readonly honba: number;
  readonly kind: "win" | "draw";
  readonly description: string;
  readonly deltas: readonly number[];
}

export interface SessionSummary {
  readonly tableId: string;
  readonly startedAt: string;
  readonly currentRound: {
    readonly roundWind: Wind;
    readonly handNumber: number;
    readonly honba: number;
  };
  readonly standings: readonly StandingEntry[];
  readonly roundsPlayed: number;
  readonly winCount: number;
  readonly drawCount: number;
  readonly rounds: readonly RoundSummaryLine[];
}

function playerName(players: readonly TablePlayer[], index: number): string {
  return players[index]?.name ?? `Player ${index + 1}`;
}

function describeRound(record: RoundRecord, players: readonly TablePlayer[]): string {
  if (record.kind === "win") {
    const winner = playerName(players, record.winnerIndex);
    if (record.payments.kind === "ron") {
      const discarder =
        record.discarderIndex === null ? "" : ` off ${playerName(players, record.discarderIndex)}`;
      return `${winner} won by ron${discarder}`;
    }
    return `${winner} won by tsumo`;
  }
  const tenpai = record.tenpaiPlayerIndices.length;
  if (tenpai === 0) {
    return "Exhaustive draw — all noten";
  }
  if (tenpai === 4) {
    return "Exhaustive draw — all tenpai";
  }
  return `Exhaustive draw — ${tenpai} tenpai`;
}

/** Build a game summary from the current table state. */
export function summarizeSession(state: SessionState): SessionSummary {
  const { table } = state;
  // Rank by score, then by seat order (index 0 = starting East) to break ties,
  // matching the "closer to the starting dealer places higher" convention.
  const ranked = table.players
    .map((player, seatIndex) => ({ player, seatIndex }))
    .toSorted(
      (left, right) => right.player.score - left.player.score || left.seatIndex - right.seatIndex,
    );

  const standings: readonly StandingEntry[] = ranked.map(({ player }, index) => ({
    placement: index + 1,
    playerId: player.id,
    name: player.name,
    score: player.score,
    net: player.score - startingScore,
  }));

  const winCount = table.history.filter((record) => record.kind === "win").length;

  return {
    tableId: table.id,
    startedAt: table.startedAt,
    currentRound: {
      handNumber: table.handNumber,
      honba: table.honba,
      roundWind: table.roundWind,
    },
    standings,
    roundsPlayed: table.history.length,
    winCount,
    drawCount: table.history.length - winCount,
    rounds: table.history.map((record) => ({
      deltas: record.deltas,
      description: describeRound(record, table.players),
      handNumber: record.handNumber,
      honba: record.honba,
      kind: record.kind,
      roundWind: record.roundWind,
    })),
  };
}

const windLabel: Record<Wind, string> = {
  east: "East",
  north: "North",
  south: "South",
  west: "West",
};

function groupThousands(value: number): string {
  const digits = Math.abs(value).toString();
  let grouped = "";
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) {
      grouped += ",";
    }
    grouped += digits[index];
  }
  return grouped;
}

function signed(value: number): string {
  if (value === 0) {
    return "±0";
  }
  return `${value > 0 ? "+" : "-"}${groupThousands(value)}`;
}

/** Render a summary as plain, shareable text (locale-independent). */
export function formatSessionSummaryText(summary: SessionSummary): string {
  const lines: string[] = [];
  lines.push(
    `Riichimi table — ${windLabel[summary.currentRound.roundWind]} ${summary.currentRound.handNumber} · ${summary.currentRound.honba} honba`,
  );
  lines.push(
    `${summary.roundsPlayed} round${summary.roundsPlayed === 1 ? "" : "s"} (${summary.winCount} win${summary.winCount === 1 ? "" : "s"}, ${summary.drawCount} draw${summary.drawCount === 1 ? "" : "s"})`,
  );
  lines.push("");
  lines.push("Standings");
  for (const entry of summary.standings) {
    lines.push(
      `${entry.placement}. ${entry.name} — ${groupThousands(entry.score)} (${signed(entry.net)})`,
    );
  }
  if (summary.rounds.length > 0) {
    lines.push("");
    lines.push("Rounds");
    for (const round of summary.rounds) {
      lines.push(
        `${windLabel[round.roundWind]} ${round.handNumber} · ${round.description} · ${round.deltas.map(signed).join(" / ")}`,
      );
    }
  }
  return lines.join("\n");
}
