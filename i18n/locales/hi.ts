import type { TranslationTree } from "../types";

const hi: TranslationTree = {
  common: {
    continue: "आगे बढ़ें",
    back: "वापस",
    close: "बंद करें",
    retry: "फिर कोशिश करें",
    loading: "लोड हो रहा है…",
    accept: "स्वीकारें",
    awesome: "बढ़िया",
    tryAgain: "फिर कोशिश करें",
    cancel: "रद्द करें",
    ok: "ठीक है",
  },
  tabs: {
    home: "होम",
    favorite: "पसंदीदा",
    games: "गेम्स",
    profile: "प्रोफ़ाइल",
  },
  onboarding: {
    welcomeLine1: "स्वागत है हमारी",
    welcomeLine2: "ऑडियोबुक यात्रा में",
    tagline:
      "पन्ना पलटें, या यूं कहें, प्ले दबाएं, और रोमांच शुरू होने दें।",
    getStarted: "शुरू करें",
  },
  adventureIntro: {
    title: "आपका रोमांच शुरू होने वाला है ✨",
    subtitle1:
      "आपका हर चुनाव आपके रोमांच का अंदाज़ तय करेगा।",
    subtitle2:
      "यहां सही या गलत जवाब नहीं हैं — बस अलग-अलग रास्ते हैं।",
    tip: "💡 सुझाव: हर विकल्प को देखिए, जल्दबाज़ी नहीं। कुछ रास्ते चौंका सकते हैं!",
    goal: "🎯 लक्ष्य: अंक नहीं, अनुभव जमा करें। आपकी यात्रा अनोखी है।",
    hint: "🌟 संकेत: राह में छुपी बातों पर ध्यान दें। वे राज़ खोल सकती हैं।",
    cta: "रोमांच शुरू करें",
  },
  adventureResult: {
    kicker: "आपकी रोमांच प्रोफ़ाइल",
    cta: "अपना रोमांच शुरू करें",
    strengths: "💪 ताक़त",
    challenges: "⚔️ चुनौतियाँ",
    advice: "🌟 सलाह",
    profiles: {
      brave: {
        title: "बहादुर साहसी",
        description:
          "आप चुनौतियों का सीधे सामना करते हैं और अनजान से पीछे नहीं हटते।",
        strengths:
          "हिम्मत, दिलेरी, निर्णय। आप अपने कर्म से दूसरों को प्रेरित करते हैं।",
        challenges:
          "कभी-कभी बिना योजना ख़तरे में कूद पड़ते हैं। धीरज ज़रूरी है।",
        advice:
          "अपनी सहज बुद्धि पर भरोसा करें, पर आस-पास ध्यान से देखें।",
      },
      clever: {
        title: "चतुर खोजी",
        description:
          "आप बुद्धि, रणनीति और तेज़ दिमाग से समस्याएं सुलझाते हैं।",
        strengths:
          "समस्या हल करना, रणनीति, अनुकूलन क्षमता।",
        challenges:
          "बहुत सोचने से फ़ैसले धीमे हो सकते हैं। विश्लेषण और क्रिया में संतुलन रखें।",
        advice:
          "यात्रा में बुद्धि से रास्ता चुनें, पर उसका आनंद लेना न भूलें।",
      },
      wild: {
        title: "स्वच्छंद आत्मा",
        description:
          "आप अपनी सहज बुद्धि सुनते हैं और अनजाने रास्तों को अपनाते हैं।",
        strengths:
          "लचीलापन, सहजता, रचनात्मक समाधान।",
        challenges:
          "आवेग कभी-कभी अप्रत्याशित नतीज़े ला सकता है।",
        advice:
          "अपनी अंतरात्मा पर भरोसा करें, पर बीच-बीच में ठहरकर योजना बनाएं।",
      },
      wise: {
        title: "विवेकी रक्षक",
        description:
          "आप देखते हैं, सोचते हैं और सोच-समझकर फ़ैसला करते हैं।",
        strengths: "धीरज, दूरदर्शिता, सोच-समझकर लिए फ़ैसले।",
        challenges:
          "कभी-कभी अनिश्चय या ज़्यादा सावधानी प्रगति धीमी कर देती है।",
        advice:
          "बुद्धि को क्रिया से मिलाएं, और औरों का भी मार्गदर्शन करें।",
      },
    },
  },
  home: {
    mostWatched: "सबसे ज़्यादा सुनी गई कहानियाँ",
    categoriesSection: "श्रेणियाँ",
    recentlyPublished: "हाल ही में प्रकाशित",
  },
  favorites: {
    myFavorites: "मेरी पसंदीदा",
    recommended: "सुझाई गई",
    trending: "ट्रेंडिंग",
  },
  games: {
    title: "आर्केड",
    subtitle: "प्रीमियम गेम्स संग्रह",
    badges: {
      new: "नया",
      hot: "हॉट",
    },
    items: {
      spellStorm: {
        title: "मंत्र तूफ़ान",
        description:
          "मंत्र फेंकें, बचाव करें और दस लहरों के बाद अजगर का सामना करें।",
      },
      spaceRunner: {
        title: "अंतरिक्ष दौड़",
        description: "उल्कापिंडों के बीच से गुज़रें।",
      },
      quizMaster: {
        title: "क्विज़ मास्टर",
        description: "अपनी जानकारी परखें।",
      },
      memoryMatch: {
        title: "स्मृति मिलान",
        description: "दिमाग़ की कसरत करें।",
      },
    },
  },
  profile: {
    defaultName: "मैजिक रीडर",
    chapters: "अध्याय",
    badges: "बैज",
    journeyProgress: "यात्रा प्रगति",
    achievementsSection: "मेरी उपलब्धियाँ",
    languageSection: "भाषा",
    changeLanguage: "भाषा बदलें",
    levels: {
      apprentice: "शिष्य",
      sorcerer: "जादूगर",
      wizard: "मायावी",
      archmage: "महाजादूगर",
    },
    achievements: {
      unlockedByChapters: "{{count}} अध्याय पढ़कर अनलॉक!",
      secretUnlocked: "गुप्त उपलब्धि अनलॉक हुई!",
      items: {
        initiate: {
          title: "शुरुआत",
          description: "हर यात्रा एक क़दम से शुरू होती है।",
        },
        bookworm: {
          title: "किताबों का दीवाना",
          description: "हर पन्ने के साथ जिज्ञासा बढ़ती है।",
        },
        relentless: {
          title: "अटूट",
          description: "जब रुकना आसान था तब भी आप चलते रहे।",
        },
        spellbinder: {
          title: "मंत्रमुग्ध करने वाला",
          description:
            "शब्दों में शक्ति है, और आपने उन्हें साधना सीख लिया।",
        },
        sage: {
          title: "ऋषि",
          description: "ज्ञान जुड़ता है, विवेक उभरता है।",
        },
        legendary: {
          title: "किंवदंती",
          description:
            "आपकी लगन अब किंवदंतियों जैसी हो गई है।",
        },
        hiddenApprentice: {
          title: "छिपा शिष्य",
          description: "जो औरों से छूट गया, आपने देख लिया।",
        },
        luckyReader: {
          title: "भाग्यशाली पाठक",
          description: "क़िस्मत उनका साथ देती है जो पढ़ते रहते हैं।",
        },
        magicMilestone: {
          title: "जादुई मील का पत्थर",
          description:
            "एक शांत पल जहाँ प्रगति जादू में बदल जाती है।",
        },
        centurion: {
          title: "सेंचुरियन",
          description: "कम लोग यहाँ तक पहुँचते हैं। आप पहुँचे।",
        },
        birthdayMagic: {
          title: "जन्मदिन का जादू",
          description:
            "कुछ दिनों में थोड़ा अधिक जादू होता है।",
        },
        earlyBird: {
          title: "सुबह के जागी",
          description:
            "दुनिया के जागने से पहले आप जग गए थे।",
        },
        nightOwl: {
          title: "रात का उल्लू",
          description: "जब सब सोते थे, आप पढ़ते रहे।",
        },
        carnavalReader: {
          title: "उत्सव पाठक",
          description:
            "उत्सव भी आपको किताबों से दूर नहीं कर सका।",
        },
        festiveSpirit: {
          title: "त्योहारी उमंग",
          description:
            "जश्न के बीच भी कहानियों को जगह मिली।",
        },
        theOneWhoPersisted: {
          title: "जिसने डटे रहे",
          description:
            "कुछ रास्ते सिर्फ़ उन्हीं को दिखते हैं जो हार नहीं मानते।",
        },
      },
    },
    profileTypes: {
      brave: {
        title: "बहादुर साहसी",
        description: "आप चुनौतियों का सीधे सामना करते हैं, कभी पीछे नहीं हटते।",
      },
      clever: {
        title: "चतुर खोजी",
        description:
          "आप बुद्धि, रणनीति और तेज़ दिमाग से समस्याएं सुलझाते हैं।",
      },
      wild: {
        title: "स्वच्छंद आत्मा",
        description:
          "आप अपनी सहज बुद्धि सुनते हैं और अनजाने रास्तों को अपनाते हैं।",
      },
      wise: {
        title: "विवेकी रक्षक",
        description:
          "आप देखते हैं, सोचते हैं और सोच-समझकर फ़ैसला करते हैं।",
      },
    },
  },
  categories: {
    title: "श्रेणियाँ",
    premium: "प्रीमियम",
    membersOnly: "सिर्फ़ सदस्यों के लिए",
    items: {
      adventure: "साहसिक",
      romance: "रोमांस",
      fantasy: "फ़ैंटेसी",
      mystery: "रहस्य",
      future: "भविष्य",
    },
  },
  quiz: {
    error:
      "क्विज़ लोड नहीं हो सका। फिर कोशिश करें पर टैप करें।",
    retry: "फिर कोशिश करें",
    completedTitle: "क्विज़ पूरा!",
    scoreLine:
      "आपने {{total}} में से {{correct}} सही जवाब दिए!",
    perfectScore:
      "आपने सभी {{total}} सही किए! शानदार!",
    perfectTitle: "बेहतरीन स्कोर!",
    greatTitle: "बहुत बढ़िया!",
    greatDescription:
      "आपने {{total}} में से {{correct}} सही किए!",
    notBadTitle: "बुरा नहीं!",
    notBadDescription:
      "आपने {{total}} में से {{correct}} सही किए। अभ्यास जारी रखें!",
    betterLuckTitle: "अगली बार शुभकामनाएं!",
    betterLuckDescription:
      "आपने {{total}} में से {{correct}} सही किए। फिर कोशिश करें!",
  },
  memoryGame: {
    title: "🧠 स्मृति चुनौती",
    instructions:
      "जितनी जल्दी हो सके सभी जोड़ मिलाइए!",
    moves: "चालें: {{count}}",
    tip: "टिप: याद रखें कि कार्ड कहाँ हैं — स्मृति सुधरेगी!",
    congratulationsTitle: "🎉 बधाई हो!",
    congratulationsMessage:
      "आपने {{count}} चालों में स्मृति चुनौती पूरी की!",
  },
  chapterCompleted: {
    choiceTitle: "चुनाव आपका है",
    choiceSubtitle:
      "आपकी यात्रा अहम मोड़ पर है। किस रास्ते पर जाएँगे?",
    completedTitle: "कहानी पूरी",
    completedSubtitle:
      "इस अध्याय का आख़िरी पन्ना पलट दिया। अगले रोमांच के लिए तैयार?",
  },
  guidedReading: {
    title: "कहानी सुनने का नया तरीक़ा",
    subtitle: "आराम से बैठें, कहानी आपको साथ ले चलेगी।",
    cta: "सुनना शुरू करें",
  },
  storieMenu: {
    translate: "अनुवाद",
    ambientSound: "पर्यावरण ध्वनि",
    translationUnavailableTitle: "अनुवाद उपलब्ध नहीं",
    translationUnavailableBody:
      "अनुवाद सेवा पर बोझ ज़्यादा है। कृपया बाद में कोशिश करें।",
    ambientOptions: {
      fantasy: "फ़ैंटेसी",
      rain: "बारिश",
      forest: "जंगल",
      ocean: "समुद्र",
      none: "कोई नहीं",
    },
  },
  paywall: {
    close: "बंद करें",
    heroTitle: "हर जादुई कहानी खोलें",
    heroSubtitle:
      "स्क्रीन-मुक्त सोने की कहानियाँ, जो आपके बच्चे के साथ बढ़ती हैं।",
    valueProps: {
      screenFree: "स्क्रीन के बिना सोने की कहानियाँ",
      newAudiobooks: "हर हफ़्ते नई ऑडियोबुक",
      forLittleListeners:
        "0-10 साल के छोटे श्रोताओं के लिए बना",
      adFree: "100% विज्ञापन-मुक्त और बच्चों के लिए सुरक्षित",
    },
    trialHeading:
      "आपका {{days}} दिन का मुफ़्त ट्रायल कैसे काम करता है",
    todayTitle: "अभी पूरी पहुँच",
    todayDesc:
      "हर कहानी, हर किरदार। कुछ भी बंद नहीं।",
    reminderTitle: "हम याद दिलाएंगे",
    reminderDesc:
      "ट्रायल ख़त्म होने से पहले सूचना मिलेगी।",
    billingTitle: "आपकी सदस्यता शुरू",
    billingDesc:
      "सिर्फ़ अगर आपको पसंद आए। सेटिंग्स में कभी भी रद्द करें।",
    dayLabel: "दिन {{day}}",
    todayLabel: "आज",
    choosePlan: "अपना प्लान चुनें",
    monthly: "मासिक",
    yearly: "वार्षिक",
    billedMonthly: "मासिक बिलिंग",
    billedYearly: "वार्षिक बिलिंग",
    monthlyEqPrefix:
      "सिर्फ़ {{price}}/माह, वार्षिक बिल",
    saveBadge: "बचाएं {{percent}}%",
    perMonth: "प्रति माह",
    perYear: "प्रति वर्ष",
    startTrialCta:
      "{{days}} दिन का मुफ़्त ट्रायल शुरू करें",
    continueYearly: "वार्षिक जारी रखें",
    continueMonthly: "मासिक जारी रखें",
    finePrintWithTrial:
      "फिर {{price}} {{period}}। कभी भी रद्द करें।",
    finePrintNoTrial:
      "रद्द होने तक अपने आप नवीनीकरण। सेटिंग्स में कभी भी रद्द करें।",
    period: {
      month: "/ माह",
      year: "/ वर्ष",
    },
    restore: "पुनः प्राप्त करें",
    restoring: "पुनर्स्थापित…",
    privacy: "गोपनीयता",
    terms: "शर्तें (EULA)",
    couldntLoadPlans:
      "प्लान लोड नहीं हुए। कनेक्शन जाँचकर फिर कोशिश करें।",
    welcomeTitle: "आप शामिल हैं!",
    welcomeBody: "हर रात, हर कहानी का आनंद लें।",
    somethingWrongTitle: "कुछ ग़लत हुआ",
    somethingWrongBody:
      "कृपया थोड़ी देर बाद फिर कोशिश करें।",
    welcomeBackTitle: "वापसी पर स्वागत है!",
    welcomeBackBody:
      "आपकी सदस्यता पुनः प्राप्त हो गई।",
    noPurchasesTitle: "कोई खरीद नहीं मिली",
    noPurchasesBody:
      "इस Apple ID पर कोई सक्रिय सदस्यता नहीं मिली।",
    restoreFailedTitle: "पुनः प्राप्ति विफल",
    restoreFailedBody:
      "कृपया थोड़ी देर बाद फिर कोशिश करें।",
    couldntOpenLinkTitle: "लिंक नहीं खुला",
    couldntOpenLinkBody:
      "कनेक्शन जाँचकर फिर कोशिश करें।",
  },
  legal: {
    privacyPolicyTitle: "गोपनीयता नीति",
    eulaTitle: "अंतिम उपयोगकर्ता लाइसेंस अनुबंध (EULA)",
    lastUpdated: "अंतिम अद्यतन: जनवरी 2026",
    iAgree: "मैं सहमत हूँ और आगे बढ़ूँ",
    keepInEnglishNote: "",
  },
  languageSelector: {
    title: "भाषा",
    subtitle: "पूरे ऐप की भाषा बदलें।",
  },
  parentalGate: {
    title: "किसी बड़े से पूछें",
    subtitle:
      "यह हिस्सा माता-पिता के लिए है। जारी रखने के लिए सवाल हल करें।",
    question: "{{a}} × {{b}} कितना होता है?",
    placeholder: "उत्तर",
    wrongAnswer: "यह सही नहीं है। यह नया सवाल आज़माएँ।",
  },
  notifications: {
    sectionTitle: "सूचनाएँ",
    bedtimeLabel: "पढ़ाई का रिमाइंडर",
    bedtimeDescription: "शाम 7 बजे एक हल्का इशारा — कहानी शुरू करने के लिए।",
    streakLabel: "स्ट्रिक रिमाइंडर",
    streakDescription: "अगर आज नहीं सुना, तो हम याद दिलाएंगे।",
    permissionDeniedTitle: "सूचनाएँ बंद हैं",
    permissionDeniedBody:
      "रिमाइंडर पाने के लिए, सेटिंग्स में Magic World की सूचनाएँ ऑन करें।",
    permissionOpenSettings: "सेटिंग्स खोलें",
    bedtimePushTitle: "सोने का समय, कहानी का समय ✨",
    bedtimePushBody: "आज रात की जादुई ऑडियोबुक खोलने के लिए टैप करें।",
    streakPushTitle: "रोज़ एक कहानी 📚",
    streakPushBody: "अपनी स्ट्रिक बनाए रखें — एक अध्याय ही काफी है।",
  },
};

export default hi;
