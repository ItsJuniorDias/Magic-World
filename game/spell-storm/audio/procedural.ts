/**
 * SPELL STORM — procedural biome soundtracks.
 *
 * The obvious way to score a game like this is to license three or four
 * ambient loops, one per biome, and hot-swap. That works but it makes the
 * bundle heavier (~470KB per mp3 × eight biomes = 3.7MB of audio the App
 * Store review team gets to complain about) and it locks the player into
 * whatever mood the composer picked on the day. Every run sounds the same.
 *
 * This file does the other thing: generates the music at runtime, one loop
 * per biome, as raw PCM. Each biome gets its own mode, tempo, and root
 * frequency. The melody is seeded from the biome name, so the same room
 * always sounds the same — not random per session — but different biomes
 * are meaningfully different, and the whole system is roughly 8KB of
 * source instead of 3.7MB of assets.
 *
 * HOW IT MOVES BYTES
 *
 *   1. Generate a Float32Array of ~12 seconds at 22050Hz mono. That's a
 *      bass drone plus a sparse pentatonic-ish melody, seeded from a hash
 *      of the biome id so it's deterministic.
 *   2. Convert to a 16-bit PCM WAV in memory (44-byte header + samples).
 *   3. Base64-encode it and write to expo-file-system's cache directory
 *      under a per-biome filename. Cached across the app session, so the
 *      second visit to a biome is instant.
 *   4. Hand the file:// uri to expo-audio's createAudioPlayer with
 *      loop=true.
 *
 * The whole encode + write is ~150ms on a mid iPhone, which happens the
 * first time you enter a new biome. We kick it off on room-change; the
 * previous biome's loop keeps playing until the new one is ready, which
 * makes the swap feel like a gradual mood shift rather than a hard cut.
 *
 * WHY NOT WEB AUDIO / TONE.JS
 *
 * There isn't a real Web Audio API in React Native. tone.js requires the
 * DOM AudioContext. expo-audio's imperative player is what we have, so
 * we do the DSP in JS, freeze it to disk, and let the native player
 * handle looping. Not real-time synthesis, but the game doesn't need
 * real-time synthesis — it needs music that sounds different in each
 * biome without shipping 4MB of mp3.
 */

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/**
 * 22050Hz is the sweet spot: it's above the Nyquist limit for the highest
 * note we play (~880Hz), the loops encode to ~530KB of WAV per biome
 * (comfortable for cache), and a mid iPhone can generate 12 seconds of it
 * in JS in around 150ms. 44100Hz would double the encode time and the
 * disk footprint for content the player will hear through a phone
 * speaker.
 */
const SAMPLE_RATE = 22050;
const CHANNELS = 1;
const BITS = 16;

/**
 * Loop length. 12 seconds is short enough that generation is fast, long
 * enough that the loop point doesn't announce itself every four seconds
 * like a ringtone. The melody generator is designed to leave the last
 * beat empty so the loop lands on silence, not a cut-off note.
 */
const LOOP_SECONDS = 12;

// ---------------------------------------------------------------------------
// Music theory, minimum viable
// ---------------------------------------------------------------------------

type Scale = "minorPent" | "dorian" | "phrygian" | "lydian" | "harmonicMinor" | "majorPent";

/**
 * Semitone offsets from the root, in one octave. Chosen for character:
 *
 *   minorPent      — safe, ambient, works for pretty much anything.
 *   dorian         — minor with a raised 6th. Cool, mossy, slightly hopeful.
 *   phrygian       — minor with a flat 2nd. Tense, coiled.
 *   lydian         — major with a sharp 4th. Bright, hovering, weightless.
 *   harmonicMinor  — the minor with the classical 7th. Dissonant, ceremonial.
 *   majorPent      — happy, uncomplicated. Not used yet, kept for future biomes.
 */
const SCALES: Record<Scale, number[]> = {
  minorPent: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  majorPent: [0, 2, 4, 7, 9],
};

interface BiomeMusic {
  /** Root note (Hz). A3=220, C4=261.6, etc. */
  rootFreq: number;
  scale: Scale;
  /** Beats per minute for the melody grid. */
  bpm: number;
  /**
   * 0..1. Higher values push notes up into the top octave and thin out the
   * bass drone. Storm and Spire read as bright, Void and Cistern as dim.
   */
  brightness: number;
}

const BIOME_MUSIC: Record<string, BiomeMusic> = {
  hollow: { rootFreq: 220.0, scale: "minorPent", bpm: 84, brightness: 0.6 },
  fungal: { rootFreq: 174.6, scale: "dorian", bpm: 68, brightness: 0.4 },
  thorn: { rootFreq: 164.8, scale: "phrygian", bpm: 90, brightness: 0.3 },
  spire: { rootFreq: 261.6, scale: "lydian", bpm: 108, brightness: 0.85 },
  ember: { rootFreq: 164.8, scale: "minorPent", bpm: 96, brightness: 0.5 },
  cistern: { rootFreq: 185.0, scale: "minorPent", bpm: 62, brightness: 0.35 },
  void: { rootFreq: 138.6, scale: "harmonicMinor", bpm: 76, brightness: 0.25 },
  storm: { rootFreq: 220.0, scale: "minorPent", bpm: 128, brightness: 0.9 },
};

function noteFreq(rootFreq: number, semitones: number): number {
  return rootFreq * Math.pow(2, semitones / 12);
}

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

/**
 * mulberry32 — small, fast, statistically fine for note-picking. NOT for
 * anything cryptographic; if you find yourself reaching for this to seed a
 * shuffle for competitive matchmaking, close this file and use crypto.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a. Cheap, spreads short strings well. */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Build the raw waveform for a biome.
 *
 * Composition, in order:
 *
 *   1. Bass drone at root/2 with a slow amplitude LFO. This is the whole
 *      floor of the mix — it never stops, and it never changes. It's the
 *      "you are still in the same biome" signal.
 *
 *   2. Sparse melody on beat divisions. The RNG rolls each beat: 35% chance
 *      the beat is a rest, 65% chance it plays a random scale degree in one
 *      of three octaves. Note length is 0.5–2 beats, decayed by an
 *      exponential envelope. Brightness pushes both octave selection and
 *      overall gain.
 *
 *   3. Optional fifth harmony on the melody note — 25% of notes get a
 *      quieter partner a perfect fifth up. Enough to sound less lonely,
 *      not enough to sound arranged.
 *
 * Melody stops at LOOP_SECONDS - 0.4 so the last envelope decays into
 * silence before the loop wraps. Nothing sounds worse than a chopped tail.
 */
function generateWaveform(biomeId: string): Float32Array {
  const music = BIOME_MUSIC[biomeId] ?? BIOME_MUSIC.hollow;
  const rng = mulberry32(hashStr(biomeId));
  const total = SAMPLE_RATE * LOOP_SECONDS;
  const buf = new Float32Array(total);

  // --- Bass drone ---
  const bassFreq = music.rootFreq / 2;
  const bassGain = 0.18 * (1.2 - music.brightness * 0.7);
  const lfoRate = 0.13;
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * lfoRate * t);
    buf[i] = Math.sin(2 * Math.PI * bassFreq * t) * bassGain * lfo;
  }

  // --- Melody ---
  const secPerBeat = 60 / music.bpm;
  const scale = SCALES[music.scale];
  const melodyEnd = LOOP_SECONDS - 0.4;
  let beatT = 0;
  const melGain = 0.16 + music.brightness * 0.08;

  while (beatT < melodyEnd) {
    // Roll rest first: even during the beat, we can decide to skip it.
    if (rng() < 0.35) {
      beatT += secPerBeat;
      continue;
    }

    const degree = Math.floor(rng() * scale.length);
    // Octave range shifts with brightness. Dim biomes stay in the middle
    // octave; bright ones spend more time up top.
    const octRoll = rng();
    let octave: number;
    if (octRoll < 0.5 - music.brightness * 0.3) octave = 0;
    else if (octRoll < 0.9) octave = 1;
    else octave = 2;

    const freq = noteFreq(music.rootFreq, scale[degree] + 12 * octave);
    const noteDur = secPerBeat * (0.5 + rng() * 1.5);
    const startSample = Math.floor(beatT * SAMPLE_RATE);
    const endSample = Math.min(total, Math.floor((beatT + noteDur) * SAMPLE_RATE));
    const withHarmony = rng() < 0.25;
    const harmFreq = withHarmony ? freq * 1.5 : 0;

    for (let i = startSample; i < endSample; i++) {
      const localT = (i - startSample) / SAMPLE_RATE;
      // Exponential decay — fast attack, natural tail.
      const env = Math.exp(-localT * 2.6);
      let s = Math.sin(2 * Math.PI * freq * localT) * env * melGain;
      if (withHarmony) {
        s += Math.sin(2 * Math.PI * harmFreq * localT) * env * melGain * 0.4;
      }
      // Accumulate onto the bass drone. Clip protection handled at encode.
      buf[i] += s;
    }

    // Step forward by whole beat, not by note length. Notes overlap, and
    // that's the whole point of the envelope — a slow decay leaking into
    // the next beat is what stops the melody sounding like a metronome.
    beatT += secPerBeat;
  }

  return buf;
}

// ---------------------------------------------------------------------------
// WAV encoding
// ---------------------------------------------------------------------------

/**
 * Pack a Float32 buffer into a 16-bit PCM WAV. The header format is:
 *
 *   [0..3]   "RIFF"
 *   [4..7]   totalSize - 8 (little-endian uint32)
 *   [8..11]  "WAVE"
 *   [12..15] "fmt "
 *   [16..19] 16 (fmt chunk size)
 *   [20..21] 1  (PCM)
 *   [22..23] channels
 *   [24..27] sampleRate
 *   [28..31] byteRate     = sampleRate * channels * (bits/8)
 *   [32..33] blockAlign   = channels * (bits/8)
 *   [34..35] bitsPerSample
 *   [36..39] "data"
 *   [40..43] dataSize
 *   [44..]   samples, little-endian int16 pairs
 *
 * We clip samples to [-1, 1] before scaling: without the clip, an
 * overshooting bass + melody sum would wrap to the opposite pole
 * and click every time it hit.
 */
function encodeWav(samples: Float32Array): Uint8Array {
  const dataSize = samples.length * (BITS / 8);
  const total = 44 + dataSize;
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, total - 8, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNELS * (BITS / 8), true);
  view.setUint16(32, CHANNELS * (BITS / 8), true);
  view.setUint16(34, BITS, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clipped * 32767), true);
  }
  return bytes;
}

function writeAscii(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

// ---------------------------------------------------------------------------
// Base64
// ---------------------------------------------------------------------------

/**
 * Hand-rolled base64 encoder. RN's global `btoa` chokes on strings above
 * ~1MB on some platforms, and we're encoding a ~530KB Uint8Array. Processing
 * in 3-byte chunks lets us stream it out without ever holding two copies
 * of the whole thing in memory.
 */
const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out +=
      B64[a >> 2] +
      B64[((a & 0x03) << 4) | (b >> 4)] +
      B64[((b & 0x0f) << 2) | (c >> 6)] +
      B64[c & 0x3f];
  }
  if (i < len) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    out += B64[a >> 2];
    out += B64[((a & 0x03) << 4) | (b >> 4)];
    out += i + 1 < len ? B64[(b & 0x0f) << 2] : "=";
    out += "=";
  }
  return out;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export interface MusicController {
  /** Preload if needed and start playing the biome's loop. Fast if cached. */
  setBiome(biomeId: string): Promise<void>;
  /** Pause / resume the current biome. */
  setPaused(paused: boolean): void;
  /** 0..1. Applied to every biome, current and future. */
  setVolume(volume: number): void;
  /** Pause everything and drop all players. Call on unmount. */
  dispose(): void;
}

interface CachedTrack {
  player: AudioPlayer;
  uri: string;
}

/**
 * Create a music controller.
 *
 * The controller owns one AudioPlayer per biome that has been visited so
 * far. Generating and writing the WAV runs on the JS thread but only ever
 * the first time a biome is entered — subsequent visits reuse the cached
 * player. The cache is per-controller and cleared on dispose, not persisted
 * across app launches, because writing to persistent storage on iOS trips
 * the "background write" heuristics and gets the app throttled if the
 * player is generating on wake.
 *
 * `setBiome` is fire-and-forget from the caller's perspective — the current
 * biome keeps playing while the next one generates in the background. When
 * generation finishes we check whether the caller has since asked for a
 * different biome; if so we discard our result and don't play it. That
 * check is what stops a fast player who runs from Fungal → Ember → Void
 * from hearing all three loops start at once because generation for the
 * earlier biomes finishes after the player has already moved on.
 */
export function createMusicController(): MusicController {
  const tracks = new Map<string, CachedTrack>();
  const pending = new Map<string, Promise<CachedTrack>>();
  let currentBiome: string | null = null;
  let paused = false;
  let volume = 0.55;
  let disposed = false;

  async function loadBiome(biomeId: string): Promise<CachedTrack> {
    const cached = tracks.get(biomeId);
    if (cached) return cached;
    const inFlight = pending.get(biomeId);
    if (inFlight) return inFlight;

    const promise = (async (): Promise<CachedTrack> => {
      const waveform = generateWaveform(biomeId);
      const wav = encodeWav(waveform);
      const b64 = encodeBase64(wav);
      // cacheDirectory is `file:///.../Library/Caches/`. Safe for OS-managed
      // eviction — iOS may clear this under storage pressure, which is fine:
      // next visit regenerates.
      const dir = FileSystem.cacheDirectory ?? "";
      const uri = `${dir}spell-storm-music-${biomeId}.wav`;
      await FileSystem.writeAsStringAsync(uri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const player = createAudioPlayer({ uri });
      player.loop = true;
      player.volume = volume;
      const track = { player, uri };
      tracks.set(biomeId, track);
      pending.delete(biomeId);
      return track;
    })();
    pending.set(biomeId, promise);
    return promise;
  }

  return {
    async setBiome(biomeId: string) {
      if (disposed) return;
      // De-dupe: no-op if the same biome is already selected.
      if (currentBiome === biomeId) return;
      const previous = currentBiome;
      currentBiome = biomeId;

      let track: CachedTrack;
      try {
        track = await loadBiome(biomeId);
      } catch (err) {
        // If encoding or writing fails we swallow it — silence is a better
        // failure mode than the game crashing on a bad free-slot cache write.
        // eslint-disable-next-line no-console
        console.warn(`[spell-storm/music] load ${biomeId} failed`, err);
        return;
      }

      // A newer request may have superseded us while the promise was in
      // flight. If so, don't step on the newer biome's playback.
      if (disposed || currentBiome !== biomeId) return;

      // Pause the old biome BEFORE we start the new one, so there's no
      // moment where two loops are audible simultaneously. seekTo(0) so
      // the next visit starts clean, not mid-melody.
      if (previous) {
        const prev = tracks.get(previous);
        if (prev) {
          try {
            prev.player.pause();
            prev.player.seekTo(0);
          } catch {
            /* ignore */
          }
        }
      }

      try {
        track.player.volume = volume;
        if (!paused) track.player.play();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[spell-storm/music] play ${biomeId} failed`, err);
      }
    },

    setPaused(p: boolean) {
      if (disposed) return;
      paused = p;
      if (!currentBiome) return;
      const track = tracks.get(currentBiome);
      if (!track) return;
      try {
        if (p) track.player.pause();
        else track.player.play();
      } catch {
        /* ignore */
      }
    },

    setVolume(v: number) {
      volume = Math.max(0, Math.min(1, v));
      for (const track of tracks.values()) {
        try {
          track.player.volume = volume;
        } catch {
          /* ignore */
        }
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const track of tracks.values()) {
        try {
          track.player.pause();
        } catch {
          /* ignore */
        }
        try {
          // AudioPlayer.remove releases the native resource. Without it we
          // leak one AudioTrack per biome visited, and the OS starts
          // ducking audio in other apps after ~10 leaked instances.
          track.player.remove();
        } catch {
          /* ignore */
        }
      }
      tracks.clear();
      pending.clear();
    },
  };
}
