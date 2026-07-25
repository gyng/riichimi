import { SegmentedControl } from "@riichimi/ui";

import { supportedLocales, messages as translations } from "../../i18n/messages";
import { useLocale } from "../../state/locale-context";
import styles from "./language-control.module.css";

const options = supportedLocales.map((locale) => ({
  label: translations[locale].localeName,
  value: locale,
}));

export function LanguageControl() {
  const { locale, messages, selectLocale } = useLocale();

  return (
    <div className={styles["card"]}>
      <p className={styles["kicker"]}>{messages.language.kicker}</p>
      <SegmentedControl
        accessibilityLabel={messages.language.label}
        onChange={selectLocale}
        options={options}
        value={locale}
      />
      <p className={styles["note"]}>{messages.language.note}</p>
    </div>
  );
}
