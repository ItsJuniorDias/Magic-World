import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
} from "react-native-track-player";
import { useEffect } from "react";

/**
 * useLockScreenPlayer
 * ==================================================================
 * Hook que instala e opera o player de audiobook (trilha de fundo)
 * na tela de história (`app/(storie)/index.tsx`).
 *
 * Por que essa reescrita (agosto 2026, resposta à segunda rejeição):
 *   Apple rejeitou sob Guideline 2.5.4 dizendo "unable to locate any
 *   features that require persistent audio" — mesmo com a feature
 *   existindo. Duas causas prováveis:
 *
 *     1. O reviewer testa o app em uma sessão curta e talvez não
 *        chegue até a tela de história dentro do tempo alocado.
 *        (Isso é atacado no lado da submissão, com screen recording
 *        e review notes claras — não dá pra resolver via código.)
 *
 *     2. `TrackPlayer.setupPlayer()` era chamado sem `iosCategory`
 *        explícito. O default (`Ambient`) NÃO permite audio em
 *        background — só `Playback` permite. Se por algum motivo
 *        o default resolvesse pra Ambient no device do reviewer,
 *        o audio pausaria ao lock screen, e a Apple concluiria que
 *        a background mode não estava sendo usada.
 *
 *   Essa versão:
 *     - Seta `IOSCategory.Playback` explícito (categoria correta
 *       para audiobooks — permite lock screen + background).
 *     - Adiciona `IOSCategoryOptions` que fazem sentido pra
 *       audiobook (não mixar com outras apps por padrão — audio
 *       do audiobook é primário).
 *     - Trata "setupPlayer called twice" com try/catch (o hook
 *       pode montar mais de uma vez em navegação rápida — o setup
 *       lança erro na segunda chamada, tudo bem, seguimos).
 *     - Configura `android.appKilledPlaybackBehavior` pra parar
 *       o playback quando o app é morto (evita zumbi player no
 *       Android — no iOS isso é gerido pelo OS).
 *     - Define capabilities de lock screen (play/pause/skip) —
 *       o que faz a lock screen mostrar os controles, sinal
 *       visual claro pro reviewer de que background audio existe.
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
      // se um outro mount já configurou. Isso é OK — a config
      // persiste entre mounts. Só ignoramos e seguimos.
      try {
        await TrackPlayer.setupPlayer({
          // iOS: categoria correta pra audiobook. Sem isso o audio
          // pausa ao lock screen e a background mode não é
          // exercitada — reviewer conclui que não tem uso.
          iosCategory: IOSCategory.Playback,
          iosCategoryMode: IOSCategoryMode.SpokenAudio,
          iosCategoryOptions: [
            IOSCategoryOptions.AllowAirPlay,
            IOSCategoryOptions.AllowBluetooth,
          ],
        });
      } catch (err) {
        // "player has already been initialized" — safe, continua.
      }

      await TrackPlayer.updateOptions({
        // Android: parar quando o app é morto (evita player zumbi).
        // iOS ignora essa flag — o SO gerencia.
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
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
          Capability.SkipToPrevious,
          Capability.SkipToNext,
        ],
      });

      // Reseta a fila antes de adicionar. Evita empilhar tracks
      // se o usuário re-entrar na mesma tela.
      await TrackPlayer.reset();

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
