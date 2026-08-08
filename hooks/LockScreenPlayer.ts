import TrackPlayer, {
  Capability,
  Event,
  IOSCategory,
} from "react-native-track-player";
import { useEffect } from "react";

/**
 * useLockScreenPlayer
 * ==================================================================
 * Hook que instala e opera o player de trilha de fundo na tela de
 * história (`app/(storie)/index.tsx`).
 *
 * Diff vs versão original (agosto 2026, fix pra Guideline 2.5.4):
 *   ÚNICA mudança funcional: adiciona `iosCategory: IOSCategory.Playback`
 *   no `setupPlayer`. Sem isso, o default do TrackPlayer (`Ambient`)
 *   pausa o áudio ao lock screen — a background mode declarada no
 *   Info.plist nunca é exercitada e a Apple conclui que não tem uso.
 *
 *   NADA MAIS foi mudado. Especificamente NÃO usamos:
 *     - `iosCategoryMode: SpokenAudio` — conflita com `expo-speech`
 *       (AVSpeechSynthesizer), silenciando a narração TTS quando
 *       ambos rodam em paralelo. Play do botão parava de funcionar.
 *     - `TrackPlayer.reset()` antes do primeiro `add` no setup —
 *       cria janela de race com `handleSpeak` que roda em paralelo
 *       pelo `useEffect` da tela `(storie)`.
 *
 *   Se a rejeição 2.5.4 continuar apesar disso, resolver via screen
 *   recording + review notes, NÃO adicionando mais opções aqui.
 *
 * IMPORTANTE:
 *   O playback service em `services/trackPlayer.ts` é registrado
 *   no `_layout.tsx` (top-level, uma vez só). Aqui só operamos.
 */

type Params = {
  title: string;
  artist: string;
  artwork?: string;
  url: any;
  volume?: number;
  currentIndex: number;
};

export function useLockScreenPlayer({
  title,
  artist,
  artwork,
  url,
  volume = 0.08,
  currentIndex,
}: Params) {
  useEffect(() => {
    let playbackEndedListener: any;

    async function setupPlayer() {
      // setupPlayer pode lançar "player has already been initialized"
      // se um mount anterior já configurou. A config persiste entre
      // mounts, então ignorar é seguro.
      try {
        await TrackPlayer.setupPlayer({
          // iOS: única opção necessária pra background audio funcionar.
          // Sem isso o default é `Ambient`, que pausa no lock screen.
          iosCategory: IOSCategory.Playback,
        });
      } catch (err) {
        // "player has already been initialized" — safe, continua.
      }

      await TrackPlayer.updateOptions({
        stopWithApp: false,
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SkipToPrevious,
          Capability.SkipToNext,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SkipToPrevious,
          Capability.SkipToNext,
        ],
        alwaysShowNotification: true,
      });

      await TrackPlayer.add([
        {
          id: currentIndex.toString(),
          url,
          title,
          artist,
          artwork,
        },
      ]);

      playbackEndedListener = TrackPlayer.addEventListener(
        Event.PlaybackQueueEnded,
        async () => {
          await TrackPlayer.seekTo(0);
          await TrackPlayer.play();
        },
      );

      await TrackPlayer.setVolume(volume);
    }

    setupPlayer();

    return () => {
      if (
        playbackEndedListener &&
        typeof playbackEndedListener.remove === "function"
      ) {
        playbackEndedListener.remove();
      }
      TrackPlayer.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = async () => {
    await TrackPlayer.play();
  };

  const pause = async () => {
    await TrackPlayer.pause();
  };

  const stop = async () => {
    await TrackPlayer.stop();
  };

  return { play, pause, stop };
}
