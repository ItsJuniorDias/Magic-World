import * as THREE from "three";
import { PaperKit } from "./paper";
import { PALETTE, rim as rimColor, shade } from "./palette";

/**
 * SPELL STORM — NPC visuals (HD pass).
 *
 * NPCs used to be three cards stacked: body, head, prompt. That was
 * sufficient at phone size but two cards away from a distant view reading
 * as "a bright shape" rather than as "a person".
 *
 * The HD pass keeps the same footprint (still doesn't animate limbs, still
 * doesn't turn to face the player) but adds anatomical shape and lit
 * detail:
 *
 *   body     — a rounded pillar torso (as before), plus a rim card behind
 *              it, a warmer collar detail, and a small chest sigil.
 *   arms     — two small down-pointing arm cards flanking the torso so the
 *              silhouette isn't a bottle.
 *   head     — the round head plus a rim and a small nose bump.
 *   hair     — a soft cowl-hood card behind the head, tinted with the
 *              robe hue.
 *   eyes     — two glow dots that gently pulse. Match the arcane family
 *              because in the storybook every ghost of Selûne's world has
 *              a bit of her arcane in them.
 *   halo     — a soft warm halo behind the head. Only visible when close.
 *   shadow   — cast shadow beneath the feet (as before, refined).
 *   prompt   — the pulsing gem overhead (as before, refined).
 *   aura     — a slow cyan disc pulse at the whole figure's feet, so the
 *              NPC reads as *magical* from across the room.
 *
 * The pose is still dead still: NPCs don't walk, they don't idle-animate,
 * they don't turn to face the player. Any animation would fight for
 * attention with the mage and the boss, both of which are much more
 * important. What HD adds is not motion but *presence* — a still figure
 * that reads as a character rather than a marker.
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

  // Palette derived from the hue seed.
  const bodyFace = hslHex(hue, 0.55, 0.42);
  const bodyEdge = hslHex(hue, 0.55, 0.24);
  const bodyRim = hslHex(hue, 0.4, 0.68);
  const headFace = hslHex(hue, 0.35, 0.68);
  const headEdge = hslHex(hue, 0.4, 0.36);
  const headRim = hslHex(hue, 0.25, 0.85);
  const hoodFace = hslHex(hue, 0.5, 0.32);
  const collarFace = hslHex(hue, 0.45, 0.52);

  // ---- Ground aura. A slow soft disc under the NPC's feet so it reads as
  // ---- luminous from a distance. -----------------------------------------
  const groundAura = kit.glowDisc(1.6, PALETTE.arcaneOuter, 24, 1.5);
  (groundAura.material as THREE.Material).opacity = 0.22;
  groundAura.rotation.x = -Math.PI / 2;
  groundAura.position.set(0, 0.04, 0);
  root.add(groundAura);

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

  // ---- Head halo. A warm soft halo behind the head, cool but subtle. ----
  const halo = kit.glowDisc(0.9, PALETTE.npcHalo, 22, 1.4);
  (halo.material as THREE.Material).opacity = 0.35;
  halo.position.set(0, 1.85, -0.1);
  root.add(halo);
  const haloMat = halo.material as THREE.MeshBasicMaterial;

  // ---- Body (torso). Rounded rectangle, chest-high. ---------------------
  const bodyShape = PaperKit.roundedRect(0.9, 1.4, 0.28);

  // Rim card behind the torso.
  const bodyRimCard = kit.card(bodyShape, bodyRim, bodyRim, {
    depth: 0.03,
    order: 11,
  });
  bodyRimCard.scale.setScalar(1.06);
  bodyRimCard.position.set(0, 0.9, -0.06);
  root.add(bodyRimCard);

  const body = kit.card(bodyShape, bodyFace, bodyEdge, {
    depth: 0.18,
    order: 12,
  });
  body.position.set(0, 0.9, 0);
  root.add(body);

  // ---- Collar detail. A small warmer stripe near the top of the torso.
  const collar = kit.card(
    PaperKit.roundedRect(0.7, 0.09, 0.03),
    collarFace,
    bodyEdge,
    { depth: 0.06, order: 13 },
  );
  collar.position.set(0, 1.5, 0.1);
  root.add(collar);

  // ---- Chest sigil — a small warm gold star pinning the robe together.
  const sigil = kit.card(PaperKit.star(5, 0.06, 0.44), PALETTE.gold, PALETTE.gold, {
    depth: 0.04,
    order: 14,
  });
  sigil.position.set(0, 1.32, 0.12);
  root.add(sigil);

  // ---- Arms. Two small down-pointing rounded cards flanking the body.
  // Doesn't animate, just breaks the silhouette.
  for (const dx of [-0.44, 0.44]) {
    const arm = kit.card(
      PaperKit.roundedRect(0.16, 0.85, 0.07),
      bodyFace,
      bodyEdge,
      { depth: 0.12, order: 11 },
    );
    arm.position.set(dx, 1.05, -0.02);
    root.add(arm);

    // Small warm gem on each cuff at the arm's end.
    const cuff = kit.card(
      PaperKit.roundedRect(0.12, 0.05, 0.02),
      PALETTE.gold,
      PALETTE.gold,
      { depth: 0.05, order: 12 },
    );
    cuff.position.set(dx, 0.62, 0.04);
    root.add(cuff);
  }

  // ---- Hood behind the head — a shape that reads as a cowl.
  const hood = kit.card(
    PaperKit.polygon([
      [-0.5, 0],
      [0.5, 0],
      [0.42, 0.6],
      [0.16, 0.72],
      [-0.16, 0.72],
      [-0.42, 0.6],
    ]),
    hoodFace,
    shade(hoodFace, 0.3),
    { depth: 0.12, order: 12 },
  );
  hood.position.set(0, 1.5, -0.02);
  root.add(hood);

  // ---- Head rim behind the head.
  const headShape = PaperKit.roundedRect(0.7, 0.7, 0.32);
  const headRimCard = kit.card(headShape, headRim, headRim, {
    depth: 0.03,
    order: 12,
  });
  headRimCard.scale.setScalar(1.08);
  headRimCard.position.set(0, 1.85, -0.06);
  root.add(headRimCard);

  // ---- Head. A smaller round card above the shoulders. ------------------
  const head = kit.card(headShape, headFace, headEdge, {
    depth: 0.18,
    order: 13,
  });
  head.position.set(0, 1.85, 0);
  root.add(head);

  // ---- Nose bump. A tiny darker circle to give the face a plane.
  const nose = kit.card(
    PaperKit.roundedRect(0.08, 0.1, 0.04),
    shade(headFace, 0.25),
    shade(headFace, 0.25),
    { depth: 0.04, order: 14 },
  );
  nose.position.set(0, 1.82, 0.11);
  root.add(nose);

  // ---- Eyes. Two glow dots — cyan cores that gently pulse.
  const eyeGlows: THREE.Mesh[] = [];
  for (const dx of [-0.11, 0.11]) {
    const eyeGlow = kit.glowDisc(0.06, PALETTE.arcaneOuter, 12);
    (eyeGlow.material as THREE.Material).opacity = 0.65;
    eyeGlow.position.set(dx, 1.92, 0.13);
    root.add(eyeGlow);
    eyeGlows.push(eyeGlow);

    // Solid inner dot.
    const eye = kit.card(
      PaperKit.roundedRect(0.05, 0.06, 0.02),
      PALETTE.arcaneOuter,
      PALETTE.arcaneCore,
      { depth: 0.03, order: 15 },
    );
    eye.position.set(dx, 1.92, 0.15);
    root.add(eye);
  }

  // ---- Prompt. Diamond above the head, pulses when the player is near
  // ---- so it reads as "come talk". Two children: a glow disc and a
  // ---- tintable diamond card. -----------------------------------------
  const prompt = new THREE.Group();
  prompt.position.set(0, 2.9, 0.1);
  root.add(prompt);

  const glow = kit.glowDisc(0.72, PALETTE.arcaneCore, 22, 1.3);
  glow.renderOrder = 20;
  prompt.add(glow);

  // Second smaller inner glow.
  const glowInner = kit.glowDisc(0.35, PALETTE.arcaneCore, 16);
  (glowInner.material as THREE.Material).opacity = 0.6;
  glowInner.renderOrder = 21;
  prompt.add(glowInner);

  const diamond = kit.tintableCard(
    PaperKit.roundedRect(0.4, 0.4, 0.09),
    PALETTE.arcaneCore,
    PALETTE.arcaneDeep,
    { depth: 0.08, order: 22 },
  );
  diamond.mesh.rotation.z = Math.PI / 4;
  prompt.add(diamond.mesh);

  // Inner smaller diamond (bright core).
  const diamondCore = kit.card(
    PaperKit.roundedRect(0.18, 0.18, 0.04),
    PALETTE.arcaneCore,
    PALETTE.arcaneCore,
    { depth: 0.06, order: 23 },
  );
  diamondCore.rotation.z = Math.PI / 4;
  diamondCore.position.z = 0.05;
  prompt.add(diamondCore);

  const promptGlowMat = glow.material as THREE.MeshBasicMaterial;
  const promptGlowInnerMat = glowInner.material as THREE.MeshBasicMaterial;
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
      promptGlowInnerMat.color.setHex(tint);
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
      promptGlowMat.opacity = nearState ? 0.85 : 0.55;
      promptGlowInnerMat.opacity = nearState ? 0.9 : 0.6;

      // Eye glow pulses.
      const eyePulse = 0.55 + Math.sin(elapsed * 1.8) * 0.22 + (nearState ? 0.2 : 0);
      for (const eg of eyeGlows) {
        (eg.material as THREE.Material).opacity = eyePulse;
      }

      // Ground aura breathes slowly.
      (groundAura.material as THREE.Material).opacity =
        0.18 + Math.sin(elapsed * 0.8) * 0.06;
      groundAura.scale.setScalar(1 + Math.sin(elapsed * 0.6) * 0.05);

      // Head halo also breathes.
      haloMat.opacity = 0.3 + Math.sin(elapsed * 0.9) * 0.08;

      void rimColor;
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
