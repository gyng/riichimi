import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router, usePathname } from "../src/navigation/router";

import type * as LocaleStorage from "../src/infrastructure/locale-preference-storage";

import { AppNavigationBar } from "../src/components/app-navigation-bar";
import { LocaleProvider } from "../src/state/locale-context";

vi.mock("../src/navigation/router", () => ({
  router: { navigate: vi.fn<typeof router.navigate>() },
  usePathname: vi.fn<typeof usePathname>().mockReturnValue("/"),
}));

vi.mock("../src/infrastructure/locale-preference-storage", () => ({
  loadLocalePreference: vi.fn<typeof LocaleStorage.loadLocalePreference>().mockResolvedValue("en"),
  saveLocalePreference: vi
    .fn<typeof LocaleStorage.saveLocalePreference>()
    .mockResolvedValue(undefined),
}));

function bar() {
  return render(
    <LocaleProvider>
      <AppNavigationBar />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/");
});

describe("AppNavigationBar", () => {
  it("offers every primary destination plus setup", async () => {
    bar();

    for (const destination of ["Scan", "Manual", "Table", "History", "Setup"]) {
      expect(screen.getByRole("link", { name: destination })).toBeInTheDocument();
    }
  });

  it("marks the destination matching the current route", async () => {
    vi.mocked(usePathname).mockReturnValue("/session");
    bar();

    expect(screen.getByRole("link", { name: "Table", current: "page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scan", current: false })).toBeInTheDocument();
  });

  it("marks setup as active on its own route without claiming a play destination", async () => {
    vi.mocked(usePathname).mockReturnValue("/settings");
    bar();

    expect(screen.getByRole("link", { name: "Setup", current: "page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manual", current: false })).toBeInTheDocument();
  });

  it("navigates to the destination that was pressed", async () => {
    bar();

    fireEvent.click(screen.getByRole("link", { name: "Scan" }));
    expect(router.navigate).toHaveBeenCalledWith("/scan");

    fireEvent.click(screen.getByRole("link", { name: "Setup" }));
    expect(router.navigate).toHaveBeenCalledWith("/settings");
  });

  it("switches the interface language from the bar, without a trip to setup", async () => {
    bar();
    const languages = screen.getByRole("combobox", { name: "Interface language" });
    expect(languages).toHaveValue("en");

    fireEvent.change(languages, { target: { value: "ja" } });

    // The destinations are the proof: the whole interface followed the choice.
    expect(screen.getByRole("link", { name: "手入力" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "表示言語" })).toHaveValue("ja");
  });

  it("ignores a language it does not have", async () => {
    bar();
    const languages = screen.getByRole("combobox", { name: "Interface language" });
    // A select's value is a DOM string, and the DOM is not ours to trust — an
    // extension, a translation tool, or a stale restore could offer anything.
    const rogue = document.createElement("option");
    rogue.value = "tlh";
    languages.append(rogue);

    fireEvent.change(languages, { target: { value: "tlh" } });

    expect(screen.getByRole("link", { name: "Scan" })).toBeInTheDocument();
    expect(languages).toHaveValue("en");
  });

  it("wears the app's name in the language being read", async () => {
    bar();
    expect(screen.getByRole("link", { name: "RIICHIMI home" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Interface language" }), {
      target: { value: "ja" },
    });

    expect(screen.getByText("立直み")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "立直みホーム" })).toBeInTheDocument();
  });

  it("names each language in that language, so it is recognized rather than recalled", async () => {
    bar();

    for (const name of ["English", "日本語", "繁體中文", "简体中文"]) {
      expect(screen.getByRole("option", { name })).toBeInTheDocument();
    }
  });

  it("returns home from the brand mark", async () => {
    bar();

    fireEvent.click(screen.getByRole("link", { name: "RIICHIMI home" }));
    expect(router.navigate).toHaveBeenCalledWith("/");
  });
});
