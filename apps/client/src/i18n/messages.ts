export const supportedLocales = ["en", "ja", "zh-Hans"] as const;

export type Locale = (typeof supportedLocales)[number];

export interface Messages {
  readonly home: {
    readonly headline: string;
    readonly intro: string;
    readonly kicker: string;
  };
  readonly localeName: string;
  readonly nav: {
    readonly history: string;
    readonly home: string;
    readonly manual: string;
    readonly scan: string;
    readonly table: string;
  };
}

// Scoring terminology (han, fu, yakuman, yaku names) stays romanized/Japanese in
// every locale on purpose: those are the terms printed on score sheets and used
// at the table, and translating them would make an audit harder to check.
export const messages: Record<Locale, Messages> = {
  en: {
    home: {
      headline: "Score a winning hand",
      intro:
        "Scan the tiles or enter them by hand. Riichimi asks only what the table cannot show and explains every point — locally, on this device.",
      kicker: "Winning hand calculator",
    },
    localeName: "English",
    nav: { history: "History", home: "home", manual: "Manual", scan: "Scan", table: "Table" },
  },
  ja: {
    home: {
      headline: "和了点を計算する",
      intro:
        "牌を撮影するか、手入力してください。卓から読み取れない情報だけを尋ね、点数の根拠をすべて表示します。計算はこの端末内で完結します。",
      kicker: "和了点計算機",
    },
    localeName: "日本語",
    nav: { history: "履歴", home: "ホーム", manual: "手入力", scan: "撮影", table: "卓" },
  },
  "zh-Hans": {
    home: {
      headline: "计算和牌点数",
      intro:
        "拍摄牌面或手动输入。Riichimi 只询问牌桌上无法看到的信息，并列出每一点的来源——全部在本机完成。",
      kicker: "和牌点数计算器",
    },
    localeName: "中文",
    nav: { history: "记录", home: "首页", manual: "手动", scan: "扫描", table: "牌桌" },
  },
};

export function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}

/** Falls back to English for an unknown or absent device locale. */
export function resolveLocale(candidate: string | null): Locale {
  if (candidate === null) {
    return "en";
  }
  if (isLocale(candidate)) {
    return candidate;
  }
  // "ja-JP" -> "ja"; "zh-Hans-CN" / "zh-CN" -> "zh-Hans".
  const language = candidate.split("-")[0]?.toLowerCase() ?? "";
  if (language === "ja") {
    return "ja";
  }
  return language === "zh" ? "zh-Hans" : "en";
}
