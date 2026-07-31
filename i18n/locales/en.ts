import type { TranslationTree } from "../types";

const en: TranslationTree = {
  common: {
    continue: "Continue",
    back: "Back",
    close: "Close",
    retry: "Retry",
    loading: "Loading…",
    accept: "Accept",
    awesome: "Awesome",
    tryAgain: "Try again",
    cancel: "Cancel",
    ok: "OK",
  },
  tabs: {
    home: "Home",
    favorite: "Favorite",
    games: "Games",
    profile: "Profile",
  },
  onboarding: {
    welcomeLine1: "Welcome to Our",
    welcomeLine2: "Audiobook Journey",
    tagline: "Turn the page, or rather, press play, and let the adventure begin.",
    getStarted: "Get Started",
  },
  adventureIntro: {
    title: "Your adventure is about to begin ✨",
    subtitle1: "Every choice you make will shape your adventure style.",
    subtitle2: "There are no right or wrong choices — only different paths.",
    tip: "💡 Tip: Take your time to explore each option. Some paths may surprise you!",
    goal: "🎯 Goal: Collect experiences, not points. Your journey is unique.",
    hint: "🌟 Hint: Look for hidden details along the way. They can unlock secrets.",
    cta: "Start the adventure",
  },
  adventureResult: {
    kicker: "Your Adventure Profile",
    cta: "Begin Your Adventure",
    strengths: "💪 Strengths",
    challenges: "⚔️ Challenges",
    advice: "🌟 Advice",
    profiles: {
      brave: {
        title: "Brave Adventurer",
        description:
          "You face challenges head-on and never back down from the unknown.",
        strengths:
          "Courage, boldness, decisiveness. You inspire others by action.",
        challenges:
          "Sometimes you rush into danger without a plan. Patience is key.",
        advice:
          "Trust your instincts, but also observe your surroundings carefully.",
      },
      clever: {
        title: "Clever Explorer",
        description: "You solve problems with wit, strategy, and a sharp mind.",
        strengths: "Problem-solving, strategy, adaptability.",
        challenges:
          "Overthinking can slow down decisions. Balance analysis with action.",
        advice:
          "Use your intellect to guide the journey, but remember to enjoy it.",
      },
      wild: {
        title: "Wild Spirit",
        description:
          "You follow your instincts and embrace unpredictable paths.",
        strengths: "Flexibility, spontaneity, creative problem-solving.",
        challenges: "Impulsiveness can bring unexpected consequences.",
        advice: "Trust your gut, but occasionally pause to plan ahead.",
      },
      wise: {
        title: "Wise Guardian",
        description:
          "You observe, reflect, and choose carefully before acting.",
        strengths: "Patience, foresight, thoughtful decision-making.",
        challenges:
          "Sometimes indecision or over-caution can slow progress.",
        advice:
          "Combine wisdom with action, and mentor others along the way.",
      },
    },
  },
  home: {
    mostWatched: "Most Watched Stories",
    categoriesSection: "Categories",
    recentlyPublished: "Recently Published",
  },
  favorites: {
    myFavorites: "My Favorites",
    recommended: "Recommended",
    trending: "Trending",
  },
  games: {
    title: "Arcade",
    subtitle: "Premium Games Collection",
    badges: {
      new: "New",
      hot: "Hot",
    },
    items: {
      spellStorm: {
        title: "Spell Storm",
        description: "Cast, dodge and survive ten waves to face the dragon.",
      },
      spaceRunner: {
        title: "Space Runner",
        description: "Navigate through asteroids.",
      },
      quizMaster: {
        title: "Quiz Master",
        description: "Test your knowledge.",
      },
      memoryMatch: {
        title: "Memory Match",
        description: "Train your brain.",
      },
    },
  },
  profile: {
    defaultName: "Magic Reader",
    chapters: "Chapters",
    badges: "Badges",
    journeyProgress: "Journey Progress",
    achievementsSection: "My Achievements",
    languageSection: "Language",
    changeLanguage: "Change language",
    levels: {
      apprentice: "APPRENTICE",
      sorcerer: "SORCERER",
      wizard: "WIZARD",
      archmage: "ARCHMAGE",
    },
    achievements: {
      unlockedByChapters: "Unlocked by reading {{count}} chapters!",
      secretUnlocked: "Secret Achievement Unlocked!",
      items: {
        initiate: {
          title: "Initiate",
          description: "Every journey begins with a single step.",
        },
        bookworm: {
          title: "Bookworm",
          description: "Curiosity grows with every page you turn.",
        },
        relentless: {
          title: "Relentless",
          description: "You kept going when stopping was easier.",
        },
        spellbinder: {
          title: "Spellbinder",
          description: "Words have power, and you have learned to wield them.",
        },
        sage: {
          title: "Sage",
          description: "Knowledge accumulates, wisdom emerges.",
        },
        legendary: {
          title: "Legendary",
          description: "Your dedication has become the stuff of legends.",
        },
        hiddenApprentice: {
          title: "Hidden Apprentice",
          description: "You noticed what others overlooked.",
        },
        luckyReader: {
          title: "Lucky Reader",
          description: "Chance favors those who keep reading.",
        },
        magicMilestone: {
          title: "Magic Milestone",
          description: "A quiet moment where progress becomes magic.",
        },
        centurion: {
          title: "Centurion",
          description: "Few reach this far. You did.",
        },
        birthdayMagic: {
          title: "Birthday Magic",
          description: "Some days carry a little extra magic.",
        },
        earlyBird: {
          title: "Early Bird",
          description: "You were awake before the world noticed.",
        },
        nightOwl: {
          title: "Night Owl",
          description: "You kept reading while others slept.",
        },
        carnavalReader: {
          title: "Carnaval Reader",
          description: "Even festivities could not pull you away.",
        },
        festiveSpirit: {
          title: "Festive Spirit",
          description: "Stories found their place among the celebrations.",
        },
        theOneWhoPersisted: {
          title: "The One Who Persisted",
          description:
            "Some paths reveal themselves only to those who do not give up.",
        },
      },
    },
    profileTypes: {
      brave: {
        title: "Brave Adventurer",
        description: "You face challenges head-on and never back down.",
      },
      clever: {
        title: "Clever Explorer",
        description: "You solve problems with wit, strategy, and a sharp mind.",
      },
      wild: {
        title: "Wild Spirit",
        description:
          "You follow your instincts and embrace unpredictable paths.",
      },
      wise: {
        title: "Wise Guardian",
        description: "You observe, reflect, and choose carefully before acting.",
      },
    },
  },
  categories: {
    title: "Categories",
    premium: "PREMIUM",
    membersOnly: "Members only",
    items: {
      adventure: "Adventure",
      romance: "Romance",
      fantasy: "Fantasy",
      mystery: "Mystery",
      future: "Future",
    },
  },
  quiz: {
    error: "Couldn't load the quiz. Tap Retry to try again.",
    retry: "Retry",
    completedTitle: "Quiz Completed!",
    scoreLine: "You answered {{correct}} out of {{total}} correctly!",
    perfectScore: "You answered all {{total}} correctly! Amazing!",
    perfectTitle: "Perfect Score!",
    greatTitle: "Great Job!",
    greatDescription: "You got {{correct}} out of {{total}} right!",
    notBadTitle: "Not Bad!",
    notBadDescription:
      "You answered {{correct}} out of {{total}} correctly. Keep practicing!",
    betterLuckTitle: "Better Luck Next Time!",
    betterLuckDescription:
      "You answered {{correct}} out of {{total}} correctly. Try again!",
  },
  memoryGame: {
    title: "🧠 Memory Challenge",
    instructions: "Try to match all pairs as quickly as possible!",
    moves: "Moves: {{count}}",
    tip: "Tip: Remember where the cards are to improve your memory!",
    congratulationsTitle: "🎉 Congratulations!",
    congratulationsMessage:
      "You completed the memory challenge in {{count}} moves!",
  },
  chapterCompleted: {
    choiceTitle: "The Choice is Yours",
    choiceSubtitle:
      "Your journey has reached a pivotal moment. Which path will you take?",
    completedTitle: "Story Completed",
    completedSubtitle:
      "You've turned the final page of this chapter. Ready for the next adventure?",
  },
  guidedReading: {
    title: "A new way to experience the story",
    subtitle: "Relax and let the reading guide you.",
    cta: "Start Listening",
  },
  storieMenu: {
    translate: "Translate",
    ambientSound: "Ambient Sound",
    translationUnavailableTitle: "Translation unavailable",
    translationUnavailableBody:
      "The translation service is overloaded. Please try again later.",
    ambientOptions: {
      fantasy: "Fantasy",
      rain: "Rain",
      forest: "Forest",
      ocean: "Ocean",
      none: "None",
    },
  },
  paywall: {
    close: "Close paywall",
    heroTitle: "Unlock every magical story",
    heroSubtitle: "Screen-free bedtime tales that grow with your little one.",
    valueProps: {
      screenFree: "Screen-free bedtime stories",
      newAudiobooks: "New audiobooks every week",
      forLittleListeners: "Made for little listeners, ages 0–10",
      adFree: "100% ad-free & kid-safe",
    },
    trialHeading: "How your {{days}}-day free trial works",
    todayTitle: "Full access, instantly",
    todayDesc: "Every story, every character. Nothing locked.",
    reminderTitle: "We'll remind you",
    reminderDesc: "You get a heads-up before your trial ends.",
    billingTitle: "Your subscription starts",
    billingDesc: "Only if you love it. Cancel anytime in Settings.",
    dayLabel: "Day {{day}}",
    todayLabel: "Today",
    choosePlan: "Choose your plan",
    monthly: "Monthly",
    yearly: "Yearly",
    billedMonthly: "Billed monthly",
    billedYearly: "Billed yearly",
    monthlyEqPrefix: "Just {{price}}/mo, billed yearly",
    saveBadge: "SAVE {{percent}}%",
    perMonth: "per month",
    perYear: "per year",
    startTrialCta: "Start {{days}}-Day Free Trial",
    continueYearly: "Continue Yearly",
    continueMonthly: "Continue Monthly",
    finePrintWithTrial: "Then {{price}} {{period}}. Cancel anytime.",
    finePrintNoTrial: "Auto-renews until cancelled. Cancel anytime in Settings.",
    period: {
      month: "/ month",
      year: "/ year",
    },
    restore: "Restore",
    restoring: "Restoring…",
    privacy: "Privacy",
    terms: "Terms (EULA)",
    couldntLoadPlans:
      "Couldn't load subscription plans. Check your connection and try again.",
    welcomeTitle: "You're in!",
    welcomeBody: "Enjoy every story, every night.",
    somethingWrongTitle: "Something went wrong",
    somethingWrongBody: "Please try again in a moment.",
    welcomeBackTitle: "Welcome back!",
    welcomeBackBody: "Your subscription has been restored.",
    noPurchasesTitle: "No purchases found",
    noPurchasesBody:
      "We couldn't find an active subscription on this Apple ID.",
    restoreFailedTitle: "Restore failed",
    restoreFailedBody: "Please try again in a moment.",
    couldntOpenLinkTitle: "Couldn't open link",
    couldntOpenLinkBody: "Please check your connection and try again.",
  },
  legal: {
    privacyPolicyTitle: "Privacy Policy",
    eulaTitle: "End User License Agreement (EULA)",
    lastUpdated: "Last updated: January 2026",
    iAgree: "I Agree & Continue",
    keepInEnglishNote: "",
  },
  languageSelector: {
    title: "Language",
    subtitle: "Change the language used throughout the app.",
  },
  notifications: {
    sectionTitle: "Notifications",
    bedtimeLabel: "Bedtime reminder",
    bedtimeDescription: "A gentle nudge at 7pm to start tonight's story.",
    streakLabel: "Streak reminder",
    streakDescription: "We'll remind you if you haven't listened today.",
    permissionDeniedTitle: "Notifications are off",
    permissionDeniedBody:
      "To get reading reminders, enable notifications for Magic World in Settings.",
    permissionOpenSettings: "Open Settings",
    bedtimePushTitle: "Bedtime, story time ✨",
    bedtimePushBody: "Tap to open tonight's magical audiobook.",
    streakPushTitle: "One story a day 📚",
    streakPushBody: "Keep your reading streak alive — a chapter is all it takes.",
  },
};

export default en;
