import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import {
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import TrackPlayer from "react-native-track-player";
import trackPlayerService from "../services/trackPlayer";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useEffect } from "react";

export const unstable_settings = {
  anchor: "(tabs)",
};

const queryClient = new QueryClient();

TrackPlayer.registerPlaybackService(() => trackPlayerService);

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    ComicReliefRegular: require("../assets/fonts/ComicRelief-Regular.ttf"),
    ComicReliefBold: require("../assets/fonts/ComicRelief-Bold.ttf"),
  });

  if (!loaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" translucent />

      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Stack>
            <Stack.Screen name="(app)/index" options={{ headerShown: false }} />
            <Stack.Screen
              name="(storie)/index"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="(categories)/index"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="(categories-detail)/index"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="(subscribe)/index"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="(profile)/index"
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="(profile-adventure)/index"
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="(profile-result-adventure)/index"
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="(quiz)/index"
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="(memory-game)/index"
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="(terms-eula)/index"
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="(privacy-policy)/index"
              options={{ headerShown: false }}
            />

            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryClientProvider>
    </>
  );
}
