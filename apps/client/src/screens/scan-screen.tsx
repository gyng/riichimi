import type { TileId } from "@riichimi/score-core";
import {
  ActionButton,
  ActivityIndicator,
  Image,
  ScrollView,
  SegmentedControl,
  Text,
  View,
  color,
  space,
} from "@riichimi/ui";
import type { Styles } from "@riichimi/ui";
import { reviewRecognition } from "@riichimi/vision";
import type { CaptureLayout, DetectedTile, RecognitionResult } from "@riichimi/vision";
import { CameraView, useCameraPermissions } from "../infrastructure/camera";
import type { CameraViewHandle } from "../infrastructure/camera";
import * as ImagePicker from "../infrastructure/photo-library";
import { router } from "../navigation/router";
import { useEffect, useRef, useState } from "react";

import sampleHandImage from "../../assets/samples/guided-sample-hand.png";
import { tileRecognition } from "../infrastructure/tile-recognition";
import { useLocale } from "../state/locale-context";
import {
  RecognitionReviewPanel,
  detectionLabel,
  orderedDetections,
  recognitionReviewThreshold,
} from "../features/recognition/recognition-review-panel";
import { TileBoundsOverlay } from "../features/recognition/tile-bounds-overlay";
import type { TileBoundsBox } from "../features/recognition/tile-bounds-overlay";
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

const layoutOptionsFor = (
  t: (source: string) => string,
): readonly { label: string; value: CaptureLayout }[] => [
  { label: t("Natural"), value: "natural" },
  { label: t("Guided"), value: "guided" },
];

// A bundled example hand so the whole scan → recognize → review flow can be
// exercised without a camera (desktop review, or a first look before capturing).
// It is staged as separate rows, so it pairs with the guided layout. The import
// is already the served URL: the bundler rewrote it at build time.
const sampleHand = {
  layout: "guided" as const,
  uri: sampleHandImage,
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
  const { t } = useLocale();
  const layoutOptions = layoutOptionsFor(t);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<"camera" | "library">("camera");
  const [importError, setImportError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<RecognitionState>({ kind: "idle" });
  // The photo overlay and the review list share one highlighted tile.
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  // The photo is drawn at its true aspect so the normalized boxes map by
  // percentage; until measured, the layout falls back to a neutral banner ratio.
  const [photoAspect, setPhotoAspect] = useState<number | null>(null);
  // Natural (single-row) is the default: it reads a hand the way it sits on the
  // table. Its concealed/called split is a guess, so it demands a structure
  // confirmation at review; guided keeps melds and dora on their own rows.
  const [captureLayout, setCaptureLayout] = useState<CaptureLayout>("natural");
  const camera = useRef<CameraViewHandle>(null);
  // Reading a photo was never a judgement call, so it starts on its own; the
  // review gate is where the user's judgement actually belongs.
  const readPhotoUri = useRef<string | null>(null);

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

  useEffect(() => {
    setPhotoAspect(null);
    setSelectedTileId(null);
    let active = true;
    if (photoUri !== null) {
      // Decoded off-screen purely to learn the photo's true shape, so the
      // detection boxes can be laid over it without a letterbox to offset.
      const probe = new window.Image();
      probe.addEventListener("load", () => {
        if (active && probe.naturalHeight > 0) {
          setPhotoAspect(probe.naturalWidth / probe.naturalHeight);
        }
      });
      // A photo whose size cannot be read still reviews fine; the boxes fall
      // back to the banner ratio rather than the photo's own.
      probe.src = photoUri;
    }
    return () => {
      active = false;
    };
  }, [photoUri]);

  // Web capture and library picks are object URLs; each retake or re-pick would
  // otherwise orphan the previous blob for the page's lifetime. Revoke the prior
  // one when it is replaced — but never on unmount, since a continued scan hands
  // its `photoUri` to the manual route as `referencePhoto` and it must survive.
  const previousObjectUrl = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousObjectUrl.current;
    if (previous !== null && previous !== photoUri && previous.startsWith("blob:")) {
      URL.revokeObjectURL(previous);
    }
    previousObjectUrl.current = photoUri;
  }, [photoUri]);

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
    readPhotoUri.current = photoUri;
    setRecognition({ kind: "running" });
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

  useEffect(() => {
    if (photoUri !== null && readPhotoUri.current !== photoUri) {
      void recognizePhoto();
    }
  });

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
  const outstandingReview = currentRecognitionReview?.reviewDetectionIds.length ?? 0;
  const continueLabel = !tilesReady
    ? `${t("Resolve")} ${outstandingReview} ${t(outstandingReview === 1 ? "tile to continue" : "tiles to continue")}`
    : requireStructureConfirmation
      ? t("Confirm split & continue")
      : t("Continue with reviewed tiles");
  const overlayBoxes: readonly TileBoundsBox[] =
    recognition.kind === "complete"
      ? orderedDetections(recognition.result).map((detection, index) => ({
          badge:
            detection.role === "dora" ? "D" : detection.role === "meld" ? "M" : String(index + 1),
          bounds: detection.bounds,
          id: detection.id,
          label: detectionLabel(detection, index, t),
          needsReview: (currentRecognitionReview?.reviewDetectionIds ?? []).includes(detection.id),
        }))
      : [];

  if (permission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={color.accent} />
        <Text style={styles.status}>{t("Checking camera availability…")}</Text>
      </View>
    );
  }

  if (!permission.granted && photoUri === null) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.kicker}>{t("CAMERA / PRIVATE BY DEFAULT")}</Text>
        <Text role="heading" style={styles.permissionTitle}>
          {t("Show us the tiles.")}
          {"\n"}
          {t("Keep the photo here.")}
        </Text>
        <Text style={styles.permissionBody}>
          {t(
            "Riichimi asks for camera access only when you choose to scan. Captures stay on this device unless you explicitly choose to contribute an example later.",
          )}
        </Text>
        <View style={styles.permissionActions}>
          <ActionButton
            label={
              permission.canAskAgain ? t("Allow camera access") : t("Camera access is blocked")
            }
            onPress={() => {
              void requestPermission();
            }}
            disabled={!permission.canAskAgain}
            variant="vermilion"
          />
          <ActionButton
            label={t("Enter tiles manually")}
            onPress={() => router.replace("/manual")}
            variant="paper"
          />
          <ActionButton
            label={t("Choose an existing photo")}
            onPress={() => {
              void choosePhoto();
            }}
            variant="paper"
          />
          <ActionButton label={t("Try a sample hand")} onPress={loadSampleHand} variant="paper" />
        </View>
        <Text style={styles.permissionSampleNote}>
          {t(
            "No camera on this device? “Try a sample hand” runs the offline recognizer on a bundled example.",
          )}
        </Text>
        {importError === null ? null : (
          <Text aria-live="polite" style={styles.error}>
            {importError}
          </Text>
        )}
      </View>
    );
  }

  if (photoUri !== null) {
    return (
      <View style={styles.captureScreen}>
        <ScrollView contentContainerStyle={styles.photoReviewContent}>
          <View style={styles.previewFrame}>
            <Image
              alt="Captured mahjong hand"
              src={photoUri}
              style={
                photoAspect === null
                  ? styles.preview
                  : [styles.previewMeasured, { aspectRatio: photoAspect }]
              }
            />
            {recognition.kind === "complete" ? (
              <TileBoundsOverlay
                boxes={overlayBoxes}
                onSelect={setSelectedTileId}
                selectedId={selectedTileId}
              />
            ) : null}
          </View>
          <View style={styles.reviewPanel}>
            <Text style={styles.reviewTitle}>
              {photoSource === "camera"
                ? t("Capture ready for review")
                : t("Photo ready for review")}
            </Text>
            <Text style={styles.reviewBody}>
              {t("Runs on this device. Dark plain surface, tiles upright.")}
            </Text>
            {recognition.kind === "complete" ? null : (
              <View style={styles.layoutChoice}>
                <Text style={styles.layoutLabel}>{t("CAPTURE LAYOUT")}</Text>
                <SegmentedControl
                  accessibilityLabel="Capture layout"
                  onChange={(value) => {
                    // A different layout is a different parse, so the photo is
                    // read again rather than leaving a stale result on screen.
                    setCaptureLayout(value);
                    readPhotoUri.current = null;
                    setRecognition({ kind: "idle" });
                  }}
                  options={layoutOptions}
                  value={captureLayout}
                />
                <Text style={styles.layoutHint}>
                  {captureLayout === "natural"
                    ? t(
                        "Natural — one row: the hand with the winning tile after a larger gap, any called melds or kans set apart to the right, then one dora indicator last. The concealed/called split is confirmed at review.",
                      )
                    : t(
                        "Guided — the concealed hand on top with the winning tile after a larger gap, any called melds or kans on a second row, and one dora indicator on the bottom row.",
                      )}
                </Text>
              </View>
            )}
            {recognition.kind === "running" ? (
              <View aria-live="polite" style={styles.recognitionStatus}>
                <ActivityIndicator color={color.accent} />
                <Text style={styles.status}>{t("Reading 15 tile faces offline…")}</Text>
              </View>
            ) : null}
            {recognition.kind === "failure" ? (
              <Text aria-live="polite" style={styles.recognitionError}>
                {recognition.message} {t("Retry with another photo, or use manual entry.")}
              </Text>
            ) : null}
            {recognition.kind === "complete" ? (
              <View aria-live="polite" style={styles.recognitionResult}>
                <Text style={styles.recognitionKicker}>{t("OFFLINE BETA \u00b7 DRAFT ONLY")}</Text>
                <Text style={styles.recognitionTitle}>
                  {`${recognition.result.detections.length} ${t("tiles read")} · ${outstandingReview} ${t("need review")}`}
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
                onSelectId={setSelectedTileId}
                requireStructureConfirmation={requireStructureConfirmation}
                result={recognition.result}
                selectedId={selectedTileId}
              />
            ) : null}
            <View style={styles.reviewActions}>
              <ActionButton
                label={photoSource === "camera" ? t("Retake") : t("Choose another photo")}
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
                  disabled={!tilesReady}
                  label={continueLabel}
                  onPress={() =>
                    reviewRecognizedTiles(recognition.result, recognition.initialReviewCount)
                  }
                  variant="vermilion"
                />
              ) : (
                <ActionButton
                  disabled={recognition.kind === "running"}
                  label={t("Read 14 tiles offline")}
                  onPress={() => {
                    void recognizePhoto();
                  }}
                  variant="vermilion"
                />
              )}
              <ActionButton
                label={t("Enter tiles from this photo")}
                onPress={() =>
                  router.push({ pathname: "/manual", params: { referencePhoto: photoUri } })
                }
                variant="vermilion"
              />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.captureScreen}>
      <CameraView ref={camera} facing="back" style={styles.camera}>
        <View style={styles.cameraChrome}>
          <View style={styles.cameraHeader}>
            <SegmentedControl
              accessibilityLabel="Capture layout"
              onChange={setCaptureLayout}
              options={layoutOptions}
              value={captureLayout}
            />
          </View>
          <View aria-label="Tile alignment guide" style={styles.guide}>
            {captureLayout === "natural" ? (
              <View style={[styles.guideBand, styles.guideBandWide]}>
                <Text style={styles.guideBandLabel}>{t("HAND \u00b7 MELDS \u00b7 DORA LAST")}</Text>
              </View>
            ) : (
              <>
                <View style={[styles.guideBand, styles.guideBandWide]}>
                  <Text style={styles.guideBandLabel}>{t("HAND")}</Text>
                </View>
                <View style={[styles.guideBand, styles.guideBandWide]}>
                  <Text style={styles.guideBandLabel}>{t("MELDS \u00b7 IF ANY")}</Text>
                </View>
                <View style={[styles.guideBand, styles.guideBandNarrow]}>
                  <Text style={styles.guideBandLabel}>{t("DORA")}</Text>
                </View>
              </>
            )}
          </View>
          <View style={styles.shutterArea}>
            <Text style={styles.cameraHint}>
              {captureLayout === "natural"
                ? t(
                    "One row: hand, a larger gap before the winner, then any called sets, then one dora.",
                  )
                : t(
                    "Hand on the top line, any called sets on the middle line, one dora on the bottom.",
                  )}
            </Text>
            <View style={styles.captureActions}>
              <ActionButton
                label={t("Capture hand")}
                onPress={() => {
                  void capturePhoto();
                }}
                variant="vermilion"
              />
              <ActionButton
                label={t("Choose photo")}
                onPress={() => {
                  void choosePhoto();
                }}
                variant="paper"
              />
              <ActionButton
                label={t("Try a sample hand")}
                onPress={loadSampleHand}
                variant="paper"
              />
            </View>
            {importError === null ? null : (
              <Text aria-live="polite" style={styles.cameraError}>
                {importError}
              </Text>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = {
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
    // Legible over a live preview of unknown brightness.
    textShadow: `0 1px 4px ${color.ink}`,
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
    gap: 10,
    justifyContent: "center",
    maxHeight: 330,
    width: "92%",
  },
  guideBand: {
    alignItems: "flex-start",
    borderColor: "rgba(255,253,247,0.85)",
    borderRadius: 6,
    borderStyle: "dashed",
    borderWidth: 2,
    justifyContent: "flex-end",
    paddingBottom: 3,
    paddingHorizontal: 6,
  },
  guideBandLabel: {
    color: "rgba(255,253,247,0.92)",
    fontFamily: "monospace",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  guideBandNarrow: { alignSelf: "flex-end", height: 58, width: "24%" },
  guideBandWide: { height: 74, width: "100%" },
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
  // Before the photo's true size is known it is shown in a fixed rectangle, so
  // it must be fitted whole rather than cropped to fill.
  preview: {
    aspectRatio: 2.1,
    maxHeight: 560,
    minHeight: 190,
    objectFit: "contain",
    width: "100%",
  },
  // Once the photo's true size is known it is drawn to its own rectangle so the
  // normalized detection boxes overlay exactly, with no letterbox to offset them.
  previewFrame: { position: "relative", width: "100%" },
  previewMeasured: { objectFit: "cover", width: "100%" },
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
} satisfies Styles;
