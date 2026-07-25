import { ActionButton, MahjongTile } from "@riichimi/ui";

import { LoadingIndicator } from "../components/loading-indicator";
import { router } from "../navigation/router";
import { useState } from "react";

import type { ScoreHistoryEntry } from "../features/score-history/score-history";
import { useScoreHistory } from "../state/score-history-context";
import { useLocale } from "../state/locale-context";
import styles from "./score-history-screen.module.css";

function points(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function scoreLabel(entry: ScoreHistoryEntry): string {
  return entry.result.limit === null
    ? `${entry.result.han ?? 0} han · ${entry.result.fu ?? 0} fu`
    : entry.result.limit.toUpperCase();
}

function paymentLabel(entry: ScoreHistoryEntry): string {
  const { payments } = entry.result;
  if (payments.kind === "ron") {
    return `${points(payments.fromDiscarder)} from discarder`;
  }
  return payments.fromDealer === null
    ? `${points(payments.fromEachNonDealer)} all`
    : `${points(payments.fromDealer)} / ${points(payments.fromEachNonDealer)}`;
}

function calculatedTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

export function ScoreHistoryScreen() {
  const { t } = useLocale();
  const history = useScoreHistory();
  const [confirmClear, setConfirmClear] = useState(false);

  if (history.loading) {
    return (
      <div className={styles["centered"]}>
        <LoadingIndicator />
        <p className={styles["muted"]}>{t("Opening the score folio…")}</p>
      </div>
    );
  }

  return (
    <div className={styles["screen"]}>
      <div className={styles["scroll"]}>
        <div className={styles["content"]}>
          <div className={styles["topBar"]}>
            <p className={styles["rules"]}>{t("SAVED LOCALLY \u00b7 LAST 20")}</p>
          </div>

          <div className={styles["header"]}>
            <p className={styles["kicker"]}>{t("SCORE FOLIO")}</p>
            <h1 className={styles["title"]}>{t("History")}</h1>
            <p className={styles["intro"]}>
              {t("Hand, context, yaku, and transfer for each.")}{" "}
              {t("Recalculating the same hand refreshes one entry instead of making duplicates.")}
            </p>
          </div>

          {history.entries.length === 0 ? (
            <div className={styles["emptyPanel"]}>
              <p className={styles["emptyNumber"]}>零</p>
              <div className={styles["emptyCopy"]}>
                <h2 className={styles["emptyTitle"]}>{t("No saved scores yet")}</h2>
                <p className={styles["muted"]}>{t("Scores you calculate appear here.")}</p>
                <div className={styles["emptyAction"]}>
                  <ActionButton
                    label={t("Score a hand")}
                    onPress={() => router.push("/manual")}
                    variant="vermilion"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className={styles["ledger"]}>
              {history.entries.map((entry, index) => (
                <div className={styles["entry"]} key={entry.id}>
                  <div className={styles["entryRail"]}>
                    <p className={styles["entryIndex"]}>{String(index + 1).padStart(2, "0")}</p>
                    <div className={styles["railLine"]} />
                  </div>
                  <div className={styles["entryBody"]}>
                    <div className={styles["entryHeader"]}>
                      <div>
                        <p className={styles["entryMeta"]}>{calculatedTime(entry.calculatedAt)}</p>
                        <h3 className={styles["score"]}>{scoreLabel(entry)}</h3>
                      </div>
                      <span className={styles["methodStamp"]}>
                        {entry.context.method.toUpperCase()}
                      </span>
                    </div>

                    <div aria-label={t("Saved concealed hand")} className={styles["tiles"]}>
                      {entry.hand.concealedTiles.map((tile, tileIndex) => (
                        <MahjongTile
                          key={`${entry.id}-${tile}-${tileIndex}`}
                          selected={
                            tile === entry.hand.winningTile &&
                            tileIndex === entry.hand.concealedTiles.lastIndexOf(tile)
                          }
                          tile={tile}
                        />
                      ))}
                    </div>

                    <div className={styles["factRow"]}>
                      <p className={styles["fact"]}>
                        {entry.context.roundWind.toUpperCase()} ROUND ·{" "}
                        {entry.context.seatWind.toUpperCase()} SEAT
                      </p>
                      <p className={styles["fact"]}>
                        {entry.hand.meldCount} CALLS · {entry.hand.doraCount} INDICATORS
                      </p>
                    </div>

                    <div className={styles["resultStrip"]}>
                      <div>
                        <p className={styles["resultKicker"]}>{t("PAYMENT")}</p>
                        <p className={styles["payment"]}>{paymentLabel(entry)}</p>
                      </div>
                      <div className={styles["totalBlock"]}>
                        <p className={styles["resultKicker"]}>{t("TOTAL GAIN")}</p>
                        <p className={styles["total"]}>{points(entry.result.totalGain)}</p>
                      </div>
                    </div>

                    <div className={styles["yakuRow"]}>
                      {(entry.result.yakuman.length > 0
                        ? entry.result.yakuman
                        : entry.result.yaku
                      ).map((item) => (
                        <span className={styles["yakuChip"]} key={item.id}>
                          {item.name}
                        </span>
                      ))}
                    </div>

                    <div className={styles["entryFooter"]}>
                      <p className={styles["rulesLabel"]}>{entry.rules.label}</p>
                      <button
                        aria-label={t("Remove score {position}", { position: index + 1 })}
                        className={styles["remove"]}
                        onClick={() => history.remove(entry.id)}
                        type="button"
                      >
                        {t("Remove")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {history.storageError === null ? null : (
            <p aria-live="polite" className={styles["error"]}>
              {history.storageError}
            </p>
          )}

          {history.entries.length === 0 ? null : confirmClear ? (
            <div className={styles["clearConfirm"]}>
              <p className={styles["clearTitle"]}>{t("Erase every saved score?")}</p>
              <div className={styles["clearActions"]}>
                <ActionButton
                  label={t("Keep scores")}
                  onPress={() => setConfirmClear(false)}
                  variant="paper"
                />
                <ActionButton
                  label={t("Erase score folio")}
                  onPress={() => {
                    history.clear();
                    setConfirmClear(false);
                  }}
                  variant="vermilion"
                />
              </div>
            </div>
          ) : (
            <button
              className={styles["clearLink"]}
              onClick={() => setConfirmClear(true)}
              type="button"
            >
              {t("Clear score folio")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
