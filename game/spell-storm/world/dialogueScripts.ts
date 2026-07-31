import type { BossKind } from "../config";
import type { DialogueScript } from "../systems/dialogue";

/**
 * SPELL STORM — the story.
 *
 * Every line the game speaks lives in this file. The design of the
 * dialogue system is minimalist on purpose — one linear script per
 * beat — and the story is minimalist too: a single arc across seven
 * bosses and four NPCs, told in as few words as it can afford.
 *
 * THE ARC, IN ONE PARAGRAPH
 *
 * You are the last apprentice of Archmage Selûne. She went to face the
 * Storm Dragon and did not return. You are following her. Each of the
 * seven "Aspects" you fight was once a Guardian she knew; each one
 * remembers her, and each says something about what she was doing here.
 * A ghost in the Cistern will tell you the twist — the Guardians
 * weren't corrupted BY the Dragon, they corrupted the Dragon to seal
 * something worse INSIDE him, and Selûne went in to hold that seal.
 * Killing the seven undoes it. The Dragon, at the very end, recognises
 * your voice.
 *
 * TONE
 *
 * Short lines. No exposition dumps. The players (kids) don't need to
 * understand every implication of every line — the point is that the
 * world feels older than they are, and the story rewards paying
 * attention rather than punishing skipping. Every important beat is
 * repeated in a different mouth: the twist appears in the Ossuary
 * NPC AND in the Voidmaw fight AND in the Dragon's finale, so a
 * player who misses one still catches the others.
 *
 * VARIANTS
 *
 * NPCs have multiple scripts keyed by how many bosses the player has
 * defeated. `pickNpcScript` runs the lookup. Boss cutscenes are one
 * script each — the ordering across bosses does the work of
 * progression.
 */

// ---------------------------------------------------------------------------
// Boss intros — one linear script per boss, ~3-5 lines each.
// ---------------------------------------------------------------------------

export const BOSS_CUTSCENES: Record<BossKind, DialogueScript> = {
  gorgeMother: {
    id: "cut_gorge",
    lines: [
      {
        speaker: "narrator",
        name: "",
        body: "The floor breathes. Somewhere below, something turns to look up.",
      },
      {
        speaker: "boss",
        name: "Gorge Mother",
        body: "Little sprout. You smell of her.",
      },
      { speaker: "mage", name: "Mage", body: "Of who?" },
      {
        speaker: "boss",
        name: "Gorge Mother",
        body: "The Moon. She fed me once, when I was smaller than a stone.",
      },
      {
        speaker: "boss",
        name: "Gorge Mother",
        body: "Come. The Bloom is hungry today.",
      },
    ],
  },

  nightwing: {
    id: "cut_nightwing",
    lines: [
      {
        speaker: "narrator",
        name: "",
        body: "The wind stops. Every shadow on the ceiling is looking at you.",
      },
      {
        speaker: "boss",
        name: "Nightwing",
        body: "Another wingless one, climbing to the roost.",
      },
      { speaker: "mage", name: "Mage", body: "I'm not here to fly." },
      {
        speaker: "boss",
        name: "Nightwing",
        body: "Then you fall like the rest. Selûne fell too.",
      },
      { speaker: "mage", name: "Mage", body: "She was HERE?" },
      {
        speaker: "boss",
        name: "Nightwing",
        body: "She passed through. Nothing catches her anymore.",
      },
    ],
  },

  cinderWarden: {
    id: "cut_cinder",
    lines: [
      {
        speaker: "narrator",
        name: "",
        body: "Heat rises off the stone in visible waves.",
      },
      {
        speaker: "boss",
        name: "Cinder Warden",
        body: "You wear no forge-mark. You are not welcome.",
      },
      { speaker: "mage", name: "Mage", body: "I need the sigil, warden." },
      {
        speaker: "boss",
        name: "Cinder Warden",
        body: "Then you need what it costs.",
      },
      {
        speaker: "boss",
        name: "Cinder Warden",
        body: "Your teacher paid. She left a mark on my chest. Do you want to see it?",
      },
    ],
  },

  lumenChoir: {
    id: "cut_choir",
    lines: [
      {
        speaker: "narrator",
        name: "",
        body: "Three lights hover in a slow triangle. The room hums.",
      },
      {
        speaker: "boss",
        name: "Lumen Choir",
        body: "One. Two. Three.",
      },
      {
        speaker: "boss",
        name: "Lumen Choir",
        body: "You are not the fourth.",
      },
      {
        speaker: "mage",
        name: "Mage",
        body: "The Choir won't sing for me?",
      },
      {
        speaker: "boss",
        name: "Lumen Choir",
        body: "The Choir sings only for those who leave.",
      },
      { speaker: "boss", name: "Lumen Choir", body: "Leave." },
    ],
  },

  thornWarden: {
    id: "cut_thorn",
    lines: [
      {
        speaker: "narrator",
        name: "",
        body: "The bark is warm. Roots move beneath the floor like slow rivers.",
      },
      {
        speaker: "boss",
        name: "Thorn Warden",
        body: "Roots remember. My roots remember your teacher.",
      },
      { speaker: "mage", name: "Mage", body: "Selûne came here?" },
      {
        speaker: "boss",
        name: "Thorn Warden",
        body: "She came. She grew. She turned inward.",
      },
      { speaker: "mage", name: "Mage", body: "Turned into what?" },
      {
        speaker: "boss",
        name: "Thorn Warden",
        body: "Into what the seal needed.",
      },
    ],
  },

  voidmaw: {
    id: "cut_voidmaw",
    lines: [
      {
        speaker: "narrator",
        name: "",
        body: "The room bends toward the centre. Your footing tilts.",
      },
      {
        speaker: "boss",
        name: "Voidmaw",
        body: "You reach and reach. What are you reaching for?",
      },
      {
        speaker: "mage",
        name: "Mage",
        body: "The one who took my master.",
      },
      {
        speaker: "boss",
        name: "Voidmaw",
        body: "The one who took her was herself.",
      },
      {
        speaker: "boss",
        name: "Voidmaw",
        body: "The rest of us just held the door.",
      },
      {
        speaker: "mage",
        name: "Mage",
        body: "...what door?",
      },
      {
        speaker: "boss",
        name: "Voidmaw",
        body: "You are about to open it.",
      },
    ],
  },

  dragon: {
    id: "cut_dragon",
    lines: [
      {
        speaker: "narrator",
        name: "",
        body: "The clouds part. A great shape lowers itself onto the throne.",
      },
      {
        speaker: "boss",
        name: "The Storm Dragon",
        body: "You should not have come, little spark.",
      },
      {
        speaker: "mage",
        name: "Mage",
        body: "Selûne. I know you're in there.",
      },
      {
        speaker: "boss",
        name: "The Storm Dragon",
        body: "...apprentice.",
      },
      {
        speaker: "boss",
        name: "The Storm Dragon",
        body: "The storm and I are one now. Turn back.",
      },
      { speaker: "mage", name: "Mage", body: "I can't." },
      {
        speaker: "boss",
        name: "The Storm Dragon",
        body: "Then let it be the wind that takes you. Not me.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Boss defeat lines — spoken as the body dissolves, so the player learns a
// last thing about what they just killed. Kept SHORT because the death FX
// and hitstop are already busy; two lines each, spoken by the boss.
// ---------------------------------------------------------------------------

export const BOSS_DEFEAT_LINES: Record<BossKind, DialogueScript> = {
  gorgeMother: {
    id: "die_gorge",
    lines: [
      {
        speaker: "boss",
        name: "Gorge Mother",
        body: "Tell her... the Bloom slept well.",
      },
      { speaker: "narrator", name: "", body: "The floor is quiet again." },
    ],
  },
  nightwing: {
    id: "die_nightwing",
    lines: [
      {
        speaker: "boss",
        name: "Nightwing",
        body: "The roost is empty. The sky is yours.",
      },
      { speaker: "narrator", name: "", body: "Feathers drift down like dark snow." },
    ],
  },
  cinderWarden: {
    id: "die_cinder",
    lines: [
      {
        speaker: "boss",
        name: "Cinder Warden",
        body: "The forge is cold. You will be the last.",
      },
      { speaker: "narrator", name: "", body: "The last ember goes out." },
    ],
  },
  lumenChoir: {
    id: "die_choir",
    lines: [
      {
        speaker: "boss",
        name: "Lumen Choir",
        body: "One. Two. None.",
      },
      { speaker: "narrator", name: "", body: "The hum goes still." },
    ],
  },
  thornWarden: {
    id: "die_thorn",
    lines: [
      {
        speaker: "boss",
        name: "Thorn Warden",
        body: "My roots are quiet. Yours grow toward her.",
      },
      { speaker: "narrator", name: "", body: "The bark falls away." },
    ],
  },
  voidmaw: {
    id: "die_voidmaw",
    lines: [
      {
        speaker: "boss",
        name: "Voidmaw",
        body: "The door is open. I could not hold it. Neither will you.",
      },
      { speaker: "narrator", name: "", body: "The pull releases. The room straightens." },
    ],
  },
  dragon: {
    id: "die_dragon",
    lines: [
      {
        speaker: "boss",
        name: "The Storm Dragon",
        body: "You came all the way. Foolish. Brave.",
      },
      { speaker: "boss", name: "The Storm Dragon", body: "...thank you, apprentice." },
      { speaker: "narrator", name: "", body: "The storm lifts. Above the throne, a single warm light remains." },
    ],
  },
};

// ---------------------------------------------------------------------------
// NPCs — four wanderers who each know a piece of the story. Every NPC has
// three script variants keyed by boss count: opening ("before you've done
// anything"), midway ("the story is happening"), late ("everything is on
// the table"). pickNpcScript picks between them.
// ---------------------------------------------------------------------------

interface NpcScriptSet {
  name: string;
  early: DialogueScript;
  mid: DialogueScript;
  late: DialogueScript;
}

export const NPC_SCRIPTS: Record<string, NpcScriptSet> = {
  wren: {
    name: "Wren",
    early: {
      id: "npc_wren_early",
      lines: [
        {
          speaker: "npc",
          name: "Wren",
          body: "You made it out. Good. I wasn't sure you would.",
        },
        {
          speaker: "npc",
          name: "Wren",
          body: "Master Selûne left this for you before she went. A spark. Not much.",
        },
        {
          speaker: "mage",
          name: "Mage",
          body: "When is she coming back?",
        },
        {
          speaker: "npc",
          name: "Wren",
          body: "She said forty days. It's been sixty.",
        },
        {
          speaker: "npc",
          name: "Wren",
          body: "Go. Find the Guardians. Bring their sigils here. The Storm Gate will open when you have six.",
        },
        {
          speaker: "npc",
          name: "Wren",
          body: "And... be careful. The deep ones remember her.",
        },
      ],
    },
    mid: {
      id: "npc_wren_mid",
      lines: [
        {
          speaker: "npc",
          name: "Wren",
          body: "Sigils. On you. I can feel them from here.",
        },
        {
          speaker: "npc",
          name: "Wren",
          body: "You know I tried, when I was your age. Made it to the Choir.",
        },
        {
          speaker: "npc",
          name: "Wren",
          body: "Turned around. Never told anyone.",
        },
        {
          speaker: "npc",
          name: "Wren",
          body: "You're doing better than me. Keep going.",
        },
      ],
    },
    late: {
      id: "npc_wren_late",
      lines: [
        {
          speaker: "npc",
          name: "Wren",
          body: "Six sigils. The gate is open. I can see the light through it.",
        },
        {
          speaker: "npc",
          name: "Wren",
          body: "Whatever is on the other side... you'll see her, apprentice. One way or another.",
        },
        {
          speaker: "npc",
          name: "Wren",
          body: "Tell her Wren said hello. If there's a her left to tell.",
        },
      ],
    },
  },

  miel: {
    name: "Miel",
    early: {
      id: "npc_miel_early",
      lines: [
        {
          speaker: "npc",
          name: "Miel",
          body: "Hey. Down here. Watch the red caps — those spit.",
        },
        {
          speaker: "npc",
          name: "Miel",
          body: "I map. Not for anyone. Just so I know it was here before it wasn't.",
        },
        {
          speaker: "npc",
          name: "Miel",
          body: "The Gorge Mother? Used to be a bud. Small enough to hold.",
        },
        {
          speaker: "npc",
          name: "Miel",
          body: "Something in the storm made her hungry. Now she is the floor.",
        },
      ],
    },
    mid: {
      id: "npc_miel_mid",
      lines: [
        {
          speaker: "npc",
          name: "Miel",
          body: "You calmed her. The Bloom is quiet.",
        },
        {
          speaker: "npc",
          name: "Miel",
          body: "Thank you. That was mine, once. My garden.",
        },
        {
          speaker: "npc",
          name: "Miel",
          body: "If you go north, take the platforms. The wind up there lies.",
        },
      ],
    },
    late: {
      id: "npc_miel_late",
      lines: [
        {
          speaker: "npc",
          name: "Miel",
          body: "You've been to the deep ones. I can smell the void on your cloak.",
        },
        {
          speaker: "npc",
          name: "Miel",
          body: "Whatever they told you — it's true. All of it.",
        },
      ],
    },
  },

  talon: {
    name: "Talon",
    early: {
      id: "npc_talon_early",
      lines: [
        {
          speaker: "npc",
          name: "Talon",
          body: "Steel-print on stone. Third pupil in a month.",
        },
        {
          speaker: "npc",
          name: "Talon",
          body: "My eyes went in the Perch. Nightwing's second dive.",
        },
        {
          speaker: "npc",
          name: "Talon",
          body: "Your master came through here. Days back. Didn't stop.",
        },
        {
          speaker: "mage",
          name: "Mage",
          body: "Did she say anything?",
        },
        {
          speaker: "npc",
          name: "Talon",
          body: "One thing. 'Tell the boy to turn around.' I didn't know she meant you.",
        },
      ],
    },
    mid: {
      id: "npc_talon_mid",
      lines: [
        {
          speaker: "npc",
          name: "Talon",
          body: "I heard the wings fall. Good work.",
        },
        {
          speaker: "npc",
          name: "Talon",
          body: "The old stories say there were Seven Seals. Seven Guardians. One of them turned monstrous — the Dragon.",
        },
        {
          speaker: "npc",
          name: "Talon",
          body: "That's the version they tell in the villages, anyway.",
        },
        {
          speaker: "npc",
          name: "Talon",
          body: "Ask the ghost in the cistern about the OTHER version. If you dare.",
        },
      ],
    },
    late: {
      id: "npc_talon_late",
      lines: [
        {
          speaker: "npc",
          name: "Talon",
          body: "Almost done. I can feel the tremor in the stone.",
        },
        {
          speaker: "npc",
          name: "Talon",
          body: "If she is still up there — and I do not think she is — she will be proud.",
        },
        {
          speaker: "npc",
          name: "Talon",
          body: "If she is not... be quick. Be kind.",
        },
      ],
    },
  },

  cael: {
    name: "Cael",
    early: {
      id: "npc_cael_early",
      lines: [
        {
          speaker: "narrator",
          name: "",
          body: "A pile of bones by the water. It stirs when you approach.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "...still. Someone. Walks.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "I was Cael. I fought the Voidmaw. Sixty years ago. Sixty.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "Listen, apprentice. The villagers have it backward.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "The Dragon did not turn the Guardians. They turned HIM.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "To hold something older. Something the seven of them could not fight alone.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "Your master went in to help hold. Every sigil you take... loosens the seal.",
        },
        {
          speaker: "mage",
          name: "Mage",
          body: "...you're saying I should stop.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "I am saying I could not.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "Neither, I think, can you.",
        },
      ],
    },
    mid: {
      id: "npc_cael_mid",
      lines: [
        {
          speaker: "npc",
          name: "Cael",
          body: "You know now. I can see it in your walk.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "It is not a betrayal. It is a choice she left you.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "Break the seal. Find her. Whatever is under it — face it together.",
        },
      ],
    },
    late: {
      id: "npc_cael_late",
      lines: [
        {
          speaker: "npc",
          name: "Cael",
          body: "The last sigil is close. I feel her, up there. Straining.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "Go. And apprentice — when the Dragon speaks with her voice, listen.",
        },
        {
          speaker: "npc",
          name: "Cael",
          body: "That is the whole of the fight.",
        },
      ],
    },
  },
};

/**
 * Selects the right variant of an NPC's script based on how many bosses
 * the player has beaten. The thresholds are the same for every NPC so
 * they all "graduate" at the same points in the story — that way
 * revisiting the hub after a big fight always feels like the world has
 * moved along with you.
 */
export function pickNpcScript(npcId: string, bossesDefeated: number): DialogueScript | null {
  const set = NPC_SCRIPTS[npcId];
  if (!set) return null;
  if (bossesDefeated >= 5) return set.late;
  if (bossesDefeated >= 2) return set.mid;
  return set.early;
}
