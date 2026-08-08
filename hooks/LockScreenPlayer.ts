import TrackPlayer, {
  Capability,
  Event,
  IOSCategory,
} from "react-native-track-player";
import { useCallback, useEffect } from "react";

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

// [MW-DEBUG] build tag — deve aparecer uma vez ao carregar o app.
console.log("[MW-DEBUG-BUILD-TAG] LockScreenPlayer r5 loaded");

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
      console.log("[MW-DEBUG] LockScreenPlayer:setup:start", {
        currentIndex,
        title,
        urlType: typeof url,
      });

      // setupPlayer pode lançar "player has already been initialized"
      // se um mount anterior já configurou. A config persiste entre
      // mounts, então ignorar é seguro.
      try {
        await TrackPlayer.setupPlayer({
          // iOS: única opção necessária pra background audio funcionar.
          // Sem isso o default é `Ambient`, que pausa no lock screen.
          iosCategory: IOSCategory.Playback,
        });
        console.log("[MW-DEBUG] LockScreenPlayer:setupPlayer OK");
      } catch (err: any) {
        // "player has already been initialized" — safe, continua.
        console.log("[MW-DEBUG] LockScreenPlayer:setupPlayer CAUGHT", {
          msg: err?.message ?? String(err),
        });
      }

      try {
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
        console.log("[MW-DEBUG] LockScreenPlayer:updateOptions OK");
      } catch (err: any) {
        console.log("[MW-DEBUG] LockScreenPlayer:updateOptions THREW", {
          msg: err?.message ?? String(err),
        });
      }

      try {
        await TrackPlayer.add([
          {
            id: currentIndex.toString(),
            url,
            title,
            artist,
            artwork,
          },
        ]);
        const queue = await TrackPlayer.getQueue();
        console.log("[MW-DEBUG] LockScreenPlayer:add OK", {
          queueLen: queue.length,
        });
      } catch (err: any) {
        console.log("[MW-DEBUG] LockScreenPlayer:add THREW", {
          msg: err?.message ?? String(err),
        });
      }

      playbackEndedListener = TrackPlayer.addEventListener(
        Event.PlaybackQueueEnded,
        async () => {
          console.log(
            "[MW-DEBUG] LockScreenPlayer:PlaybackQueueEnded — looping",
          );
          await TrackPlayer.seekTo(0);
          await TrackPlayer.play();
        },
      );

      await TrackPlayer.setVolume(volume);
      console.log("[MW-DEBUG] LockScreenPlayer:setup:done");
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

  // IMPORTANTE: essas 3 funções PRECISAM ser estáveis entre renders.
  // A tela `(storie)` usa `stop` como dep do `useFocusEffect`. Se a
  // referência mudar a cada render, o useFocusEffect dispara
  // cleanup a cada re-render — o que chama `stopAllAudio` no meio
  // do handleSpeak e derruba a sessão em curso (session_mismatch).
  const play = useCallback(async () => {
    await TrackPlayer.play();
  }, []);

  const pause = useCallback(async () => {
    await TrackPlayer.pause();
  }, []);

  const stop = useCallback(async () => {
    await TrackPlayer.stop();
  }, []);

  return { play, pause, stop };
}
