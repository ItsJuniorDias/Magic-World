import * as THREE from "three";
import { PALETTE } from "./palette";
import { PaperKit } from "./paper";
import { Puppet, type PoseInput } from "./puppet";

/**
 * The mage: eleven cards on a seven-joint rig.
 *
 * Silhouette is doing the heavy lifting here. At phone size the player sees
 * maybe 90 pixels of character, so the reads that matter are the pointed hat
 * (nothing else in the game is a triangle that tall), the flared robe, and
 * the cyan orb. Facial detail is two eye dots — anything more disappears.
 */

export interface Mage {
  puppet: Puppet;
  root: THREE.Group;
  /** Bright flash at the staff tip when a spell fires. */
  flare: THREE.Mesh;
  /** Persistent soft glow around the orb. */
  orbGlow: THREE.Mesh;
  /** Whole-body flash used for the invulnerability blink. */
  setVisible(v: boolean): void;
  update(input: PoseInput, castFlash: number): void;
}

export function createMage(kit: PaperKit): Mage {
  const puppet = new Puppet();

  // --- Rig -----------------------------------------------------------------
  // Coordinates are in world units, origin at the mage's feet.
  puppet.joint("body", "root", 0, 0.72);
  puppet.joint("head", "body", 0, 0.42);
  puppet.joint("armBack", "body", -0.1, 0.24, 0.35, -0.12);
  puppet.joint("armFront", "body", 0.1, 0.24, -0.35, 0.14);
  puppet.joint("legBack", "root", -0.13, 0.34, 0, -0.1);
  puppet.joint("legFront", "root", 0.13, 0.34, 0, 0.1);

  // --- Legs (behind the robe) ---------------------------------------------
  for (const name of ["legBack", "legFront"] as const) {
    const leg = kit.card(PaperKit.roundedRect(0.19, 0.42, 0.08), PALETTE.robeEdge, PALETTE.robeEdge, {
      depth: 0.12,
      order: 4,
    });
    puppet.attach(name, leg, 0.21);
    const boot = kit.card(PaperKit.roundedRect(0.27, 0.16, 0.07), PALETTE.staffWood, PALETTE.staffEdge, {
      depth: 0.14,
      order: 5,
    });
    puppet.attach(name, boot, 0.42, 0.03);
  }

  // --- Robe ----------------------------------------------------------------
  // A trapezoid, wider at the hem. The flare is what separates a wizard
  // silhouette from a stick figure.
  const robe = kit.card(
    PaperKit.polygon([
      [-0.28, 0.42],
      [0.28, 0.42],
      [0.46, -0.5],
      [-0.46, -0.5],
    ]),
    PALETTE.robeFace,
    PALETTE.robeEdge,
    { depth: 0.24, order: 6 },
  );
  puppet.attach("body", robe, 0);

  // Trim along the hem, in the magic colour, tying the robe to the spells.
  const hem = kit.card(PaperKit.roundedRect(0.92, 0.08, 0.03), PALETTE.robeTrim, PALETTE.robeTrim, {
    depth: 0.05,
    order: 7,
  });
  puppet.attach("body", hem, 0.5, 0, 0.14);

  // --- Head ---------------------------------------------------------------
  const head = kit.card(PaperKit.blob(0.26, 3, 0.06, 1.2, 1.05), PALETTE.skin, PALETTE.skinEdge, {
    depth: 0.22,
    order: 8,
  });
  puppet.attach("head", head, -0.02);

  // Eyes: two dots, placed forward of centre so facing reads instantly.
  for (const dx of [0.06, 0.17]) {
    const eye = kit.card(PaperKit.roundedRect(0.055, 0.075, 0.027), 0x2a1a3a, 0x2a1a3a, {
      depth: 0.04,
      order: 9,
    });
    puppet.attach("head", eye, -0.03, dx, 0.13);
  }

  // --- Hat ----------------------------------------------------------------
  const brim = kit.card(PaperKit.roundedRect(0.66, 0.1, 0.05), PALETTE.hatFace, PALETTE.hatEdge, {
    depth: 0.2,
    order: 10,
  });
  puppet.attach("head", brim, -0.24);

  // The cone leans back slightly and curls at the tip — a straight cone
  // reads as a party hat, the curl reads as a wizard.
  const cone = kit.card(
    PaperKit.polygon([
      [-0.26, 0],
      [0.26, 0],
      [0.02, 0.52],
      [-0.16, 0.72],
      [-0.3, 0.66],
      [-0.12, 0.48],
    ]),
    PALETTE.hatFace,
    PALETTE.hatEdge,
    { depth: 0.18, order: 10 },
  );
  puppet.attach("head", cone, -0.28);

  // A star on the hat, because this is a children's storybook.
  const hatStar = kit.card(PaperKit.star(5, 0.09, 0.44), PALETTE.gold, PALETTE.gold, {
    depth: 0.04,
    order: 11,
  });
  puppet.attach("head", hatStar, -0.52, -0.02, 0.12);

  // --- Arms ---------------------------------------------------------------
  const backArm = kit.card(PaperKit.roundedRect(0.16, 0.44, 0.07), PALETTE.robeEdge, PALETTE.robeEdge, {
    depth: 0.11,
    order: 5,
  });
  puppet.attach("armBack", backArm, 0.22);

  const frontArm = kit.card(PaperKit.roundedRect(0.17, 0.42, 0.075), PALETTE.robeFace, PALETTE.robeEdge, {
    depth: 0.13,
    order: 12,
  });
  puppet.attach("armFront", frontArm, 0.21);

  // --- Staff --------------------------------------------------------------
  // Parented to the front arm, so aiming the arm aims the staff.
  const staff = kit.card(PaperKit.roundedRect(0.075, 1.15, 0.035), PALETTE.staffWood, PALETTE.staffEdge, {
    depth: 0.1,
    order: 13,
  });
  puppet.attach("armFront", staff, 0.5, 0.02, 0.08);

  const orb = kit.card(PaperKit.blob(0.13, 3, 0.04, 4.4), PALETTE.arcane, PALETTE.arcaneDeep, {
    depth: 0.14,
    order: 15,
  });
  puppet.attach("armFront", orb, 1.02, 0.02, 0.1);

  const orbGlow = kit.glowDisc(0.42, PALETTE.arcane, 16);
  orbGlow.renderOrder = 14;
  puppet.attach("armFront", orbGlow, 1.02, 0.02, 0.05);

  // Muzzle flare, hidden until a spell fires.
  const flare = kit.glowDisc(0.85, PALETTE.arcaneCore, 18);
  flare.renderOrder = 16;
  flare.visible = false;
  puppet.attach("armFront", flare, 1.12, 0.02, 0.16);

  const root = puppet.root;

  return {
    puppet,
    root,
    flare,
    orbGlow,
    setVisible(v) {
      root.visible = v;
    },
    update(input, castFlash) {
      puppet.poseHumanoid(input);

      // Orb breathes constantly, then spikes on cast.
      const idlePulse = 1 + Math.sin(input.time * 3.4) * 0.12;
      const castPulse = 1 + castFlash * 1.5;
      orbGlow.scale.setScalar(idlePulse * castPulse);
      (orbGlow.material as THREE.Material).opacity = 0.55 + castFlash * 0.45;

      flare.visible = castFlash > 0.02;
      if (flare.visible) {
        flare.scale.setScalar(0.5 + castFlash * 0.9);
        (flare.material as THREE.Material).opacity = castFlash;
      }
    },
  };
}
