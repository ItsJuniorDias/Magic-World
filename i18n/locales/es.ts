import type { TranslationTree } from "../types";

const es: TranslationTree = {
  common: {
    continue: "Continuar",
    back: "Volver",
    close: "Cerrar",
    retry: "Reintentar",
    loading: "Cargando…",
    accept: "Aceptar",
    awesome: "¡Genial!",
    tryAgain: "Reintentar",
    cancel: "Cancelar",
    ok: "OK",
  },
  tabs: {
    home: "Inicio",
    favorite: "Favoritos",
    games: "Juegos",
    profile: "Perfil",
  },
  onboarding: {
    welcomeLine1: "Bienvenido a nuestro",
    welcomeLine2: "viaje de audiolibros",
    tagline:
      "Pasa la página, o mejor, pulsa play, y que empiece la aventura.",
    getStarted: "Empezar",
  },
  adventureIntro: {
    title: "Tu aventura está por comenzar ✨",
    subtitle1: "Cada elección va a moldear tu estilo de aventura.",
    subtitle2: "No hay elecciones correctas o incorrectas — solo caminos distintos.",
    tip: "💡 Consejo: tómate tu tiempo para explorar cada opción. ¡Algunos caminos pueden sorprenderte!",
    goal: "🎯 Meta: colecciona experiencias, no puntos. Tu viaje es único.",
    hint: "🌟 Pista: busca los detalles ocultos en el camino. Pueden revelar secretos.",
    cta: "Iniciar la aventura",
  },
  adventureResult: {
    kicker: "Tu perfil de aventura",
    cta: "Comenzar tu aventura",
    strengths: "💪 Fortalezas",
    challenges: "⚔️ Desafíos",
    advice: "🌟 Consejo",
    profiles: {
      brave: {
        title: "Aventurero Valiente",
        description:
          "Enfrentas los desafíos de frente y nunca retrocedes ante lo desconocido.",
        strengths:
          "Coraje, audacia, decisión. Inspiras a los demás con la acción.",
        challenges:
          "A veces te lanzas al peligro sin plan. La paciencia es clave.",
        advice:
          "Confía en tu instinto, pero observa tu entorno con atención.",
      },
      clever: {
        title: "Explorador Ingenioso",
        description:
          "Resuelves problemas con ingenio, estrategia y mente aguda.",
        strengths: "Resolución de problemas, estrategia, adaptabilidad.",
        challenges:
          "Pensar demasiado puede frenar decisiones. Equilibra análisis con acción.",
        advice:
          "Usa tu intelecto para guiar el viaje, pero recuerda disfrutarlo.",
      },
      wild: {
        title: "Espíritu Libre",
        description:
          "Sigues tus instintos y abrazas los caminos impredecibles.",
        strengths: "Flexibilidad, espontaneidad, resolución creativa.",
        challenges: "La impulsividad puede traer consecuencias inesperadas.",
        advice:
          "Confía en tu intuición, pero de vez en cuando pausa para planear.",
      },
      wise: {
        title: "Guardián Sabio",
        description:
          "Observas, reflexionas y eliges con cuidado antes de actuar.",
        strengths: "Paciencia, visión, decisiones reflexivas.",
        challenges:
          "A veces la indecisión o el exceso de cautela frenan el avance.",
        advice:
          "Combina sabiduría con acción y guía a otros en el camino.",
      },
    },
  },
  home: {
    mostWatched: "Historias más vistas",
    categoriesSection: "Categorías",
    recentlyPublished: "Publicadas recientemente",
  },
  favorites: {
    myFavorites: "Mis favoritos",
    recommended: "Recomendadas",
    trending: "Tendencia",
  },
  games: {
    title: "Arcade",
    subtitle: "Colección premium de juegos",
    badges: {
      new: "Nuevo",
      hot: "Popular",
    },
    items: {
      spellStorm: {
        title: "Tormenta de Hechizos",
        description:
          "Lanza hechizos, esquiva y sobrevive diez oleadas hasta enfrentar al dragón.",
      },
      spaceRunner: {
        title: "Corredor Espacial",
        description: "Navega entre asteroides.",
      },
      quizMaster: {
        title: "Maestro del Quiz",
        description: "Pon a prueba tus conocimientos.",
      },
      memoryMatch: {
        title: "Juego de Memoria",
        description: "Entrena tu mente.",
      },
    },
  },
  profile: {
    defaultName: "Lector Mágico",
    chapters: "Capítulos",
    badges: "Insignias",
    journeyProgress: "Progreso del viaje",
    achievementsSection: "Mis logros",
    languageSection: "Idioma",
    changeLanguage: "Cambiar idioma",
    levels: {
      apprentice: "APRENDIZ",
      sorcerer: "HECHICERO",
      wizard: "MAGO",
      archmage: "ARCHIMAGO",
    },
    achievements: {
      unlockedByChapters: "¡Desbloqueado al leer {{count}} capítulos!",
      secretUnlocked: "¡Logro secreto desbloqueado!",
      items: {
        initiate: {
          title: "Iniciado",
          description: "Cada viaje empieza con un solo paso.",
        },
        bookworm: {
          title: "Ratón de Biblioteca",
          description: "La curiosidad crece con cada página.",
        },
        relentless: {
          title: "Incansable",
          description: "Seguiste cuando parar era más fácil.",
        },
        spellbinder: {
          title: "Cautivador",
          description: "Las palabras tienen poder y aprendiste a usarlas.",
        },
        sage: {
          title: "Sabio",
          description: "El conocimiento se acumula, la sabiduría emerge.",
        },
        legendary: {
          title: "Legendario",
          description: "Tu dedicación ya es materia de leyenda.",
        },
        hiddenApprentice: {
          title: "Aprendiz Oculto",
          description: "Notaste lo que otros pasaron por alto.",
        },
        luckyReader: {
          title: "Lector Afortunado",
          description: "La suerte favorece a quien sigue leyendo.",
        },
        magicMilestone: {
          title: "Hito Mágico",
          description: "Un momento tranquilo donde el progreso se vuelve magia.",
        },
        centurion: {
          title: "Centurión",
          description: "Pocos llegan tan lejos. Tú lo hiciste.",
        },
        birthdayMagic: {
          title: "Magia de Cumpleaños",
          description: "Algunos días llevan una magia extra.",
        },
        earlyBird: {
          title: "Madrugador",
          description: "Estabas despierto antes que el mundo lo notara.",
        },
        nightOwl: {
          title: "Búho Nocturno",
          description: "Seguiste leyendo mientras otros dormían.",
        },
        carnavalReader: {
          title: "Lector de Carnaval",
          description: "Ni las fiestas pudieron apartarte.",
        },
        festiveSpirit: {
          title: "Espíritu Festivo",
          description: "Las historias encontraron su lugar entre las celebraciones.",
        },
        theOneWhoPersisted: {
          title: "El que Persistió",
          description:
            "Algunos caminos se revelan solo a quienes no se rinden.",
        },
      },
    },
    profileTypes: {
      brave: {
        title: "Aventurero Valiente",
        description: "Enfrentas los desafíos de frente y nunca retrocedes.",
      },
      clever: {
        title: "Explorador Ingenioso",
        description:
          "Resuelves problemas con ingenio, estrategia y mente aguda.",
      },
      wild: {
        title: "Espíritu Libre",
        description:
          "Sigues tus instintos y abrazas los caminos impredecibles.",
      },
      wise: {
        title: "Guardián Sabio",
        description:
          "Observas, reflexionas y eliges con cuidado antes de actuar.",
      },
    },
  },
  categories: {
    title: "Categorías",
    premium: "PREMIUM",
    membersOnly: "Exclusivo para miembros",
    items: {
      adventure: "Aventura",
      romance: "Romance",
      fantasy: "Fantasía",
      mystery: "Misterio",
      future: "Futuro",
    },
  },
  quiz: {
    error: "No se pudo cargar el quiz. Toca Reintentar.",
    retry: "Reintentar",
    completedTitle: "¡Quiz completado!",
    scoreLine: "¡Acertaste {{correct}} de {{total}}!",
    perfectScore: "¡Acertaste las {{total}}! ¡Increíble!",
    perfectTitle: "¡Puntaje perfecto!",
    greatTitle: "¡Muy bien!",
    greatDescription: "¡Acertaste {{correct}} de {{total}}!",
    notBadTitle: "¡Nada mal!",
    notBadDescription:
      "Acertaste {{correct}} de {{total}}. ¡Sigue practicando!",
    betterLuckTitle: "¡Suerte la próxima!",
    betterLuckDescription:
      "Acertaste {{correct}} de {{total}}. ¡Inténtalo de nuevo!",
  },
  memoryGame: {
    title: "🧠 Desafío de memoria",
    instructions: "¡Empareja todos los pares lo más rápido posible!",
    moves: "Movimientos: {{count}}",
    tip: "Consejo: recuerda dónde están las cartas para mejorar tu memoria.",
    congratulationsTitle: "🎉 ¡Felicidades!",
    congratulationsMessage:
      "¡Completaste el desafío en {{count}} movimientos!",
  },
  chapterCompleted: {
    choiceTitle: "La elección es tuya",
    choiceSubtitle:
      "Tu viaje llegó a un momento clave. ¿Qué camino tomarás?",
    completedTitle: "Historia completada",
    completedSubtitle:
      "Volteaste la última página de este capítulo. ¿Listo para la próxima aventura?",
  },
  guidedReading: {
    title: "Una nueva forma de vivir la historia",
    subtitle: "Relájate y deja que la lectura te guíe.",
    cta: "Empezar a escuchar",
  },
  storieMenu: {
    translate: "Traducir",
    ambientSound: "Sonido ambiente",
    translationUnavailableTitle: "Traducción no disponible",
    translationUnavailableBody:
      "El servicio de traducción está sobrecargado. Inténtalo más tarde.",
    ambientOptions: {
      fantasy: "Fantasía",
      rain: "Lluvia",
      forest: "Bosque",
      ocean: "Océano",
      none: "Ninguno",
    },
  },
  paywall: {
    close: "Cerrar",
    heroTitle: "Desbloquea cada historia mágica",
    heroSubtitle: "Cuentos sin pantallas que crecen con tu pequeño.",
    valueProps: {
      screenFree: "Cuentos de dormir sin pantalla",
      newAudiobooks: "Audiolibros nuevos cada semana",
      forLittleListeners: "Hecho para pequeños oyentes de 0 a 10 años",
      adFree: "100% sin anuncios y seguro para niños",
    },
    trialHeading: "Cómo funciona tu prueba gratis de {{days}} días",
    todayTitle: "Acceso total, al instante",
    todayDesc: "Cada historia, cada personaje. Nada bloqueado.",
    reminderTitle: "Te avisaremos",
    reminderDesc: "Recibirás un aviso antes de que termine la prueba.",
    billingTitle: "Empieza tu suscripción",
    billingDesc: "Solo si te encanta. Cancela cuando quieras en Ajustes.",
    dayLabel: "Día {{day}}",
    todayLabel: "Hoy",
    choosePlan: "Elige tu plan",
    monthly: "Mensual",
    yearly: "Anual",
    billedMonthly: "Facturación mensual",
    billedYearly: "Facturación anual",
    monthlyEqPrefix: "Solo {{price}}/mes, facturado anual",
    saveBadge: "AHORRA {{percent}}%",
    perMonth: "al mes",
    perYear: "al año",
    startTrialCta: "Comenzar prueba gratis de {{days}} días",
    continueYearly: "Continuar anual",
    continueMonthly: "Continuar mensual",
    finePrintWithTrial: "Luego {{price}} {{period}}. Cancela cuando quieras.",
    finePrintNoTrial:
      "Renovación automática hasta cancelar. Cancela cuando quieras en Ajustes.",
    period: {
      month: "/ mes",
      year: "/ año",
    },
    restore: "Restaurar",
    restoring: "Restaurando…",
    privacy: "Privacidad",
    terms: "Términos (EULA)",
    couldntLoadPlans:
      "No se pudieron cargar los planes. Revisa tu conexión y reintenta.",
    welcomeTitle: "¡Estás dentro!",
    welcomeBody: "Disfruta cada historia, cada noche.",
    somethingWrongTitle: "Algo salió mal",
    somethingWrongBody: "Inténtalo de nuevo en un momento.",
    welcomeBackTitle: "¡Bienvenido de vuelta!",
    welcomeBackBody: "Tu suscripción se ha restaurado.",
    noPurchasesTitle: "No se encontraron compras",
    noPurchasesBody:
      "No encontramos una suscripción activa en este Apple ID.",
    restoreFailedTitle: "Error al restaurar",
    restoreFailedBody: "Inténtalo de nuevo en un momento.",
    couldntOpenLinkTitle: "No se pudo abrir el enlace",
    couldntOpenLinkBody: "Revisa tu conexión e inténtalo de nuevo.",
  },
  legal: {
    privacyPolicyTitle: "Política de Privacidad",
    eulaTitle: "Contrato de Licencia de Usuario Final (EULA)",
    lastUpdated: "Última actualización: enero de 2026",
    iAgree: "Acepto y continúo",
    keepInEnglishNote: "",
  },
  languageSelector: {
    title: "Idioma",
    subtitle: "Cambia el idioma usado en toda la app.",
  },
};

export default es;
