import type { TranslationTree } from "../types";

const fr: TranslationTree = {
  common: {
    continue: "Continuer",
    back: "Retour",
    close: "Fermer",
    retry: "Réessayer",
    loading: "Chargement…",
    accept: "Accepter",
    awesome: "Super",
    tryAgain: "Réessayer",
    cancel: "Annuler",
    ok: "OK",
  },
  tabs: {
    home: "Accueil",
    favorite: "Favoris",
    games: "Jeux",
    profile: "Profil",
  },
  onboarding: {
    welcomeLine1: "Bienvenue dans notre",
    welcomeLine2: "voyage audio",
    tagline:
      "Tourne la page, ou plutôt, appuie sur play, et laisse l'aventure commencer.",
    getStarted: "C'est parti",
  },
  adventureIntro: {
    title: "Ton aventure va commencer ✨",
    subtitle1: "Chaque choix façonnera ton style d'aventure.",
    subtitle2:
      "Il n'y a ni bon ni mauvais choix — juste des chemins différents.",
    tip: "💡 Astuce : prends ton temps pour explorer chaque option. Certains chemins peuvent te surprendre !",
    goal: "🎯 Objectif : collectionne des expériences, pas des points. Ton parcours est unique.",
    hint: "🌟 Indice : cherche les détails cachés sur le chemin. Ils révèlent des secrets.",
    cta: "Commencer l'aventure",
  },
  adventureResult: {
    kicker: "Ton profil d'aventure",
    cta: "Commencer ton aventure",
    strengths: "💪 Forces",
    challenges: "⚔️ Défis",
    advice: "🌟 Conseil",
    profiles: {
      brave: {
        title: "Aventurier Courageux",
        description:
          "Tu affrontes les défis de face et ne recules jamais devant l'inconnu.",
        strengths:
          "Courage, audace, décision. Tu inspires les autres par l'action.",
        challenges:
          "Parfois tu fonces dans le danger sans plan. La patience est essentielle.",
        advice:
          "Fais confiance à ton instinct, mais observe bien ce qui t'entoure.",
      },
      clever: {
        title: "Explorateur Malin",
        description:
          "Tu résous les problèmes avec esprit, stratégie et vivacité.",
        strengths: "Résolution de problèmes, stratégie, adaptabilité.",
        challenges:
          "Trop réfléchir peut ralentir tes décisions. Équilibre l'analyse et l'action.",
        advice:
          "Utilise ton intelligence pour guider le voyage, mais n'oublie pas d'en profiter.",
      },
      wild: {
        title: "Esprit Sauvage",
        description:
          "Tu suis ton instinct et embrasses les chemins imprévisibles.",
        strengths: "Flexibilité, spontanéité, résolution créative.",
        challenges: "L'impulsivité peut apporter des conséquences inattendues.",
        advice:
          "Fais confiance à ton intuition, mais fais parfois une pause pour planifier.",
      },
      wise: {
        title: "Gardien Sage",
        description:
          "Tu observes, réfléchis et choisis avec soin avant d'agir.",
        strengths:
          "Patience, vision à long terme, décisions réfléchies.",
        challenges:
          "Parfois l'indécision ou l'excès de prudence ralentissent tes progrès.",
        advice:
          "Combine sagesse et action, et guide les autres en chemin.",
      },
    },
  },
  home: {
    mostWatched: "Histoires les plus écoutées",
    categoriesSection: "Catégories",
    recentlyPublished: "Publiées récemment",
  },
  favorites: {
    myFavorites: "Mes favoris",
    recommended: "Recommandées",
    trending: "Tendances",
  },
  games: {
    title: "Arcade",
    subtitle: "Collection premium de jeux",
    badges: {
      new: "Nouveau",
      hot: "En vogue",
    },
    items: {
      spellStorm: {
        title: "Tempête de Sorts",
        description:
          "Lance des sorts, esquive et survis à dix vagues avant d'affronter le dragon.",
      },
      spaceRunner: {
        title: "Coureur de l'Espace",
        description: "Navigue entre les astéroïdes.",
      },
      quizMaster: {
        title: "Maître du Quiz",
        description: "Teste tes connaissances.",
      },
      memoryMatch: {
        title: "Jeu de Mémoire",
        description: "Entraîne ton cerveau.",
      },
    },
  },
  profile: {
    defaultName: "Lecteur Magique",
    chapters: "Chapitres",
    badges: "Badges",
    journeyProgress: "Progression",
    achievementsSection: "Mes succès",
    languageSection: "Langue",
    changeLanguage: "Changer de langue",
    levels: {
      apprentice: "APPRENTI",
      sorcerer: "SORCIER",
      wizard: "MAGE",
      archmage: "ARCHIMAGE",
    },
    achievements: {
      unlockedByChapters: "Débloqué après {{count}} chapitres lus !",
      secretUnlocked: "Succès secret débloqué !",
      items: {
        initiate: {
          title: "Initié",
          description: "Chaque voyage commence par un seul pas.",
        },
        bookworm: {
          title: "Rat de Bibliothèque",
          description: "La curiosité grandit à chaque page tournée.",
        },
        relentless: {
          title: "Infatigable",
          description: "Tu as continué quand s'arrêter était plus facile.",
        },
        spellbinder: {
          title: "Envoûteur",
          description:
            "Les mots ont un pouvoir et tu as appris à le manier.",
        },
        sage: {
          title: "Sage",
          description: "La connaissance s'accumule, la sagesse émerge.",
        },
        legendary: {
          title: "Légendaire",
          description: "Ta persévérance est devenue légendaire.",
        },
        hiddenApprentice: {
          title: "Apprenti Caché",
          description: "Tu as remarqué ce que d'autres ont raté.",
        },
        luckyReader: {
          title: "Lecteur Chanceux",
          description: "La chance sourit à ceux qui continuent de lire.",
        },
        magicMilestone: {
          title: "Jalon Magique",
          description:
            "Un moment paisible où le progrès devient magie.",
        },
        centurion: {
          title: "Centurion",
          description: "Peu vont aussi loin. Toi si.",
        },
        birthdayMagic: {
          title: "Magie d'Anniversaire",
          description: "Certains jours portent un peu plus de magie.",
        },
        earlyBird: {
          title: "Lève-tôt",
          description: "Tu étais éveillé avant que le monde ne s'en aperçoive.",
        },
        nightOwl: {
          title: "Noctambule",
          description: "Tu as continué à lire quand les autres dormaient.",
        },
        carnavalReader: {
          title: "Lecteur de Carnaval",
          description: "Même les fêtes n'ont pas pu t'éloigner.",
        },
        festiveSpirit: {
          title: "Esprit Festif",
          description:
            "Les histoires ont trouvé leur place parmi les fêtes.",
        },
        theOneWhoPersisted: {
          title: "Celui qui a Persisté",
          description:
            "Certains chemins ne se révèlent qu'à ceux qui n'abandonnent pas.",
        },
      },
    },
    profileTypes: {
      brave: {
        title: "Aventurier Courageux",
        description:
          "Tu affrontes les défis de face et ne recules jamais.",
      },
      clever: {
        title: "Explorateur Malin",
        description:
          "Tu résous les problèmes avec esprit, stratégie et vivacité.",
      },
      wild: {
        title: "Esprit Sauvage",
        description:
          "Tu suis ton instinct et embrasses les chemins imprévisibles.",
      },
      wise: {
        title: "Gardien Sage",
        description:
          "Tu observes, réfléchis et choisis avec soin avant d'agir.",
      },
    },
  },
  categories: {
    title: "Catégories",
    premium: "PREMIUM",
    membersOnly: "Réservé aux membres",
    items: {
      adventure: "Aventure",
      romance: "Romance",
      fantasy: "Fantastique",
      mystery: "Mystère",
      future: "Futur",
    },
  },
  quiz: {
    error: "Impossible de charger le quiz. Appuie sur Réessayer.",
    retry: "Réessayer",
    completedTitle: "Quiz terminé !",
    scoreLine: "Tu as trouvé {{correct}} sur {{total}} !",
    perfectScore: "Tu as tout trouvé sur {{total}} ! Incroyable !",
    perfectTitle: "Score parfait !",
    greatTitle: "Bien joué !",
    greatDescription: "Tu as trouvé {{correct}} sur {{total}} !",
    notBadTitle: "Pas mal !",
    notBadDescription:
      "Tu as trouvé {{correct}} sur {{total}}. Continue de t'entraîner !",
    betterLuckTitle: "Plus de chance la prochaine fois !",
    betterLuckDescription:
      "Tu as trouvé {{correct}} sur {{total}}. Retente ta chance !",
  },
  memoryGame: {
    title: "🧠 Défi mémoire",
    instructions: "Associe toutes les paires le plus vite possible !",
    moves: "Coups : {{count}}",
    tip: "Astuce : mémorise où sont les cartes pour améliorer ta mémoire !",
    congratulationsTitle: "🎉 Félicitations !",
    congratulationsMessage:
      "Tu as terminé le défi en {{count}} coups !",
  },
  chapterCompleted: {
    choiceTitle: "Le choix t'appartient",
    choiceSubtitle:
      "Ton voyage arrive à un moment clé. Quel chemin prendras-tu ?",
    completedTitle: "Histoire terminée",
    completedSubtitle:
      "Tu as tourné la dernière page de ce chapitre. Prêt pour la prochaine aventure ?",
  },
  guidedReading: {
    title: "Une nouvelle façon de vivre l'histoire",
    subtitle: "Détends-toi et laisse la lecture te guider.",
    cta: "Commencer l'écoute",
  },
  storieMenu: {
    translate: "Traduire",
    ambientSound: "Son d'ambiance",
    translationUnavailableTitle: "Traduction indisponible",
    translationUnavailableBody:
      "Le service de traduction est surchargé. Réessaie plus tard.",
    ambientOptions: {
      fantasy: "Fantastique",
      rain: "Pluie",
      forest: "Forêt",
      ocean: "Océan",
      none: "Aucun",
    },
  },
  paywall: {
    close: "Fermer",
    heroTitle: "Débloque chaque histoire magique",
    heroSubtitle:
      "Des histoires du soir sans écran, qui grandissent avec ton petit.",
    valueProps: {
      screenFree: "Histoires du soir sans écran",
      newAudiobooks: "De nouveaux audiolivres chaque semaine",
      forLittleListeners: "Pensé pour les petits auditeurs de 0 à 10 ans",
      adFree: "100 % sans publicité et sécurisé",
    },
    trialHeading: "Comment fonctionne ton essai gratuit de {{days}} jours",
    todayTitle: "Accès total, tout de suite",
    todayDesc: "Chaque histoire, chaque personnage. Rien de bloqué.",
    reminderTitle: "On te préviendra",
    reminderDesc: "Tu recevras un rappel avant la fin de l'essai.",
    billingTitle: "Ton abonnement commence",
    billingDesc:
      "Uniquement si tu adores. Annule quand tu veux dans Réglages.",
    dayLabel: "Jour {{day}}",
    todayLabel: "Aujourd'hui",
    choosePlan: "Choisis ton offre",
    monthly: "Mensuel",
    yearly: "Annuel",
    billedMonthly: "Facturation mensuelle",
    billedYearly: "Facturation annuelle",
    monthlyEqPrefix: "Juste {{price}}/mois, facturation annuelle",
    saveBadge: "ÉCONOMISE {{percent}} %",
    perMonth: "par mois",
    perYear: "par an",
    startTrialCta: "Démarrer l'essai gratuit de {{days}} jours",
    continueYearly: "Continuer en annuel",
    continueMonthly: "Continuer en mensuel",
    finePrintWithTrial:
      "Puis {{price}} {{period}}. Annule quand tu veux.",
    finePrintNoTrial:
      "Renouvellement automatique jusqu'à annulation. Annule quand tu veux dans Réglages.",
    period: {
      month: "/ mois",
      year: "/ an",
    },
    restore: "Restaurer",
    restoring: "Restauration…",
    privacy: "Confidentialité",
    terms: "Conditions (EULA)",
    couldntLoadPlans:
      "Impossible de charger les offres. Vérifie ta connexion et réessaie.",
    welcomeTitle: "Tu es là !",
    welcomeBody: "Profite de chaque histoire, chaque soir.",
    somethingWrongTitle: "Un souci est survenu",
    somethingWrongBody: "Réessaie dans un instant.",
    welcomeBackTitle: "Content de te revoir !",
    welcomeBackBody: "Ton abonnement a été restauré.",
    noPurchasesTitle: "Aucun achat trouvé",
    noPurchasesBody:
      "Aucun abonnement actif n'a été trouvé sur cet Apple ID.",
    restoreFailedTitle: "Échec de la restauration",
    restoreFailedBody: "Réessaie dans un instant.",
    couldntOpenLinkTitle: "Impossible d'ouvrir le lien",
    couldntOpenLinkBody: "Vérifie ta connexion et réessaie.",
  },
  legal: {
    privacyPolicyTitle: "Politique de confidentialité",
    eulaTitle: "Contrat de licence utilisateur final (EULA)",
    lastUpdated: "Dernière mise à jour : janvier 2026",
    iAgree: "J'accepte et continue",
    keepInEnglishNote: "",
  },
  languageSelector: {
    title: "Langue",
    subtitle: "Change la langue utilisée dans toute l'app.",
  },
};

export default fr;
