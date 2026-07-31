import * as THREE from "three";
import { PaperKit } from "./paper";
import { PALETTE } from "./palette";

/**
 * SPELL STORM — NPC visuals.
 *
 * Every NPC in the world is three cards stacked at the same x:
 *
 *   body    — a rounded pillar torso in the NPC's tint colour.
 *   head    — a smaller round card above the body.
 *   prompt  — a small floating diamond above the head, tinted arcane,
 *             that pulses so the player can spot the NPC across the room.
 *
 * The prompt has two visual modes managed by setNear(): a distant "!"
 * bob (default, calmer) and a bright "TALK" glow when the player is
 * inside interaction range. The switch is a scale and colour change,
 * not a texture change, because we don't have text rendering in the GL
 * layer — the "TALK" affordance in reality is the LOUDER pulse. The
 * text is in the HUD prompt bubble instead (see the React layer).
 *
 * The pose is dead still: NPCs don't walk, they don't idle-animate, they
 * don't turn to face the player. Any animation would fight for attention
 * with the mage and the boss, both of which are much more important. A
 * still figure with a bobbing prompt says "npc, walk over here" clearly
 * enough.
 */

export interface NpcVisual {
  root: THREE.Group;
  /** Called every render frame. `elapsed` is the sim clock in seconds. */
  update(elapsed: number, playerX: number, playerY: number): void;
  setNear(near: boolean): void;
  /** Fully release GPU resources. Owned by the room stage. */
  dispose(): void;
}

/** Bright HSL → hex helper. Kept local so the palette module stays boss/mage-only. */
function hslHex(h: number, s: number, l: number): number {
  const c = new THREE.Color().setHSL(h, s, l);
  return (Math.round(c.r * 255) << 16) | (Math.round(c.g * 255) << 8) | Math.round(c.b * 255);
}

export function createNpc(
  kit: PaperKit,
  x: number,
  hue: number,
): NpcVisual {
  const root = new THREE.Group();
  root.name = "npc";
  root.position.set(x, 0, 0.35);

  // ---- Body (torso). Rounded rectangle, chest-high. ---------------------
  const bodyFace = hslHex(hue, 0.55, 0.42);
  const bodyEdge = hslHex(hue, 0.55, 0.24);
  const body = kit.card(PaperKit.roundedRect(0.9, 1.4, 0.28), bodyFace, bodyEdge, {
    depth: 0.18,
    order: 12,
  });
  body.position.set(0, 0.9, 0);
  root.add(body);

  // ---- Head. A smaller round card above the shoulders. ------------------
  const headFace = hslHex(hue, 0.35, 0.68);
  const headEdge = hslHex(hue, 0.4, 0.36);
  const head = kit.card(PaperKit.roundedRect(0.7, 0.7, 0.32), headFace, headEdge, {
    depth: 0.18,
    order: 13,
  });
  head.position.set(0, 1.85, 0);
  root.add(head);

  // ---- Floor shadow. A thin dark ellipse under the feet so the NPC
  // ---- doesn't look like it's hovering. --------------------------------
  const shadow = kit.card(PaperKit.roundedRect(1.0, 0.28, 0.14), 0x000000, 0x000000, {
    depth: 0.02,
    order: 11,
  });
  (shadow.material as THREE.Material[])[0].opacity = 0.42;
  (shadow.material as THREE.Material[])[0].transparent = true;
  (shadow.material as THREE.Material[])[1].opacity = 0.42;
  (shadow.material as THREE.Material[])[1].transparent = true;
  shadow.position.set(0, 0.05, -0.05);
  root.add(shadow);

  // ---- Prompt. Diamond above the head, pulses when the player is near
  // ---- so it reads as "come talk". Two children: a glow disc and a
  // ---- tintable diamond card. -----------------------------------------
  const prompt = new THREE.Group();
  prompt.position.set(0, 2.9, 0.1);
  root.add(prompt);

  const glow = kit.glowDisc(0.62, PALETTE.arcaneCore, 18);
  glow.renderOrder = 20;
  prompt.add(glow);

  const diamond = kit.tintableCard(
    PaperKit.roundedRect(0.36, 0.36, 0.08),
    PALETTE.arcaneCore,
    PALETTE.arcaneDeep,
    { depth: 0.08, order: 22 },
  );
  diamond.mesh.rotation.z = Math.PI / 4;
  prompt.add(diamond.mesh);

  const promptGlowMat = glow.material as THREE.MeshBasicMaterial;
  promptGlowMat.transparent = true;

  let nearState = false;

  return {
    root,
    setNear(near: boolean) {
      nearState = near;
      // Immediate colour swap. The size/pulse is animated in update()
      // so it phases in smoothly, but the tint change is the fastest
      // way for the player to notice they're in range.
      const tint = near ? PALETTE.gold : PALETTE.arcaneCore;
      diamond.face.color.setHex(tint);
      promptGlowMat.color.setHex(tint);
    },
    update(elapsed: number) {
      // Prompt bobs and pulses. Twice as active when the player is near.
      const rate = nearState ? 5.2 : 2.4;
      const amp = nearState ? 0.28 : 0.16;
      prompt.position.y = 2.9 + Math.sin(elapsed * rate) * amp;
      const pulse = nearState
        ? 1.15 + Math.sin(elapsed * 6) * 0.25
        : 1.0 + Math.sin(elapsed * 3) * 0.12;
      prompt.scale.setScalar(pulse);
      // Fade the outer glow gently, otherwise it reads as static when
      // no other FX are on screen — this is a mostly-empty room.
      promptGlowMat.opacity = nearState ? 0.75 : 0.42;
    },
    dispose() {
      root.removeFromParent();
      // Geometries and materials are already tracked by the kit's
      // disposer; the room stage will free them.
    },
  };
}

/** World-space radius in which the "player is near" prompt lights up. */
export const NPC_INTERACT_RADIUS = 2.6;
