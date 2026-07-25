import { describe, expect, it, vi } from "vitest";
import { TopAppBar } from "@riichimi/ui";
import { fireEvent, render, screen } from "@testing-library/react";

function renderBar(overrides?: { onScan?: () => void; onBrand?: () => void }) {
  return render(
    <TopAppBar
      brandGlyph="立"
      brandLabel="RIICHIMI"
      homeLabel="RIICHIMI home"
      items={[
        {
          active: true,
          key: "/scan",
          label: "Scan",
          onPress: overrides?.onScan ?? vi.fn<() => void>(),
        },
        { active: false, key: "/manual", label: "Manual", onPress: vi.fn<() => void>() },
      ]}
      navLabel="Primary"
      onBrandPress={overrides?.onBrand ?? vi.fn<() => void>()}
    />,
  );
}

describe("TopAppBar", () => {
  it("marks the active destination and navigates on press", async () => {
    const onScan = vi.fn<() => void>();
    renderBar({ onScan });

    expect(screen.getByRole("link", { name: "Scan", current: "page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manual", current: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Scan" }));
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("returns home from the brand mark", async () => {
    const onBrand = vi.fn<() => void>();
    renderBar({ onBrand });

    fireEvent.click(screen.getByRole("link", { name: "RIICHIMI home" }));
    expect(onBrand).toHaveBeenCalledTimes(1);
  });
});
