export type Language = "ko";

export const DEFAULT_LOCALE: Language = "ko";

export type Strings = {
  home: {
    title: string;
    accountFilter: string;
    showOriginal: string;
    hideOriginal: string;
    translatedBy: string;
  }
};

export const STRINGS: Record<Language, Strings> = {
  ko: {
    home: {
      title: "이키즈라이브! 아카이브",
      accountFilter: "계정 필터",
      showOriginal: "원문 보기",
      hideOriginal: "원문 숨기기",
      translatedBy: "번역",
    },
  }
};
