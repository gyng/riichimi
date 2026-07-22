import { router, usePathname } from "expo-router";

import {
  integerArrayInput,
  integerInput,
  stringArrayInput,
  useWebMcpTools,
  webMcpResult,
} from "../../infrastructure/webmcp";
import { createRoundCommandMetadata, useSession } from "../../state/session-context";
import { useScoreHistory } from "../../state/score-history-context";

const routes = {
  history: "/history",
  home: "/",
  manual: "/manual",
  scan: "/scan",
  session: "/session",
} as const;

function destinationInput(input: Record<string, unknown>): keyof typeof routes {
  const value = input["destination"];
  if (
    value === "history" ||
    value === "home" ||
    value === "manual" ||
    value === "scan" ||
    value === "session"
  ) {
    return value;
  }
  throw new Error("destination must be home, history, manual, scan, or session.");
}

export function WebMcpBridge() {
  const pathname = usePathname();
  const session = useSession();
  const scoreHistory = useScoreHistory();
  const table = session.state?.table ?? null;

  useWebMcpTools([
    {
      annotations: { readOnlyHint: true },
      description:
        "Inspect the active Richii route, supported scoring rules, and current local table summary without changing app state.",
      execute: () =>
        webMcpResult("Richii app state read successfully.", {
          activeRoute: pathname,
          rules: {
            id: "wrc-2025",
            kiriageMangan: true,
            redFives: false,
          },
          savedScoreCount: scoreHistory.entries.length,
          table:
            table === null
              ? null
              : {
                  dealerIndex: table.dealerIndex,
                  handNumber: table.handNumber,
                  honba: table.honba,
                  players: table.players.map(({ name, score }) => ({ name, score })),
                  riichiSticks: table.riichiSticks,
                  roundWind: table.roundWind,
                },
        }),
      inputSchema: { additionalProperties: false, properties: {}, type: "object" },
      name: "richii.app.get_state",
      title: "Inspect Richii state",
    },
    {
      description:
        "Navigate the visible Richii interface to the home, score history, manual calculator, camera scan, or table session screen.",
      execute: (input: Record<string, unknown>) => {
        const destination = destinationInput(input);
        router.push(routes[destination]);
        return webMcpResult(`Opened the ${destination} screen.`, { destination });
      },
      inputSchema: {
        additionalProperties: false,
        properties: {
          destination: {
            enum: ["home", "history", "manual", "scan", "session"],
            type: "string",
          },
        },
        required: ["destination"],
        type: "object",
      },
      name: "richii.app.navigate",
      title: "Navigate Richii",
    },
    {
      annotations: { readOnlyHint: true },
      description:
        "List recent standalone scores saved locally by Richii, including hand context, score, payment, and yaku summaries.",
      execute: () =>
        webMcpResult(`Read ${scoreHistory.entries.length} saved scores.`, {
          entries: scoreHistory.entries.map((entry) => ({
            calculatedAt: entry.calculatedAt,
            context: entry.context,
            hand: entry.hand,
            id: entry.id,
            result: entry.result,
            rules: entry.rules,
          })),
        }),
      inputSchema: { additionalProperties: false, properties: {}, type: "object" },
      name: "richii.history.list",
      title: "List recent scores",
    },
    {
      description:
        "Start a new local four-player table at East 1 with 25,000 points each. Use only when no table is active.",
      execute: (input: Record<string, unknown>) => {
        if (table !== null) {
          throw new Error("A table is already active. Continue or end it in the visible UI first.");
        }
        const playerNames = stringArrayInput(input, "playerNames", 4);
        session.createTable(playerNames);
        router.push("/session");
        return webMcpResult("Started a local East 1 table.", { playerNames });
      },
      inputSchema: {
        additionalProperties: false,
        properties: {
          playerNames: {
            items: { minLength: 1, type: "string" },
            maxItems: 4,
            minItems: 4,
            type: "array",
          },
        },
        required: ["playerNames"],
        type: "object",
      },
      name: "richii.session.start",
      title: "Start table session",
    },
    {
      description:
        "Declare riichi for one player at the active local table, deducting 1,000 points and adding a stick. The visible UI can undo this action.",
      execute: (input: Record<string, unknown>) => {
        if (table === null) {
          throw new Error("No table is active.");
        }
        const playerIndex = integerInput(input, "playerIndex", 0, 3);
        session.declarePlayerRiichi(playerIndex);
        return webMcpResult(
          `Declared riichi for ${table.players[playerIndex]?.name ?? `player ${playerIndex + 1}`}.`,
          {
            playerIndex,
          },
        );
      },
      inputSchema: {
        additionalProperties: false,
        properties: { playerIndex: { maximum: 3, minimum: 0, type: "integer" } },
        required: ["playerIndex"],
        type: "object",
      },
      name: "richii.session.declare_riichi",
      title: "Declare player riichi",
    },
    {
      description:
        "Record an exhaustive draw for the active table using zero to four tenpai player indexes. Richii settles noten payments and advances or repeats the dealer; the visible UI can undo it.",
      execute: (input: Record<string, unknown>) => {
        if (table === null) {
          throw new Error("No table is active.");
        }
        const tenpaiPlayerIndices = integerArrayInput(input, "tenpaiPlayerIndices", 0, 3);
        session.recordDraw({ ...createRoundCommandMetadata(), tenpaiPlayerIndices });
        router.push("/session");
        return webMcpResult("Recorded the exhaustive draw.", { tenpaiPlayerIndices });
      },
      inputSchema: {
        additionalProperties: false,
        properties: {
          tenpaiPlayerIndices: {
            items: { maximum: 3, minimum: 0, type: "integer" },
            maxItems: 4,
            type: "array",
            uniqueItems: true,
          },
        },
        required: ["tenpaiPlayerIndices"],
        type: "object",
      },
      name: "richii.session.record_draw",
      title: "Record exhaustive draw",
    },
    {
      description: "Undo the most recent table change and update the visible session UI.",
      execute: () => {
        if (session.state === null || session.state.undoStack.length === 0) {
          throw new Error("There is no table change to undo.");
        }
        session.undo();
        return webMcpResult("Undid the most recent table change.");
      },
      inputSchema: { additionalProperties: false, properties: {}, type: "object" },
      name: "richii.session.undo",
      title: "Undo table change",
    },
  ]);

  return null;
}
