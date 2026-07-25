import { router, usePathname } from "../../navigation/router";
import { isScoringRulesProfileId, scoringRulesProfile } from "@riichimi/rules";

import {
  integerArrayInput,
  integerInput,
  stringArrayInput,
  useWebMcpTools,
  webMcpResult,
} from "../../infrastructure/webmcp";
import { createRoundCommandMetadata, useSession } from "../../state/session-context";
import { useScoreHistory } from "../../state/score-history-context";
import { useRules } from "../../state/rules-context";

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
  const rules = useRules();
  const table = session.state?.table ?? null;
  const activeRules = scoringRulesProfile(table?.rulesProfileId ?? rules.activeRules.id);

  useWebMcpTools([
    {
      annotations: { readOnlyHint: true },
      description:
        "Inspect the active Riichimi route, supported scoring rules, and current local table summary without changing app state.",
      execute: () =>
        webMcpResult("Riichimi app state read successfully.", {
          activeRoute: pathname,
          rules: {
            id: activeRules.id,
            kiriageMangan: activeRules.kiriageMangan,
            label: activeRules.label,
            redFives: activeRules.redFives,
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
                  rulesProfileId: table.rulesProfileId,
                },
        }),
      inputSchema: { additionalProperties: false, properties: {}, type: "object" },
      name: "riichimi.app.get_state",
      title: "Inspect Riichimi state",
    },
    {
      description:
        "Navigate the visible Riichimi interface to the home, score history, manual calculator, camera scan, or table session screen.",
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
      name: "riichimi.app.navigate",
      title: "Navigate Riichimi",
    },
    {
      description:
        "Select the visible scoring profile and save it on this device. A running table keeps its pinned profile and must be ended before this setting can change.",
      execute: (input: Record<string, unknown>) => {
        if (table !== null) {
          throw new Error(
            "The active table has pinned rules. End it before choosing another profile.",
          );
        }
        const profileId = input["profileId"];
        if (typeof profileId !== "string" || !isScoringRulesProfileId(profileId)) {
          throw new Error("profileId must name a supported scoring rules profile.");
        }
        rules.selectProfile(profileId);
        return webMcpResult("Selected the scoring rules profile.", {
          rules: scoringRulesProfile(profileId),
        });
      },
      inputSchema: {
        additionalProperties: false,
        properties: {
          profileId: {
            enum: ["wrc-2025", "wrc-2025-red-five-table"],
            type: "string",
          },
        },
        required: ["profileId"],
        type: "object",
      },
      name: "riichimi.rules.select",
      title: "Select scoring rules",
    },
    {
      annotations: { readOnlyHint: true },
      description:
        "List recent standalone scores saved locally by Riichimi, including hand context, score, payment, and yaku summaries.",
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
      name: "riichimi.history.list",
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
        return webMcpResult("Started a local East 1 table.", {
          playerNames,
          rulesProfileId: rules.activeRules.id,
        });
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
      name: "riichimi.session.start",
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
      name: "riichimi.session.declare_riichi",
      title: "Declare player riichi",
    },
    {
      description:
        "Record an exhaustive draw for the active table using zero to four tenpai player indexes. Riichimi settles noten payments and advances or repeats the dealer; the visible UI can undo it.",
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
      name: "riichimi.session.record_draw",
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
      name: "riichimi.session.undo",
      title: "Undo table change",
    },
  ]);

  return null;
}
