import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text, Pressable } from "react-native";

import * as rulesPreferenceStorage from "../infrastructure/rules-preference-storage";
import { RulesProvider, useRules } from "./rules-context";

jest.mock("../infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: jest.fn(),
  saveRulesPreference: jest.fn().mockResolvedValue(undefined),
}));

function Probe() {
  const rules = useRules();
  return (
    <>
      <Text>{rules.activeRules.id}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => rules.selectProfile("wrc-2025-red-five-table")}
      >
        <Text>Choose red fives</Text>
      </Pressable>
    </>
  );
}

describe("RulesProvider", () => {
  it("does not overwrite a choice made while stored preferences are loading", async () => {
    let finishLoad: ((profileId: "wrc-2025") => void) | undefined;
    jest.mocked(rulesPreferenceStorage.loadRulesPreference).mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoad = resolve;
      }),
    );
    await render(
      <RulesProvider>
        <Probe />
      </RulesProvider>,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Choose red fives" }));
    finishLoad?.("wrc-2025");

    expect(await screen.findByText("wrc-2025-red-five-table")).toBeOnTheScreen();
    expect(rulesPreferenceStorage.saveRulesPreference).toHaveBeenCalledWith(
      "wrc-2025-red-five-table",
    );
  });
});
