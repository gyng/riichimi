import { describe, expect, it, vi } from "vitest";
import {
  ActionButton,
  Checkbox,
  CounterControl,
  MahjongTile,
  MethodCard,
  SectionLabel,
  SegmentedControl,
  TileDisplayProvider,
} from "@riichimi/ui";
import { fireEvent, render, screen } from "@testing-library/react";

// These primitives are reused on every surface, so a regression here is felt
// everywhere at once. Each test drives the control the way a player does.
describe("ActionButton", () => {
  it("reports a press", async () => {
    const onPress = vi.fn<() => void>();
    render(<ActionButton label="Calculate" onPress={onPress} variant="vermilion" />);

    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("stays silent and reports itself disabled when it cannot be used", async () => {
    const onPress = vi.fn<() => void>();
    render(<ActionButton disabled label="Calculate" onPress={onPress} variant="paper" />);

    const button = screen.getByRole("button", { name: "Calculate" });
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("SegmentedControl", () => {
  const options = [
    { label: "Tsumo", value: "tsumo" },
    { label: "Ron", value: "ron" },
  ] as const;

  it("marks the selected option and reports a different choice", async () => {
    const onChange = vi.fn<(value: "tsumo" | "ron") => void>();
    render(
      <SegmentedControl
        accessibilityLabel="Win method"
        onChange={onChange}
        options={options}
        value="tsumo"
      />,
    );

    expect(screen.getByRole("radio", { name: "Tsumo", checked: true })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Ron", checked: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Ron" }));
    expect(onChange).toHaveBeenCalledWith("ron");
  });
});

describe("Checkbox", () => {
  it("reports the value it is moving to, both ways", () => {
    const onChange = vi.fn<(checked: boolean) => void>();
    const { rerender } = render(<Checkbox checked={false} label="Ura-dora" onChange={onChange} />);

    const box = screen.getByRole("checkbox", { name: "Ura-dora", checked: false });
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<Checkbox checked label="Ura-dora" onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Ura-dora", checked: true }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("stays silent and reports itself disabled when the rule is pinned", () => {
    const onChange = vi.fn<(checked: boolean) => void>();
    render(<Checkbox checked disabled label="Red fives count as dora" onChange={onChange} />);

    const box = screen.getByRole("checkbox", { name: "Red fives count as dora" });
    expect(box).toBeDisabled();
    fireEvent.click(box);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("CounterControl", () => {
  it("steps up and down", async () => {
    const onChange = vi.fn<(value: number) => void>();
    render(<CounterControl label="Honba" maximum={20} onChange={onChange} value={3} />);

    fireEvent.click(screen.getByLabelText("Increase Honba"));
    expect(onChange).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByLabelText("Decrease Honba"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("will not go below zero or past its maximum", async () => {
    const onChange = vi.fn<(value: number) => void>();
    const { rerender } = render(
      <CounterControl label="Honba" maximum={2} onChange={onChange} value={0} />,
    );

    fireEvent.click(screen.getByLabelText("Decrease Honba"));
    expect(onChange).not.toHaveBeenCalled();

    rerender(<CounterControl label="Honba" maximum={2} onChange={onChange} value={2} />);
    fireEvent.click(screen.getByLabelText("Increase Honba"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("MethodCard", () => {
  it("reports a press on its action", async () => {
    const onPress = vi.fn<() => void>();
    render(
      <MethodCard
        actionLabel="Scan a winning hand"
        body="Use a guided camera frame."
        index="01"
        onPress={onPress}
        title="Let the tiles speak"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Scan a winning hand" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("SectionLabel", () => {
  it("renders its text", async () => {
    render(<SectionLabel>Winning hand calculator</SectionLabel>);

    expect(screen.getByText("WINNING HAND CALCULATOR")).toBeInTheDocument();
  });
});

describe("MahjongTile", () => {
  it("names the tile for a screen reader rather than relying on the art", async () => {
    render(<MahjongTile tile="5p" />);

    expect(screen.getByLabelText("5 circles")).toBeInTheDocument();
  });

  it("names a red five and an honour by what they are", async () => {
    render(
      <>
        <MahjongTile tile="0m" />
        <MahjongTile tile="green" />
      </>,
    );

    expect(screen.getByLabelText("red five characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Green dragon")).toBeInTheDocument();
  });

  it("reports a press and stays silent when disabled", async () => {
    const onPress = vi.fn<() => void>();
    const { rerender } = render(<MahjongTile onPress={onPress} tile="1m" />);

    fireEvent.click(screen.getByRole("button", { name: "1 characters" }));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<MahjongTile disabled onPress={onPress} tile="1m" />);
    fireEvent.click(screen.getByRole("button", { name: "1 characters" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("adds a corner rank only when that display is switched on", async () => {
    const { rerender } = render(
      <TileDisplayProvider showRankLabels={false}>
        <MahjongTile tile="3s" />
      </TileDisplayProvider>,
    );
    expect(screen.queryByText("3s")).not.toBeInTheDocument();

    rerender(
      <TileDisplayProvider showRankLabels>
        <MahjongTile tile="3s" />
      </TileDisplayProvider>,
    );
    expect(screen.getByText("3s")).toBeInTheDocument();
  });

  it("gives an honour no rank label, having no rank", async () => {
    render(
      <TileDisplayProvider showRankLabels>
        <MahjongTile tile="east" />
      </TileDisplayProvider>,
    );

    expect(screen.getByLabelText("East wind")).toBeInTheDocument();
    expect(screen.queryByText(/^[0-9][mps]$/)).not.toBeInTheDocument();
  });
});
