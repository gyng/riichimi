import type { TileId } from "@riichimi/score-core";
import { ActionButton, SegmentedControl, color, space } from "@riichimi/ui";
import { reviewRecognition } from "@riichimi/vision";
import type { CaptureLayout, DetectedTile, RecognitionResult } from "@riichimi/vision";
import { Asset } from "expo-asset";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { bodyEdges } from "../components/screen-insets";

import sampleHandImage from "../../assets/samples/guided-sample-hand.png";
import { tileRecognition } from "../infrastructure/tile-recognition";
import {
  RecognitionReviewPanel,
  recognitionReviewThreshold,
} from "../features/recognition/recognition-review-panel";
import { inferMeld, serializeRecognizedMelds } from "../features/recognition/recognition-draft";

// Group meld-role detections back into their called sets, left-to-right within a
// group and by group order, using the `meld-<group>-<tile>` ids the recognizer
// assigns. Returns the proposed tile id for each tile (undefined if unreadable).
function orderedMeldGroups(detections: readonly DetectedTile[]): (TileId | undefined)[][] {
  const groups = new Map<number, DetectedTile[]>();
  for (const detection of detections) {
    if (detection.role !== "meld") {
      continue;
    }
    const match = /^meld-(\d+)-/.exec(detection.id);
    if (match?.[1] === undefined) {
      continue;
    }
    const groupIndex = Number(match[1]);
    const group = groups.get(groupIndex) ?? [];
    group.push(detection);
    groups.set(groupIndex, group);
  }
  return [...groups.entries()]
    .toSorted(([left], [right]) => left - right)
    .map(([, tiles]) =>
      tiles
        .toSorted((left, right) => left.bounds.x - right.bounds.x)
        .map(({ alternatives, tile }) => tile ?? alternatives[0]?.tile),
    );
}

const layoutOptions: readonly { label: string; value: CaptureLayout }[] = [
  { label: "Natural", value: "natural" },
  { label: "Guided", value: "guided" },
];

// A bundled example hand so the whole scan → recognize → review flow can be
// exercised without a camera (desktop review, or a first look before capturing).
// It is staged as separate rows, so it pairs with the guided layout.
// `Asset.fromModule` is the universal way to get a loadable URL for a bundled
// asset; `Image.resolveAssetSource` does not exist on react-native-web.
const sampleHand = {
  layout: "guided" as const,
  uri: Asset.fromModule(sampleHandImage).uri,
};

type RecognitionState =
  | { readonly kind: "idle" }
  | { readonly kind: "running" }
  | { readonly kind: "failure"; readonly message: string }
  | {
      readonly kind: "complete";
      readonly initialReviewCount: number;
      readonly result: RecognitionResult;
    };

export function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<"camera" | "library">("camera");
  const [importError, setImportError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<RecognitionState>({ kind: "idle" });
  // Natural (single-row) is the default: it reads a hand the way it sits on the
  // table. Its concealed/called split is a guess, so it demands a structure
  // confirmation at review; guided keeps melds and dora on their own rows.
  const [captureLayout, setCaptureLayout] = useState<CaptureLayout>("natural");
  const [structureConfirmed, setStructureConfirmed] = useState(false);
  const camera = useRef<CameraView>(null);

  useEffect(() => {
    let active = true;
    void ImagePicker.getPendingResultAsync().then((pending) => {
      if (
        active &&
        pending !== null &&
        "canceled" in pending &&
        !pending.canceled &&
        pending.assets[0] !== undefined
      ) {
        setPhotoSource("library");
        setPhotoUri(pending.assets[0].uri);
        setRecognition({ kind: "idle" });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function capturePhoto() {
    const photo = await camera.current?.takePictureAsync({ quality: 0.75 });

    if (photo !== undefined) {
      setPhotoSource("camera");
      setPhotoUri(photo.uri);
      setRecognition({ kind: "idle" });
    }
  }

  async function choosePhoto() {
    setImportError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ["images"],
        quality: 0.9,
        selectionLimit: 1,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset !== undefined) {
        setPhotoSource("library");
        setPhotoUri(asset.uri);
        setRecognition({ kind: "idle" });
      }
    } catch {
      setImportError(
        "That photo could not be opened. Try another image or enter the tiles manually.",
      );
    }
  }

  function loadSampleHand() {
    setImportError(null);
    setPhotoSource("library");
    setCaptureLayout(sampleHand.layout);
    setPhotoUri(sampleHand.uri);
    setRecognition({ kind: "idle" });
  }

  async function recognizePhoto() {
    if (photoUri === null) {
      return;
    }
    setRecognition({ kind: "running" });
    setStructureConfirmed(false);
    try {
      const result = await tileRecognition.recognize({
        height: 1,
        layout: captureLayout,
        uri: photoUri,
        width: 1,
      });
      const review = reviewRecognition(result, recognitionReviewThreshold);
      setRecognition({
        initialReviewCount: review.reviewDetectionIds.length,
        kind: "complete",
        result,
      });
    } catch (error) {
      setRecognition({
        kind: "failure",
        message:
          error instanceof Error ? error.message : "The tiles could not be read from this photo.",
      });
    }
  }

  function reviewRecognizedTiles(result: RecognitionResult, reviewedCount: number) {
    if (photoUri === null) {
      return;
    }
    const hand = result.detections
      .filter(({ role }) => role === "concealed" || role === "winning")
      .toSorted((left, right) => left.bounds.x - right.bounds.x);
    const dora = result.detections.find(({ role }) => role === "dora");
    const tiles = hand.map(({ alternatives, tile }) => tile ?? alternatives[0]?.tile);
    const winningIndex = hand.findIndex(({ role }) => role === "winning");
    const doraTile = dora?.tile ?? dora?.alternatives[0]?.tile;
    const meldGroups = orderedMeldGroups(result.detections);
    // A called meld occupies one set slot, so a valid hand has 14 - 3 per meld
    // concealed tiles. Each group must classify into a legal meld.
    const expectedConcealed = 14 - meldGroups.length * 3;
    const meldTileGroups = meldGroups.map((group) =>
      group.filter((tile): tile is TileId => tile !== undefined),
    );
    const meldsInferable = meldTileGroups.every(
      (group, index) => group.length === meldGroups[index]?.length && inferMeld(group) !== null,
    );
    if (
      hand.length !== expectedConcealed ||
      tiles.some((tile) => tile === undefined) ||
      winningIndex < 0 ||
      doraTile === undefined ||
      !meldsInferable
    ) {
      setRecognition({
        kind: "failure",
        message:
          "One or more tiles or called melds could not be proposed. Retake the photo or enter them manually.",
      });
      return;
    }
    router.push({
      pathname: "/manual",
      params: {
        recognizedDora: doraTile,
        recognizedMelds: serializeRecognizedMelds(meldTileGroups),
        recognizedModel: result.modelVersion,
        recognizedReviewedCount: String(reviewedCount),
        recognizedTiles: tiles.join(","),
        recognizedWinningIndex: String(winningIndex),
        referencePhoto: photoUri,
      },
    });
  }

  const currentRecognitionReview =
    recognition.kind === "complete"
      ? reviewRecognition(recognition.result, recognitionReviewThreshold)
      : null;
  const requireStructureConfirmation = captureLayout === "natural";
  const tilesReady = currentRecognitionReview?.readyToConfirm === true;
  const structureReady = !requireStructureConfirmation || structureConfirmed;
  const continueLabel = !tilesReady
    ? `Resolve ${currentRecognitionReview?.reviewDetectionIds.length ?? 0} tiles to continue`
    : structureReady
      ? "Continue with reviewed tiles"
      : "Confirm the hand structure to continue";

  if (permission === null) {
    return (
      <SafeAreaView edges={bodyEdges} style={styles.centered}>
        <ActivityIndicator color={color.accent} />
        <Text style={styles.status}>Checking camera availability…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted && photoUri === null) {
    return (
      <SafeAreaView edges={bodyEdges} style={styles.permissionScreen}>
        <Text style={styles.kicker}>CAMERA / PRIVATE BY DEFAULT</Text>
        <Text accessibilityRole="header" style={styles.permissionTitle}>
          Show us the tiles.{"\n"}Keep the photo here.
        </Text>
        <Text style={styles.permissionBody}>
          Riichimi asks for camera access only when you choose to scan. Captures stay on this device
          unless you explicitly choose to contribute an example later.
        </Text>
        <View style={styles.permissionActions}>
          <ActionButton
            label={permission.canAskAgain ? "Allow camera access" : "Camera access is blocked"}
            onPress={() => {
              void requestPermission();
            }}
            disabled={!permission.canAskAgain}
            variant="vermilion"
          />
          <ActionButton
            label="Enter tiles manually"
            onPress={() => router.replace("/manual")}
            variant="paper"
          />
          <ActionButton
            label="Choose an existing photo"
            onPress={() => {
              void choosePhoto();
            }}
            variant="paper"
          />
          <ActionButton label="Try a sample hand" onPress={loadSampleHand} variant="paper" />
        </View>
        <Text style={styles.permissionSampleNote}>
          No camera on this device? “Try a sample hand” runs the offline recognizer on a bundled
          example.
        </Text>
        {importError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {importError}
          </Text>
        )}
      </SafeAreaView>
    );
  }

  if (photoUri !== null) {
    return (
      <SafeAreaView edges={bodyEdges} style={styles.captureScreen}>
        <ScrollView contentContainerStyle={styles.photoReviewContent}>
          <Image
            accessibilityLabel="Captured mahjong hand"
            source={{ uri: photoUri }}
            style={styles.preview}
          />
          <View style={styles.reviewPanel}>
            <Text style={styles.reviewTitle}>
              {photoSource === "camera" ? "Capture ready for review" : "Photo ready for review"}
            </Text>
            <Text style={styles.reviewBody}>
              Beta recognition runs entirely on this device. Use a dark, plain surface and keep
              tiles upright; every result still needs your confirmation.
            </Text>
            {recognition.kind === "complete" ? null : (
              <View style={styles.layoutChoice}>
                <Text style={styles.layoutLabel}>CAPTURE LAYOUT</Text>
                <SegmentedControl
                  accessibilityLabel="Capture layout"
                  onChange={(value) => {
                    setCaptureLayout(value);
                    setRecognition((current) =>
                      current.kind === "failure" ? { kind: "idle" } : current,
                    );
                  }}
                  options={layoutOptions}
                  value={captureLayout}
                />
                <Text style={styles.layoutHint}>
                  {captureLayout === "natural"
                    ? "Natural — one row: the hand with the winning tile after a larger gap, any called melds or kans set apart to the right, then one dora indicator last. The concealed/called split is confirmed at review."
                    : "Guided — the concealed hand on top with the winning tile after a larger gap, any called melds or kans on a second row, and one dora indicator on the bottom row."}
                </Text>
              </View>
            )}
            {recognition.kind === "running" ? (
              <View accessibilityLiveRegion="polite" style={styles.recognitionStatus}>
                <ActivityIndicator color={color.accent} />
                <Text style={styles.status}>Reading 15 tile faces offline…</Text>
              </View>
            ) : null}
            {recognition.kind === "failure" ? (
              <Text accessibilityLiveRegion="polite" style={styles.recognitionError}>
                {recognition.message} Retry with another photo, or use manual entry.
              </Text>
            ) : null}
            {recognition.kind === "complete" ? (
              <View accessibilityLiveRegion="polite" style={styles.recognitionResult}>
                <Text style={styles.recognitionKicker}>OFFLINE BETA · DRAFT ONLY</Text>
                <Text style={styles.recognitionTitle}>
                  {`15 tiles read · ${currentRecognitionReview?.reviewDetectionIds.length ?? 0} need review`}
                </Text>
                <Text style={styles.recognitionCopy}>
                  Compare every proposed tile with the reference before calculating the score.
                </Text>
              </View>
            ) : null}
            {recognition.kind === "complete" ? (
              <RecognitionReviewPanel
                initialReviewCount={recognition.initialReviewCount}
                onChange={(result) =>
                  setRecognition({
                    initialReviewCount: recognition.initialReviewCount,
                    kind: "complete",
                    result,
                  })
                }
                onConfirmStructureChange={setStructureConfirmed}
                requireStructureConfirmation={requireStructureConfirmation}
                result={recognition.result}
                structureConfirmed={structureConfirmed}
              />
            ) : null}
            <View style={styles.reviewActions}>
              <ActionButton
                label={photoSource === "camera" ? "Retake" : "Choose another photo"}
                onPress={() => {
                  if (photoSource === "camera") {
                    setPhotoUri(null);
                    setRecognition({ kind: "idle" });
                  } else {
                    void choosePhoto();
                  }
                }}
                variant="paper"
              />
              {recognition.kind === "complete" ? (
                <ActionButton
                  disabled={!tilesReady || !structureReady}
                  label={continueLabel}
                  onPress={() =>
                    reviewRecognizedTiles(recognition.result, recognition.initialReviewCount)
                  }
                  variant="vermilion"
                />
              ) : (
                <ActionButton
                  disabled={recognition.kind === "running"}
                  label="Read 14 tiles offline"
                  onPress={() => {
                    void recognizePhoto();
                  }}
                  variant="vermilion"
                />
              )}
              <ActionButton
                label="Enter tiles from this photo"
                onPress={() =>
                  router.push({ pathname: "/manual", params: { referencePhoto: photoUri } })
                }
                variant="vermilion"
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.captureScreen}>
      <CameraView ref={camera} facing="back" style={styles.camera}>
        <SafeAreaView edges={bodyEdges} style={styles.cameraChrome}>
          <View style={styles.cameraHeader}>
            <Text style={styles.guideLabel}>ALIGN HAND · MELDS · DORA</Text>
          </View>
          <View accessibilityLabel="Tile alignment guide" style={styles.guide}>
            <View style={styles.guideCornerTopLeft} />
            <View style={styles.guideCornerTopRight} />
            <View style={styles.guideCornerBottomLeft} />
            <View style={styles.guideCornerBottomRight} />
          </View>
          <View style={styles.shutterArea}>
            <Text style={styles.cameraHint}>
              Separate 14 upright tiles; leave a larger gap before the winner. Put one dora below.
            </Text>
            <View style={styles.captureActions}>
              <ActionButton
                label="Capture hand"
                onPress={() => {
                  void capturePhoto();
                }}
                variant="vermilion"
              />
              <ActionButton
                label="Choose photo"
                onPress={() => {
                  void choosePhoto();
                }}
                variant="paper"
              />
              <ActionButton label="Try a sample hand" onPress={loadSampleHand} variant="paper" />
            </View>
            {importError === null ? null : (
              <Text accessibilityLiveRegion="polite" style={styles.cameraError}>
                {importError}
              </Text>
            )}
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  cameraError: { color: color.white, fontFamily: "serif", fontSize: 14 },
  cameraChrome: {
    flex: 1,
    justifyContent: "space-between",
    padding: space.x4,
  },
  cameraHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cameraHint: {
    color: color.white,
    fontFamily: "serif",
    fontSize: 16,
    textShadowColor: color.ink,
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  captureScreen: {
    backgroundColor: color.ink,
    flex: 1,
  },
  captureActions: { flexDirection: "row", flexWrap: "wrap", gap: space.x3 },
  centered: {
    alignItems: "center",
    backgroundColor: color.canvas,
    flex: 1,
    gap: space.x3,
    justifyContent: "center",
  },
  error: { color: color.accent, fontFamily: "serif", fontSize: 14, marginTop: space.x4 },
  guide: {
    alignSelf: "center",
    aspectRatio: 2.8,
    maxHeight: 300,
    position: "relative",
    width: "92%",
  },
  guideCornerBottomLeft: {
    borderBottomColor: color.white,
    borderBottomWidth: 3,
    borderLeftColor: color.white,
    borderLeftWidth: 3,
    bottom: 0,
    height: 28,
    left: 0,
    position: "absolute",
    width: 28,
  },
  guideCornerBottomRight: {
    borderBottomColor: color.white,
    borderBottomWidth: 3,
    borderRightColor: color.white,
    borderRightWidth: 3,
    bottom: 0,
    height: 28,
    position: "absolute",
    right: 0,
    width: 28,
  },
  guideCornerTopLeft: {
    borderLeftColor: color.white,
    borderLeftWidth: 3,
    borderTopColor: color.white,
    borderTopWidth: 3,
    height: 28,
    left: 0,
    position: "absolute",
    top: 0,
    width: 28,
  },
  guideCornerTopRight: {
    borderRightColor: color.white,
    borderRightWidth: 3,
    borderTopColor: color.white,
    borderTopWidth: 3,
    height: 28,
    position: "absolute",
    right: 0,
    top: 0,
    width: 28,
  },
  guideLabel: {
    color: color.white,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  kicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  layoutChoice: { gap: space.x2, marginBottom: space.x4 },
  layoutHint: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 13,
    lineHeight: 19,
    marginTop: space.x2,
  },
  layoutLabel: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  permissionActions: {
    alignItems: "flex-start",
    gap: space.x3,
  },
  permissionBody: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 28,
    marginBottom: space.x6,
    maxWidth: 660,
  },
  permissionSampleNote: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 13,
    lineHeight: 19,
    marginTop: space.x4,
    maxWidth: 520,
  },
  permissionScreen: {
    backgroundColor: color.canvas,
    flex: 1,
    justifyContent: "center",
    padding: space.x5,
  },
  permissionTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: -1.7,
    lineHeight: 50,
    marginBottom: space.x4,
    marginTop: space.x3,
  },
  photoReviewContent: { backgroundColor: color.ink, flexGrow: 1 },
  preview: {
    aspectRatio: 2.1,
    maxHeight: 560,
    minHeight: 190,
    resizeMode: "contain",
    width: "100%",
  },
  reviewActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x3,
  },
  reviewBody: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: space.x4,
  },
  reviewPanel: {
    backgroundColor: color.canvas,
    padding: space.x5,
  },
  recognitionCopy: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 13,
    lineHeight: 19,
    marginTop: space.x1,
  },
  recognitionError: {
    color: color.accent,
    fontFamily: "serif",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: space.x4,
  },
  recognitionKicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  recognitionResult: {
    backgroundColor: "#F2E7D3",
    borderColor: color.line,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: space.x4,
    padding: space.x3,
  },
  recognitionStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.x2,
    marginBottom: space.x4,
  },
  recognitionTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "700",
    marginTop: space.x1,
  },
  reviewTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 23,
    fontWeight: "700",
    marginBottom: space.x2,
  },
  shutterArea: {
    alignItems: "center",
    gap: space.x3,
  },
  status: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 15,
  },
});
