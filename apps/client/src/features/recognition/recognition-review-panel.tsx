import { canonicalTileIds, canonicalizeTile, redFiveIds } from "@riichimi/score-core";
import type { TileId } from "@riichimi/score-core";
import { ActionButton, MahjongTile, classNames, useTileDisplay } from "@riichimi/ui";
import { chooseWinningDetection, correctDetection, reviewRecognition } from "@riichimi/vision";
import type { DetectedTile, RecognitionResult } from "@riichimi/vision";
import { useEffect, useMemo, useState } from "react";

import styles from "./recognition-review-panel.module.css";
import { useLocale } from "../../state/locale-context";

export const recognitionReviewThreshold = 0.75;

const allTileChoices: readonly TileId[] = [...canonicalTileIds, ...redFiveIds];

function meldOrder(detection: DetectedTile): readonly [number, number] {
  const match = /^meld-(\d+)-(\d+)$/.exec(detection.id);
  return [Number(match?.[1] ?? 0), Number(match?.[2] ?? 0)];
}

interface MeldGroup {
  readonly index: number;
  readonly tiles: readonly DetectedTile[];
}

// Reassemble the meld-role detections into their called sets, in group order and
// left-to-right within a group. Used so the structure — not just each tile's
// identity — can be reviewed and corrected before scoring.
function meldGroupsOf(result: RecognitionResult): readonly MeldGroup[] {
  const groups = new Map<number, DetectedTile[]>();
  for (const detection of result.detections) {
    if (detection.role !== "meld") {
      continue;
    }
    const [group] = meldOrder(detection);
    const tiles = groups.get(group) ?? [];
    tiles.push(detection);
    groups.set(group, tiles);
  }
  return [...groups.entries()]
    .toSorted(([left], [right]) => left - right)
    .map(([index, tiles]) => ({
      index,
      tiles: tiles.toSorted((left, right) => meldOrder(left)[1] - meldOrder(right)[1]),
    }));
}

export function orderedDetections(result: RecognitionResult): readonly DetectedTile[] {
  const hand = result.detections
    .filter(({ role }) => role === "concealed" || role === "winning")
    .toSorted((left, right) => left.bounds.x - right.bounds.x);
  // Called melds are reviewed too, grouped in order, so the confirm gate covers
  // every recognized tile — not just the concealed hand.
  const melds = result.detections
    .filter(({ role }) => role === "meld")
    .toSorted((left, right) => {
      const [leftGroup, leftTile] = meldOrder(left);
      const [rightGroup, rightTile] = meldOrder(right);
      return leftGroup - rightGroup || leftTile - rightTile;
    });
  const dora = result.detections.filter(({ role }) => role === "dora");
  return [...hand, ...melds, ...dora];
}

type Translate = (source: string) => string;

export function detectionLabel(detection: DetectedTile, index: number, t: Translate): string {
  if (detection.role === "dora") {
    return t("Dora indicator");
  }
  if (detection.role === "meld") {
    const [group, tile] = meldOrder(detection);
    return `${t("Meld")} ${group + 1} ${t("tile")} ${tile + 1}`;
  }
  if (detection.role === "winning") {
    return `${t("Winning tile")} ${index + 1}`;
  }
  return `${t("Hand tile")} ${index + 1}`;
}

function proposedTile(detection: DetectedTile): TileId | null {
  return detection.tile ?? detection.alternatives[0]?.tile ?? null;
}

function uniqueChoices(detection: DetectedTile): readonly TileId[] {
  const choices = [proposedTile(detection), ...detection.alternatives.map(({ tile }) => tile)];
  return [...new Set(choices.filter((tile): tile is TileId => tile !== null))].slice(0, 3);
}

export interface RecognitionReviewPanelProps {
  readonly initialReviewCount: number;
  readonly onChange: (result: RecognitionResult) => void;
  /** When set, the concealed/called split is a parser guess (e.g. the natural
      single-row layout) and must be explicitly confirmed before scoring. */
  readonly requireStructureConfirmation?: boolean;
  readonly result: RecognitionResult;
  /** Selection can be lifted so the photo overlay and the list share one
      highlighted tile. Omit both for the panel to own selection itself. */
  readonly selectedId?: string | null;
  readonly onSelectId?: (id: string | null) => void;
}

export function RecognitionReviewPanel({
  initialReviewCount,
  onChange,
  requireStructureConfirmation = false,
  result,
  selectedId: controlledSelectedId,
  onSelectId,
}: RecognitionReviewPanelProps) {
  const { t } = useLocale();
  const { tileName } = useTileDisplay();
  const review = reviewRecognition(result, recognitionReviewThreshold);
  const detections = orderedDetections(result);
  const meldGroups = meldGroupsOf(result);
  const concealedCount = result.detections.filter(
    ({ role }) => role === "concealed" || role === "winning",
  ).length;
  // Surface the structure whenever the parser guessed one (a called set present)
  // or the capture mode makes the split ambiguous. A fully concealed guided hand
  // needs no structure step.
  const showStructure = meldGroups.length > 0 || requireStructureConfirmation;

  function foldMeldIntoHand(group: MeldGroup) {
    let corrected = result;
    for (const detection of group.tiles) {
      corrected = correctDetection(corrected, detection.id, {
        role: "concealed",
        tile: detection.tile ?? detection.alternatives[0]?.tile ?? null,
      });
    }
    onChange(corrected);
  }
  const controlled = onSelectId !== undefined;
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    review.reviewDetectionIds[0] ?? detections[0]?.id ?? null,
  );
  const selectedId = controlled ? (controlledSelectedId ?? null) : internalSelectedId;
  const setSelectedId = (id: string | null) => {
    if (onSelectId !== undefined) {
      onSelectId(id);
    } else {
      setInternalSelectedId(id);
    }
  };
  const [showAllTiles, setShowAllTiles] = useState(false);
  const selected = detections.find(({ id }) => id === selectedId) ?? null;
  const issueIds = new Set(review.reviewDetectionIds);
  const totalReviewCount = Math.max(initialReviewCount, review.reviewDetectionIds.length);

  // Only ever *seed* a selection (first flagged tile, else the first tile). Once
  // something is selected — by the effect, a list tap, or a box tap — it sticks,
  // so the reviewer can inspect any tile, not just the flagged ones. Advancing
  // to the next flag happens on resolve, in chooseTile.
  const firstReviewId = review.reviewDetectionIds[0];
  const firstDetectionId = detections[0]?.id;
  useEffect(() => {
    if (selectedId === null) {
      const seed = firstReviewId ?? firstDetectionId ?? null;
      if (seed !== null) {
        if (onSelectId !== undefined) {
          onSelectId(seed);
        } else {
          setInternalSelectedId(seed);
        }
      }
    }
  }, [selectedId, firstReviewId, firstDetectionId, onSelectId]);

  const countsWithoutSelected = useMemo(() => {
    const counts = new Map<string, number>();
    for (const detection of result.detections) {
      if (detection.id === selectedId || detection.tile === null) {
        continue;
      }
      const tile = canonicalizeTile(detection.tile);
      counts.set(tile, (counts.get(tile) ?? 0) + 1);
    }
    return counts;
  }, [result, selectedId]);

  function chooseTile(tile: TileId) {
    if (selected === null) {
      return;
    }
    const role = selected.role === "unknown" ? "concealed" : selected.role;
    setShowAllTiles(false);
    const corrected = correctDetection(result, selected.id, { role, tile });
    onChange(corrected);
    // Settling a flagged tile advances to the next one still needing a look, so
    // confirming a run of low-confidence reads stays a single stream of taps.
    const remaining = reviewRecognition(corrected, recognitionReviewThreshold).reviewDetectionIds;
    const next = remaining.find((id) => id !== selected.id);
    if (next !== undefined) {
      setSelectedId(next);
    }
  }

  return (
    <section className={styles["root"]}>
      <div className={styles["headingRow"]}>
        <div className={styles["headingCopy"]}>
          <p className={styles["kicker"]}>{t("TILE-BY-TILE REVIEW")}</p>
          <h2 className={styles["title"]}>
            {review.reviewDetectionIds.length === 0
              ? t("Recognition review complete")
              : `${review.reviewDetectionIds.length} ${t(review.reviewDetectionIds.length === 1 ? "tile needs confirmation" : "tiles need confirmation")}`}
          </h2>
        </div>
        <p aria-live="polite" className={styles["progress"]}>
          {totalReviewCount - review.reviewDetectionIds.length} / {totalReviewCount} {t("reviewed")}
        </p>
      </div>

      <p className={styles["instructions"]}>
        {review.readyToConfirm
          ? t("Check the row against the photo.")
          : t("Outlined tiles need a look.")}
      </p>

      {showStructure ? (
        <div aria-label={t("Hand structure")} className={styles["structure"]}>
          <p className={styles["structureKicker"]}>{t("HAND STRUCTURE")}</p>
          <h3 className={styles["structureTitle"]}>
            {`${concealedCount} ${t(concealedCount === 1 ? "concealed tile" : "concealed tiles")} · ${meldGroups.length} ${t(meldGroups.length === 1 ? "called set" : "called sets")}`}
          </h3>
          <p className={styles["structureCopy"]}>
            {t("Called sets are read as open. Adjust in the calculator.")}
          </p>
          {meldGroups.map((group) => (
            <div className={styles["structureGroup"]} key={group.index}>
              <div className={styles["structureGroupTiles"]}>
                {group.tiles.map((detection) => {
                  const tile = proposedTile(detection);
                  return tile === null ? null : <MahjongTile key={detection.id} tile={tile} />;
                })}
              </div>
              <ActionButton
                label={`${t("Called set")} ${group.index + 1} ${t("isn't a call — move to hand")}`}
                onPress={() => foldMeldIntoHand(group)}
                variant="paper"
              />
            </div>
          ))}
          {requireStructureConfirmation && meldGroups.length === 0 ? (
            <p className={styles["structureCopy"]}>
              {t("Add any missed called set in the calculator.")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div aria-label={t("Recognized tiles")} className={styles["detections"]}>
        {detections.map((detection, index) => {
          const tile = proposedTile(detection);
          const label = detectionLabel(detection, index, t);
          const needsReview = issueIds.has(detection.id);
          return (
            <button
              aria-label={
                needsReview
                  ? t("{position}, {tile}, {percent} percent confidence, needs review", {
                      percent: Math.round(detection.confidence * 100),
                      position: label,
                      tile: tile === null ? t("unreadable") : tileName(tile),
                    })
                  : t("{position}, {tile}, {percent} percent confidence", {
                      percent: Math.round(detection.confidence * 100),
                      position: label,
                      tile: tile === null ? t("unreadable") : tileName(tile),
                    })
              }
              aria-pressed={detection.id === selectedId}
              className={classNames(
                styles["detection"],
                needsReview && styles["detectionIssue"],
                detection.id === selectedId && styles["detectionSelected"],
              )}
              key={detection.id}
              onClick={() => {
                setSelectedId(detection.id);
                setShowAllTiles(false);
              }}
              type="button"
            >
              <span
                className={classNames(styles["position"], needsReview && styles["positionIssue"])}
              >
                {label}
              </span>
              {tile === null ? (
                <span className={styles["unknownTile"]}>?</span>
              ) : (
                <MahjongTile tile={tile} />
              )}
              {/* Confidence is shown only where it drives a decision — on the
                  flagged tiles — paired with a word so the flag never rests on
                  colour alone. Confident tiles stay uncluttered. */}
              {needsReview ? (
                <span className={styles["reviewFlag"]}>
                  {t("CHECK")} · {Math.round(detection.confidence * 100)}%
                </span>
              ) : (
                <span className={styles["confidenceOk"]}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {selected === null ? null : (
        <div className={styles["editor"]}>
          <p className={styles["editorKicker"]}>
            {t("SELECTED")} · {detectionLabel(selected, detections.indexOf(selected), t)}
          </p>
          <h3 className={styles["editorTitle"]}>{t("Confirm or replace this tile")}</h3>
          <div className={styles["suggestions"]}>
            {uniqueChoices(selected).map((tile) => (
              <button
                aria-label={t("Use {tile} for the selected tile", { tile: tileName(tile) })}
                className={styles["suggestion"]}
                key={tile}
                onClick={() => chooseTile(tile)}
                type="button"
              >
                <MahjongTile selected={selected.tile === tile} tile={tile} />
                <span className={styles["suggestionLabel"]}>
                  {selected.tile === tile ? t("CONFIRM") : t("USE")}
                </span>
              </button>
            ))}
          </div>
          <div className={styles["editorActions"]}>
            <ActionButton
              label={showAllTiles ? t("Hide complete tile picker") : t("Choose from all tiles")}
              onPress={() => setShowAllTiles((visible) => !visible)}
              variant="paper"
            />
            {selected.role === "dora" || selected.role === "meld" ? null : (
              <ActionButton
                disabled={selected.role === "winning"}
                label={
                  selected.role === "winning"
                    ? t("Marked as winning tile")
                    : t("Mark as winning tile")
                }
                onPress={() => onChange(chooseWinningDetection(result, selected.id))}
                variant="paper"
              />
            )}
          </div>
          {showAllTiles ? (
            <div aria-label={t("Complete tile picker")} className={styles["allTiles"]}>
              {allTileChoices.map((tile) => {
                const disabled = (countsWithoutSelected.get(canonicalizeTile(tile)) ?? 0) >= 4;
                return (
                  <MahjongTile
                    disabled={disabled}
                    key={tile}
                    onPress={() => chooseTile(tile)}
                    selected={selected.tile === tile}
                    tile={tile}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
