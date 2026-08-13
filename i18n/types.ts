/**
 * i18n — types
 * ============================================================
 * Contrato de shape das traduções. Todo arquivo em `locales/`
 * DEVE exportar um objeto compatível com `TranslationTree`.
 * Se faltar chave, o fallback pra `en` cobre em runtime.
 *
 * Ordem das chaves reflete ordem visual do app pra facilitar
 * revisão manual — não reorganizar por alfabético.
 */

export type LocaleCode = "en" | "es" | "pt" | "fr" | "de" | "hi" | "ar";

export type LocaleMeta = {
  code: LocaleCode;
  /** Nome da língua NA língua (usado no selector). */
  nativeName: string;
  /** Nome em inglês (fallback / debug). */
  englishName: string;
  /** Emoji da bandeira — usa o país mais representativo. */
  flag: string;
  /** Direção do texto. RTL só ativa flag `direction`, não força I18nManager. */
  direction: "ltr" | "rtl";
};

/**
 * Shape das traduções. Espelhado por todos os locales.
 * `en.ts` é a fonte da verdade — os outros SEMPRE têm as
 * mesmas chaves (validado em dev pelo `assertShape`).
 */
export type TranslationTree = {
  common: {
    continue: string;
    back: string;
    close: string;
    retry: string;
    loading: string;
    accept: string;
    awesome: string;
    tryAgain: string;
    cancel: string;
    ok: string;
  };
  tabs: {
    home: string;
    favorite: string;
    games: string;
    profile: string;
  };
  onboarding: {
    welcomeLine1: string;
    welcomeLine2: string;
    tagline: string;
    getStarted: string;
  };
  adventureIntro: {
    title: string;
    subtitle1: string;
    subtitle2: string;
    tip: string;
    goal: string;
    hint: string;
    cta: string;
  };
  adventureResult: {
    kicker: string;
    cta: string;
    strengths: string;
    challenges: string;
    advice: string;
    profiles: {
      brave: {
        title: string;
        description: string;
        strengths: string;
        challenges: string;
        advice: string;
      };
      clever: {
        title: string;
        description: string;
        strengths: string;
        challenges: string;
        advice: string;
      };
      wild: {
        title: string;
        description: string;
        strengths: string;
        challenges: string;
        advice: string;
      };
      wise: {
        title: string;
        description: string;
        strengths: string;
        challenges: string;
        advice: string;
      };
    };
  };
  home: {
    mostWatched: string;
    categoriesSection: string;
    recentlyPublished: string;
  };
  favorites: {
    myFavorites: string;
    recommended: string;
    trending: string;
  };
  games: {
    title: string;
    subtitle: string;
    badges: {
      new: string;
      hot: string;
    };
    items: {
      knightQuest: { title: string; description: string };
      spellStorm: { title: string; description: string };
      spaceRunner: { title: string; description: string };
      quizMaster: { title: string; description: string };
      memoryMatch: { title: string; description: string };
    };
  };
  profile: {
    defaultName: string;
    chapters: string;
    badges: string;
    journeyProgress: string;
    achievementsSection: string;
    languageSection: string;
    changeLanguage: string;
    levels: {
      apprentice: string;
      sorcerer: string;
      wizard: string;
      archmage: string;
    };
    achievements: {
      /** Interpolação: {{count}} = number of chapters */
      unlockedByChapters: string;
      secretUnlocked: string;
      items: Record<string, { title: string; description: string }>;
    };
    profileTypes: {
      brave: { title: string; description: string };
      clever: { title: string; description: string };
      wild: { title: string; description: string };
      wise: { title: string; description: string };
    };
  };
  categories: {
    title: string;
    premium: string;
    membersOnly: string;
    items: {
      adventure: string;
      romance: string;
      fantasy: string;
      mystery: string;
      future: string;
    };
  };
  quiz: {
    error: string;
    retry: string;
    completedTitle: string;
    /** Interpolação: {{correct}}, {{total}} */
    scoreLine: string;
    /** Interpolação: {{total}} */
    perfectScore: string;
    perfectTitle: string;
    greatTitle: string;
    /** Interpolação: {{correct}}, {{total}} */
    greatDescription: string;
    notBadTitle: string;
    /** Interpolação: {{correct}}, {{total}} */
    notBadDescription: string;
    betterLuckTitle: string;
    /** Interpolação: {{correct}}, {{total}} */
    betterLuckDescription: string;
  };
  memoryGame: {
    title: string;
    instructions: string;
    /** Interpolação: {{count}} */
    moves: string;
    tip: string;
    congratulationsTitle: string;
    /** Interpolação: {{count}} */
    congratulationsMessage: string;
  };
  chapterCompleted: {
    choiceTitle: string;
    choiceSubtitle: string;
    completedTitle: string;
    completedSubtitle: string;
  };
  guidedReading: {
    title: string;
    subtitle: string;
    cta: string;
  };
  storieMenu: {
    translate: string;
    ambientSound: string;
    translationUnavailableTitle: string;
    translationUnavailableBody: string;
    ambientOptions: {
      fantasy: string;
      rain: string;
      forest: string;
      ocean: string;
      none: string;
    };
  };
  paywall: {
    close: string;
    heroTitle: string;
    heroSubtitle: string;
    valueProps: {
      screenFree: string;
      newAudiobooks: string;
      forLittleListeners: string;
      adFree: string;
    };
    /** Interpolação: {{days}} */
    trialHeading: string;
    todayTitle: string;
    todayDesc: string;
    reminderTitle: string;
    reminderDesc: string;
    billingTitle: string;
    billingDesc: string;
    /** Interpolação: {{day}} */
    dayLabel: string;
    todayLabel: string;
    choosePlan: string;
    monthly: string;
    yearly: string;
    billedMonthly: string;
    billedYearly: string;
    /** Interpolação: {{price}} */
    monthlyEqPrefix: string;
    /** Interpolação: {{percent}} */
    saveBadge: string;
    perMonth: string;
    perYear: string;
    /** Interpolação: {{days}} */
    startTrialCta: string;
    continueYearly: string;
    continueMonthly: string;
    /** Interpolação: {{price}}, {{period}} */
    finePrintWithTrial: string;
    finePrintNoTrial: string;
    period: {
      month: string;
      year: string;
    };
    restore: string;
    restoring: string;
    privacy: string;
    terms: string;
    couldntLoadPlans: string;
    welcomeTitle: string;
    welcomeBody: string;
    somethingWrongTitle: string;
    somethingWrongBody: string;
    welcomeBackTitle: string;
    welcomeBackBody: string;
    noPurchasesTitle: string;
    noPurchasesBody: string;
    restoreFailedTitle: string;
    restoreFailedBody: string;
    couldntOpenLinkTitle: string;
    couldntOpenLinkBody: string;
  };
  legal: {
    privacyPolicyTitle: string;
    eulaTitle: string;
    lastUpdated: string;
    iAgree: string;
    /** Notion-hosted text stays in EN; keep title only translated. */
    keepInEnglishNote: string;
  };
  languageSelector: {
    title: string;
    subtitle: string;
  };
  parentalGate: {
    /** Título do modal — "Peça a um adulto". */
    title: string;
    /** Subtítulo — "Essa ação precisa de um adulto". */
    subtitle: string;
    /** Pergunta com interpolação: {{a}} × {{b}}. */
    question: string;
    /** Placeholder do input numérico. */
    placeholder: string;
    /** Mensagem quando erra — regenera problema. */
    wrongAnswer: string;
  };
  notifications: {
    /** Título da seção no Profile. */
    sectionTitle: string;
    /** Rótulo do toggle "Lembrete de leitura". */
    bedtimeLabel: string;
    bedtimeDescription: string;
    /** Rótulo do toggle "Lembrete de streak". */
    streakLabel: string;
    streakDescription: string;
    /** Alerta pedindo permissão manual em Ajustes se o usuário negou. */
    permissionDeniedTitle: string;
    permissionDeniedBody: string;
    permissionOpenSettings: string;
    /** Textos das notificações agendadas — usados no payload local. */
    bedtimePushTitle: string;
    bedtimePushBody: string;
    streakPushTitle: string;
    streakPushBody: string;
  };
};
