import { fireEvent, render, screen } from "@testing-library/react-native";
import { router, usePathname } from "expo-router";

import { AppNavigationBar } from "../src/components/app-navigation-bar";
import { LocaleProvider } from "../src/state/locale-context";

jest.mock("expo-router", () => ({
  router: { navigate: jest.fn() },
  usePathname: jest.fn().mockReturnValue("/"),
}));

jest.mock("../src/infrastructure/locale-preference-storage", () => ({
  loadLocalePreference: jest.fn().mockResolvedValue("en"),
  saveLocalePreference: jest.fn().mockResolvedValue(undefined),
}));

function bar() {
  return render(
    <LocaleProvider>
      <AppNavigationBar />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  jest.mocked(usePathname).mockReturnValue("/");
});

describe("AppNavigationBar", () => {
  it("offers every primary destination plus setup", async () => {
    await bar();

    for (const destination of ["Scan", "Manual", "Table", "History", "Setup"]) {
      expect(screen.getByRole("link", { name: destination })).toBeOnTheScreen();
    }
  });

  it("marks the destination matching the current route", async () => {
    jest.mocked(usePathname).mockReturnValue("/session");
    await bar();

    expect(screen.getByRole("link", { name: "Table", selected: true })).toBeOnTheScreen();
    expect(screen.getByRole("link", { name: "Scan", selected: false })).toBeOnTheScreen();
  });

  it("marks setup as active on its own route without claiming a play destination", async () => {
    jest.mocked(usePathname).mockReturnValue("/settings");
    await bar();

    expect(screen.getByRole("link", { name: "Setup", selected: true })).toBeOnTheScreen();
    expect(screen.getByRole("link", { name: "Manual", selected: false })).toBeOnTheScreen();
  });

  it("navigates to the destination that was pressed", async () => {
    await bar();

    await fireEvent.press(screen.getByRole("link", { name: "Scan" }));
    expect(router.navigate).toHaveBeenCalledWith("/scan");

    await fireEvent.press(screen.getByRole("link", { name: "Setup" }));
    expect(router.navigate).toHaveBeenCalledWith("/settings");
  });

  it("returns home from the brand mark", async () => {
    await bar();

    await fireEvent.press(screen.getByRole("link", { name: "RIICHIMI home" }));
    expect(router.navigate).toHaveBeenCalledWith("/");
  });
});
