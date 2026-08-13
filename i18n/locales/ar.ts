import type { TranslationTree } from "../types";

const ar: TranslationTree = {
  common: {
    continue: "متابعة",
    back: "رجوع",
    close: "إغلاق",
    retry: "إعادة المحاولة",
    loading: "جارٍ التحميل…",
    accept: "قبول",
    awesome: "رائع",
    tryAgain: "إعادة المحاولة",
    cancel: "إلغاء",
    ok: "حسنًا",
  },
  tabs: {
    home: "الرئيسية",
    favorite: "المفضلة",
    games: "الألعاب",
    profile: "الملف",
  },
  onboarding: {
    welcomeLine1: "مرحبًا بك في",
    welcomeLine2: "رحلتنا الصوتية",
    tagline:
      "اقلب الصفحة، أو بالأحرى اضغط تشغيل، ودع المغامرة تبدأ.",
    getStarted: "لنبدأ",
  },
  adventureIntro: {
    title: "مغامرتك على وشك أن تبدأ ✨",
    subtitle1: "كل خيار تتخذه سيشكّل أسلوب مغامرتك.",
    subtitle2:
      "لا توجد خيارات صحيحة أو خاطئة — فقط مسارات مختلفة.",
    tip: "💡 نصيحة: خذ وقتك لاستكشاف كل خيار. بعض الطرق قد تفاجئك!",
    goal: "🎯 الهدف: اجمع التجارب لا النقاط. رحلتك فريدة.",
    hint: "🌟 تلميح: ابحث عن التفاصيل الخفية على الطريق. قد تكشف لك أسرارًا.",
    cta: "ابدأ المغامرة",
  },
  adventureResult: {
    kicker: "ملفك في المغامرة",
    cta: "ابدأ مغامرتك",
    strengths: "💪 نقاط القوة",
    challenges: "⚔️ التحديات",
    advice: "🌟 نصيحة",
    profiles: {
      brave: {
        title: "المغامر الشجاع",
        description:
          "تواجه التحديات مباشرة ولا تتراجع أبدًا أمام المجهول.",
        strengths:
          "الشجاعة والجرأة والحسم. تُلهم الآخرين بأفعالك.",
        challenges:
          "أحيانًا تندفع نحو الخطر دون خطة. الصبر هو المفتاح.",
        advice:
          "ثِق بحدسك، لكن راقب ما حولك بعناية.",
      },
      clever: {
        title: "المستكشف الذكي",
        description:
          "تحل المشكلات بالذكاء والاستراتيجية والعقل الحاد.",
        strengths:
          "حل المشكلات، الاستراتيجية، القدرة على التكيّف.",
        challenges:
          "التفكير الزائد قد يبطئ القرارات. وازن بين التحليل والفعل.",
        advice:
          "استخدم عقلك لقيادة الرحلة، لكن لا تنسَ الاستمتاع بها.",
      },
      wild: {
        title: "الروح الحرة",
        description:
          "تتبع حدسك وتحتضن الطرق غير المتوقعة.",
        strengths: "المرونة، العفوية، الحلول المبتكرة.",
        challenges:
          "الاندفاع قد يجلب عواقب غير متوقعة.",
        advice:
          "ثِق بحدسك، لكن توقّف أحيانًا للتخطيط.",
      },
      wise: {
        title: "الحارس الحكيم",
        description:
          "تراقب وتتأمل وتختار بعناية قبل التصرف.",
        strengths: "الصبر، البصيرة، القرارات المدروسة.",
        challenges:
          "أحيانًا التردد أو الحذر المفرط قد يبطئ التقدم.",
        advice:
          "اجمع بين الحكمة والفعل، وأرشد الآخرين في طريقك.",
      },
    },
  },
  home: {
    mostWatched: "أكثر القصص استماعًا",
    categoriesSection: "الفئات",
    recentlyPublished: "نُشرت حديثًا",
  },
  favorites: {
    myFavorites: "مفضلتي",
    recommended: "موصى بها",
    trending: "الأكثر رواجًا",
  },
  games: {
    title: "الأركيد",
    subtitle: "مجموعة الألعاب المميزة",
    badges: {
      new: "جديد",
      hot: "الأكثر رواجًا",
    },
    items: {
      knightQuest: {
        title: "مغامرة الفارس",
        description: "استكشف القرية، واجه الزنزانة، واهزم محارب الهيكل العظمي.",
      },
      spellStorm: {
        title: "عاصفة التعاويذ",
        description:
          "ألقِ التعاويذ، وتفادَ، وانجُ من عشر موجات لمواجهة التنين.",
      },
      spaceRunner: {
        title: "عدّاء الفضاء",
        description: "تجوّل بين الكويكبات.",
      },
      quizMaster: {
        title: "سيّد الاختبارات",
        description: "اختبر معلوماتك.",
      },
      memoryMatch: {
        title: "لعبة الذاكرة",
        description: "درّب عقلك.",
      },
    },
  },
  profile: {
    defaultName: "قارئ سحري",
    chapters: "الفصول",
    badges: "الأوسمة",
    journeyProgress: "تقدّم الرحلة",
    achievementsSection: "إنجازاتي",
    languageSection: "اللغة",
    changeLanguage: "تغيير اللغة",
    levels: {
      apprentice: "متدرب",
      sorcerer: "ساحر",
      wizard: "مشعوذ",
      archmage: "كبير السحرة",
    },
    achievements: {
      unlockedByChapters:
        "تم فتحه بقراءة {{count}} فصلاً!",
      secretUnlocked: "تم فتح إنجاز سرّي!",
      items: {
        initiate: {
          title: "المُبتدئ",
          description: "كل رحلة تبدأ بخطوة واحدة.",
        },
        bookworm: {
          title: "دودة الكتب",
          description: "الفضول ينمو مع كل صفحة تقلبها.",
        },
        relentless: {
          title: "لا يكل",
          description: "استمررت حين كان التوقف أسهل.",
        },
        spellbinder: {
          title: "الساحر بالكلمات",
          description:
            "للكلمات قوة، وقد تعلّمت كيف توظّفها.",
        },
        sage: {
          title: "الحكيم",
          description: "تتراكم المعرفة، وتظهر الحكمة.",
        },
        legendary: {
          title: "أسطوري",
          description: "صار تفانيك أسطورة.",
        },
        hiddenApprentice: {
          title: "المتدرب الخفي",
          description: "لاحظت ما فات الآخرين.",
        },
        luckyReader: {
          title: "القارئ المحظوظ",
          description: "الحظ يحابي من يواصل القراءة.",
        },
        magicMilestone: {
          title: "معلم سحري",
          description:
            "لحظة هادئة يتحوّل فيها التقدّم إلى سحر.",
        },
        centurion: {
          title: "الكينتوريون",
          description: "قلّة تصل إلى هنا. أنت وصلت.",
        },
        birthdayMagic: {
          title: "سحر عيد الميلاد",
          description: "بعض الأيام تحمل سحرًا إضافيًا.",
        },
        earlyBird: {
          title: "الطائر المبكر",
          description: "كنت مستيقظًا قبل أن ينتبه العالم.",
        },
        nightOwl: {
          title: "بومة الليل",
          description: "قرأت بينما كان الآخرون نائمين.",
        },
        carnavalReader: {
          title: "قارئ الاحتفالات",
          description: "لم تستطع الاحتفالات إبعادك.",
        },
        festiveSpirit: {
          title: "روح الاحتفال",
          description:
            "وجدت القصص مكانًا وسط الاحتفالات.",
        },
        theOneWhoPersisted: {
          title: "من ثابر",
          description:
            "بعض الطرق لا تكشف نفسها إلا لمن لا يستسلمون.",
        },
      },
    },
    profileTypes: {
      brave: {
        title: "المغامر الشجاع",
        description:
          "تواجه التحديات مباشرة ولا تتراجع أبدًا.",
      },
      clever: {
        title: "المستكشف الذكي",
        description:
          "تحل المشكلات بالذكاء والاستراتيجية والعقل الحاد.",
      },
      wild: {
        title: "الروح الحرة",
        description:
          "تتبع حدسك وتحتضن الطرق غير المتوقعة.",
      },
      wise: {
        title: "الحارس الحكيم",
        description:
          "تراقب وتتأمل وتختار بعناية قبل التصرف.",
      },
    },
  },
  categories: {
    title: "الفئات",
    premium: "مميز",
    membersOnly: "للمشتركين فقط",
    items: {
      adventure: "مغامرة",
      romance: "رومانسية",
      fantasy: "خيال",
      mystery: "غموض",
      future: "مستقبل",
    },
  },
  quiz: {
    error:
      "تعذّر تحميل الاختبار. اضغط إعادة المحاولة.",
    retry: "إعادة المحاولة",
    completedTitle: "اكتمل الاختبار!",
    scoreLine:
      "أجبت بشكل صحيح على {{correct}} من {{total}}!",
    perfectScore:
      "أجبت على جميع الأسئلة الـ{{total}} بشكل صحيح! رائع!",
    perfectTitle: "علامة تامة!",
    greatTitle: "أحسنت!",
    greatDescription:
      "أجبت بشكل صحيح على {{correct}} من {{total}}!",
    notBadTitle: "ليس سيئًا!",
    notBadDescription:
      "أجبت على {{correct}} من {{total}}. تابع التمرين!",
    betterLuckTitle: "حظًا أوفر في المرة القادمة!",
    betterLuckDescription:
      "أجبت على {{correct}} من {{total}}. حاول مجددًا!",
  },
  memoryGame: {
    title: "🧠 تحدي الذاكرة",
    instructions:
      "طابق كل الأزواج بأسرع ما يمكن!",
    moves: "الحركات: {{count}}",
    tip: "نصيحة: تذكّر مواقع البطاقات لتحسين ذاكرتك!",
    congratulationsTitle: "🎉 تهانينا!",
    congratulationsMessage:
      "أكملت التحدي في {{count}} حركة!",
  },
  chapterCompleted: {
    choiceTitle: "الخيار لك",
    choiceSubtitle:
      "وصلت رحلتك إلى لحظة مفصلية. أي طريق ستسلك؟",
    completedTitle: "اكتملت القصة",
    completedSubtitle:
      "قلبت الصفحة الأخيرة من هذا الفصل. مستعد للمغامرة القادمة؟",
  },
  guidedReading: {
    title: "طريقة جديدة لعيش القصة",
    subtitle: "استرخِ ودع القراءة ترشدك.",
    cta: "ابدأ الاستماع",
  },
  storieMenu: {
    translate: "ترجمة",
    ambientSound: "صوت خلفي",
    translationUnavailableTitle: "الترجمة غير متاحة",
    translationUnavailableBody:
      "خدمة الترجمة مثقلة. حاول لاحقًا.",
    ambientOptions: {
      fantasy: "خيال",
      rain: "مطر",
      forest: "غابة",
      ocean: "محيط",
      none: "لا شيء",
    },
  },
  paywall: {
    close: "إغلاق",
    heroTitle: "افتح كل قصة سحرية",
    heroSubtitle:
      "حكايات ما قبل النوم بلا شاشات، تنمو مع طفلك.",
    valueProps: {
      screenFree: "حكايات نوم بلا شاشة",
      newAudiobooks: "كتب صوتية جديدة كل أسبوع",
      forLittleListeners:
        "مصمم للمستمعين الصغار من عمر 0 إلى 10",
      adFree: "100% بلا إعلانات وآمن للأطفال",
    },
    trialHeading:
      "كيف تعمل التجربة المجانية لمدة {{days}} يومًا",
    todayTitle: "وصول كامل، فورًا",
    todayDesc: "كل قصة، كل شخصية. لا شيء مغلق.",
    reminderTitle: "سنذكّرك",
    reminderDesc:
      "ستصلك تنبيه قبل انتهاء التجربة.",
    billingTitle: "يبدأ اشتراكك",
    billingDesc:
      "فقط إذا أعجبك. ألغِ متى شئت من الإعدادات.",
    dayLabel: "اليوم {{day}}",
    todayLabel: "اليوم",
    choosePlan: "اختر خطتك",
    monthly: "شهري",
    yearly: "سنوي",
    billedMonthly: "فوترة شهرية",
    billedYearly: "فوترة سنوية",
    monthlyEqPrefix:
      "فقط {{price}} شهريًا، فوترة سنوية",
    saveBadge: "وفّر {{percent}}%",
    perMonth: "شهريًا",
    perYear: "سنويًا",
    startTrialCta:
      "ابدأ التجربة المجانية لمدة {{days}} يومًا",
    continueYearly: "متابعة سنويًا",
    continueMonthly: "متابعة شهريًا",
    finePrintWithTrial:
      "ثم {{price}} {{period}}. ألغِ متى شئت.",
    finePrintNoTrial:
      "تجديد تلقائي حتى الإلغاء. ألغِ متى شئت من الإعدادات.",
    period: {
      month: "/ شهر",
      year: "/ سنة",
    },
    restore: "استعادة",
    restoring: "جاري الاستعادة…",
    privacy: "الخصوصية",
    terms: "الشروط (EULA)",
    couldntLoadPlans:
      "تعذّر تحميل الخطط. تحقق من اتصالك وحاول مجددًا.",
    welcomeTitle: "أنت معنا!",
    welcomeBody: "استمتع بكل قصة، كل ليلة.",
    somethingWrongTitle: "حدث خطأ ما",
    somethingWrongBody: "حاول مجددًا بعد قليل.",
    welcomeBackTitle: "مرحبًا بعودتك!",
    welcomeBackBody: "تمت استعادة اشتراكك.",
    noPurchasesTitle: "لم يُعثر على مشتريات",
    noPurchasesBody:
      "لم نجد اشتراكًا نشطًا على Apple ID هذا.",
    restoreFailedTitle: "فشلت الاستعادة",
    restoreFailedBody: "حاول مجددًا بعد قليل.",
    couldntOpenLinkTitle: "تعذّر فتح الرابط",
    couldntOpenLinkBody:
      "تحقق من اتصالك وحاول مجددًا.",
  },
  legal: {
    privacyPolicyTitle: "سياسة الخصوصية",
    eulaTitle:
      "اتفاقية ترخيص المستخدم النهائي (EULA)",
    lastUpdated: "آخر تحديث: يناير 2026",
    iAgree: "أوافق وأتابع",
    keepInEnglishNote: "",
  },
  languageSelector: {
    title: "اللغة",
    subtitle: "غيّر اللغة المستخدمة في التطبيق بأكمله.",
  },
  parentalGate: {
    title: "اسأل شخصًا بالغًا",
    subtitle: "هذا الجزء مخصص للبالغين. من فضلك أجب عن السؤال للمتابعة.",
    question: "كم يساوي {{a}} × {{b}}؟",
    placeholder: "الإجابة",
    wrongAnswer: "الإجابة غير صحيحة. جرّب هذا السؤال الجديد.",
  },
  notifications: {
    sectionTitle: "الإشعارات",
    bedtimeLabel: "تذكير القراءة",
    bedtimeDescription:
      "تذكير لطيف في الساعة 7 مساءً لبدء قصة الليلة.",
    streakLabel: "تذكير المتابعة",
    streakDescription:
      "سنذكّرك إذا لم تستمع اليوم.",
    permissionDeniedTitle: "الإشعارات مغلقة",
    permissionDeniedBody:
      "للحصول على تذكيرات القراءة، فعّل الإشعارات لـ Magic World من الإعدادات.",
    permissionOpenSettings: "فتح الإعدادات",
    bedtimePushTitle: "وقت النوم، وقت القصة ✨",
    bedtimePushBody:
      "اضغط لفتح الكتاب الصوتي السحري لهذه الليلة.",
    streakPushTitle: "قصة كل يوم 📚",
    streakPushBody:
      "حافظ على متابعتك — فصل واحد يكفي.",
  },
};

export default ar;
