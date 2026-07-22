import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { ScanScreen } from "../src/screens/scan-screen";

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

describe("ScanScreen", () => {
  it("keeps the calculator usable when camera access is unavailable", async () => {
    await render(<ScanScreen />);

    expect(screen.getByText("Camera access is blocked")).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Enter tiles manually" }));

    expect(router.replace).toHaveBeenCalledWith("/manual");
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
});
