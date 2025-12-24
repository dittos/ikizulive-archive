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
    sortByLatest: string;
    sortByOldest: string;
    noPosts: string;
    goToDate: string;
  };
  footer: {
    disclaimer: string;
  };
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
      sortByLatest: "최신순",
      sortByOldest: "날짜순",
      noPosts: "게시물이 없습니다. 필터를 변경하거나 다른 날짜를 선택해 보세요.",
      goToDate: "날짜로 이동",
    },
    footer: {
      disclaimer: "이 아카이브는 비공식 팬사이트이며, 프로젝트 이키즈라이브!와 무관합니다.\n모든 저작권은 원작자(©プロジェクトイキヅライブ！)에 있습니다.",
    },
  }
};
