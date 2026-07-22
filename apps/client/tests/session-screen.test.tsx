import { fireEvent, render, screen } from "@testing-library/react-native";

import { SessionScreen } from "../src/screens/session-screen";
import { SessionProvider } from "../src/state/session-context";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

jest.mock("../src/infrastructure/session-storage", () => ({
  loadStoredSession: jest.fn().mockResolvedValue(null),
  saveStoredSession: jest.fn().mockResolvedValue(undefined),
}));

describe("SessionScreen", () => {
  it("starts and updates a locally managed table", async () => {
    await render(
      <SessionProvider>
        <SessionScreen />
      </SessionProvider>,
    );

    await fireEvent.press(await screen.findByRole("button", { name: "Start East 1" }));

    expect(screen.getByRole("header", { name: "East 1" })).toBeOnTheScreen();
    expect(screen.getAllByText("25,000")).toHaveLength(4);

    const firstRiichiButton = screen.getAllByRole("button", { name: "Declare riichi" }).at(0);
    if (firstRiichiButton === undefined) {
      throw new Error("Expected a riichi control for the first player.");
    }
    await fireEvent.press(firstRiichiButton);

    expect(screen.getByText("24,000")).toBeOnTheScreen();
    expect(screen.getByLabelText("0 honba, 1 riichi stick")).toBeOnTheScreen();
  });

  it("settles noten payments and exposes undo", async () => {
    await render(
      <SessionProvider>
        <SessionScreen />
      </SessionProvider>,
    );
    await fireEvent.press(await screen.findByRole("button", { name: "Start East 1" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Player 1" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Player 3" }));
    await fireEvent.press(screen.getByRole("button", { name: "Record draw & advance" }));

    expect(screen.getAllByText("26,500")).toHaveLength(2);
    expect(screen.getAllByText("23,500")).toHaveLength(2);

    await fireEvent.press(screen.getByRole("button", { name: "Undo last change" }));
    expect(screen.getAllByText("25,000")).toHaveLength(4);
  });
});
