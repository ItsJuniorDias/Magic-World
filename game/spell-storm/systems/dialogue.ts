import type { BossKind } from "../config";

/**
 * SPELL STORM — dialogue.
 *
 * Every talkable moment in the game — boss cutscene, NPC chat, epilogue —
 * runs through one small state machine. A dialogue is an ordered list of
 * Lines; a Line has a speaker and a body. The React overlay reads the
 * currently active dialogue off the HUD, renders the speaker's card and
 * the body, and calls `advance` on tap. When there are no more lines the
 * simulation exits the dialogue phase and returns to whatever it was
 * doing before.
 *
 * Why lines rather than a graph. Every dialogue in this game is linear;
 * even the "different NPCs after progression" case is handled by picking
 * a different script up front, not by branching mid-conversation. A
 * conversation graph would be more powerful but the power would go
 * unused, and every reader of this file would have to figure out the
 * graph runtime first.
 *
 * Why the speaker is a tag not a portrait. The paper-theatre style has
 * no rendered faces. Speakers are named ("Wren", "Gorge Mother"), tinted
 * per side (mage warm, other cool), and that's the whole feedback loop
 * for who's talking. Adding portraits would mean adding art, which is
 * the one thing this project has spent great pains not needing.
 */

export type Speaker = "mage" | "boss" | "npc" | "narrator";

export interface DialogueLine {
  speaker: Speaker;
  /** Display name — "Wren", "Gorge Mother", or "" for the narrator. */
  name: string;
  body: string;
}

export interface DialogueScript {
  id: string;
  lines: readonly DialogueLine[];
}

/**
 * The single kind of dialogue currently open. `kind` distinguishes what
 * exiting the dialogue does — a boss cutscene commits to the shop next,
 * an NPC chat resumes free play, and the finale opens the victory
 * screen.
 */
export interface DialogueState {
  script: DialogueScript;
  index: number;
  kind: "bossIntro" | "bossDefeat" | "npc" | "epilogue";
  /**
   * For boss cutscenes, the boss we'll spawn once the player commits.
   * Null for NPC chats and epilogues.
   */
  pendingBoss: BossKind | null;
  /**
   * NPC id — set when this is an NPC chat, so the orchestrator can mark
   * the NPC as met when the dialogue closes.
   */
  npcId: string | null;
}

/** Currently displayed line, or null if the script has run out. */
export function currentLine(state: DialogueState): DialogueLine | null {
  return state.script.lines[state.index] ?? null;
}

/**
 * Moves to the next line. Returns true if there is more to read; returns
 * false when the dialogue has finished, at which point the caller should
 * close the dialogue and transition to whatever comes next.
 */
export function advanceDialogue(state: DialogueState): boolean {
  state.index += 1;
  return state.index < state.script.lines.length;
}

/** Skips to the end so the caller's follow-up logic runs on the next call. */
export function endDialogue(state: DialogueState): void {
  state.index = state.script.lines.length;
}
