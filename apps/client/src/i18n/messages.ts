export const supportedLocales = ["en", "ja", "zh-Hans", "zh-Hant"] as const;

export type Locale = (typeof supportedLocales)[number];

export interface Messages {
  readonly home: {
    readonly headline: string;
    readonly historyEmpty: string;
    readonly historyLabel: string;
    readonly manualAction: string;
    readonly scanAction: string;
    readonly sessionResume: string;
    readonly sessionStart: string;
  };
  readonly language: {
    readonly kicker: string;
    readonly label: string;
    readonly note: string;
  };
  readonly localeName: string;
  readonly nav: {
    readonly history: string;
    readonly home: string;
    readonly manual: string;
    readonly scan: string;
    readonly setup: string;
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
      historyEmpty: "No saved scores yet",
      historyLabel: "Saved scores",
      manualAction: "Enter by hand",
      scanAction: "Scan a hand",
      sessionResume: "Resume table",
      sessionStart: "Start a table",
    },
    language: {
      kicker: "LANGUAGE · THIS DEVICE",
      label: "Interface language",
      note: "Scoring terms (han, fu, yakuman) keep their usual form in every language.",
    },
    localeName: "English",
    nav: {
      history: "History",
      home: "home",
      manual: "Manual",
      scan: "Scan",
      setup: "Setup",
      table: "Table",
    },
  },
  ja: {
    home: {
      headline: "和了点を計算する",
      historyEmpty: "保存された点数はまだありません",
      historyLabel: "保存した点数",
      manualAction: "手入力で計算",
      scanAction: "撮影して計算",
      sessionResume: "卓に戻る",
      sessionStart: "卓を始める",
    },
    language: {
      kicker: "表示言語 · この端末",
      label: "表示言語",
      note: "翻・符・役満などの用語は、どの言語でも通常の表記のままにしています。",
    },
    localeName: "日本語",
    nav: {
      history: "履歴",
      home: "ホーム",
      manual: "手入力",
      scan: "撮影",
      setup: "設定",
      table: "卓",
    },
  },
  "zh-Hans": {
    home: {
      headline: "计算和牌点数",
      historyEmpty: "尚无保存的点数",
      historyLabel: "已保存的点数",
      manualAction: "手动输入",
      scanAction: "拍摄计算",
      sessionResume: "返回牌桌",
      sessionStart: "开始牌桌",
    },
    language: {
      kicker: "界面语言 · 本机",
      label: "界面语言",
      note: "番、符、役满等术语在各语言下均保持惯用写法。",
    },
    localeName: "简体中文",
    nav: {
      history: "记录",
      home: "首页",
      manual: "手动",
      scan: "扫描",
      setup: "设置",
      table: "牌桌",
    },
  },

  "zh-Hant": {
    home: {
      headline: "計算和牌點數",
      historyEmpty: "尚無儲存的點數",
      historyLabel: "已儲存的點數",
      manualAction: "手動輸入",
      scanAction: "拍攝計算",
      sessionResume: "返回牌桌",
      sessionStart: "開始牌桌",
    },
    language: {
      kicker: "介面語言 · 本機",
      label: "介面語言",
      note: "番、符、役滿等術語在各語言下均保持慣用寫法。",
    },
    localeName: "繁體中文",
    nav: {
      history: "紀錄",
      home: "首頁",
      manual: "手動",
      scan: "掃描",
      setup: "設定",
      table: "牌桌",
    },
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
  // "ja-JP" -> "ja". For Chinese, script and region decide which set of
  // characters a reader expects: Taiwan, Hong Kong, and Macau read traditional.
  const [language = "", ...rest] = candidate.toLowerCase().split("-");
  if (language === "ja") {
    return "ja";
  }
  if (language !== "zh") {
    return "en";
  }
  const traditional = rest.some((part) => ["hant", "tw", "hk", "mo"].includes(part));
  return traditional ? "zh-Hant" : "zh-Hans";
}
