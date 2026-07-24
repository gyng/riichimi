import type { ScoreHandResult } from "@riichimi/score-core";
import { color, space } from "@riichimi/ui";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "../../state/locale-context";

export interface ScoreResultPanelProps {
  readonly result: ScoreHandResult;
}

function points(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function ScoreResultPanel({ result }: ScoreResultPanelProps) {
  const { t } = useLocale();
  if (result.kind === "invalid") {
    return (
      <View accessibilityLiveRegion="polite" style={[styles.panel, styles.errorPanel]}>
        <Text accessibilityRole="header" style={styles.errorTitle}>
          {t("Check the hand")}
        </Text>
        {result.issues.map((issue) => (
          <Text key={`${issue.code}-${issue.message}`} style={styles.errorItem}>
            • {issue.message}
          </Text>
        ))}
      </View>
    );
  }

  if (result.kind === "not-winning" || result.kind === "no-yaku") {
    return (
      <View accessibilityLiveRegion="polite" style={[styles.panel, styles.errorPanel]}>
        <Text accessibilityRole="header" style={styles.errorTitle}>
          {result.kind === "not-winning" ? t("Not a complete hand") : t("A yaku is still needed")}
        </Text>
        <Text style={styles.errorItem}>{result.message}</Text>
      </View>
    );
  }

  const title =
    result.limit === null
      ? `${result.han ?? 0} ${t("han")} · ${result.fu?.rounded ?? 0} ${t("fu")}`
      : result.limit.toUpperCase();
  const payment =
    result.payments.kind === "ron"
      ? `${points(result.payments.fromDiscarder)} ${t("from discarder")}`
      : result.payments.fromDealer === null
        ? `${points(result.payments.fromEachNonDealer)} ${t("all")}`
        : `${points(result.payments.fromDealer)} / ${points(result.payments.fromEachNonDealer)}`;

  return (
    <View accessibilityLiveRegion="polite" style={[styles.panel, styles.successPanel]}>
      <Text style={styles.kicker}>{t("MAXIMUM-VALUE INTERPRETATION")}</Text>
      <Text accessibilityRole="header" style={styles.scoreTitle}>
        {title}
      </Text>
      <Text style={styles.payment}>{payment}</Text>
      <Text style={styles.total}>
        {t("Winner receives")} {points(result.totalGain)} {t("points total")}
      </Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>
        {result.yakuman.length > 0 ? t("Yakuman") : t("Yaku")}
      </Text>
      {(result.yakuman.length > 0 ? result.yakuman : result.yaku).map((item) => (
        <View key={item.id} style={styles.lineItem}>
          <View style={styles.lineCopy}>
            <Text style={styles.lineTitle}>{item.name}</Text>
            <Text style={styles.lineNote}>{item.romanized}</Text>
          </View>
          <Text style={styles.value}>
            {"han" in item ? `${item.han} ${t("han")}` : `${item.value}×`}
          </Text>
        </View>
      ))}

      {result.dora.total > 0 ? (
        <View style={styles.lineItem}>
          <View style={styles.lineCopy}>
            <Text style={styles.lineTitle}>{t("Dora")}</Text>
            <Text style={styles.lineNote}>
              {t("Visible")} {result.dora.dora} · {t("Ura")} {result.dora.uraDora} · {t("Red")}{" "}
              {result.dora.redDora}
            </Text>
          </View>
          <Text style={styles.value}>
            {result.dora.total} {t("han")}
          </Text>
        </View>
      ) : null}

      {result.fu !== null ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>{t("Fu audit")}</Text>
          {result.fu.items.map((item, index) => (
            <View key={`${item.reason}-${index}`} style={styles.fuRow}>
              <Text style={styles.lineNote}>{item.reason}</Text>
              <Text style={styles.fuValue}>+{item.fu}</Text>
            </View>
          ))}
          <Text style={styles.rounding}>
            {result.fu.unrounded} {t("fu")} → {result.fu.rounded} {t("fu")}
          </Text>
        </>
      ) : null}

      {result.riichiBonus > 0 ? (
        <Text style={styles.bonus}>
          {t("Includes")} {points(result.riichiBonus)} {t("points in riichi deposits.")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bonus: {
    color: color.jade,
    fontFamily: "serif",
    fontSize: 14,
    fontWeight: "700",
    marginTop: space.x4,
  },
  divider: {
    backgroundColor: color.line,
    height: 1,
    marginVertical: space.x5,
  },
  errorItem: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 16,
    lineHeight: 24,
    marginTop: space.x2,
  },
  errorPanel: {
    backgroundColor: "#F6DCD4",
    borderColor: color.accent,
  },
  errorTitle: {
    color: color.accent,
    fontFamily: "serif",
    fontSize: 25,
    fontWeight: "800",
  },
  fuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  fuValue: {
    color: color.ink,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
  },
  kicker: {
    color: "#8FC3AE",
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  lineCopy: {
    flex: 1,
  },
  lineItem: {
    alignItems: "center",
    borderBottomColor: "#43695C",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.x4,
    paddingVertical: space.x3,
  },
  lineNote: {
    color: "#C7D6CF",
    fontFamily: "serif",
    fontSize: 13,
  },
  lineTitle: {
    color: color.white,
    fontFamily: "serif",
    fontSize: 16,
    fontWeight: "700",
  },
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: space.x5,
  },
  payment: {
    color: color.white,
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "700",
    marginTop: space.x2,
  },
  rounding: {
    color: color.white,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    marginTop: space.x3,
    textAlign: "right",
  },
  scoreTitle: {
    color: color.white,
    fontFamily: "serif",
    fontSize: 39,
    fontWeight: "800",
    letterSpacing: -1.2,
    marginTop: space.x2,
  },
  sectionTitle: {
    color: "#8FC3AE",
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: space.x2,
  },
  successPanel: {
    backgroundColor: color.jade,
    borderColor: color.jade,
  },
  total: {
    color: "#C7D6CF",
    fontFamily: "serif",
    fontSize: 14,
    marginTop: space.x2,
  },
  value: {
    color: "#FFD6CB",
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "800",
  },
});
