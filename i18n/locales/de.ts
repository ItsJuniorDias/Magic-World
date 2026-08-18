import type { TranslationTree } from "../types";

const de: TranslationTree = {
  common: {
    continue: "Weiter",
    back: "Zurück",
    close: "Schließen",
    retry: "Erneut versuchen",
    loading: "Lädt…",
    accept: "Akzeptieren",
    awesome: "Super",
    tryAgain: "Nochmal versuchen",
    cancel: "Abbrechen",
    ok: "OK",
  },
  tabs: {
    home: "Start",
    favorite: "Favoriten",
    games: "Spiele",
    profile: "Profil",
  },
  onboarding: {
    welcomeLine1: "Willkommen zu",
    welcomeLine2: "unserer Hörbuchreise",
    tagline:
      "Blättere die Seite um — oder besser: drücke auf Play, und lass das Abenteuer beginnen.",
    getStarted: "Los geht's",
  },
  adventureIntro: {
    title: "Dein Abenteuer beginnt gleich ✨",
    subtitle1: "Jede Entscheidung formt deinen ganz eigenen Abenteuerstil.",
    subtitle2:
      "Es gibt keine richtigen oder falschen Wege — nur verschiedene Pfade.",
    tip: "💡 Tipp: Nimm dir Zeit, jede Option zu erkunden. Manche Wege werden dich überraschen!",
    goal: "🎯 Ziel: Sammle Erlebnisse, keine Punkte. Deine Reise ist einzigartig.",
    hint: "🌟 Hinweis: Achte unterwegs auf versteckte Details. Sie können Geheimnisse enthüllen.",
    cta: "Abenteuer starten",
  },
  adventureResult: {
    kicker: "Dein Abenteurer-Profil",
    cta: "Starte dein Abenteuer",
    strengths: "💪 Stärken",
    challenges: "⚔️ Herausforderungen",
    advice: "🌟 Rat",
    profiles: {
      brave: {
        title: "Mutiger Abenteurer",
        description:
          "Du stellst dich Herausforderungen direkt und weichst dem Unbekannten nie aus.",
        strengths:
          "Mut, Kühnheit, Entschlossenheit. Du inspirierst andere durch dein Handeln.",
        challenges:
          "Manchmal stürzt du dich ohne Plan in Gefahr. Geduld ist der Schlüssel.",
        advice:
          "Vertraue deinem Instinkt, aber beobachte auch deine Umgebung genau.",
      },
      clever: {
        title: "Kluger Entdecker",
        description:
          "Du löst Probleme mit Witz, Strategie und einem scharfen Verstand.",
        strengths: "Problemlösung, Strategie, Anpassungsfähigkeit.",
        challenges:
          "Zu viel Nachdenken kann Entscheidungen verlangsamen. Balance zwischen Analyse und Handlung.",
        advice:
          "Nutze deinen Verstand, um die Reise zu leiten, aber vergiss nicht, sie zu genießen.",
      },
      wild: {
        title: "Wilde Seele",
        description:
          "Du folgst deinen Instinkten und wagst dich auf unvorhersehbare Pfade.",
        strengths:
          "Flexibilität, Spontanität, kreative Problemlösung.",
        challenges:
          "Impulsivität kann unerwartete Folgen haben.",
        advice:
          "Vertraue deinem Bauchgefühl, aber halte gelegentlich inne, um vorauszuplanen.",
      },
      wise: {
        title: "Weiser Hüter",
        description:
          "Du beobachtest, denkst nach und wählst sorgfältig, bevor du handelst.",
        strengths: "Geduld, Weitblick, überlegte Entscheidungen.",
        challenges:
          "Manchmal können Unentschlossenheit oder Übervorsicht den Fortschritt bremsen.",
        advice:
          "Verbinde Weisheit mit Handeln und leite andere unterwegs an.",
      },
    },
  },
  home: {
    mostWatched: "Meistgehörte Geschichten",
    categoriesSection: "Kategorien",
    recentlyPublished: "Neu erschienen",
  },
  favorites: {
    myFavorites: "Meine Favoriten",
    recommended: "Empfohlen",
    trending: "Trending",
  },
  games: {
    title: "Spielhalle",
    subtitle: "Premium-Spielesammlung",
    badges: {
      new: "Neu",
      hot: "Hot",
    },
    items: {
      knightQuest: {
        title: "Ritterquest",
        description: "Erkunde das Dorf, wage dich in den Kerker und besiege den Skelett-Krieger.",
      },
      spellStorm: {
        title: "Zaubersturm",
        description:
          "Zaubere, weiche aus und überstehe zehn Wellen bis zum Drachen.",
      },
      spaceRunner: {
        title: "Weltraumläufer",
        description: "Navigiere durch Asteroiden.",
      },
      quizMaster: {
        title: "Quizmeister",
        description: "Teste dein Wissen.",
      },
      memoryMatch: {
        title: "Memory-Spiel",
        description: "Trainiere dein Gehirn.",
      },
    },
  },
  profile: {
    defaultName: "Magischer Leser",
    chapters: "Kapitel",
    badges: "Abzeichen",
    journeyProgress: "Fortschritt der Reise",
    achievementsSection: "Meine Erfolge",
    languageSection: "Sprache",
    changeLanguage: "Sprache ändern",
    levels: {
      apprentice: "LEHRLING",
      sorcerer: "ZAUBERER",
      wizard: "MAGIER",
      archmage: "ERZMAGIER",
    },
    achievements: {
      unlockedByChapters:
        "Freigeschaltet nach dem Lesen von {{count}} Kapiteln!",
      secretUnlocked: "Geheimer Erfolg freigeschaltet!",
      items: {
        initiate: {
          title: "Eingeweihter",
          description: "Jede Reise beginnt mit einem einzigen Schritt.",
        },
        bookworm: {
          title: "Bücherwurm",
          description: "Mit jeder Seite wächst deine Neugier.",
        },
        relentless: {
          title: "Unermüdlich",
          description:
            "Du hast weitergemacht, obwohl Aufhören leichter gewesen wäre.",
        },
        spellbinder: {
          title: "Zauberbanner",
          description:
            "Worte haben Macht — und du hast gelernt, sie zu führen.",
        },
        sage: {
          title: "Weiser",
          description: "Wissen sammelt sich, Weisheit entsteht.",
        },
        legendary: {
          title: "Legendär",
          description:
            "Deine Hingabe ist zum Stoff der Legenden geworden.",
        },
        hiddenApprentice: {
          title: "Verborgener Lehrling",
          description: "Du hast bemerkt, was andere übersehen haben.",
        },
        luckyReader: {
          title: "Glücklicher Leser",
          description:
            "Das Glück begünstigt jene, die weiterlesen.",
        },
        magicMilestone: {
          title: "Magischer Meilenstein",
          description:
            "Ein stiller Moment, in dem Fortschritt zu Magie wird.",
        },
        centurion: {
          title: "Zenturio",
          description: "Nur wenige kommen so weit. Du hast es geschafft.",
        },
        birthdayMagic: {
          title: "Geburtstagszauber",
          description: "Manche Tage tragen ein bisschen mehr Magie in sich.",
        },
        earlyBird: {
          title: "Frühaufsteher",
          description:
            "Du warst wach, bevor die Welt es gemerkt hat.",
        },
        nightOwl: {
          title: "Nachteule",
          description: "Du hast gelesen, während andere schliefen.",
        },
        carnavalReader: {
          title: "Karnevals-Leser",
          description:
            "Nicht einmal die Feierlichkeiten konnten dich abhalten.",
        },
        festiveSpirit: {
          title: "Festlicher Geist",
          description:
            "Geschichten fanden ihren Platz mitten in den Feiern.",
        },
        theOneWhoPersisted: {
          title: "Der Beharrliche",
          description:
            "Manche Pfade zeigen sich nur denen, die nicht aufgeben.",
        },
      },
    },
    profileTypes: {
      brave: {
        title: "Mutiger Abenteurer",
        description:
          "Du stellst dich Herausforderungen direkt und weichst nie zurück.",
      },
      clever: {
        title: "Kluger Entdecker",
        description:
          "Du löst Probleme mit Witz, Strategie und scharfem Verstand.",
      },
      wild: {
        title: "Wilde Seele",
        description:
          "Du folgst deinen Instinkten und wagst dich auf unvorhersehbare Pfade.",
      },
      wise: {
        title: "Weiser Hüter",
        description:
          "Du beobachtest, denkst nach und wählst sorgfältig, bevor du handelst.",
      },
    },
  },
  categories: {
    title: "Kategorien",
    premium: "PREMIUM",
    membersOnly: "Nur für Mitglieder",
    items: {
      adventure: "Abenteuer",
      romance: "Romantik",
      fantasy: "Fantasie",
      mystery: "Mysterium",
      future: "Zukunft",
    },
  },
  quiz: {
    error:
      "Das Quiz konnte nicht geladen werden. Tippe auf Erneut versuchen.",
    retry: "Erneut versuchen",
    completedTitle: "Quiz abgeschlossen!",
    scoreLine:
      "Du hast {{correct}} von {{total}} richtig beantwortet!",
    perfectScore:
      "Du hast alle {{total}} Fragen richtig beantwortet! Fantastisch!",
    perfectTitle: "Perfekte Punktzahl!",
    greatTitle: "Gut gemacht!",
    greatDescription:
      "Du hast {{correct}} von {{total}} richtig!",
    notBadTitle: "Nicht schlecht!",
    notBadDescription:
      "Du hast {{correct}} von {{total}} richtig beantwortet. Übe weiter!",
    betterLuckTitle: "Beim nächsten Mal klappt's!",
    betterLuckDescription:
      "Du hast {{correct}} von {{total}} richtig beantwortet. Versuch es nochmal!",
  },
  memoryGame: {
    title: "🧠 Gedächtnis-Herausforderung",
    instructions: "Finde alle Paare so schnell wie möglich!",
    moves: "Züge: {{count}}",
    tip: "Tipp: Merke dir, wo die Karten liegen, um dein Gedächtnis zu trainieren!",
    congratulationsTitle: "🎉 Glückwunsch!",
    congratulationsMessage:
      "Du hast die Gedächtnis-Herausforderung in {{count}} Zügen gemeistert!",
  },
  chapterCompleted: {
    choiceTitle: "Die Wahl liegt bei dir",
    choiceSubtitle:
      "Deine Reise hat einen entscheidenden Moment erreicht. Welchen Weg wählst du?",
    completedTitle: "Geschichte abgeschlossen",
    completedSubtitle:
      "Du hast die letzte Seite dieses Kapitels umgeblättert. Bereit für das nächste Abenteuer?",
  },
  guidedReading: {
    title: "Eine neue Art, die Geschichte zu erleben",
    subtitle: "Entspann dich und lass dich vom Lesen leiten.",
    cta: "Anhören starten",
  },
  storieMenu: {
    translate: "Übersetzen",
    ambientSound: "Umgebungsklang",
    translationUnavailableTitle: "Übersetzung nicht verfügbar",
    translationUnavailableBody:
      "Der Übersetzungsdienst ist überlastet. Bitte versuch es später erneut.",
    ambientOptions: {
      fantasy: "Fantasie",
      rain: "Regen",
      forest: "Wald",
      ocean: "Ozean",
      none: "Keine",
    },
  },
  paywall: {
    close: "Bezahlschranke schließen",
    heroTitle: "Alle magischen Geschichten freischalten",
    heroSubtitle:
      "Gute-Nacht-Geschichten ohne Bildschirm, die mit deinem Kind mitwachsen.",
    valueProps: {
      screenFree: "Gute-Nacht-Geschichten ohne Bildschirm",
      newAudiobooks: "Jede Woche neue Hörbücher",
      forLittleListeners:
        "Für kleine Zuhörer von 0 bis 10 Jahren",
      adFree: "100 % werbefrei & kindersicher",
    },
    trialHeading:
      "So funktioniert deine {{days}}-tägige kostenlose Testphase",
    todayTitle: "Sofort voller Zugriff",
    todayDesc: "Jede Geschichte, jeder Charakter. Nichts gesperrt.",
    reminderTitle: "Wir erinnern dich",
    reminderDesc:
      "Du bekommst eine Erinnerung, bevor deine Testphase endet.",
    billingTitle: "Dein Abo startet",
    billingDesc:
      "Nur wenn es dir gefällt. Jederzeit in den Einstellungen kündbar.",
    dayLabel: "Tag {{day}}",
    todayLabel: "Heute",
    choosePlan: "Wähle deinen Plan",
    monthly: "Monatlich",
    yearly: "Jährlich",
    billedMonthly: "Monatliche Abrechnung",
    billedYearly: "Jährliche Abrechnung",
    monthlyEqPrefix:
      "Nur {{price}}/Monat bei jährlicher Zahlung",
    saveBadge: "SPARE {{percent}} %",
    perMonth: "pro Monat",
    perYear: "pro Jahr",
    startTrialCta:
      "{{days}}-tägige kostenlose Testphase starten",
    continueYearly: "Jährlich fortfahren",
    continueMonthly: "Monatlich fortfahren",
    finePrintWithTrial:
      "Danach {{price}} {{period}}. Jederzeit kündbar.",
    finePrintNoTrial:
      "Verlängert sich automatisch bis zur Kündigung. Jederzeit in den Einstellungen kündbar.",
    period: {
      month: "/ Monat",
      year: "/ Jahr",
    },
    restore: "Wiederherstellen",
    restoring: "Wird wiederhergestellt…",
    privacy: "Datenschutz",
    terms: "Bedingungen (EULA)",
    couldntLoadPlans:
      "Abo-Pläne konnten nicht geladen werden. Prüfe deine Verbindung und versuch es nochmal.",
    welcomeTitle: "Willkommen an Bord!",
    welcomeBody: "Genieße jede Geschichte, jeden Abend.",
    somethingWrongTitle: "Etwas ist schiefgelaufen",
    somethingWrongBody: "Bitte versuch es gleich nochmal.",
    welcomeBackTitle: "Willkommen zurück!",
    welcomeBackBody: "Dein Abo wurde wiederhergestellt.",
    noPurchasesTitle: "Keine Käufe gefunden",
    noPurchasesBody:
      "Wir konnten kein aktives Abo für diese Apple-ID finden.",
    restoreFailedTitle: "Wiederherstellung fehlgeschlagen",
    restoreFailedBody: "Bitte versuch es gleich nochmal.",
    couldntOpenLinkTitle: "Link konnte nicht geöffnet werden",
    couldntOpenLinkBody:
      "Bitte prüfe deine Verbindung und versuch es nochmal.",
    maybeLater: "Vielleicht später",
  },
  legal: {
    privacyPolicyTitle: "Datenschutzerklärung",
    eulaTitle: "Endbenutzer-Lizenzvertrag (EULA)",
    lastUpdated: "Zuletzt aktualisiert: Januar 2026",
    iAgree: "Zustimmen & fortfahren",
    keepInEnglishNote: "",
  },
  languageSelector: {
    title: "Sprache",
    subtitle: "Ändere die Sprache, die in der ganzen App verwendet wird.",
  },
  parentalGate: {
    title: "Frag einen Erwachsenen",
    subtitle:
      "Dieser Teil ist für Erwachsene. Bitte löse die Aufgabe, um fortzufahren.",
    question: "Wie viel ist {{a}} × {{b}}?",
    placeholder: "Antwort",
    wrongAnswer: "Das ist nicht richtig. Versuche diese neue Aufgabe.",
  },
  notifications: {
    sectionTitle: "Benachrichtigungen",
    bedtimeLabel: "Erinnerung vor dem Schlafengehen",
    bedtimeDescription:
      "Ein sanfter Anstoß um 19 Uhr, um die heutige Geschichte zu beginnen.",
    streakLabel: "Streak-Erinnerung",
    streakDescription:
      "Wir erinnern dich, wenn du heute noch nicht zugehört hast.",
    permissionDeniedTitle: "Benachrichtigungen sind aus",
    permissionDeniedBody:
      "Um Lese-Erinnerungen zu erhalten, aktiviere die Benachrichtigungen für Magic World in den Einstellungen.",
    permissionOpenSettings: "Einstellungen öffnen",
    bedtimePushTitle: "Zeit für die Gute-Nacht-Geschichte ✨",
    bedtimePushBody:
      "Tippe, um das heutige magische Hörbuch zu öffnen.",
    streakPushTitle: "Eine Geschichte pro Tag 📚",
    streakPushBody:
      "Halte deine Lese-Streak am Leben — ein Kapitel reicht schon.",
  },
};

export default de;
