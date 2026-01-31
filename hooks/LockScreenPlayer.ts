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
  currentIndex,
}: {
  title: string;
  artist: string;
  artwork?: string;
  url: any;
  volume?: number;
  currentIndex: number;
}) {
  // Setup inicial
  useEffect(() => {
    let playbackEndedListener: any;

    async function setupPlayer() {
      await TrackPlayer.setupPlayer();

      await TrackPlayer.updateOptions({
        stopWithApp: false,
        capabilities: [
          Capability.Play, 
          Capability.Pause, 
          Capability.Stop, 
          Capability.SkipToPrevious, 
          Capability.SkipToNext 
        ],
        compactCapabilities: [
          Capability.Play, 
          Capability.Pause,   
          Capability.Stop,     
          Capability.SkipToPrevious, 
          Capability.SkipToNext 
        ],
        alwaysShowNotification: true,
      });

      await TrackPlayer.add([{
        id: currentIndex.toString(),
        url,
        title,
        artist,
        artwork,
      } 
    ]);

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
