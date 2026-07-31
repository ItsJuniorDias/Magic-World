import { useEffect, useState } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import TrackPlayer from "react-native-track-player";
import trackPlayerService from "../services/trackPlayer";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useLocaleStore } from "@/i18n";
import { useNotifications } from "@/hooks/useNotifications";

export const unstable_settings = {
  anchor: "(tabs)",
};

const queryClient = new QueryClient();

TrackPlayer.registerPlaybackService(() => trackPlayerService);

/**
 * Wrapper interno pra rodar `useNotifications` só depois do i18n
 * estar pronto. O hook já checa `useLocaleStore.ready` internamente,
 * mas isolar aqui deixa a intenção explícita e permite adicionar
 * outros hooks de bootstrap (ex.: analytics, remote config) sem
 * poluir o RootLayout.
 */
function AppBootstrap({ children }: { children: React.ReactNode }) {
  useNotifications();
  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    ComicReliefRegular: require("../assets/fonts/ComicRelief-Regular.ttf"),
    ComicReliefBold: require("../assets/fonts/ComicRelief-Bold.ttf"),
  });

  // i18n hydration — reconstrói o locale escolhido (AsyncStorage)
  // ou detecta do dispositivo antes de renderizar qualquer tela.
  // Sem isso a primeira frame pode piscar em EN pra usuário PT.
  const [i18nReady, setI18nReady] = useState(false);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);

  useEffect(() => {
    hydrateLocale().finally(() => setI18nReady(true));
  }, [hydrateLocale]);

  if (!loaded || !i18nReady) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" translucent />

      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <AppBootstrap>
            {/*
              Nota: com expo-router v6, o file-based routing detecta
              automaticamente cada rota em `app/`. Só precisamos declarar
              Stack.Screen quando queremos customizar options. Como todas
              as rotas usam `headerShown: false`, aplicamos via
              `screenOptions` uma vez só.
            */}
            <Stack screenOptions={{ headerShown: false }} />
            <StatusBar style="auto" />
          </AppBootstrap>
        </ThemeProvider>
      </QueryClientProvider>
    </>
  );
}
