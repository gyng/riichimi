import { TopAppBar } from "@riichimi/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";

function renderBar(overrides?: { onScan?: () => void; onBrand?: () => void }) {
  return render(
    <TopAppBar
      brandGlyph="立"
      brandLabel="RIICHIMI"
      items={[
        { active: true, key: "/scan", label: "Scan", onPress: overrides?.onScan ?? jest.fn() },
        { active: false, key: "/manual", label: "Manual", onPress: jest.fn() },
      ]}
      onBrandPress={overrides?.onBrand ?? jest.fn()}
    />,
  );
}

describe("TopAppBar", () => {
  it("marks the active destination and navigates on press", async () => {
    const onScan = jest.fn();
    await renderBar({ onScan });

    expect(screen.getByRole("link", { name: "Scan", selected: true })).toBeOnTheScreen();
    expect(screen.getByRole("link", { name: "Manual", selected: false })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("link", { name: "Scan" }));
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("returns home from the brand mark", async () => {
    const onBrand = jest.fn();
    await renderBar({ onBrand });

    await fireEvent.press(screen.getByRole("link", { name: "RIICHIMI home" }));
    expect(onBrand).toHaveBeenCalledTimes(1);
  });
});
