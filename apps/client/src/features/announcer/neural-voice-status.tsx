import { ProgressBar } from "@riichimi/ui";

import type { NeuralVoiceState } from "../../infrastructure/kokoro-speech";
import { useLocale } from "../../state/locale-context";
import styles from "./neural-voice-status.module.css";

/**
 * What the neural voice is doing, wherever the choice is offered.
 *
 * The fetch is about 90 MB and the first line of every hand is synthesized
 * before it can be heard, so both are long enough to look like nothing
 * happening. The download can say how far along it is and gets a measured bar;
 * generating cannot, and gets one that travels rather than fills, because
 * inventing a percentage would be worse than admitting there is none.
 */
export function NeuralVoiceStatus({ state }: { readonly state: NeuralVoiceState }) {
  const { t } = useLocale();

  if (state.kind === "loading") {
    const percent = Math.round(state.progress * 100);
    return (
      <div aria-live="polite" className={styles["status"]}>
        <p className={styles["note"]}>
          {t("Fetching the voice… {percent}%", { percent: String(percent) })}
        </p>
        <ProgressBar label={t("Fetching the voice")} value={state.progress} />
      </div>
    );
  }

  if (state.kind === "generating") {
    return (
      <div aria-live="polite" className={styles["status"]}>
        <p className={styles["note"]}>{t("Reading the hand…")}</p>
        <ProgressBar label={t("Reading the hand")} />
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <p aria-live="polite" className={styles["note"]}>
        {state.stage === "japanese"
          ? t("The Japanese voice could not speak. The English one will read wins instead.")
          : t("The voice could not be fetched. This device's own voice will read wins instead.")}
      </p>
    );
  }

  return null;
}
