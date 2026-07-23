import { SegmentedControl, color, space } from "@riichimi/ui";
import { StyleSheet, Text, View } from "react-native";

import { supportedLocales, messages as translations } from "../../i18n/messages";
import { useLocale } from "../../state/locale-context";

const options = supportedLocales.map((locale) => ({
  label: translations[locale].localeName,
  value: locale,
}));

export function LanguageControl() {
  const { locale, messages, selectLocale } = useLocale();

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>{messages.language.kicker}</Text>
      <SegmentedControl
        accessibilityLabel={messages.language.label}
        onChange={selectLocale}
        options={options}
        value={locale}
      />
      <Text style={styles.note}>{messages.language.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: color.jade,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: space.x2,
  },
  note: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 13,
    lineHeight: 19,
    marginTop: space.x2,
  },
  root: {
    flexBasis: 320,
    flexGrow: 1,
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: space.x5,
    padding: space.x4,
  },
});
