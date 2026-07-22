import { CalculatorLanding } from "@richii/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";

describe("CalculatorLanding", () => {
  it("makes scanning the primary user action", async () => {
    const onScan = jest.fn();

    await render(
      <CalculatorLanding
        hasActiveSession={false}
        historyCount={0}
        onHistory={jest.fn()}
        onManual={jest.fn()}
        onScan={onScan}
        onSession={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Scan a winning hand" }));

    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("keeps manual entry available without camera access", async () => {
    const onManual = jest.fn();

    await render(
      <CalculatorLanding
        hasActiveSession={false}
        historyCount={0}
        onHistory={jest.fn()}
        onManual={onManual}
        onScan={jest.fn()}
        onSession={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Enter tiles manually" }));

    expect(onManual).toHaveBeenCalledTimes(1);
  });

  it("opens the local score folio", async () => {
    const onHistory = jest.fn();

    await render(
      <CalculatorLanding
        hasActiveSession={false}
        historyCount={3}
        onHistory={onHistory}
        onManual={jest.fn()}
        onScan={jest.fn()}
        onSession={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Revisit recent answers" }));

    expect(onHistory).toHaveBeenCalledTimes(1);
  });
});
