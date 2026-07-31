export default {
  expo: {
    name: "Magic World",
    slug: "magicworld",
    version: "3.0.0",
    orientation: "default",
    icon: "./assets/images/icon.png",
    scheme: "magicworld",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    extra: {
      eas: {
        projectId: "2ed87d70-4ddc-404a-b9eb-2478b82fd7d3",
      },
    },
    ios: {
      newArchEnabled: false,
      supportsTablet: true,
      bundleIdentifier: "com.alexandre.juniort10.magicworld",
      infoPlist: {
        UIBackgroundModes: ["audio"],
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
        // Idiomas suportados pelo app — a App Store usa isso pra
        // exibir "Languages" na página do produto. Bate 1:1 com
        // os locales em `i18n/locales/*`.
        CFBundleLocalizations: [
          "en",
          "ar",
          "es",
          "fr",
          "hi",
          "pt",
          "zh-Hans",
        ],
        CFBundleDevelopmentRegion: "en",
      },
    },
    android: {
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.alexandre.juniort10.magicworld",
    },
    web: {
      output: "static",
    },
    splash: null,
    plugins: [
      "expo-router",
      "expo-localization",
      [
        "expo-notifications",
        {
          // TODO(alexandre): trocar por um 96x96 PNG monocromático branco
          // em fundo transparente pra ficar polido no Android
          // (recomendação do Google). Por enquanto usa o icon principal
          // — Android vai renderizar em cinza, mas funciona.
          icon: "./assets/images/icon.png",
          color: "#8B5CF6",
        },
      ],
      "./plugin/withFmtConstevalFix",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
