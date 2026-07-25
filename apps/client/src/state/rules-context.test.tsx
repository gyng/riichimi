import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Pressable, Text } from "@riichimi/ui";

import * as rulesPreferenceStorage from "../infrastructure/rules-preference-storage";
import { RulesProvider, useRules } from "./rules-context";

vi.mock("../infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: vi.fn<typeof rulesPreferenceStorage.loadRulesPreference>(),
  saveRulesPreference: vi
    .fn<typeof rulesPreferenceStorage.saveRulesPreference>()
    .mockResolvedValue(undefined),
}));

function Probe() {
  const rules = useRules();
  return (
    <>
      <Text>{rules.activeRules.id}</Text>
      <Pressable onPress={() => rules.selectProfile("wrc-2025-red-five-table")}>
        <Text>Choose red fives</Text>
      </Pressable>
    </>
  );
}

describe("RulesProvider", () => {
  it("does not overwrite a choice made while stored preferences are loading", async () => {
    let finishLoad: ((profileId: "wrc-2025") => void) | undefined;
    vi.mocked(rulesPreferenceStorage.loadRulesPreference).mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoad = resolve;
      }),
    );
    render(
      <RulesProvider>
        <Probe />
      </RulesProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose red fives" }));
    finishLoad?.("wrc-2025");

    expect(await screen.findByText("wrc-2025-red-five-table")).toBeInTheDocument();
    expect(rulesPreferenceStorage.saveRulesPreference).toHaveBeenCalledWith(
      "wrc-2025-red-five-table",
    );
  });
});
