import type { TranslationTree } from "../types";

const pt: TranslationTree = {
  common: {
    continue: "Continuar",
    back: "Voltar",
    close: "Fechar",
    retry: "Tentar de novo",
    loading: "Carregando…",
    accept: "Aceitar",
    awesome: "Show",
    tryAgain: "Tentar de novo",
    cancel: "Cancelar",
    ok: "OK",
  },
  tabs: {
    home: "Início",
    favorite: "Favoritos",
    games: "Jogos",
    profile: "Perfil",
  },
  onboarding: {
    welcomeLine1: "Bem-vindo à nossa",
    welcomeLine2: "jornada de audiolivros",
    tagline:
      "Vire a página, ou melhor, aperte o play, e deixe a aventura começar.",
    getStarted: "Começar",
  },
  adventureIntro: {
    title: "Sua aventura está prestes a começar ✨",
    subtitle1: "Cada escolha vai moldar o seu estilo de aventura.",
    subtitle2: "Não existe certo ou errado — só caminhos diferentes.",
    tip: "💡 Dica: sem pressa pra explorar cada opção. Alguns caminhos podem te surpreender!",
    goal: "🎯 Objetivo: colecione experiências, não pontos. Sua jornada é única.",
    hint: "🌟 Pista: procure detalhes escondidos no caminho. Eles podem revelar segredos.",
    cta: "Começar a aventura",
  },
  adventureResult: {
    kicker: "Seu perfil de aventura",
    cta: "Começar sua aventura",
    strengths: "💪 Pontos fortes",
    challenges: "⚔️ Desafios",
    advice: "🌟 Conselho",
    profiles: {
      brave: {
        title: "Aventureiro Corajoso",
        description:
          "Você encara os desafios de frente e nunca recua diante do desconhecido.",
        strengths:
          "Coragem, ousadia, decisão. Você inspira os outros pela ação.",
        challenges:
          "Às vezes se joga no perigo sem plano. Paciência é a chave.",
        advice:
          "Confie no seu instinto, mas observe o entorno com atenção.",
      },
      clever: {
        title: "Explorador Esperto",
        description:
          "Você resolve problemas com sagacidade, estratégia e mente afiada.",
        strengths: "Resolução de problemas, estratégia, adaptabilidade.",
        challenges:
          "Pensar demais pode travar decisões. Equilibre análise com ação.",
        advice:
          "Use a inteligência pra guiar a jornada, mas lembre de curtir também.",
      },
      wild: {
        title: "Espírito Selvagem",
        description:
          "Você segue seus instintos e abraça caminhos imprevisíveis.",
        strengths: "Flexibilidade, espontaneidade, criatividade pra resolver.",
        challenges:
          "Impulsividade pode trazer consequências inesperadas.",
        advice:
          "Confie no seu feeling, mas de vez em quando pause pra planejar.",
      },
      wise: {
        title: "Guardião Sábio",
        description:
          "Você observa, reflete e escolhe com cuidado antes de agir.",
        strengths: "Paciência, visão de longo prazo, decisões ponderadas.",
        challenges:
          "Às vezes a indecisão ou o excesso de cautela atrasam o progresso.",
        advice:
          "Combine sabedoria com ação, e oriente os outros no caminho.",
      },
    },
  },
  home: {
    mostWatched: "Mais assistidas",
    categoriesSection: "Categorias",
    recentlyPublished: "Publicadas recentemente",
  },
  favorites: {
    myFavorites: "Meus favoritos",
    recommended: "Recomendadas",
    trending: "Em alta",
  },
  games: {
    title: "Arcade",
    subtitle: "Coleção premium de jogos",
    badges: {
      new: "Novo",
      hot: "Bombando",
    },
    items: {
      knightQuest: {
        title: "Cavaleiro em Missão",
        description: "Explore a vila, enfrente a masmorra e derrote o Guerreiro Esqueleto.",
      },
      spellStorm: {
        title: "Tempestade de Feitiços",
        description:
          "Lance feitiços, desvie e sobreviva a dez ondas até enfrentar o dragão.",
      },
      spaceRunner: {
        title: "Corrida Espacial",
        description: "Navegue por entre os asteroides.",
      },
      quizMaster: {
        title: "Mestre do Quiz",
        description: "Teste seus conhecimentos.",
      },
      memoryMatch: {
        title: "Jogo da Memória",
        description: "Treine seu cérebro.",
      },
    },
  },
  profile: {
    defaultName: "Leitor Mágico",
    chapters: "Capítulos",
    badges: "Conquistas",
    journeyProgress: "Progresso da jornada",
    achievementsSection: "Minhas conquistas",
    languageSection: "Idioma",
    changeLanguage: "Mudar idioma",
    levels: {
      apprentice: "APRENDIZ",
      sorcerer: "FEITICEIRO",
      wizard: "MAGO",
      archmage: "ARQUIMAGO",
    },
    achievements: {
      unlockedByChapters: "Desbloqueada ao ler {{count}} capítulos!",
      secretUnlocked: "Conquista secreta desbloqueada!",
      items: {
        initiate: {
          title: "Iniciante",
          description: "Toda jornada começa com um único passo.",
        },
        bookworm: {
          title: "Rato de Biblioteca",
          description: "A curiosidade cresce a cada página virada.",
        },
        relentless: {
          title: "Incansável",
          description: "Você continuou mesmo quando parar seria mais fácil.",
        },
        spellbinder: {
          title: "Encantador",
          description:
            "Palavras têm poder, e você aprendeu a usá-las.",
        },
        sage: {
          title: "Sábio",
          description: "O conhecimento se acumula, a sabedoria surge.",
        },
        legendary: {
          title: "Lendário",
          description: "Sua dedicação virou coisa de lenda.",
        },
        hiddenApprentice: {
          title: "Aprendiz Oculto",
          description: "Você reparou no que os outros passaram batido.",
        },
        luckyReader: {
          title: "Leitor de Sorte",
          description: "A sorte favorece quem continua lendo.",
        },
        magicMilestone: {
          title: "Marco Mágico",
          description: "Um momento tranquilo em que o progresso vira magia.",
        },
        centurion: {
          title: "Centurião",
          description: "Poucos chegam até aqui. Você chegou.",
        },
        birthdayMagic: {
          title: "Magia de Aniversário",
          description: "Alguns dias carregam uma magia a mais.",
        },
        earlyBird: {
          title: "Madrugador",
          description: "Você já estava acordado antes do mundo perceber.",
        },
        nightOwl: {
          title: "Coruja da Noite",
          description: "Você continuou lendo enquanto os outros dormiam.",
        },
        carnavalReader: {
          title: "Leitor de Carnaval",
          description: "Nem a folia conseguiu te tirar dos livros.",
        },
        festiveSpirit: {
          title: "Espírito Festivo",
          description: "As histórias encontraram lugar entre as festas.",
        },
        theOneWhoPersisted: {
          title: "Aquele Que Persistiu",
          description:
            "Alguns caminhos só se revelam pra quem não desiste.",
        },
      },
    },
    profileTypes: {
      brave: {
        title: "Aventureiro Corajoso",
        description: "Você encara os desafios de frente e nunca recua.",
      },
      clever: {
        title: "Explorador Esperto",
        description:
          "Você resolve problemas com sagacidade, estratégia e mente afiada.",
      },
      wild: {
        title: "Espírito Selvagem",
        description:
          "Você segue seus instintos e abraça caminhos imprevisíveis.",
      },
      wise: {
        title: "Guardião Sábio",
        description:
          "Você observa, reflete e escolhe com cuidado antes de agir.",
      },
    },
  },
  categories: {
    title: "Categorias",
    premium: "PREMIUM",
    membersOnly: "Exclusivo para membros",
    items: {
      adventure: "Aventura",
      romance: "Romance",
      fantasy: "Fantasia",
      mystery: "Mistério",
      future: "Futuro",
    },
  },
  quiz: {
    error: "Não deu pra carregar o quiz. Toque em Tentar de novo.",
    retry: "Tentar de novo",
    completedTitle: "Quiz finalizado!",
    scoreLine: "Você acertou {{correct}} de {{total}}!",
    perfectScore: "Você acertou todas as {{total}}! Incrível!",
    perfectTitle: "Nota máxima!",
    greatTitle: "Mandou bem!",
    greatDescription: "Você acertou {{correct}} de {{total}}!",
    notBadTitle: "Nada mal!",
    notBadDescription:
      "Você acertou {{correct}} de {{total}}. Continue treinando!",
    betterLuckTitle: "Mais sorte na próxima!",
    betterLuckDescription:
      "Você acertou {{correct}} de {{total}}. Tenta de novo!",
  },
  memoryGame: {
    title: "🧠 Desafio da memória",
    instructions: "Tente combinar todos os pares o mais rápido possível!",
    moves: "Jogadas: {{count}}",
    tip: "Dica: memorize onde estão as cartas pra melhorar sua memória!",
    congratulationsTitle: "🎉 Parabéns!",
    congratulationsMessage:
      "Você completou o desafio em {{count}} jogadas!",
  },
  chapterCompleted: {
    choiceTitle: "A escolha é sua",
    choiceSubtitle:
      "Sua jornada chegou a um momento crucial. Qual caminho vai seguir?",
    completedTitle: "História concluída",
    completedSubtitle:
      "Você virou a última página deste capítulo. Pronto pra próxima aventura?",
  },
  guidedReading: {
    title: "Uma nova forma de viver a história",
    subtitle: "Relaxe e deixe a leitura te guiar.",
    cta: "Começar a ouvir",
  },
  storieMenu: {
    translate: "Traduzir",
    ambientSound: "Som ambiente",
    translationUnavailableTitle: "Tradução indisponível",
    translationUnavailableBody:
      "O serviço de tradução está sobrecarregado. Tenta de novo daqui a pouco.",
    ambientOptions: {
      fantasy: "Fantasia",
      rain: "Chuva",
      forest: "Floresta",
      ocean: "Oceano",
      none: "Nenhum",
    },
  },
  paywall: {
    close: "Fechar",
    heroTitle: "Desbloqueie todas as histórias mágicas",
    heroSubtitle:
      "Histórias de dormir sem tela, que crescem junto com o pequeno.",
    valueProps: {
      screenFree: "Histórias sem tela pra hora de dormir",
      newAudiobooks: "Novos audiolivros toda semana",
      forLittleListeners: "Feito pra pequenos ouvintes, de 0 a 10 anos",
      adFree: "100% sem anúncios e seguro pra crianças",
    },
    trialHeading: "Como funciona seu teste grátis de {{days}} dias",
    todayTitle: "Acesso total, na hora",
    todayDesc: "Toda história, todo personagem. Nada bloqueado.",
    reminderTitle: "A gente avisa",
    reminderDesc: "Você recebe um lembrete antes do teste acabar.",
    billingTitle: "Sua assinatura começa",
    billingDesc: "Só se você amar. Cancele quando quiser em Ajustes.",
    dayLabel: "Dia {{day}}",
    todayLabel: "Hoje",
    choosePlan: "Escolha seu plano",
    monthly: "Mensal",
    yearly: "Anual",
    billedMonthly: "Cobrado mensalmente",
    billedYearly: "Cobrado anualmente",
    monthlyEqPrefix: "Só {{price}}/mês, cobrado anualmente",
    saveBadge: "ECONOMIZE {{percent}}%",
    perMonth: "por mês",
    perYear: "por ano",
    startTrialCta: "Começar teste grátis de {{days}} dias",
    continueYearly: "Continuar anual",
    continueMonthly: "Continuar mensal",
    finePrintWithTrial: "Depois {{price}} {{period}}. Cancele quando quiser.",
    finePrintNoTrial:
      "Renovação automática até cancelar. Cancele quando quiser em Ajustes.",
    period: {
      month: "/ mês",
      year: "/ ano",
    },
    restore: "Restaurar",
    restoring: "Restaurando…",
    privacy: "Privacidade",
    terms: "Termos (EULA)",
    couldntLoadPlans:
      "Não deu pra carregar os planos. Confira sua conexão e tenta de novo.",
    welcomeTitle: "Você entrou!",
    welcomeBody: "Aproveite cada história, toda noite.",
    somethingWrongTitle: "Algo deu errado",
    somethingWrongBody: "Tenta de novo daqui a pouco.",
    welcomeBackTitle: "Bem-vindo de volta!",
    welcomeBackBody: "Sua assinatura foi restaurada.",
    noPurchasesTitle: "Nenhuma compra encontrada",
    noPurchasesBody:
      "Não achamos assinatura ativa nesta Apple ID.",
    restoreFailedTitle: "Falha ao restaurar",
    restoreFailedBody: "Tenta de novo daqui a pouco.",
    couldntOpenLinkTitle: "Não deu pra abrir o link",
    couldntOpenLinkBody:
      "Confira sua conexão e tenta de novo.",
    maybeLater: "Talvez depois",
  },
  legal: {
    privacyPolicyTitle: "Política de Privacidade",
    eulaTitle: "Contrato de Licença de Usuário Final (EULA)",
    lastUpdated: "Última atualização: janeiro de 2026",
    iAgree: "Concordo e continuar",
    keepInEnglishNote: "",
  },
  languageSelector: {
    title: "Idioma",
    subtitle: "Mude o idioma usado em todo o app.",
  },
  parentalGate: {
    title: "Peça a um adulto",
    subtitle:
      "Esta parte é para adultos. Responda a pergunta para continuar.",
    question: "Quanto é {{a}} × {{b}}?",
    placeholder: "Resposta",
    wrongAnswer: "Resposta incorreta. Tente esta nova conta.",
  },
  notifications: {
    sectionTitle: "Notificações",
    bedtimeLabel: "Lembrete de leitura",
    bedtimeDescription: "Um lembrete gentil às 19h pra começar a história.",
    streakLabel: "Lembrete de sequência",
    streakDescription: "A gente avisa se você não escutou hoje.",
    permissionDeniedTitle: "Notificações desativadas",
    permissionDeniedBody:
      "Pra receber lembretes, ative as notificações do Magic World em Ajustes.",
    permissionOpenSettings: "Abrir Ajustes",
    bedtimePushTitle: "Hora de dormir, hora de histórias ✨",
    bedtimePushBody: "Toque pra abrir o audiolivro mágico de hoje.",
    streakPushTitle: "Uma história por dia 📚",
    streakPushBody:
      "Mantenha sua sequência viva — um capítulo já basta.",
  },
};

export default pt;
