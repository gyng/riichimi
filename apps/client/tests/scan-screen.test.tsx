import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { ScanScreen } from "../src/screens/scan-screen";
import { tileRecognition } from "../src/infrastructure/tile-recognition";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: () => [{ canAskAgain: false, granted: false, status: "denied" }, jest.fn()],
}));

jest.mock("expo-image-picker", () => ({
  getPendingResultAsync: jest.fn().mockResolvedValue(null),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ assets: null, canceled: true }),
}));

jest.mock("../src/infrastructure/tile-recognition", () => ({
  tileRecognition: { recognize: jest.fn() },
}));

describe("ScanScreen", () => {
  it("keeps the calculator usable when camera access is unavailable", async () => {
    await render(<ScanScreen />);

    expect(screen.getByText("Camera access is blocked")).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Enter tiles manually" }));

    expect(router.replace).toHaveBeenCalledWith("/manual");
  });

  it("loads a bundled sample hand so the flow works without a camera", async () => {
    await render(<ScanScreen />);

    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Try a sample hand" }));
    });

    expect(await screen.findByText("Photo ready for review")).toBeOnTheScreen();
  });

  it("opens an existing photo and carries it into manual correction", async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      assets: [
        {
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          fileName: "hand.jpg",
          fileSize: 42,
          height: 600,
          mimeType: "image/jpeg",
          type: "image",
          uri: "file:///hand.jpg",
          width: 1200,
        },
      ],
      canceled: false,
    });
    await render(<ScanScreen />);

    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Choose an existing photo" }));
    });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Photo ready for review")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Enter tiles from this photo" }));

    expect(router.push).toHaveBeenCalledWith({
      params: { referencePhoto: "file:///hand.jpg" },
      pathname: "/manual",
    });
  });

  it("recognizes a guided photo and opens a reviewable calculator draft", async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      assets: [
        {
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          fileName: "guided-hand.jpg",
          fileSize: 42,
          height: 600,
          mimeType: "image/jpeg",
          type: "image",
          uri: "file:///guided-hand.jpg",
          width: 1200,
        },
      ],
      canceled: false,
    });
    const handTiles = [
      "1m",
      "1m",
      "1m",
      "2m",
      "2m",
      "2m",
      "3m",
      "3m",
      "3m",
      "4p",
      "4p",
      "4p",
      "east",
      "east",
    ] as const;
    jest.mocked(tileRecognition).recognize.mockResolvedValueOnce({
      detections: [
        ...handTiles.map((tile, index) => ({
          alternatives: [{ confidence: 0.8, tile }],
          bounds: { height: 0.3, width: 0.05, x: index / 20, y: 0.2 },
          confidence: index === 4 ? 0.6 : 0.9,
          id: `hand-${index}`,
          role: index === 13 ? ("winning" as const) : ("concealed" as const),
          tile,
        })),
        {
          alternatives: [{ confidence: 0.9, tile: "9s" as const }],
          bounds: { height: 0.3, width: 0.05, x: 0.8, y: 0.65 },
          confidence: 0.9,
          id: "dora-0",
          role: "dora" as const,
          tile: "9s" as const,
        },
      ],
      modelVersion: "guided-crop-v0-test",
    });
    await render(<ScanScreen />);

    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Choose an existing photo" }));
    });
    // Reading starts on its own once a photo exists; no extra tap to begin.
    expect(await screen.findByText("15 tiles read · 1 need review")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Resolve 1 tiles to continue" })).toBeDisabled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Use 2 characters for selected tile" }),
    );
    expect(await screen.findByText("Recognition review complete")).toBeOnTheScreen();
    // The natural (default) layout still confirms the concealed/called split, but
    // the confirmation is the continue action itself rather than an extra tap.
    await fireEvent.press(screen.getByRole("button", { name: "Confirm split & continue" }));

    expect(router.push).toHaveBeenCalledWith({
      params: {
        recognizedDora: "9s",
        recognizedMelds: "",
        recognizedModel: "guided-crop-v0-test",
        recognizedReviewedCount: "1",
        recognizedTiles: handTiles.join(","),
        recognizedWinningIndex: "13",
        referencePhoto: "file:///guided-hand.jpg",
      },
      pathname: "/manual",
    });
  });
});
