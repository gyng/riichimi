import {
  ActionButton,
  CounterControl,
  MahjongTile,
  MethodCard,
  SectionLabel,
  SegmentedControl,
  TileDisplayProvider,
} from "@riichimi/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";

// These primitives are reused on every surface, so a regression here is felt
// everywhere at once. Each test drives the control the way a player does.
describe("ActionButton", () => {
  it("reports a press", async () => {
    const onPress = jest.fn();
    await render(<ActionButton label="Calculate" onPress={onPress} variant="vermilion" />);

    await fireEvent.press(screen.getByRole("button", { name: "Calculate" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("stays silent and reports itself disabled when it cannot be used", async () => {
    const onPress = jest.fn();
    await render(<ActionButton disabled label="Calculate" onPress={onPress} variant="paper" />);

    const button = screen.getByRole("button", { name: "Calculate" });
    expect(button).toBeDisabled();
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("SegmentedControl", () => {
  const options = [
    { label: "Tsumo", value: "tsumo" },
    { label: "Ron", value: "ron" },
  ] as const;

  it("marks the selected option and reports a different choice", async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        accessibilityLabel="Win method"
        onChange={onChange}
        options={options}
        value="tsumo"
      />,
    );

    expect(screen.getByRole("radio", { name: "Tsumo", checked: true })).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Ron", checked: false })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("radio", { name: "Ron" }));
    expect(onChange).toHaveBeenCalledWith("ron");
  });
});

describe("CounterControl", () => {
  it("steps up and down", async () => {
    const onChange = jest.fn();
    await render(<CounterControl label="Honba" maximum={20} onChange={onChange} value={3} />);

    await fireEvent.press(screen.getByLabelText("Increase Honba"));
    expect(onChange).toHaveBeenCalledWith(4);

    await fireEvent.press(screen.getByLabelText("Decrease Honba"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("will not go below zero or past its maximum", async () => {
    const onChange = jest.fn();
    const { rerender } = await render(
      <CounterControl label="Honba" maximum={2} onChange={onChange} value={0} />,
    );

    await fireEvent.press(screen.getByLabelText("Decrease Honba"));
    expect(onChange).not.toHaveBeenCalled();

    await rerender(<CounterControl label="Honba" maximum={2} onChange={onChange} value={2} />);
    await fireEvent.press(screen.getByLabelText("Increase Honba"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("MethodCard", () => {
  it("reports a press on its action", async () => {
    const onPress = jest.fn();
    await render(
      <MethodCard
        actionLabel="Scan a winning hand"
        body="Use a guided camera frame."
        index="01"
        onPress={onPress}
        title="Let the tiles speak"
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Scan a winning hand" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("SectionLabel", () => {
  it("renders its text", async () => {
    await render(<SectionLabel>Winning hand calculator</SectionLabel>);

    expect(screen.getByText("WINNING HAND CALCULATOR")).toBeOnTheScreen();
  });
});

describe("MahjongTile", () => {
  it("names the tile for a screen reader rather than relying on the art", async () => {
    await render(<MahjongTile tile="5p" />);

    expect(screen.getByLabelText("5 circles")).toBeOnTheScreen();
  });

  it("names a red five and an honour by what they are", async () => {
    await render(
      <>
        <MahjongTile tile="0m" />
        <MahjongTile tile="green" />
      </>,
    );

    expect(screen.getByLabelText("red five characters")).toBeOnTheScreen();
    expect(screen.getByLabelText("Green dragon")).toBeOnTheScreen();
  });

  it("reports a press and stays silent when disabled", async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<MahjongTile onPress={onPress} tile="1m" />);

    await fireEvent.press(screen.getByRole("button", { name: "1 characters" }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<MahjongTile disabled onPress={onPress} tile="1m" />);
    await fireEvent.press(screen.getByRole("button", { name: "1 characters" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("adds a corner rank only when that display is switched on", async () => {
    const { rerender } = await render(
      <TileDisplayProvider showRankLabels={false}>
        <MahjongTile tile="3s" />
      </TileDisplayProvider>,
    );
    expect(screen.queryByText("3s", { includeHiddenElements: true })).not.toBeOnTheScreen();

    await rerender(
      <TileDisplayProvider showRankLabels>
        <MahjongTile tile="3s" />
      </TileDisplayProvider>,
    );
    expect(screen.getByText("3s", { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("gives an honour no rank label, having no rank", async () => {
    await render(
      <TileDisplayProvider showRankLabels>
        <MahjongTile tile="east" />
      </TileDisplayProvider>,
    );

    expect(screen.getByLabelText("East wind")).toBeOnTheScreen();
    expect(
      screen.queryByText(/^[0-9][mps]$/, { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
  });
});
