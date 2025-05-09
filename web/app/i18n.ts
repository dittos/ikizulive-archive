export type Language = "ko";

export const DEFAULT_LOCALE: Language = "ko";

export type Strings = {
  home: {
    title: string;
    accountFilter: string;
  }
};

export const STRINGS: Record<Language, Strings> = {
  ko: {
    home: {
      title: "이키즈라이브! 아카이브",
      accountFilter: "계정 필터",
    },
  }
};
