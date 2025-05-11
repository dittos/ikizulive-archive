export type Language = "ko";

export const DEFAULT_LOCALE: Language = "ko";

export type Strings = {
  home: {
    title: string;
    accountFilter: string;
    selectAll: string;
    showOriginal: string;
    hideOriginal: string;
    translatedBy: string;
    prevPage: string;
    nextPage: string;
  }
};

export const STRINGS: Record<Language, Strings> = {
  ko: {
    home: {
      title: "이키즈라이브! 아카이브",
      accountFilter: "계정 필터",
      selectAll: "모두 선택",
      showOriginal: "원문 보기",
      hideOriginal: "원문 숨기기",
      translatedBy: "번역",
      prevPage: "이전 페이지",
      nextPage: "다음 페이지",
    },
  }
};
