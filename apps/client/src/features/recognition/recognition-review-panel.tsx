import { canonicalTileIds, canonicalizeTile, redFiveIds } from "@riichimi/score-core";
import type { TileId } from "@riichimi/score-core";
import { ActionButton, MahjongTile, color, space, tileAccessibleName } from "@riichimi/ui";
import { chooseWinningDetection, correctDetection, reviewRecognition } from "@riichimi/vision";
import type { DetectedTile, RecognitionResult } from "@riichimi/vision";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

function orderedDetections(result: RecognitionResult): readonly DetectedTile[] {
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

function detectionLabel(detection: DetectedTile, index: number): string {
  if (detection.role === "dora") {
    return "Dora indicator";
  }
  if (detection.role === "meld") {
    const [group, tile] = meldOrder(detection);
    return `Meld ${group + 1} tile ${tile + 1}`;
  }
  if (detection.role === "winning") {
    return `Winning tile ${index + 1}`;
  }
  return `Hand tile ${index + 1}`;
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
}

export function RecognitionReviewPanel({
  initialReviewCount,
  onChange,
  requireStructureConfirmation = false,
  result,
}: RecognitionReviewPanelProps) {
  const { t } = useLocale();
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
  const [selectedId, setSelectedId] = useState<string | null>(
    review.reviewDetectionIds[0] ?? detections[0]?.id ?? null,
  );
  const [showAllTiles, setShowAllTiles] = useState(false);
  const selected = detections.find(({ id }) => id === selectedId) ?? null;
  const issueIds = new Set(review.reviewDetectionIds);
  const nextIssueId = review.reviewDetectionIds[0];
  const selectedNeedsReview = selectedId !== null && issueIds.has(selectedId);
  const totalReviewCount = Math.max(initialReviewCount, review.reviewDetectionIds.length);

  useEffect(() => {
    if (nextIssueId !== undefined && !selectedNeedsReview) {
      setSelectedId(nextIssueId);
      setShowAllTiles(false);
    }
  }, [nextIssueId, selectedNeedsReview]);

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
    onChange(correctDetection(result, selected.id, { role, tile }));
  }

  return (
    <View style={styles.root}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.kicker}>{t("TILE-BY-TILE REVIEW")}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {review.reviewDetectionIds.length === 0
              ? "Recognition review complete"
              : `${review.reviewDetectionIds.length} ${review.reviewDetectionIds.length === 1 ? "tile needs" : "tiles need"} confirmation`}
          </Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.progress}>
          {totalReviewCount - review.reviewDetectionIds.length} / {totalReviewCount} reviewed
        </Text>
      </View>

      <Text style={styles.instructions}>
        {review.readyToConfirm ? t("Check the row against the photo.") : t("Red needs a look.")}
      </Text>

      {showStructure ? (
        <View accessibilityLabel="Hand structure" style={styles.structure}>
          <Text style={styles.structureKicker}>{t("HAND STRUCTURE")}</Text>
          <Text accessibilityRole="header" style={styles.structureTitle}>
            {`${concealedCount} concealed ${concealedCount === 1 ? "tile" : "tiles"} · ${meldGroups.length} called ${meldGroups.length === 1 ? "set" : "sets"}`}
          </Text>
          <Text style={styles.structureCopy}>
            {t("Called sets are read as open. Adjust in the calculator.")}
          </Text>
          {meldGroups.map((group) => (
            <View key={group.index} style={styles.structureGroup}>
              <View style={styles.structureGroupTiles}>
                {group.tiles.map((detection) => {
                  const tile = proposedTile(detection);
                  return tile === null ? null : <MahjongTile key={detection.id} tile={tile} />;
                })}
              </View>
              <ActionButton
                label={`Called set ${group.index + 1} isn't a call — move to hand`}
                onPress={() => foldMeldIntoHand(group)}
                variant="paper"
              />
            </View>
          ))}
          {requireStructureConfirmation && meldGroups.length === 0 ? (
            <Text style={styles.structureCopy}>
              {t("Add any missed called set in the calculator.")}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View accessibilityLabel="Recognized tiles" style={styles.detections}>
        {detections.map((detection, index) => {
          const tile = proposedTile(detection);
          const label = detectionLabel(detection, index);
          const needsReview = issueIds.has(detection.id);
          return (
            <Pressable
              accessibilityLabel={`${label}, ${tile === null ? "unknown" : tileAccessibleName(tile)}, ${Math.round(detection.confidence * 100)} percent confidence${needsReview ? ", needs review" : ""}`}
              accessibilityRole="button"
              accessibilityState={{ selected: detection.id === selectedId }}
              key={detection.id}
              onPress={() => {
                setSelectedId(detection.id);
                setShowAllTiles(false);
              }}
              style={[
                styles.detection,
                needsReview && styles.detectionIssue,
                detection.id === selectedId && styles.detectionSelected,
              ]}
            >
              <Text style={[styles.position, needsReview && styles.positionIssue]}>{label}</Text>
              {tile === null ? (
                <View style={styles.unknownTile}>
                  <Text style={styles.unknownMark}>?</Text>
                </View>
              ) : (
                <MahjongTile tile={tile} />
              )}
              <Text style={styles.confidence}>{Math.round(detection.confidence * 100)}%</Text>
            </Pressable>
          );
        })}
      </View>

      {selected === null ? null : (
        <View style={styles.editor}>
          <Text style={styles.editorKicker}>
            SELECTED · {detectionLabel(selected, detections.indexOf(selected))}
          </Text>
          <Text style={styles.editorTitle}>{t("Confirm or replace this tile")}</Text>
          <View style={styles.suggestions}>
            {uniqueChoices(selected).map((tile) => (
              <Pressable
                accessibilityLabel={`Use ${tileAccessibleName(tile)} for selected tile`}
                accessibilityRole="button"
                key={tile}
                onPress={() => chooseTile(tile)}
                style={styles.suggestion}
              >
                <MahjongTile selected={selected.tile === tile} tile={tile} />
                <Text style={styles.suggestionLabel}>
                  {selected.tile === tile ? "CONFIRM" : "USE"}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.editorActions}>
            <ActionButton
              label={showAllTiles ? "Hide complete tile picker" : "Choose from all tiles"}
              onPress={() => setShowAllTiles((visible) => !visible)}
              variant="paper"
            />
            {selected.role === "dora" || selected.role === "meld" ? null : (
              <ActionButton
                disabled={selected.role === "winning"}
                label={
                  selected.role === "winning" ? "Marked as winning tile" : "Mark as winning tile"
                }
                onPress={() => onChange(chooseWinningDetection(result, selected.id))}
                variant="paper"
              />
            )}
          </View>
          {showAllTiles ? (
            <View accessibilityLabel="Complete tile picker" style={styles.allTiles}>
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
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  allTiles: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.x4 },
  checkbox: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.ink,
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkboxChecked: { backgroundColor: color.ink },
  checkmark: { color: color.white, fontSize: 13, fontWeight: "800" },
  confidence: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
  },
  detection: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 6,
  },
  detectionIssue: { backgroundColor: "#FFF4E8", borderColor: color.accent, borderWidth: 2 },
  detectionSelected: { borderColor: color.ink, borderWidth: 3 },
  detections: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.x4 },
  editor: {
    backgroundColor: color.canvasDeep,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: space.x4,
    padding: space.x4,
  },
  editorActions: { flexDirection: "row", flexWrap: "wrap", gap: space.x3, marginTop: space.x4 },
  editorKicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  editorTitle: { color: color.ink, fontFamily: "serif", fontSize: 19, fontWeight: "700" },
  headingCopy: { flex: 1, minWidth: 230 },
  headingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x3,
    justifyContent: "space-between",
  },
  instructions: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.x2,
  },
  kicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  position: { color: color.inkMuted, fontFamily: "monospace", fontSize: 8, fontWeight: "700" },
  positionIssue: { color: color.accent },
  progress: { color: color.jade, fontFamily: "monospace", fontSize: 11, fontWeight: "800" },
  root: {
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: space.x4,
    padding: space.x4,
  },
  structure: {
    backgroundColor: color.canvasDeep,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    gap: space.x2,
    marginTop: space.x4,
    padding: space.x4,
  },
  structureConfirm: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.x2,
    marginTop: space.x3,
  },
  structureConfirmLabel: {
    color: color.ink,
    flex: 1,
    fontFamily: "serif",
    fontSize: 14,
    fontWeight: "700",
  },
  structureCopy: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 13,
    lineHeight: 19,
  },
  structureGroup: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x3,
    marginTop: space.x2,
  },
  structureGroupTiles: { flexDirection: "row", gap: 4 },
  structureKicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  structureTitle: { color: color.ink, fontFamily: "serif", fontSize: 17, fontWeight: "700" },
  suggestion: { alignItems: "center", gap: 3 },
  suggestionLabel: {
    color: color.jade,
    fontFamily: "monospace",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: space.x3, marginTop: space.x3 },
  title: { color: color.ink, fontFamily: "serif", fontSize: 21, fontWeight: "700" },
  unknownMark: { color: color.accent, fontFamily: "serif", fontSize: 28, fontWeight: "800" },
  unknownTile: {
    alignItems: "center",
    aspectRatio: 0.72,
    backgroundColor: color.white,
    borderColor: color.accent,
    borderRadius: 5,
    borderStyle: "dashed",
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 38,
  },
});
