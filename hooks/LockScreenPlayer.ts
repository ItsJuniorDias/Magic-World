import TrackPlayer, {
  Capability,
  Event,
} from "react-native-track-player";
import { useEffect } from "react";

/**
 * Hook para controlar lock screen iOS
 */
export function useLockScreenPlayer({
  title,
  artist,
  artwork,
  url,
  volume = 0.08,
}: {
  title: string;
  artist: string;
  artwork?: string;
  url: any;
  volume?: number;
}) {
  // Setup inicial
  useEffect(() => {
    let playbackEndedListener: any;
    async function setupPlayer() {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        stopWithApp: false,
        capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
        compactCapabilities: [Capability.Play, Capability.Pause],
        alwaysShowNotification: true,
      });

      await TrackPlayer.add({
        id: "track",
        url,
        title,
        artist,
        artwork,
      });

      playbackEndedListener = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
        await TrackPlayer.seekTo(0);
        await TrackPlayer.play();
      });

      await TrackPlayer.setVolume(volume);
    }
    setupPlayer();

    return () => {
      if (playbackEndedListener && typeof playbackEndedListener.remove === "function") {
        playbackEndedListener.remove();
      }
      TrackPlayer.reset();
    };
  }, []);
  

  const play = async () => {
    const current = await TrackPlayer.getCurrentTrack();
    
    if (current == null) await TrackPlayer.skip("track");
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
