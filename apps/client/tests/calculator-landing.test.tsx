import { describe, expect, it, vi } from "vitest";
import { CalculatorLanding } from "@riichimi/ui";

import { messages } from "../src/i18n/messages";
import { fireEvent, render, screen } from "@testing-library/react";

describe("CalculatorLanding", () => {
  it("makes scanning the primary user action", async () => {
    const onScan = vi.fn<() => void>();

    render(
      <CalculatorLanding
        copy={messages.en.home}
        hasActiveSession={false}
        historyCount={0}
        onHistory={vi.fn<() => void>()}
        onManual={vi.fn<() => void>()}
        onScan={onScan}
        onSession={vi.fn<() => void>()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scan a hand" }));

    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("keeps manual entry available without camera access", async () => {
    const onManual = vi.fn<() => void>();

    render(
      <CalculatorLanding
        copy={messages.en.home}
        hasActiveSession={false}
        historyCount={0}
        onHistory={vi.fn<() => void>()}
        onManual={onManual}
        onScan={vi.fn<() => void>()}
        onSession={vi.fn<() => void>()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Enter by hand" }));

    expect(onManual).toHaveBeenCalledTimes(1);
  });

  it("opens the local score folio", async () => {
    const onHistory = vi.fn<() => void>();

    render(
      <CalculatorLanding
        copy={messages.en.home}
        hasActiveSession={false}
        historyCount={3}
        onHistory={onHistory}
        onManual={vi.fn<() => void>()}
        onScan={vi.fn<() => void>()}
        onSession={vi.fn<() => void>()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Saved scores" }));

    expect(onHistory).toHaveBeenCalledTimes(1);
  });
});
