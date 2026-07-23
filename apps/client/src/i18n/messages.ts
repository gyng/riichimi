export const supportedLocales = ["en", "ja", "zh-Hans"] as const;

export type Locale = (typeof supportedLocales)[number];

export interface Messages {
  readonly home: {
    readonly headline: string;
    readonly historyBody: string;
    readonly historyKicker: string;
    readonly historyRevisit: string;
    readonly historySaved: string;
    readonly historyStart: string;
    readonly intro: string;
    readonly kicker: string;
    readonly manualAction: string;
    readonly manualBody: string;
    readonly manualIndex: string;
    readonly manualTitle: string;
    readonly scanAction: string;
    readonly scanBody: string;
    readonly scanIndex: string;
    readonly scanTitle: string;
    readonly sessionKicker: string;
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
      historyBody: "Local score audits, ready when the table asks why.",
      historyKicker: "SCORE FOLIO",
      historyRevisit: "Revisit recent answers",
      historySaved: "SAVED",
      historyStart: "Keep the next answer",
      intro:
        "Scan the tiles or enter them by hand. Riichimi asks only what the table cannot show and explains every point — locally, on this device.",
      kicker: "Winning hand calculator",
      manualAction: "Enter tiles manually",
      manualBody:
        "Build the same auditable result without camera access. Nothing important is hidden behind automation.",
      manualIndex: "02 / MANUAL",
      manualTitle: "Keep full control",
      scanAction: "Scan a winning hand",
      scanBody:
        "Use a guided camera frame to recognize tiles, calls, the winning tile, and dora indicators.",
      scanIndex: "01 / RECOMMENDED",
      scanTitle: "Let the tiles speak",
      sessionKicker: "03 / TABLE SESSION",
      sessionResume: "Resume the active table",
      sessionStart: "Start a four-player table",
    },
    language: {
      kicker: "LANGUAGE · THIS DEVICE",
      label: "Interface language",
      note: "Scoring terms (han, fu, yakuman) stay in their usual form in every language. Translation is still in progress, so some screens remain in English.",
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
      historyBody: "点数の根拠を端末内に保存します。卓で理由を聞かれたときに。",
      historyKicker: "点数記録",
      historyRevisit: "最近の結果を見る",
      historySaved: "保存済み",
      historyStart: "次の結果を保存する",
      intro:
        "牌を撮影するか、手入力してください。卓から読み取れない情報だけを尋ね、点数の根拠をすべて表示します。計算はこの端末内で完結します。",
      kicker: "和了点計算機",
      manualAction: "手入力する",
      manualBody: "カメラなしでも同じ監査可能な結果を作れます。重要な判断を自動化に隠しません。",
      manualIndex: "02 / 手入力",
      manualTitle: "すべて自分で決める",
      scanAction: "和了手を撮影する",
      scanBody: "ガイド枠に合わせて撮影し、牌・鳴き・和了牌・ドラ表示牌を認識します。",
      scanIndex: "01 / おすすめ",
      scanTitle: "牌に語らせる",
      sessionKicker: "03 / 対局",
      sessionResume: "進行中の卓に戻る",
      sessionStart: "四人打ちの卓を始める",
    },
    language: {
      kicker: "表示言語 · この端末",
      label: "表示言語",
      note: "翻・符・役満などの用語は、どの言語でも通常の表記のままにしています。翻訳は作業中のため、一部の画面は英語のままです。",
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
      historyBody: "点数依据保存在本机，牌桌上有疑问时随时可查。",
      historyKicker: "点数存档",
      historyRevisit: "查看最近的结果",
      historySaved: "已保存",
      historyStart: "保存下一次结果",
      intro:
        "拍摄牌面或手动输入。Riichimi 只询问牌桌上无法看到的信息，并列出每一点的来源——全部在本机完成。",
      kicker: "和牌点数计算器",
      manualAction: "手动输入牌",
      manualBody: "没有相机也能得到同样可核对的结果。重要的判断不会被自动化隐藏。",
      manualIndex: "02 / 手动",
      manualTitle: "完全自己掌控",
      scanAction: "拍摄和牌",
      scanBody: "对准取景框拍摄，识别牌张、副露、和牌张与宝牌指示牌。",
      scanIndex: "01 / 推荐",
      scanTitle: "让牌自己说话",
      sessionKicker: "03 / 牌桌对局",
      sessionResume: "回到进行中的牌桌",
      sessionStart: "开始四人牌桌",
    },
    language: {
      kicker: "界面语言 · 本机",
      label: "界面语言",
      note: "番、符、役满等术语在各语言下均保持惯用写法。翻译仍在进行中，部分页面暂为英文。",
    },
    localeName: "中文",
    nav: {
      history: "记录",
      home: "首页",
      manual: "手动",
      scan: "扫描",
      setup: "设置",
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
  // "ja-JP" -> "ja"; "zh-Hans-CN" / "zh-CN" -> "zh-Hans".
  const language = candidate.split("-")[0]?.toLowerCase() ?? "";
  if (language === "ja") {
    return "ja";
  }
  return language === "zh" ? "zh-Hans" : "en";
}
