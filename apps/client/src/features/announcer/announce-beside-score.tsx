import { SegmentedControl } from "@riichimi/ui";
import { useEffect, useId, useState } from "react";

import { neuralVoiceState, watchNeuralVoice } from "../../infrastructure/kokoro-speech";
import type { NeuralVoiceState } from "../../infrastructure/kokoro-speech";
import { neuralVoiceOffered } from "../../infrastructure/speech-selection";
import { useAnnouncer } from "../../state/announcer-context";
import { useLocale } from "../../state/locale-context";
import styles from "./announce-beside-score.module.css";

export interface AnnounceBesideScoreProps {
  /** Speaks the score that is on screen, so the control can prove it works. */
  readonly onSayAgain: () => void;
}

/**
 * The announcer's controls, next to the score they read out.
 *
 * They used to live only in Setup, off by default, which made a working feature
 * indistinguishable from a broken one — you had to already know it existed to
 * go and find it. Beside the score there is no discovery problem, and turning
 * it on speaks the hand that is already on screen, so a player learns
 * immediately whether their device makes any sound at all.
 */
export function AnnounceBesideScore({ onSayAgain }: AnnounceBesideScoreProps) {
  const { t } = useLocale();
  const { announceWins, setAnnounceWins, setVoice, speech, voice } = useAnnouncer();
  const voiceLabelId = useId();
  const [neural, setNeural] = useState<NeuralVoiceState>(neuralVoiceState);

  useEffect(() => watchNeuralVoice(setNeural), []);

  if (!speech.available) {
    return null;
  }

  return (
    <div className={styles["row"]}>
      <button
        aria-pressed={announceWins}
        className={styles["toggle"]}
        onClick={() => {
          const next = !announceWins;
          setAnnounceWins(next);
          // Turning it on reads this hand straight away: the point of putting
          // the control here is that its effect is audible without scoring
          // another hand to find out.
          if (next) {
            onSayAgain();
          } else {
            speech.cancel();
          }
        }}
        type="button"
      >
        <span aria-hidden className={styles["speaker"]}>
          {announceWins ? "🔊" : "🔇"}
        </span>
        {announceWins ? t("Announcing wins") : t("Announce wins")}
      </button>

      {announceWins ? (
        <button className={styles["again"]} onClick={onSayAgain} type="button">
          {t("Say it again")}
        </button>
      ) : null}

      {announceWins && neuralVoiceOffered() ? (
        <div className={styles["voice"]}>
          <p className={styles["voiceLabel"]} id={voiceLabelId}>
            {t("VOICE")}
          </p>
          <SegmentedControl
            labelledBy={voiceLabelId}
            onChange={setVoice}
            options={[
              { label: t("This device"), value: "system" },
              { label: t("Neural"), value: "neural" },
            ]}
            value={voice}
          />
          {neural.kind === "loading" ? (
            <p aria-live="polite" className={styles["voiceNote"]}>
              {t("Fetching the voice…")}
            </p>
          ) : null}
          {neural.kind === "failed" ? (
            <p aria-live="polite" className={styles["voiceNote"]}>
              {t("The voice could not be fetched. This device's own voice will read wins instead.")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
