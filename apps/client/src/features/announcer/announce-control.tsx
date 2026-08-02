import { Checkbox, SegmentedControl } from "@riichimi/ui";
import { useEffect, useId, useState } from "react";

import { DELIVERIES, NEURAL_SPEAKERS } from "./announcer-preference";
import { neuralVoiceState, watchNeuralVoice } from "../../infrastructure/kokoro-speech";
import type { NeuralVoiceState } from "../../infrastructure/kokoro-speech";
import { neuralVoiceOffered } from "../../infrastructure/speech-selection";
import { useAnnouncer } from "../../state/announcer-context";
import { useLocale } from "../../state/locale-context";
import styles from "./announce-control.module.css";

const voiceOptions = (t: (source: string) => string) =>
  [
    { label: t("This device"), value: "system" },
    { label: t("Neural"), value: "neural" },
  ] as const;

/** Setup controls for the win celebration and the spoken announcement. */
export function AnnounceControl() {
  const { t } = useLocale();
  const {
    announceWins,
    celebrateWins,
    delivery,
    setAnnounceWins,
    setCelebrateWins,
    setDelivery,
    setSpeaker,
    setVoice,
    speaker,
    speech,
    voice,
  } = useAnnouncer();
  const voiceLabelId = useId();
  const speakerLabelId = useId();
  const deliveryLabelId = useId();
  const [neural, setNeural] = useState<NeuralVoiceState>(neuralVoiceState);

  // The download runs outside React, so subscribe rather than poll.
  useEffect(() => watchNeuralVoice(setNeural), []);

  return (
    <div className={styles["card"]}>
      <p className={styles["kicker"]}>{t("WINS · THIS DEVICE")}</p>

      <Checkbox
        checked={celebrateWins}
        label={t("Celebrate big hands")}
        onChange={setCelebrateWins}
      />
      <p className={styles["note"]}>
        {t("Fire, lightning, and a brush stamp on a mangan or better.")}
      </p>

      {speech.available ? (
        <>
          <Checkbox
            checked={announceWins}
            label={t("Announce a win out loud")}
            onChange={(next) => {
              setAnnounceWins(next);
              if (!next) {
                // Stop mid-sentence rather than finishing what nobody asked for.
                speech.cancel();
              }
            }}
          />
          <p className={styles["note"]}>{t("Reads the han, fu, and points when a hand scores.")}</p>
        </>
      ) : null}

      {announceWins && neuralVoiceOffered() ? (
        <>
          <p className={styles["fieldLabel"]} id={voiceLabelId}>
            {t("VOICE")}
          </p>
          <SegmentedControl
            labelledBy={voiceLabelId}
            onChange={(next) => {
              setVoice(next);
            }}
            options={voiceOptions(t)}
            value={voice}
          />
          <p className={styles["note"]}>
            {voice === "neural"
              ? t(
                  "The same voice on every device. Fetches about 90 MB once, then reads offline like the rest of the app.",
                )
              : t("Whatever voice this device already has. Nothing to fetch.")}
          </p>
          {/* The fetch is slow and silent otherwise, so say what is happening —
              and say when it failed, because the browser voice quietly takes
              over and a player should know why it sounds different. */}
          {voice === "neural" ? (
            <>
              <p className={styles["fieldLabel"]} id={speakerLabelId}>
                {t("SPEAKER")}
              </p>
              <SegmentedControl
                labelledBy={speakerLabelId}
                onChange={setSpeaker}
                options={NEURAL_SPEAKERS.map((option) => ({
                  label: t(option.label),
                  value: option.id,
                }))}
                value={speaker}
              />
              <p className={styles["note"]}>
                {t("Japanese speakers from the same download. Switching is instant.")}
              </p>
            </>
          ) : null}

          <p className={styles["fieldLabel"]} id={deliveryLabelId}>
            {t("DELIVERY")}
          </p>
          <SegmentedControl
            labelledBy={deliveryLabelId}
            onChange={setDelivery}
            options={DELIVERIES.map((option) => ({ label: t(option.label), value: option.id }))}
            value={delivery}
          />
          <p className={styles["note"]}>
            {t("How long the announcer holds between the call, each yaku, and the score.")}
          </p>

          {voice === "neural" && neural.kind === "loading" ? (
            <p aria-live="polite" className={styles["note"]}>
              {t("Fetching the voice…")}
            </p>
          ) : null}
          {voice === "neural" && neural.kind === "failed" ? (
            <p aria-live="polite" className={styles["note"]}>
              {t("The voice could not be fetched. This device's own voice will read wins instead.")}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
