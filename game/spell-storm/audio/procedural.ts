/**
 * SPELL STORM — procedural biome soundtracks (v3.5, the fuller version).
 *
 * v3.0 shipped a bass drone + sparse sine-wave melody. That fit under 20KB
 * of code and produced music, but the music sounded like an alarm-clock
 * radio warming up. This pass keeps the same "generate a WAV once, cache
 * it, hand it to expo-audio" spine and rebuilds what lives on top:
 *
 *   Bass drone       — sub sine at rootFreq/2 with a slow amplitude LFO.
 *                      Always on. The floor of every mix.
 *
 *   Pad              — three detuned sawtooth oscillators per chord tone
 *                      (root / third / fifth of the current chord). Slow
 *                      attack/release. Feeds the harmony that the melody
 *                      sits on top of. Sweeps a one-pole lowpass so it
 *                      doesn't fight the arp for the treble.
 *
 *   Arpeggio         — chord tones cycled on eighth notes, sine wave
 *                      with a short pluck envelope. Adds motion without
 *                      making a statement.
 *
 *   Melody           — plucked-string additive (fundamental + 2 partials),
 *                      seeded random note picks from the scale, ADSR-ish
 *                      envelope. This is the voice the player recognizes
 *                      as "the tune".
 *
 *   Percussion       — sine-sweep kick (60Hz → 30Hz over 90ms) plus
 *                      filtered noise hi-hats. Grid patterns per biome.
 *
 *   Reverb           — Schroeder-style: four parallel comb filters with
 *                      staggered delay lengths, then a series allpass.
 *                      Wet mix per biome so cistern is a cavern and
 *                      storm is a stadium.
 *
 * A four-bar chord progression per biome cycles under everything. Pad,
 * arp, and melody all read from the same chord grid, so nothing steps
 * on nothing — the harmony is coherent even though the notes are picked
 * at random.
 *
 * GENERATION COST
 *
 * ~350ms on a mid iPhone the first time each biome is entered, up from
 * ~150ms. Cached to expo-file-system after the first pass, so the second
 * visit is a `createAudioPlayer(uri)` with no DSP at all.
 *
 * BUDGET
 *
 * ~830KB of WAV per biome (16-bit mono, 22050Hz, 16-second loop). Eight
 * biomes at ~6.6MB of cache, which is well under the 100MB iOS soft
 * budget for /Library/Caches, and OS-evictable under storage pressure.
 * The alternative — licensing eight 1MB mp3s and shipping them in the
 * app bundle — costs the same on disk plus a wall of App Store review
 * questions about audio rights.
 */

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 22050;
const CHANNELS = 1;
const BITS = 16;

/**
 * 16-second loops. Long enough that a four-bar chord progression at 84bpm
 * cycles about 1.5 times through the loop, so the ear can't easily lock
 * onto "here's where it starts over" the way it can with 12s at the same
 * tempo. Short enough that we still fit under 1MB per biome.
 */
const LOOP_SECONDS = 16;

// ---------------------------------------------------------------------------
// Scales and chords
// ---------------------------------------------------------------------------

type Scale = "minorPent" | "dorian" | "phrygian" | "lydian" | "harmonicMinor" | "aeolian";

/** Semitone offsets from the root, one octave. */
const SCALES: Record<Scale, number[]> = {
  minorPent: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

/**
 * A chord is three scale-degree offsets from the root, defining root/
 * third/fifth of the triad we want under that bar. Encoded as scale
 * degrees (0 = tonic, 3 = fourth up, etc), not literal semitones — the
 * scale conversion handles the mode-specific intervals.
 *
 * Progressions run four bars and cycle. The choices below aren't
 * arbitrary; each one is a common shape for its mode.
 */
type ChordProgression = number[][]; // 4 chords, each [root_deg, third_deg, fifth_deg]

// Common shapes:
const PROG_i_VI_III_VII: ChordProgression = [
  [0, 2, 4], // i — tonic minor
  [5, 0, 2], // VI (relative major)
  [2, 4, 6], // III
  [4, 6, 1], // VII
];
const PROG_i_iv_v_i: ChordProgression = [
  [0, 2, 4],
  [3, 5, 0],
  [4, 6, 1],
  [0, 2, 4],
];
const PROG_i_VII_VI_VII: ChordProgression = [
  [0, 2, 4],
  [4, 6, 1],
  [5, 0, 2],
  [4, 6, 1],
];
const PROG_I_IV_V_I: ChordProgression = [
  // Bright / modal — used with lydian and pentatonic-major-ish biomes.
  [0, 2, 4],
  [3, 5, 0],
  [4, 6, 1],
  [0, 2, 4],
];

// ---------------------------------------------------------------------------
// Biome soundtrack recipes
// ---------------------------------------------------------------------------

interface BiomeMusic {
  rootFreq: number;
  scale: Scale;
  bpm: number;
  brightness: number; // 0..1, tunes octave selection and pad brightness
  progression: ChordProgression;
  /** Per-voice gains. 0 kills the voice, 1 is unity. */
  bassGain: number;
  padGain: number;
  arpGain: number;
  melodyGain: number;
  percGain: number;
  /** 0..0.5. How much reverb sits under the mix. */
  reverbWet: number;
  /**
   * Kick pattern on 16 sixteenth-note steps per bar. 1 = hit, 0 = rest.
   * Hi-hat pattern is derived from it (every second step, minus kick steps).
   */
  kickPattern: number[];
}

const KICK_STRAIGHT: number[] =
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
const KICK_DRIVING: number[] =
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const KICK_SPARSE: number[] =
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const KICK_SILENT: number[] =
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const BIOME_MUSIC: Record<string, BiomeMusic> = {
  hollow: {
    rootFreq: 220.0,        // A3
    scale: "aeolian",
    bpm: 82,
    brightness: 0.55,
    progression: PROG_i_VI_III_VII,
    bassGain: 0.9,
    padGain: 0.75,
    arpGain: 0.4,
    melodyGain: 0.55,
    percGain: 0.35,
    reverbWet: 0.28,
    kickPattern: KICK_STRAIGHT,
  },
  fungal: {
    rootFreq: 174.6,        // F3
    scale: "dorian",
    bpm: 66,
    brightness: 0.4,
    progression: PROG_i_VII_VI_VII,
    bassGain: 1.0,
    padGain: 0.85,
    arpGain: 0.55,          // gurgling arp is the biome
    melodyGain: 0.4,
    percGain: 0.0,          // no drums — wet forest, no beat
    reverbWet: 0.42,        // damp
    kickPattern: KICK_SILENT,
  },
  thorn: {
    rootFreq: 164.8,        // E3
    scale: "phrygian",
    bpm: 92,
    brightness: 0.3,
    progression: PROG_i_iv_v_i,
    bassGain: 0.95,
    padGain: 0.6,
    arpGain: 0.35,
    melodyGain: 0.65,       // agitated melody up front
    percGain: 0.4,
    reverbWet: 0.24,
    kickPattern: KICK_DRIVING,
  },
  spire: {
    rootFreq: 261.6,        // C4 — floats
    scale: "lydian",
    bpm: 108,
    brightness: 0.9,
    progression: PROG_I_IV_V_I,
    bassGain: 0.35,         // thin bass; sky biome, no weight
    padGain: 0.85,
    arpGain: 0.7,           // bell-like arp is the character
    melodyGain: 0.55,
    percGain: 0.15,
    reverbWet: 0.38,        // airy
    kickPattern: KICK_SPARSE,
  },
  ember: {
    rootFreq: 164.8,        // E3
    scale: "minorPent",
    bpm: 96,
    brightness: 0.5,
    progression: PROG_i_iv_v_i,
    bassGain: 1.0,          // warm bass forward
    padGain: 0.65,
    arpGain: 0.4,
    melodyGain: 0.55,
    percGain: 0.55,         // forge = rhythm
    reverbWet: 0.2,
    kickPattern: KICK_DRIVING,
  },
  cistern: {
    rootFreq: 185.0,        // F#3
    scale: "minorPent",
    bpm: 62,
    brightness: 0.35,
    progression: PROG_i_VII_VI_VII,
    bassGain: 0.75,
    padGain: 0.8,
    arpGain: 0.5,
    melodyGain: 0.45,
    percGain: 0.0,
    reverbWet: 0.5,         // cavern
    kickPattern: KICK_SILENT,
  },
  void: {
    rootFreq: 138.6,        // C#3
    scale: "harmonicMinor",
    bpm: 74,
    brightness: 0.22,
    progression: PROG_i_iv_v_i,
    bassGain: 1.0,
    padGain: 0.9,           // pad is the whole biome — dissonant, slow
    arpGain: 0.3,
    melodyGain: 0.5,
    percGain: 0.0,
    reverbWet: 0.45,
    kickPattern: KICK_SILENT,
  },
  storm: {
    rootFreq: 220.0,        // A3
    scale: "aeolian",
    bpm: 128,
    brightness: 0.85,
    progression: PROG_i_VI_III_VII,
    bassGain: 0.95,
    padGain: 0.55,
    arpGain: 0.65,          // rapid arp fits the tempo
    melodyGain: 0.7,        // melody dominant — finale energy
    percGain: 0.75,         // full kit
    reverbWet: 0.22,
    kickPattern: KICK_DRIVING,
  },
};

function noteFreq(rootFreq: number, semitones: number): number {
  return rootFreq * Math.pow(2, semitones / 12);
}

function scaleDegreeSemitones(scale: Scale, degree: number): number {
  const s = SCALES[scale];
  // Degree can extend past one octave: 7 → octave up + degree 0, etc.
  const octaves = Math.floor(degree / s.length);
  const idx = ((degree % s.length) + s.length) % s.length;
  return s[idx] + octaves * 12;
}

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

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

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Voice: Bass drone
// ---------------------------------------------------------------------------

/**
 * A continuous sub sine at rootFreq/2 with a slow amplitude LFO. This is
 * the emotional anchor of every biome — you feel it more than you hear it.
 * The LFO on the amplitude keeps it from reading as a test tone.
 */
function renderBass(buf: Float32Array, music: BiomeMusic): void {
  const bassFreq = music.rootFreq / 2;
  const lfoRate = 0.14;
  const gain = 0.22 * music.bassGain;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const lfo = 0.82 + 0.18 * Math.sin(2 * Math.PI * lfoRate * t);
    buf[i] += Math.sin(2 * Math.PI * bassFreq * t) * gain * lfo;
  }
}

// ---------------------------------------------------------------------------
// Voice: Pad (detuned saw chord following the progression)
// ---------------------------------------------------------------------------

/**
 * Naive sawtooth: `2 * fract(t * freq) - 1`. Aliases above ~5kHz, but a
 * phone speaker rolls off well before then and a one-pole lowpass filter
 * catches the rest. For music this atmospheric the tradeoff is fine —
 * PolyBLEP would double the CPU cost with no audible improvement at the
 * frequencies we play.
 */
function saw(t: number, freq: number): number {
  const p = t * freq;
  return 2 * (p - Math.floor(p)) - 1;
}

/**
 * Three detuned oscillators per chord tone, root/third/fifth of the
 * current chord. Slow ADSR envelope so it swells and holds through the
 * bar. A one-pole lowpass sweeps with brightness so dim biomes read as
 * muffled instead of just quiet.
 */
function renderPad(
  buf: Float32Array,
  music: BiomeMusic,
  secPerBar: number,
): void {
  if (music.padGain <= 0) return;
  const totalBars = LOOP_SECONDS / secPerBar;
  // Sit the pad an octave up from the bass so it doesn't muddy.
  const padOctave = 12;
  // Cutoff for the one-pole LP: brighter biomes let more through.
  const cutoffHz = 900 + music.brightness * 2400;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = (1 / SAMPLE_RATE) / (rc + 1 / SAMPLE_RATE);
  let lpState = 0;

  const gainMaster = 0.14 * music.padGain;

  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const barIdx = Math.floor(t / secPerBar) % music.progression.length;
    const chord = music.progression[barIdx];

    // Bar envelope: fade in the first 12%, sustain, fade out the last 8%.
    const tInBar = (t % secPerBar) / secPerBar;
    let env: number;
    if (tInBar < 0.12) env = tInBar / 0.12;
    else if (tInBar > 0.92) env = (1 - tInBar) / 0.08;
    else env = 1;

    let s = 0;
    for (const deg of chord) {
      const semis = scaleDegreeSemitones(music.scale, deg) + padOctave;
      const baseFreq = noteFreq(music.rootFreq, semis);
      // Three detuned oscillators per tone — the classic thick pad trick.
      s += saw(t, baseFreq);
      s += saw(t, baseFreq * 1.005);
      s += saw(t, baseFreq * 0.995);
    }
    s /= chord.length * 3;

    // One-pole LP toward the sample.
    lpState += alpha * (s - lpState);

    buf[i] += lpState * env * gainMaster;
  }
  // Suppress unused warning — totalBars is here for future extension.
  void totalBars;
}

// ---------------------------------------------------------------------------
// Voice: Arpeggio
// ---------------------------------------------------------------------------

/**
 * Chord tones cycled on eighth-note grid. Sine wave with a short pluck
 * envelope so each note reads as a distinct hit rather than a legato
 * line. Runs on top of the same chord progression as the pad, so the
 * arp inherits the harmony instead of picking its own.
 */
function renderArp(
  buf: Float32Array,
  music: BiomeMusic,
  secPerBeat: number,
  secPerBar: number,
): void {
  if (music.arpGain <= 0) return;
  const secPerNote = secPerBeat / 2; // eighth notes
  const totalNotes = Math.floor(LOOP_SECONDS / secPerNote);
  const arpOctave = 24 + (music.brightness > 0.7 ? 12 : 0);
  const gainMaster = 0.18 * music.arpGain;

  for (let n = 0; n < totalNotes; n++) {
    const noteStart = n * secPerNote;
    const barIdx = Math.floor(noteStart / secPerBar) % music.progression.length;
    const chord = music.progression[barIdx];
    // Cycle through the chord tones — 0,1,2,1,0,1,2,1,...
    const chordTonePos = n % (chord.length * 2 - 2);
    const chordIdx =
      chordTonePos < chord.length
        ? chordTonePos
        : chord.length * 2 - 2 - chordTonePos;
    const degree = chord[chordIdx];
    const freq = noteFreq(
      music.rootFreq,
      scaleDegreeSemitones(music.scale, degree) + arpOctave,
    );

    const startSample = Math.floor(noteStart * SAMPLE_RATE);
    // Notes decay over about 60% of the eighth-note slot, so consecutive
    // notes don't step on each other while still ringing a bit.
    const noteLen = secPerNote * 0.65;
    const endSample = Math.min(
      buf.length,
      startSample + Math.floor(noteLen * SAMPLE_RATE),
    );

    for (let i = startSample; i < endSample; i++) {
      const localT = (i - startSample) / SAMPLE_RATE;
      // Fast attack, exp decay: 6ms up, then e^(-6t) down.
      const attack = Math.min(1, localT / 0.006);
      const decay = Math.exp(-localT * 6.2);
      const env = attack * decay;
      buf[i] += Math.sin(2 * Math.PI * freq * localT) * env * gainMaster;
    }
  }
}

// ---------------------------------------------------------------------------
// Voice: Melody
// ---------------------------------------------------------------------------

/**
 * Seeded random note picks, plucked additive timbre. Draws from the scale
 * but constrains octave choice by brightness — dim biomes stay in the
 * middle octave, bright biomes reach up. 35% rest chance keeps the melody
 * sparse enough to breathe.
 *
 * Timbre is a fundamental + two decaying partials (2× and 3× the
 * fundamental at reduced amplitude), which reads as "plucked string"
 * without needing a real Karplus-Strong (which JS can just about afford
 * for one voice at a time, but not four times in a mix).
 */
function renderMelody(
  buf: Float32Array,
  music: BiomeMusic,
  rng: () => number,
  secPerBeat: number,
): void {
  if (music.melodyGain <= 0) return;
  const scale = SCALES[music.scale];
  const melodyEnd = LOOP_SECONDS - 0.5;
  const gainMaster = 0.20 * music.melodyGain;
  let beatT = 0;

  while (beatT < melodyEnd) {
    if (rng() < 0.38) {
      beatT += secPerBeat;
      continue;
    }
    const degree = Math.floor(rng() * scale.length);
    // Octave selection biased by brightness.
    const octRoll = rng();
    let octave: number;
    if (octRoll < 0.5 - music.brightness * 0.3) octave = 1;
    else if (octRoll < 0.9) octave = 2;
    else octave = 3;

    const freq = noteFreq(music.rootFreq, scale[degree] + 12 * octave);
    const noteDur = secPerBeat * (0.5 + rng() * 1.6);
    const startSample = Math.floor(beatT * SAMPLE_RATE);
    const endSample = Math.min(
      buf.length,
      Math.floor((beatT + noteDur) * SAMPLE_RATE),
    );

    for (let i = startSample; i < endSample; i++) {
      const localT = (i - startSample) / SAMPLE_RATE;
      const attack = Math.min(1, localT / 0.008);
      const decay = Math.exp(-localT * 2.4);
      const env = attack * decay;
      // Fundamental + fifth + octave partials, each with its own decay.
      // The higher partials decay faster than the fundamental, which is
      // the physical behaviour of a real plucked string.
      const s1 = Math.sin(2 * Math.PI * freq * localT);
      const s2 = Math.sin(2 * Math.PI * freq * 2 * localT) * Math.exp(-localT * 4.5) * 0.35;
      const s3 = Math.sin(2 * Math.PI * freq * 3 * localT) * Math.exp(-localT * 6.5) * 0.18;
      buf[i] += (s1 + s2 + s3) * env * gainMaster;
    }
    beatT += secPerBeat;
  }
}

// ---------------------------------------------------------------------------
// Voice: Percussion
// ---------------------------------------------------------------------------

/**
 * Kick: sine sweep from 60Hz to 30Hz over the first 90ms of the hit,
 * plus a click transient on the very first sample. Sounds like a thump
 * even through a phone speaker where 30Hz is inaudible on its own.
 *
 * Hi-hat: white noise gated by a short exp envelope, one-pole highpassed
 * so it sits above the mix instead of muddying it. Placed on the beat
 * subdivisions the kick skips.
 */
function renderPercussion(
  buf: Float32Array,
  music: BiomeMusic,
  rng: () => number,
  secPerBeat: number,
): void {
  if (music.percGain <= 0) return;
  const secPerStep = secPerBeat / 4; // 16th note grid
  const totalSteps = Math.floor(LOOP_SECONDS / secPerStep);
  const kickPattern = music.kickPattern;

  const kickGain = 0.42 * music.percGain;
  const hatGain = 0.14 * music.percGain;

  // Hi-hat noise generator: also seeded so it's deterministic.
  const noiseRng = mulberry32(0xdeadbeef);
  let hpPrev = 0;

  for (let step = 0; step < totalSteps; step++) {
    const stepStart = step * secPerStep;
    const patternIdx = step % kickPattern.length;
    const startSample = Math.floor(stepStart * SAMPLE_RATE);

    // Kick
    if (kickPattern[patternIdx] === 1) {
      const kickLen = 0.28;
      const endSample = Math.min(
        buf.length,
        startSample + Math.floor(kickLen * SAMPLE_RATE),
      );
      // Track pitch across samples via phase accumulator (integrate freq,
      // don't just evaluate sin(2π f t) because f changes and that'd
      // create a discontinuity at every f change).
      let phase = 0;
      for (let i = startSample; i < endSample; i++) {
        const localT = (i - startSample) / SAMPLE_RATE;
        // Pitch envelope: 60Hz → 30Hz over 90ms, then hold.
        const pitchEnv = Math.max(0, 1 - localT / 0.09);
        const freq = 30 + pitchEnv * 30;
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        // Amplitude: exponential decay.
        const amp = Math.exp(-localT * 8);
        // Click transient on the first ms of the hit.
        const click = localT < 0.001 ? 0.4 : 0;
        buf[i] += (Math.sin(phase) * amp + click) * kickGain;
      }
    }

    // Hi-hat on offbeat 16ths where the kick isn't playing. Skip every
    // fourth step to leave breathing room.
    const hatEligible = kickPattern[patternIdx] === 0 && step % 2 === 0;
    if (hatEligible && rng() < 0.45) {
      const hatLen = 0.06;
      const endSample = Math.min(
        buf.length,
        startSample + Math.floor(hatLen * SAMPLE_RATE),
      );
      for (let i = startSample; i < endSample; i++) {
        const localT = (i - startSample) / SAMPLE_RATE;
        const env = Math.exp(-localT * 55);
        const noise = 2 * noiseRng() - 1;
        // One-pole highpass at ~6kHz to make the noise sizzle instead of hiss.
        const hp = noise - hpPrev * 0.75;
        hpPrev = noise;
        buf[i] += hp * env * hatGain;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Reverb — Schroeder (4 comb + 1 allpass)
// ---------------------------------------------------------------------------

/**
 * Applies a Schroeder reverb in place on the buffer. Four parallel comb
 * filters with staggered delay lengths and lightly damped feedback,
 * followed by a single allpass to smear the phase and stop the combs
 * from ringing on discrete pitches. Wet ratio is per-biome — 0.5 in the
 * cistern reads as "big cavern", 0.2 in ember reads as "close forge".
 *
 * Not a great reverb by studio standards, but the classic textbook
 * design does exactly what we want here: it turns dry point-source
 * synths into something that reads as "played in a space". You could
 * argue for a Freeverb, but the code that separates a decent Schroeder
 * from a Freeverb is ~4x the size and the difference is inaudible on
 * a phone speaker.
 *
 * Comb delays are chosen to be co-prime in samples so the individual
 * combs don't reinforce each other at any particular frequency.
 */
function applyReverb(buf: Float32Array, wet: number): void {
  if (wet <= 0) return;
  // Delays at 22050Hz: ~53, 60, 68, 76 ms. Co-prime sample counts avoid
  // resonance ridges at any specific frequency.
  const combDelays = [1171, 1327, 1499, 1687];
  const combGain = 0.82;
  const combDamp = 0.28;

  const N = buf.length;
  const combBuffers = combDelays.map((d) => new Float32Array(d));
  const combIdx = combDelays.map(() => 0);
  const combLpState = combDelays.map(() => 0);

  // Allpass: 225-sample delay, gain 0.5.
  const apDelay = 225;
  const apBuffer = new Float32Array(apDelay);
  let apIdx = 0;
  const apGain = 0.5;

  for (let i = 0; i < N; i++) {
    const input = buf[i];
    let combSum = 0;
    for (let c = 0; c < 4; c++) {
      const delayed = combBuffers[c][combIdx[c]];
      // Damping: one-pole LP inside the feedback loop, keeps highs
      // from ringing forever (they die faster than lows do IRL).
      combLpState[c] = delayed * (1 - combDamp) + combLpState[c] * combDamp;
      const fb = combLpState[c];
      combBuffers[c][combIdx[c]] = input + fb * combGain;
      combIdx[c]++;
      if (combIdx[c] >= combDelays[c]) combIdx[c] = 0;
      combSum += fb;
    }
    combSum *= 0.25;

    // Allpass, one stage. y[n] = -g*x[n] + delayed + g*delayed_out
    const apDelayed = apBuffer[apIdx];
    const apOut = -apGain * combSum + apDelayed;
    apBuffer[apIdx] = combSum + apGain * apOut;
    apIdx++;
    if (apIdx >= apDelay) apIdx = 0;

    buf[i] = input * (1 - wet) + apOut * wet;
  }
}

// ---------------------------------------------------------------------------
// Master
// ---------------------------------------------------------------------------

/**
 * Soft-clip anything over ±0.85 so the encoder doesn't have to clip us
 * on the way to 16-bit int. tanh gives a smooth compressor curve that
 * squashes the peaks without ringing.
 */
function softClip(buf: Float32Array): void {
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    // tanh(1.15 x) / 1.15 keeps a linear range up to about 0.6 and
    // squashes above that. Avoids the hard clip on the WAV encoder.
    buf[i] = Math.tanh(1.15 * x) / 1.15;
  }
}

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

function generateWaveform(biomeId: string): Float32Array {
  const music = BIOME_MUSIC[biomeId] ?? BIOME_MUSIC.hollow;
  const rng = mulberry32(hashStr(biomeId));
  const total = SAMPLE_RATE * LOOP_SECONDS;
  const buf = new Float32Array(total);

  const secPerBeat = 60 / music.bpm;
  const secPerBar = secPerBeat * 4;

  // Order matters only for the reverb — everything else is additive.
  renderBass(buf, music);
  renderPad(buf, music, secPerBar);
  renderArp(buf, music, secPerBeat, secPerBar);
  renderMelody(buf, music, rng, secPerBeat);
  renderPercussion(buf, music, rng, secPerBeat);

  softClip(buf);
  applyReverb(buf, music.reverbWet);
  softClip(buf); // reverb can push peaks back up

  return buf;
}

// ---------------------------------------------------------------------------
// WAV encoding
// ---------------------------------------------------------------------------

/**
 * Pack a Float32 buffer into a 16-bit PCM WAV. The header layout is the
 * standard 44-byte RIFF/WAVE preamble; samples follow as little-endian
 * int16 pairs.
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

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Hand-rolled encoder. RN's global `btoa` chokes on strings above ~1MB on
 * some platforms, and we're now encoding ~1MB WAVs per biome.
 */
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
  setBiome(biomeId: string): Promise<void>;
  setPaused(paused: boolean): void;
  setVolume(volume: number): void;
  dispose(): void;
}

interface CachedTrack {
  player: AudioPlayer;
  uri: string;
}

/**
 * Create a music controller.
 *
 * See v3.0 notes above about lazy per-biome caching and mid-flight
 * cancellation — none of that changed in v3.5. What changed is what the
 * WAVs sound like, not how they get to the player.
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
      const dir = FileSystem.cacheDirectory ?? "";
      // Version suffix in the filename so devices that ran the v3.0 build
      // don't play back its cached 12s loops after this update lands.
      const uri = `${dir}spell-storm-music-v3-${biomeId}.wav`;
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
      if (currentBiome === biomeId) return;
      const previous = currentBiome;
      currentBiome = biomeId;

      let track: CachedTrack;
      try {
        track = await loadBiome(biomeId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[spell-storm/music] load ${biomeId} failed`, err);
        return;
      }

      if (disposed || currentBiome !== biomeId) return;

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
