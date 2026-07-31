import * as THREE from "three";
import { PALETTE, rim as rimColor, shade } from "./palette";
import { PaperKit } from "./paper";
import { Puppet, type PoseInput } from "./puppet";

/**
 * The mage — HD pass.
 *
 * Silhouette is still doing the heavy lifting: at phone size the player
 * sees maybe 90 pixels of character, so the reads that matter are still
 * the pointed hat, the flared robe, and the cyan orb.
 *
 * What HD adds without breaking the silhouette:
 *
 *   - Rim highlights on the hat, robe and head. A brighter, slightly
 *     scaled-up clone of each card sits behind the primary. On a phone
 *     that reads as "the moon is behind him". No lit shader.
 *   - Hair. A short auburn tuft sticking out from under the hat's brim,
 *     driven by a low-amplitude sine so it flutters as the mage moves.
 *   - Glowing eyes. Cyan cores with a small warm halo — the eyes now
 *     match the arcane family, which is what visually says "spellcaster".
 *   - Cloak. A darker card *behind* the robe, flowing with more amplitude
 *     than the robe itself so movement reads as fabric rather than a
 *     rectangle.
 *   - Belt and clasp. Two small cards at the waist that break the robe
 *     silhouette into a top and a bottom, giving it proportions.
 *   - Orbiting motes. Three small cyan glow discs slowly orbiting the
 *     orb — pure decoration but the player's eye is drawn to them
 *     between shots, and that draws it back to the character mid-fight.
 *   - Chest sigil. A small gold star on the robe, so a distant view of
 *     the mage isn't just two shapes of blue.
 *
 * The API is unchanged: same `update(input, castFlash)`, same `flare`,
 * same `orbGlow`. Every new element hangs off the existing puppet.
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

  // --- Cloak (behind the robe) --------------------------------------------
  // A darker, wider trapezoid sitting behind the robe. Flows with a stronger
  // wobble than the robe itself so it reads as a separate layer of fabric.
  const cloak = kit.card(
    PaperKit.polygon([
      [-0.36, 0.44],
      [0.36, 0.44],
      [0.58, -0.58],
      [-0.58, -0.58],
    ]),
    shade(PALETTE.robeFace, 0.5),
    shade(PALETTE.robeEdge, 0.6),
    { depth: 0.14, order: 5 },
  );
  cloak.position.z = -0.18;
  puppet.attach("body", cloak, 0);

  // --- Legs (behind the robe) ---------------------------------------------
  for (const name of ["legBack", "legFront"] as const) {
    const leg = kit.card(
      PaperKit.roundedRect(0.19, 0.42, 0.08),
      PALETTE.robeEdge,
      PALETTE.robeShadow,
      { depth: 0.12, order: 4 },
    );
    puppet.attach(name, leg, 0.21);
    const boot = kit.card(
      PaperKit.roundedRect(0.27, 0.16, 0.07),
      PALETTE.staffWood,
      PALETTE.staffEdge,
      { depth: 0.14, order: 5 },
    );
    puppet.attach(name, boot, 0.42, 0.03);

    // Buckle on each boot — a warm speck that catches the eye when running.
    const buckle = kit.card(
      PaperKit.roundedRect(0.09, 0.05, 0.02),
      PALETTE.gold,
      PALETTE.gold,
      { depth: 0.03, order: 6 },
    );
    puppet.attach(name, buckle, 0.4, 0.03, 0.16);
  }

  // --- Robe ----------------------------------------------------------------
  // A trapezoid, wider at the hem. The flare is what separates a wizard
  // silhouette from a stick figure.
  const robeShape = PaperKit.polygon([
    [-0.28, 0.42],
    [0.28, 0.42],
    [0.46, -0.5],
    [-0.46, -0.5],
  ]);

  // Rim-lit robe: a brighter, larger version behind the primary card.
  const robeRim = kit.card(robeShape, PALETTE.robeRim, PALETTE.robeRim, {
    depth: 0.02,
    order: 5,
  });
  robeRim.scale.setScalar(1.08);
  robeRim.position.z = -0.06;
  puppet.attach("body", robeRim, 0);

  const robe = kit.card(robeShape, PALETTE.robeFace, PALETTE.robeEdge, {
    depth: 0.24,
    order: 6,
  });
  puppet.attach("body", robe, 0);

  // Trim along the hem, in the magic colour, tying the robe to the spells.
  const hem = kit.card(
    PaperKit.roundedRect(0.92, 0.08, 0.03),
    PALETTE.robeTrim,
    PALETTE.robeTrim,
    { depth: 0.05, order: 7 },
  );
  puppet.attach("body", hem, 0.5, 0, 0.14);

  // Belt — a horizontal darker strip breaking the robe into torso and skirt.
  const belt = kit.card(
    PaperKit.roundedRect(0.68, 0.09, 0.03),
    shade(PALETTE.robeFace, 0.55),
    shade(PALETTE.robeEdge, 0.6),
    { depth: 0.06, order: 7 },
  );
  puppet.attach("body", belt, -0.02, 0, 0.14);

  // Belt buckle — a warm gold accent smack in the middle.
  const buckle = kit.card(
    PaperKit.roundedRect(0.16, 0.14, 0.05),
    PALETTE.gold,
    PALETTE.goldRim,
    { depth: 0.07, order: 8 },
  );
  puppet.attach("body", buckle, -0.02, 0, 0.18);

  // Chest sigil — a small gold star, breaking up the robe silhouette.
  const chestStar = kit.card(
    PaperKit.star(5, 0.09, 0.44),
    PALETTE.gold,
    PALETTE.goldRim,
    { depth: 0.05, order: 8 },
  );
  puppet.attach("body", chestStar, -0.24, 0, 0.16);

  // Two little buttons flanking the sigil.
  for (const dx of [-0.14, 0.14]) {
    const button = kit.card(
      PaperKit.roundedRect(0.05, 0.05, 0.024),
      PALETTE.gold,
      PALETTE.gold,
      { depth: 0.04, order: 8 },
    );
    puppet.attach("body", button, -0.24, dx, 0.15);
  }

  // --- Head ---------------------------------------------------------------
  // Rim first, primary on top.
  const headShape = PaperKit.blob(0.26, 4, 0.06, 1.2, 1.05);
  const headRim = kit.card(headShape, PALETTE.skinRim, PALETTE.skinRim, {
    depth: 0.02,
    order: 7,
  });
  headRim.scale.setScalar(1.09);
  headRim.position.z = -0.06;
  puppet.attach("head", headRim, -0.02);

  const head = kit.card(headShape, PALETTE.skin, PALETTE.skinEdge, {
    depth: 0.22,
    order: 8,
  });
  puppet.attach("head", head, -0.02);

  // Hair — a small tuft peeking from under the brim.
  const hair = kit.card(
    PaperKit.polygon([
      [-0.22, 0],
      [-0.18, 0.14],
      [-0.06, 0.05],
      [0.06, 0.16],
      [0.18, 0.05],
      [0.24, 0.14],
      [0.22, 0],
    ]),
    PALETTE.hairFace,
    PALETTE.hairEdge,
    { depth: 0.05, order: 9 },
  );
  puppet.attach("head", hair, -0.16);

  // Eyes: two dots, placed forward of centre so facing reads instantly.
  // HD pass: each eye is a warm skin-toned card with a cyan glow core, so
  // the mage's eyes match the arcane colour family.
  const eyeCyanCores: THREE.Mesh[] = [];
  for (const dx of [0.06, 0.17]) {
    const eyeBase = kit.card(
      PaperKit.roundedRect(0.075, 0.09, 0.033),
      PALETTE.eyeDark,
      PALETTE.eyeDark,
      { depth: 0.04, order: 9 },
    );
    puppet.attach("head", eyeBase, -0.03, dx, 0.13);

    const eyeGlow = kit.glowDisc(0.08, PALETTE.eyeGlow, 14);
    puppet.attach("head", eyeGlow, -0.03, dx, 0.15);
    (eyeGlow.material as THREE.Material).opacity = 0.7;
    eyeCyanCores.push(eyeGlow);

    const eyeCore = kit.card(
      PaperKit.roundedRect(0.04, 0.05, 0.02),
      PALETTE.eyeGlow,
      PALETTE.eyeGlow,
      { depth: 0.03, order: 10 },
    );
    puppet.attach("head", eyeCore, -0.03, dx, 0.17);
  }

  // --- Hat ----------------------------------------------------------------
  // Rim first, primary on top.
  const brimShape = PaperKit.roundedRect(0.68, 0.11, 0.05);
  const brimRim = kit.card(brimShape, PALETTE.hatRim, PALETTE.hatRim, {
    depth: 0.02,
    order: 9,
  });
  brimRim.scale.setScalar(1.06);
  brimRim.position.z = -0.06;
  puppet.attach("head", brimRim, -0.24);

  const brim = kit.card(brimShape, PALETTE.hatFace, PALETTE.hatEdge, {
    depth: 0.2,
    order: 10,
  });
  puppet.attach("head", brim, -0.24);

  // Brim underside shadow — a slightly darker card under the front lip.
  const brimShadow = kit.card(
    PaperKit.roundedRect(0.6, 0.05, 0.02),
    PALETTE.hatShadow,
    PALETTE.hatShadow,
    { depth: 0.03, order: 9 },
  );
  puppet.attach("head", brimShadow, -0.22, 0, -0.05);

  // The cone leans back slightly and curls at the tip — a straight cone
  // reads as a party hat, the curl reads as a wizard.
  const coneShape = PaperKit.polygon([
    [-0.26, 0],
    [0.26, 0],
    [0.04, 0.54],
    [-0.14, 0.74],
    [-0.3, 0.68],
    [-0.1, 0.5],
  ]);

  const coneRim = kit.card(coneShape, PALETTE.hatRim, PALETTE.hatRim, {
    depth: 0.02,
    order: 9,
  });
  coneRim.scale.setScalar(1.06);
  coneRim.position.z = -0.05;
  puppet.attach("head", coneRim, -0.28);

  const cone = kit.card(coneShape, PALETTE.hatFace, PALETTE.hatEdge, {
    depth: 0.18,
    order: 10,
  });
  puppet.attach("head", cone, -0.28);

  // Cone shadow — a darker card down the leading edge for form.
  const coneShadow = kit.card(
    PaperKit.polygon([
      [-0.26, 0],
      [-0.05, 0],
      [-0.14, 0.74],
      [-0.3, 0.68],
    ]),
    PALETTE.hatShadow,
    PALETTE.hatShadow,
    { depth: 0.02, order: 10 },
  );
  coneShadow.position.z = 0.02;
  (coneShadow.material as THREE.Material[])[0].transparent = true;
  (coneShadow.material as THREE.Material[])[0].opacity = 0.6;
  puppet.attach("head", coneShadow, -0.28);

  // A star on the hat, because this is a children's storybook.
  const hatStar = kit.card(
    PaperKit.star(5, 0.1, 0.44),
    PALETTE.gold,
    PALETTE.goldRim,
    { depth: 0.05, order: 11 },
  );
  puppet.attach("head", hatStar, -0.54, -0.02, 0.14);

  // A glow behind the hat star.
  const hatStarGlow = kit.glowDisc(0.22, PALETTE.gold, 18);
  puppet.attach("head", hatStarGlow, -0.54, -0.02, 0.08);
  (hatStarGlow.material as THREE.Material).opacity = 0.55;

  // --- Arms ---------------------------------------------------------------
  const backArm = kit.card(
    PaperKit.roundedRect(0.16, 0.44, 0.07),
    PALETTE.robeEdge,
    PALETTE.robeShadow,
    { depth: 0.11, order: 5 },
  );
  puppet.attach("armBack", backArm, 0.22);

  const frontArm = kit.card(
    PaperKit.roundedRect(0.17, 0.42, 0.075),
    PALETTE.robeFace,
    PALETTE.robeEdge,
    { depth: 0.13, order: 12 },
  );
  puppet.attach("armFront", frontArm, 0.21);

  // Front arm rim.
  const frontArmRim = kit.card(
    PaperKit.roundedRect(0.17, 0.42, 0.075),
    PALETTE.robeRim,
    PALETTE.robeRim,
    { depth: 0.02, order: 11 },
  );
  frontArmRim.scale.setScalar(1.1);
  frontArmRim.position.z = -0.06;
  puppet.attach("armFront", frontArmRim, 0.21);

  // Small hand card at the front arm's end (the one holding the staff).
  const hand = kit.card(
    PaperKit.blob(0.09, 3, 0.05, 6.7, 1),
    PALETTE.skin,
    PALETTE.skinEdge,
    { depth: 0.08, order: 12 },
  );
  puppet.attach("armFront", hand, 0.44, 0, 0.14);

  // --- Staff --------------------------------------------------------------
  // Parented to the front arm, so aiming the arm aims the staff.
  const staff = kit.card(
    PaperKit.roundedRect(0.075, 1.15, 0.035),
    PALETTE.staffWood,
    PALETTE.staffEdge,
    { depth: 0.1, order: 13 },
  );
  puppet.attach("armFront", staff, 0.5, 0.02, 0.08);

  // A wooden knot detail on the staff — one small darker card partway up.
  const staffKnot = kit.card(
    PaperKit.blob(0.06, 4, 0.15, 3.3, 1.2),
    PALETTE.staffKnot,
    PALETTE.staffEdge,
    { depth: 0.04, order: 13 },
  );
  puppet.attach("armFront", staffKnot, 0.72, 0.02, 0.12);

  // Orb: the primary, brighter card, plus a rim halo behind it.
  const orbShape = PaperKit.blob(0.13, 4, 0.04, 4.4);
  const orb = kit.card(orbShape, PALETTE.arcaneOuter, PALETTE.arcaneDeep, {
    depth: 0.14,
    order: 15,
    bevel: 0.02,
  });
  puppet.attach("armFront", orb, 1.02, 0.02, 0.1);

  // Orb inner core (brighter).
  const orbCore = kit.card(
    PaperKit.blob(0.06, 3, 0.06, 7.3),
    PALETTE.arcanePlasma,
    PALETTE.arcaneCore,
    { depth: 0.06, order: 16 },
  );
  puppet.attach("armFront", orbCore, 1.02, 0.02, 0.14);

  const orbGlow = kit.glowDisc(0.5, PALETTE.arcane, 24);
  orbGlow.renderOrder = 14;
  puppet.attach("armFront", orbGlow, 1.02, 0.02, 0.05);

  const orbAura = kit.glowDisc(0.85, PALETTE.arcaneOuter, 24, 1.3);
  orbAura.renderOrder = 13;
  (orbAura.material as THREE.Material).opacity = 0.35;
  puppet.attach("armFront", orbAura, 1.02, 0.02, 0.02);

  // Muzzle flare, hidden until a spell fires.
  const flare = kit.glowDisc(0.95, PALETTE.arcaneCore, 22);
  flare.renderOrder = 17;
  flare.visible = false;
  puppet.attach("armFront", flare, 1.12, 0.02, 0.16);

  // --- Orbiting motes -----------------------------------------------------
  // Three cyan glow discs orbiting the orb. Slow and pretty — the player's
  // eye catches them between fights and it draws attention back to the
  // character.
  const motePivots: THREE.Group[] = [];
  const motes: THREE.Mesh[] = [];
  const motePhases: number[] = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    puppet.attach("armFront", pivot, 1.02, 0.02, 0.1);
    const mote = kit.glowDisc(0.05, PALETTE.arcaneOuter, 12);
    mote.position.x = 0.28;
    pivot.add(mote);
    motePivots.push(pivot);
    motes.push(mote);
    motePhases.push((i / 3) * Math.PI * 2);
  }

  // --- Robe hem particles (tiny cyan sparks) ------------------------------
  // A row of small glow discs along the hem which pulse in place. Not
  // particles — they don't move — so no pooling overhead.
  const hemSparks: THREE.Mesh[] = [];
  const hemSparkPhases: number[] = [];
  for (let i = 0; i < 5; i++) {
    const spark = kit.glowDisc(0.04, PALETTE.arcaneOuter, 8);
    puppet.attach("body", spark, 0.5, -0.35 + i * 0.175, 0.2);
    (spark.material as THREE.Material).opacity = 0.5;
    hemSparks.push(spark);
    hemSparkPhases.push(i * 0.9);
  }

  const root = puppet.root;

  // --- Cast state ---------------------------------------------------------
  // Kept out of update() so the closure doesn't reallocate per frame.
  let castHeat = 0;

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

      // Ease castHeat toward castFlash so eye glow and hair flutter
      // don't jump.
      castHeat += (castFlash - castHeat) * 0.35;

      // Orb breathes constantly, then spikes on cast.
      const t = input.time + input.phase;
      const idlePulse = 1 + Math.sin(t * 3.4) * 0.12;
      const castPulse = 1 + castFlash * 1.5;
      orbGlow.scale.setScalar(idlePulse * castPulse);
      (orbGlow.material as THREE.Material).opacity = 0.6 + castFlash * 0.4;
      orbAura.scale.setScalar((idlePulse * castPulse) * 1.2);
      (orbAura.material as THREE.Material).opacity = 0.28 + castFlash * 0.35;
      orbCore.scale.setScalar(1 + Math.sin(t * 5.2) * 0.14 + castFlash * 0.3);

      flare.visible = castFlash > 0.02;
      if (flare.visible) {
        flare.scale.setScalar(0.5 + castFlash * 0.9);
        (flare.material as THREE.Material).opacity = castFlash;
      }

      // Eye glow tracks the cast heat. On cast the eyes get slightly brighter.
      for (const eye of eyeCyanCores) {
        (eye.material as THREE.Material).opacity = 0.6 + castHeat * 0.4;
      }

      // Hat star gently pulses.
      hatStar.rotation.z = Math.sin(t * 0.9) * 0.06;
      (hatStarGlow.material as THREE.Material).opacity =
        0.5 + Math.sin(t * 1.8) * 0.12;

      // Hair flutters based on horizontal speed and a low-amplitude sine.
      const hairFlutter = Math.sin(t * 6.1) * 0.06 + input.speedRatio * 0.2;
      hair.rotation.z = hairFlutter;
      hair.position.x = 0.02 * input.speedRatio;

      // Cloak lags behind body movement — its rotation is opposite the run
      // stride and slightly delayed.
      cloak.rotation.z = -input.speedRatio * 0.12 + Math.sin(t * 2.1) * 0.03;

      // Orbiting motes rotate at a slow constant rate.
      for (let i = 0; i < motePivots.length; i++) {
        const angle = t * 0.9 + motePhases[i];
        motePivots[i].rotation.z = angle;
        // Vertical bob relative to the pivot for a 3D orbit feel.
        motes[i].position.y = Math.sin(angle * 1.7) * 0.06;
        (motes[i].material as THREE.Material).opacity =
          0.55 + Math.sin(t * 3 + i) * 0.2;
      }

      // Hem sparks pulse in a running wave.
      for (let i = 0; i < hemSparks.length; i++) {
        const phase = t * 3.8 + hemSparkPhases[i];
        (hemSparks[i].material as THREE.Material).opacity =
          0.35 + Math.max(0, Math.sin(phase)) * 0.55;
      }

      void rimColor;
    },
  };
}
