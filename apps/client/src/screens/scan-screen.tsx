import type { TileId } from "@riichimi/score-core";
import { ActionButton, SegmentedControl, classNames } from "@riichimi/ui";
import { reviewRecognition } from "@riichimi/vision";
import type { CaptureLayout, DetectedTile, RecognitionResult } from "@riichimi/vision";
import { CameraView, useCameraPermissions } from "../infrastructure/camera";
import type { CameraViewHandle } from "../infrastructure/camera";
import * as ImagePicker from "../infrastructure/photo-library";
import { router } from "../navigation/router";
import { useEffect, useRef, useState } from "react";

import sampleHandImage from "../../assets/samples/guided-sample-hand.png";
import { tileRecognition } from "../infrastructure/tile-recognition";
import { LoadingIndicator } from "../components/loading-indicator";
import { useLocale } from "../state/locale-context";
import styles from "./scan-screen.module.css";
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
      <div className={styles["centered"]}>
        <LoadingIndicator />
        <p className={styles["status"]}>{t("Checking camera availability…")}</p>
      </div>
    );
  }

  if (!permission.granted && photoUri === null) {
    return (
      <div className={styles["permissionScreen"]}>
        <p className={styles["kicker"]}>{t("CAMERA / PRIVATE BY DEFAULT")}</p>
        <h1 className={styles["permissionTitle"]}>
          {t("Show us the tiles.")}
          {"\n"}
          {t("Keep the photo here.")}
        </h1>
        <p className={styles["permissionBody"]}>
          {t(
            "Riichimi asks for camera access only when you choose to scan. Captures stay on this device unless you explicitly choose to contribute an example later.",
          )}
        </p>
        <div className={styles["permissionActions"]}>
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
        </div>
        <p className={styles["permissionSampleNote"]}>
          {t(
            "No camera on this device? “Try a sample hand” runs the offline recognizer on a bundled example.",
          )}
        </p>
        {importError === null ? null : (
          <p aria-live="polite" className={styles["error"]}>
            {importError}
          </p>
        )}
      </div>
    );
  }

  if (photoUri !== null) {
    return (
      <div className={styles["captureScreen"]}>
        <div className={styles["scroll"]}>
          <div className={styles["photoReviewContent"]}>
            <div className={styles["previewFrame"]}>
              <img
                alt="Captured mahjong hand"
                className={photoAspect === null ? styles["preview"] : styles["previewMeasured"]}
                src={photoUri}
                // Drawn at the photo's own shape once it is known, so the detection
                // boxes overlay it with no letterbox to offset them.
                style={photoAspect === null ? undefined : { aspectRatio: photoAspect }}
              />
              {recognition.kind === "complete" ? (
                <TileBoundsOverlay
                  boxes={overlayBoxes}
                  onSelect={setSelectedTileId}
                  selectedId={selectedTileId}
                />
              ) : null}
            </div>
            <div className={styles["reviewPanel"]}>
              <p className={styles["reviewTitle"]}>
                {photoSource === "camera"
                  ? t("Capture ready for review")
                  : t("Photo ready for review")}
              </p>
              <p className={styles["reviewBody"]}>
                {t("Runs on this device. Dark plain surface, tiles upright.")}
              </p>
              {recognition.kind === "complete" ? null : (
                <div className={styles["layoutChoice"]}>
                  <p className={styles["layoutLabel"]}>{t("CAPTURE LAYOUT")}</p>
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
                  <p className={styles["layoutHint"]}>
                    {captureLayout === "natural"
                      ? t(
                          "Natural — one row: the hand with the winning tile after a larger gap, any called melds or kans set apart to the right, then one dora indicator last. The concealed/called split is confirmed at review.",
                        )
                      : t(
                          "Guided — the concealed hand on top with the winning tile after a larger gap, any called melds or kans on a second row, and one dora indicator on the bottom row.",
                        )}
                  </p>
                </div>
              )}
              {recognition.kind === "running" ? (
                <div aria-live="polite" className={styles["recognitionStatus"]}>
                  <LoadingIndicator />
                  <p className={styles["status"]}>{t("Reading 15 tile faces offline…")}</p>
                </div>
              ) : null}
              {recognition.kind === "failure" ? (
                <p aria-live="polite" className={styles["recognitionError"]}>
                  {recognition.message} {t("Retry with another photo, or use manual entry.")}
                </p>
              ) : null}
              {recognition.kind === "complete" ? (
                <div aria-live="polite" className={styles["recognitionResult"]}>
                  <p className={styles["recognitionKicker"]}>
                    {t("OFFLINE BETA \u00b7 DRAFT ONLY")}
                  </p>
                  <p className={styles["recognitionTitle"]}>
                    {`${recognition.result.detections.length} ${t("tiles read")} · ${outstandingReview} ${t("need review")}`}
                  </p>
                </div>
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
              <div className={styles["reviewActions"]}>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["captureScreen"]}>
      <CameraView ref={camera} facing="back" className={styles["camera"]}>
        <div className={styles["cameraChrome"]}>
          <div className={styles["cameraHeader"]}>
            <SegmentedControl
              accessibilityLabel="Capture layout"
              onChange={setCaptureLayout}
              options={layoutOptions}
              value={captureLayout}
            />
          </div>
          <div aria-label="Tile alignment guide" className={styles["guide"]}>
            {captureLayout === "natural" ? (
              <div className={classNames(styles["guideBand"], styles["guideBandWide"])}>
                <p className={styles["guideBandLabel"]}>
                  {t("HAND \u00b7 MELDS \u00b7 DORA LAST")}
                </p>
              </div>
            ) : (
              <>
                <div className={classNames(styles["guideBand"], styles["guideBandWide"])}>
                  <p className={styles["guideBandLabel"]}>{t("HAND")}</p>
                </div>
                <div className={classNames(styles["guideBand"], styles["guideBandWide"])}>
                  <p className={styles["guideBandLabel"]}>{t("MELDS \u00b7 IF ANY")}</p>
                </div>
                <div className={classNames(styles["guideBand"], styles["guideBandNarrow"])}>
                  <p className={styles["guideBandLabel"]}>{t("DORA")}</p>
                </div>
              </>
            )}
          </div>
          <div className={styles["shutterArea"]}>
            <p className={styles["cameraHint"]}>
              {captureLayout === "natural"
                ? t(
                    "One row: hand, a larger gap before the winner, then any called sets, then one dora.",
                  )
                : t(
                    "Hand on the top line, any called sets on the middle line, one dora on the bottom.",
                  )}
            </p>
            <div className={styles["captureActions"]}>
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
            </div>
            {importError === null ? null : (
              <p aria-live="polite" className={styles["cameraError"]}>
                {importError}
              </p>
            )}
          </div>
        </div>
      </CameraView>
    </div>
  );
}
