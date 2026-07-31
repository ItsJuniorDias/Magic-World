import * as THREE from "three";
import { isBossKind, type EnemyKind } from "../config";
import { createBoss } from "./bosses";
import { PALETTE, rim as rimColor, shade, shift } from "./palette";
import { PaperKit } from "./paper";
import { Puppet, type PoseInput } from "./puppet";

/**
 * Every enemy in the game — HD pass.
 *
 * Each creature owns *private* materials rather than shared ones, because
 * each needs to flash white independently when it takes a hit. That flash is
 * non-negotiable in a shooter: without it the player cannot tell whether a
 * shot connected, and a golem that soaks five hits feels broken rather than
 * tough. It is the cheapest possible feedback and it does more for feel than
 * any particle effect.
 *
 * Creatures are pooled. `reset()` returns one to its spawn state so the pool
 * can hand it out again without reallocating geometry.
 *
 * WHAT HD ADDS (per-creature, discretionary)
 *
 *   slime  — a brighter inner core, a rim, a dribble beneath the mouth.
 *   bat    — segmented wings (bones), glowing eye cores, chest fur tuft.
 *   golem  — pauldrons, cracks glowing through the torso, chunkier fists.
 *   wisp   — bigger halo, more tails, a warm inner nucleus.
 *   dragon — the finale. This one gets the full treatment: layered scales,
 *            glowing belly veins, filigreed horns, larger wing spans with
 *            wing bones, a full mouth glow when charging.
 *
 * Rank-and-file enemies (slime/bat/wisp) can be dozens on screen at once
 * so their part count grows only by a handful of cards. The dragon is
 * built like a boss — because it IS the final boss.
 */

export interface Creature {
  kind: EnemyKind;
  root: THREE.Group;
  puppet: Puppet;
  /** 0 = normal colour, 1 = fully white. */
  setFlash(amount: number): void;
  update(input: PoseInput, extra: number): void;
  reset(): void;
}

interface Tintable {
  material: THREE.MeshBasicMaterial;
  base: THREE.Color;
}

/** Wraps the flash bookkeeping shared by every creature. */
function makeFlasher(tints: Tintable[]) {
  const white = new THREE.Color(PALETTE.hitFlash);
  return (amount: number) => {
    const a = Math.min(1, Math.max(0, amount));
    for (const t of tints) {
      t.material.color.copy(t.base).lerp(white, a);
    }
  };
}

export function createCreature(kit: PaperKit, kind: EnemyKind): Creature {
  switch (kind) {
    case "slime":
      return createSlime(kit);
    case "bat":
      return createBat(kit);
    case "golem":
      return createGolem(kit);
    case "wisp":
      return createWisp(kit);
    case "dragon":
      // The Storm Dragon is the finale, built here because it predates the
      // other six and there was no reason to rewrite a working boss.
      return createDragon(kit);
    default:
      if (isBossKind(kind)) return createBoss(kit, kind);
      return createSlime(kit);
  }
}

// ---------------------------------------------------------------------------
// Slime — the tutorial enemy. Hops, squashes on landing.
// HD: brighter inner nucleus + rim + dribble.
// ---------------------------------------------------------------------------
function createSlime(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 0.4);
  const tints: Tintable[] = [];

  const track = (m: THREE.MeshBasicMaterial, hex: number) =>
    tints.push({ material: m, base: new THREE.Color(hex) });

  const bodyShape = PaperKit.blob(0.52, 5, 0.1, 2.3, 0.85);
  // Rim card — a slightly larger, brighter clone behind the primary.
  const rimHex = rimColor(PALETTE.slimeFace, PALETTE.slimeRim, 0.55);
  const rimClone = kit.card(bodyShape, rimHex, rimHex, {
    depth: 0.05,
    order: 19,
  });
  rimClone.scale.setScalar(1.08);
  rimClone.position.z = -0.06;
  puppet.attach("body", rimClone, 0);

  const body = kit.tintableCard(bodyShape, PALETTE.slimeFace, PALETTE.slimeEdge, {
    depth: 0.4,
    order: 20,
  });
  track(body.face, PALETTE.slimeFace);
  track(body.edge, PALETTE.slimeEdge);
  puppet.attach("body", body.mesh, 0);

  // Inner nucleus — a pale core visible through the jelly, giving the slime
  // a centre of gravity.
  const nucleus = kit.tintableCard(
    PaperKit.blob(0.24, 4, 0.1, 5.3, 0.9),
    PALETTE.slimeRim,
    PALETTE.slimeRim,
    { depth: 0.06, order: 21 },
  );
  track(nucleus.face, PALETTE.slimeRim);
  (nucleus.mesh.material as THREE.Material[])[0].transparent = true;
  (nucleus.mesh.material as THREE.Material[])[0].opacity = 0.55;
  puppet.attach("body", nucleus.mesh, -0.04, 0.08, 0.15);

  const shine = kit.tintableCard(PaperKit.blob(0.15, 3, 0.1, 7.1, 0.7), PALETTE.slimeShine, PALETTE.slimeShine, {
    depth: 0.05,
    order: 22,
  });
  track(shine.face, PALETTE.slimeShine);
  puppet.attach("body", shine.mesh, -0.18, -0.16, 0.22);

  for (const dx of [-0.1, 0.16]) {
    const eye = kit.tintableCard(PaperKit.roundedRect(0.08, 0.11, 0.04), 0x1e2b18, 0x1e2b18, {
      depth: 0.04,
      order: 22,
    });
    track(eye.face, 0x1e2b18);
    puppet.attach("body", eye.mesh, -0.02, dx, 0.22);

    // Small white glint in each eye.
    const glint = kit.tintableCard(PaperKit.roundedRect(0.03, 0.04, 0.015), 0xffffff, 0xffffff, {
      depth: 0.03,
      order: 23,
    });
    track(glint.face, 0xffffff);
    puppet.attach("body", glint.mesh, -0.04, dx + 0.02, 0.24);
  }

  // Little drip beneath the mouth — a tiny inverted teardrop.
  const drip = kit.tintableCard(
    PaperKit.polygon([
      [-0.05, 0],
      [0.05, 0],
      [0.02, -0.16],
      [-0.02, -0.16],
    ]),
    PALETTE.slimeFace,
    PALETTE.slimeEdge,
    { depth: 0.05, order: 21 },
  );
  track(drip.face, PALETTE.slimeFace);
  puppet.attach("body", drip.mesh, 0.28, 0, 0.16);

  const setFlash = makeFlasher(tints);

  return {
    kind: "slime",
    root: puppet.root,
    puppet,
    setFlash,
    update(input) {
      // Airborne slimes stretch vertically, grounded ones settle and wobble.
      const t = input.time + input.phase;
      if (!input.onGround) {
        const stretch = 1 + Math.min(0.3, Math.abs(input.vy) * 0.016);
        puppet.setSquash(1 / stretch, stretch);
      } else {
        const wobble = Math.sin(t * 8) * 0.05;
        puppet.setSquash(1 + wobble, 1 - wobble);
      }
    },
    reset() {
      puppet.setSquash(1, 1);
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Bat — fast, erratic, flaps constantly.
// HD: wing bones, glowing eye cores, fur tuft.
// ---------------------------------------------------------------------------
function createBat(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 0.34);
  puppet.joint("armBack", "body", -0.14, 0.06, 0, -0.1);
  puppet.joint("armFront", "body", 0.14, 0.06, 0, 0.1);
  const tints: Tintable[] = [];

  const track = (m: THREE.MeshBasicMaterial, hex: number) =>
    tints.push({ material: m, base: new THREE.Color(hex) });

  // Rim card behind the body.
  const bodyShape = PaperKit.blob(0.3, 4, 0.08, 5.5, 1.1);
  const rimClone = kit.card(bodyShape, PALETTE.batRim, PALETTE.batRim, {
    depth: 0.04,
    order: 19,
  });
  rimClone.scale.setScalar(1.09);
  rimClone.position.z = -0.05;
  puppet.attach("body", rimClone, 0);

  const body = kit.tintableCard(bodyShape, PALETTE.batFace, PALETTE.batEdge, {
    depth: 0.26,
    order: 20,
  });
  track(body.face, PALETTE.batFace);
  track(body.edge, PALETTE.batEdge);
  puppet.attach("body", body.mesh, 0);

  // Small fur tuft on the chest — a pale patch.
  const tuft = kit.tintableCard(
    PaperKit.blob(0.14, 4, 0.16, 6.7, 0.9),
    PALETTE.batRim,
    PALETTE.batRim,
    { depth: 0.06, order: 21 },
  );
  track(tuft.face, PALETTE.batRim);
  puppet.attach("body", tuft.mesh, -0.02, 0, 0.2);

  // Ears — the one detail that stops it reading as a generic blob.
  for (const dx of [-0.13, 0.13]) {
    const ear = kit.tintableCard(
      PaperKit.polygon([
        [-0.08, 0],
        [0.08, 0],
        [0.02, 0.24],
      ]),
      PALETTE.batFace,
      PALETTE.batEdge,
      { depth: 0.1, order: 21 },
    );
    track(ear.face, PALETTE.batFace);
    puppet.attach("body", ear.mesh, -0.26, dx);

    // Inner ear detail.
    const innerEar = kit.tintableCard(
      PaperKit.polygon([
        [-0.04, 0.05],
        [0.04, 0.05],
        [0.01, 0.18],
      ]),
      PALETTE.batWing,
      PALETTE.batWing,
      { depth: 0.05, order: 22 },
    );
    track(innerEar.face, PALETTE.batWing);
    puppet.attach("body", innerEar.mesh, -0.26, dx, 0.06);
  }

  // Wings: scalloped trailing edge, hinged at the shoulder.
  for (const [joint, dir] of [
    ["armBack", -1],
    ["armFront", 1],
  ] as const) {
    const wingShape = PaperKit.polygon([
      [0, 0],
      [dir * 0.62, 0.16],
      [dir * 0.52, -0.02],
      [dir * 0.66, -0.1],
      [dir * 0.44, -0.14],
      [dir * 0.5, -0.24],
      [dir * 0.16, -0.16],
    ]);
    const wing = kit.tintableCard(wingShape, PALETTE.batWing, PALETTE.batEdge, {
      depth: 0.05,
      order: 19,
    });
    track(wing.face, PALETTE.batWing);
    puppet.attach(joint, wing.mesh, 0);

    // Wing bones — three tiny darker lines from shoulder to tips.
    for (let i = 0; i < 3; i++) {
      const boneEnd = 0.4 + i * 0.15;
      const bone = kit.tintableCard(
        PaperKit.polygon([
          [0, -0.01],
          [0, 0.01],
          [dir * boneEnd, i * 0.05 - 0.06],
        ]),
        shade(PALETTE.batWing, 0.35),
        shade(PALETTE.batWing, 0.35),
        { depth: 0.02, order: 20 },
      );
      track(bone.face, shade(PALETTE.batWing, 0.35));
      bone.mesh.position.z = 0.05;
      puppet.attach(joint, bone.mesh, 0);
    }
  }

  // Eyes — a warm golden dot on a slightly larger glow.
  for (const dx of [-0.09, 0.09]) {
    const eyeGlow = kit.glowDisc(0.1, PALETTE.gold, 12);
    (eyeGlow.material as THREE.Material).opacity = 0.55;
    puppet.attach("body", eyeGlow, -0.02, dx, 0.14);

    const eye = kit.tintableCard(PaperKit.roundedRect(0.06, 0.06, 0.03), PALETTE.gold, PALETTE.gold, {
      depth: 0.03,
      order: 22,
    });
    track(eye.face, PALETTE.gold);
    puppet.attach("body", eye.mesh, -0.02, dx, 0.16);
  }

  const setFlash = makeFlasher(tints);

  return {
    kind: "bat",
    root: puppet.root,
    puppet,
    setFlash,
    update(input) {
      puppet.poseCreature(input, 17, 0.75);
    },
    reset() {
      puppet.setSquash(1, 1);
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Golem — slow, armoured, telegraphs a slam. `extra` is windup progress 0..1.
// HD: pauldrons, cracks, brighter core, textured torso.
// ---------------------------------------------------------------------------
function createGolem(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 0.92);
  puppet.joint("head", "body", 0, 0.42);
  puppet.joint("armBack", "body", -0.36, 0.3, 0.2, -0.14);
  puppet.joint("armFront", "body", 0.36, 0.3, -0.2, 0.16);
  puppet.joint("legBack", "root", -0.24, 0.44, 0, -0.12);
  puppet.joint("legFront", "root", 0.24, 0.44, 0, 0.12);
  const tints: Tintable[] = [];

  const track = (m: THREE.MeshBasicMaterial, hex: number) =>
    tints.push({ material: m, base: new THREE.Color(hex) });

  for (const name of ["legBack", "legFront"] as const) {
    const leg = kit.tintableCard(PaperKit.roundedRect(0.34, 0.5, 0.1), PALETTE.golemEdge, PALETTE.golemEdge, {
      depth: 0.28,
      order: 19,
    });
    track(leg.face, PALETTE.golemEdge);
    puppet.attach(name, leg.mesh, 0.25);

    // Foot chunk at the bottom.
    const foot = kit.tintableCard(
      PaperKit.roundedRect(0.42, 0.14, 0.05),
      shade(PALETTE.golemFace, 0.2),
      PALETTE.golemEdge,
      { depth: 0.28, order: 19 },
    );
    track(foot.face, shade(PALETTE.golemFace, 0.2));
    puppet.attach(name, foot.mesh, 0.5, 0.04);
  }

  // Torso: primary + rim.
  const torsoShape = PaperKit.polygon([
    [-0.62, 0.5],
    [0.62, 0.5],
    [0.5, -0.52],
    [-0.5, -0.52],
  ]);
  const torsoRim = kit.card(torsoShape, PALETTE.golemRim, PALETTE.golemRim, {
    depth: 0.02,
    order: 19,
  });
  torsoRim.scale.setScalar(1.06);
  torsoRim.position.z = -0.06;
  puppet.attach("body", torsoRim, 0);

  const torso = kit.tintableCard(torsoShape, PALETTE.golemFace, PALETTE.golemEdge, {
    depth: 0.5,
    order: 20,
  });
  track(torso.face, PALETTE.golemFace);
  track(torso.edge, PALETTE.golemEdge);
  puppet.attach("body", torso.mesh, 0);

  // Cracks — thin warm cards seeping through the stone.
  for (const [dx, dy, rot, len] of [
    [-0.22, 0.15, 0.3, 0.5],
    [0.3, -0.15, -0.5, 0.4],
  ] as const) {
    const crack = kit.tintableCard(
      PaperKit.polygon([
        [-0.015, 0],
        [0.015, 0],
        [-0.03, len],
        [-0.06, len],
      ]),
      PALETTE.golemCore,
      PALETTE.golemCore,
      { depth: 0.04, order: 21 },
    );
    track(crack.face, PALETTE.golemCore);
    crack.mesh.rotation.z = rot;
    puppet.attach("body", crack.mesh, dy, dx, 0.28);
  }

  // Pauldrons — shoulder chunks.
  for (const [dx, dir] of [[-0.6, -1], [0.6, 1]] as const) {
    const paul = kit.tintableCard(
      PaperKit.polygon([
        [-0.24 * dir, 0.24],
        [0.2 * dir, 0.24],
        [0.32 * dir, -0.02],
        [-0.28 * dir, -0.1],
      ]),
      shift(PALETTE.golemFace, -0.1),
      PALETTE.golemEdge,
      { depth: 0.3, order: 21 },
    );
    track(paul.face, shift(PALETTE.golemFace, -0.1));
    puppet.attach("body", paul.mesh, 0.35, dx, 0.16);
  }

  // The core. Doubles as the tell: it brightens during the slam windup, so a
  // player who has died to it once knows to move before the arms come down.
  const core = kit.tintableCard(PaperKit.blob(0.22, 6, 0.14, 3.3), PALETTE.golemCore, PALETTE.golemCore, {
    depth: 0.06,
    order: 22,
  });
  track(core.face, PALETTE.golemCore);
  puppet.attach("body", core.mesh, 0.04, 0, 0.28);
  const coreGlow = kit.glowDisc(0.6, PALETTE.golemCore, 16);
  coreGlow.renderOrder = 21;
  puppet.attach("body", coreGlow, 0.04, 0, 0.24);
  const coreOuterGlow = kit.glowDisc(1.0, PALETTE.golemCore, 18, 1.5);
  (coreOuterGlow.material as THREE.Material).opacity = 0.3;
  coreOuterGlow.renderOrder = 20;
  puppet.attach("body", coreOuterGlow, 0.04, 0, 0.22);

  const headShape = PaperKit.roundedRect(0.5, 0.4, 0.12);
  const headRim = kit.card(headShape, PALETTE.golemRim, PALETTE.golemRim, {
    depth: 0.02,
    order: 21,
  });
  headRim.scale.setScalar(1.06);
  headRim.position.z = -0.05;
  puppet.attach("head", headRim, -0.2);

  const head = kit.tintableCard(headShape, PALETTE.golemFace, PALETTE.golemEdge, {
    depth: 0.36,
    order: 22,
  });
  track(head.face, PALETTE.golemFace);
  puppet.attach("head", head.mesh, -0.2);

  for (const dx of [-0.11, 0.11]) {
    const eyeGlow = kit.glowDisc(0.14, PALETTE.golemCore, 12);
    (eyeGlow.material as THREE.Material).opacity = 0.6;
    puppet.attach("head", eyeGlow, -0.2, dx, 0.18);

    const eye = kit.tintableCard(PaperKit.roundedRect(0.09, 0.05, 0.02), PALETTE.golemCore, PALETTE.golemCore, {
      depth: 0.03,
      order: 23,
    });
    track(eye.face, PALETTE.golemCore);
    puppet.attach("head", eye.mesh, -0.2, dx, 0.2);
  }

  for (const name of ["armBack", "armFront"] as const) {
    const arm = kit.tintableCard(PaperKit.roundedRect(0.28, 0.56, 0.11), PALETTE.golemFace, PALETTE.golemEdge, {
      depth: 0.24,
      order: name === "armFront" ? 23 : 19,
    });
    track(arm.face, PALETTE.golemFace);
    puppet.attach(name, arm.mesh, 0.28);
    const fist = kit.tintableCard(PaperKit.blob(0.26, 5, 0.12, 6.6), PALETTE.golemFace, PALETTE.golemEdge, {
      depth: 0.34,
      order: name === "armFront" ? 24 : 19,
    });
    track(fist.face, PALETTE.golemFace);
    puppet.attach(name, fist.mesh, 0.62);

    // Knuckle spike on each fist.
    const spike = kit.tintableCard(
      PaperKit.polygon([
        [-0.06, 0],
        [0.06, 0],
        [0, 0.16],
      ]),
      shade(PALETTE.golemFace, 0.2),
      PALETTE.golemEdge,
      { depth: 0.1, order: name === "armFront" ? 25 : 19 },
    );
    track(spike.face, shade(PALETTE.golemFace, 0.2));
    puppet.attach(name, spike.mesh, 0.72, 0, 0.12);
  }

  const setFlash = makeFlasher(tints);

  return {
    kind: "golem",
    root: puppet.root,
    puppet,
    setFlash,
    update(input, windup) {
      puppet.poseHumanoid({ ...input, aimAngle: null });
      // Arms rise together during the windup, then hammer down.
      if (windup > 0) {
        const lift = Math.sin(Math.min(1, windup) * Math.PI * 0.5) * 2.2;
        puppet.get("armBack").rotation.z = 0.2 + lift;
        puppet.get("armFront").rotation.z = -0.2 - lift;
        coreGlow.scale.setScalar(1 + windup * 1.4);
        coreOuterGlow.scale.setScalar(1 + windup * 1.6);
        (coreGlow.material as THREE.Material).opacity = 0.5 + windup * 0.5;
        (coreOuterGlow.material as THREE.Material).opacity = 0.25 + windup * 0.4;
      } else {
        const idlePulse = 1 + Math.sin(input.time * 2.4) * 0.1;
        coreGlow.scale.setScalar(idlePulse);
        coreOuterGlow.scale.setScalar(idlePulse * 1.1);
        (coreGlow.material as THREE.Material).opacity = 0.45;
        (coreOuterGlow.material as THREE.Material).opacity = 0.25;
      }
    },
    reset() {
      puppet.setSquash(1, 1);
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Wisp — floats, keeps its distance, fires slow orbs.
// HD: bigger halo + inner nucleus + 5 tails.
// ---------------------------------------------------------------------------
function createWisp(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 0.5);
  const tints: Tintable[] = [];

  const track = (m: THREE.MeshBasicMaterial, hex: number) =>
    tints.push({ material: m, base: new THREE.Color(hex) });

  // Big outer halo.
  const outerHalo = kit.glowDisc(1.1, PALETTE.wispFace, 22, 1.4);
  (outerHalo.material as THREE.Material).opacity = 0.3;
  outerHalo.renderOrder = 18;
  puppet.attach("body", outerHalo, 0);

  const coreShape = PaperKit.blob(0.28, 6, 0.12, 8.2);
  // Rim.
  const coreRim = kit.card(coreShape, PALETTE.wispRim, PALETTE.wispRim, {
    depth: 0.04,
    order: 19,
  });
  coreRim.scale.setScalar(1.1);
  coreRim.position.z = -0.05;
  puppet.attach("body", coreRim, 0);

  const core = kit.tintableCard(coreShape, PALETTE.wispFace, PALETTE.wispEdge, {
    depth: 0.24,
    order: 20,
  });
  track(core.face, PALETTE.wispFace);
  track(core.edge, PALETTE.wispEdge);
  puppet.attach("body", core.mesh, 0);

  // Inner nucleus — a brighter smaller card.
  const nucleus = kit.tintableCard(
    PaperKit.blob(0.14, 5, 0.1, 3.4),
    PALETTE.arcaneCore,
    PALETTE.wispRim,
    { depth: 0.06, order: 22 },
  );
  track(nucleus.face, PALETTE.arcaneCore);
  puppet.attach("body", nucleus.mesh, -0.02, 0, 0.14);

  const glow = kit.glowDisc(0.72, PALETTE.wispFace, 18);
  glow.renderOrder = 19;
  puppet.attach("body", glow, 0);

  // Five trailing tails that lag behind the body (was 3).
  const tails: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) {
    const tail = kit.tintableCard(
      PaperKit.blob(0.14 - i * 0.02, 4, 0.16, i * 4.1),
      PALETTE.wispFace,
      PALETTE.wispEdge,
      { depth: 0.08, order: 19 },
    );
    track(tail.face, PALETTE.wispFace);
    const holder = new THREE.Group();
    holder.add(tail.mesh);
    puppet.get("body").add(holder);
    tails.push(holder);
  }

  for (const dx of [-0.09, 0.09]) {
    const eye = kit.tintableCard(PaperKit.roundedRect(0.05, 0.09, 0.025), 0x4a3210, 0x4a3210, {
      depth: 0.03,
      order: 23,
    });
    track(eye.face, 0x4a3210);
    puppet.attach("body", eye.mesh, -0.02, dx, 0.18);

    // Small white glint.
    const glint = kit.tintableCard(PaperKit.roundedRect(0.02, 0.03, 0.01), 0xffffff, 0xffffff, {
      depth: 0.02,
      order: 24,
    });
    track(glint.face, 0xffffff);
    puppet.attach("body", glint.mesh, -0.04, dx + 0.01, 0.2);
  }

  const setFlash = makeFlasher(tints);

  return {
    kind: "wisp",
    root: puppet.root,
    puppet,
    setFlash,
    update(input, charge) {
      const t = input.time + input.phase;
      tails.forEach((tail, i) => {
        const lag = (i + 1) * 0.35;
        tail.position.set(Math.sin(t * 2.2 - lag) * 0.22, -0.32 - i * 0.15, -0.1);
      });
      const pulse = 1 + Math.sin(t * 3) * 0.12 + charge * 0.7;
      glow.scale.setScalar(pulse);
      outerHalo.scale.setScalar(pulse * 1.15);
      (glow.material as THREE.Material).opacity = 0.5 + charge * 0.5;
      (outerHalo.material as THREE.Material).opacity = 0.28 + charge * 0.4;
    },
    reset() {
      puppet.setSquash(1, 1);
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Dragon — the wave 10 boss (and the arc's finale).
// HD: full boss treatment — layered scales, wing bones, glowing belly veins,
// filigreed horns, a full mouth glow with rim.
// ---------------------------------------------------------------------------
function createDragon(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 0);
  puppet.joint("head", "body", 1.45, 0.3, 0, 0.2);
  puppet.joint("armBack", "body", -0.3, 0.55, 0, -0.4);
  puppet.joint("armFront", "body", -0.1, 0.6, 0, 0.4);
  puppet.joint("extra", "body", -1.5, 0.1, 0, -0.1); // tail
  const tints: Tintable[] = [];
  const track = (m: THREE.MeshBasicMaterial, hex: number) =>
    tints.push({ material: m, base: new THREE.Color(hex) });

  // Aura — a red-orange glow around the whole dragon.
  const dragonAura = kit.glowDisc(5.2, PALETTE.dragonRim, 36, 1.4);
  (dragonAura.material as THREE.Material).opacity = 0.22;
  puppet.attach("body", dragonAura, 0.4, 0, -1.2);
  const dragonAuraMat = dragonAura.material as THREE.Material;

  // Wings first so they sit behind everything.
  for (const [joint, dir, order] of [
    ["armBack", -1, 17],
    ["armFront", 1, 18],
  ] as const) {
    const wingShape = PaperKit.polygon([
      [0, 0],
      [-0.5, 1.9],
      [0.35, 1.55],
      [0.5, 2.15],
      [1.15, 1.4],
      [1.05, 0.75],
      [1.55, 0.55],
      [0.6, 0.15],
    ]);

    // Wing rim clone — a brighter version behind the wing.
    const rimHex = rimColor(PALETTE.dragonWing, PALETTE.dragonRim, 0.55);
    const rimWing = kit.card(wingShape, rimHex, rimHex, {
      depth: 0.03,
      order: order - 1,
    });
    rimWing.scale.setScalar(1.05);
    rimWing.position.z = dir * 0.22;
    puppet.attach(joint, rimWing, 0);

    const wing = kit.tintableCard(wingShape, PALETTE.dragonWing, PALETTE.dragonEdge, {
      depth: 0.08,
      order,
    });
    track(wing.face, PALETTE.dragonWing);
    const mesh = puppet.attach(joint, wing.mesh, 0);
    mesh.position.z = dir * 0.25;

    // Wing bones — three thin cards traversing the wing.
    for (let i = 0; i < 3; i++) {
      const bone = kit.tintableCard(
        PaperKit.polygon([
          [0, -0.02],
          [0, 0.02],
          [-0.3 + i * 0.3, 1.7 - i * 0.4],
          [-0.34 + i * 0.3, 1.7 - i * 0.4],
        ]),
        shade(PALETTE.dragonWing, 0.3),
        shade(PALETTE.dragonWing, 0.3),
        { depth: 0.03, order: order + 1 },
      );
      track(bone.face, shade(PALETTE.dragonWing, 0.3));
      bone.mesh.position.z = dir * 0.28;
      puppet.attach(joint, bone.mesh, 0);
    }
  }

  const bodyShape = PaperKit.blob(1.25, 5, 0.14, 9.4, 0.66);
  // Body rim.
  const bodyRim = kit.card(bodyShape, PALETTE.dragonRim, PALETTE.dragonRim, {
    depth: 0.04,
    order: 19,
  });
  bodyRim.scale.setScalar(1.05);
  bodyRim.position.z = -0.06;
  puppet.attach("body", bodyRim, 0);

  const body = kit.tintableCard(bodyShape, PALETTE.dragonFace, PALETTE.dragonEdge, {
    depth: 0.7,
    order: 20,
  });
  track(body.face, PALETTE.dragonFace);
  track(body.edge, PALETTE.dragonEdge);
  puppet.attach("body", body.mesh, 0);

  // Scale ridges along the back — five bumps of darker cards.
  for (let i = 0; i < 5; i++) {
    const scale = kit.tintableCard(
      PaperKit.polygon([
        [-0.16, 0],
        [0.16, 0],
        [0, 0.28],
      ]),
      PALETTE.dragonScale,
      PALETTE.dragonEdge,
      { depth: 0.1, order: 21 },
    );
    track(scale.face, PALETTE.dragonScale);
    puppet.attach("body", scale.mesh, -0.6 - i * 0.12, -0.5 + i * 0.3, 0.34);
  }

  const belly = kit.tintableCard(PaperKit.blob(0.78, 4, 0.1, 2.8, 0.42), PALETTE.dragonBelly, PALETTE.dragonBelly, {
    depth: 0.1,
    order: 21,
  });
  track(belly.face, PALETTE.dragonBelly);
  puppet.attach("body", belly.mesh, 0.34, 0.1, 0.36);

  // Belly veins — three horizontal warm cards on the belly.
  for (let i = 0; i < 3; i++) {
    const vein = kit.tintableCard(
      PaperKit.roundedRect(0.5, 0.03, 0.01),
      PALETTE.cinderCore,
      PALETTE.cinderCore,
      { depth: 0.03, order: 22 },
    );
    track(vein.face, PALETTE.cinderCore);
    puppet.attach("body", vein.mesh, 0.2 - i * 0.14, 0.1, 0.42);
  }

  // Tail: three tapering segments on one joint, offset along -x.
  for (let i = 0; i < 3; i++) {
    const seg = kit.tintableCard(PaperKit.blob(0.42 - i * 0.11, 4, 0.1, i * 3.3, 0.7), PALETTE.dragonFace, PALETTE.dragonEdge, {
      depth: 0.3,
      order: 19,
    });
    track(seg.face, PALETTE.dragonFace);
    puppet.attach("extra", seg.mesh, 0, -i * 0.5, -0.05);
  }

  // Tail spikes at the end.
  const tailSpike = kit.tintableCard(
    PaperKit.polygon([
      [-0.15, 0],
      [0.15, 0],
      [-0.24, 0.42],
    ]),
    PALETTE.dragonBelly,
    PALETTE.dragonEdge,
    { depth: 0.14, order: 20 },
  );
  track(tailSpike.face, PALETTE.dragonBelly);
  puppet.attach("extra", tailSpike, 0, -1.4, 0.05);

  const headShape = PaperKit.polygon([
    [-0.45, -0.4],
    [0.72, -0.32],
    [0.95, -0.05],
    [0.6, 0.2],
    [0.1, 0.48],
    [-0.45, 0.35],
  ]);

  // Head rim.
  const headRim = kit.card(headShape, PALETTE.dragonRim, PALETTE.dragonRim, {
    depth: 0.04,
    order: 22,
  });
  headRim.scale.setScalar(1.06);
  headRim.position.z = -0.06;
  puppet.attach("head", headRim, 0);

  const head = kit.tintableCard(headShape, PALETTE.dragonFace, PALETTE.dragonEdge, {
    depth: 0.55,
    order: 23,
  });
  track(head.face, PALETTE.dragonFace);
  track(head.edge, PALETTE.dragonEdge);
  puppet.attach("head", head.mesh, 0);

  // Horns — with filigree curl.
  for (const [hx, hy, len] of [
    [-0.18, 0.36, 0.5],
    [-0.42, 0.28, 0.36],
  ] as const) {
    const horn = kit.tintableCard(
      PaperKit.polygon([
        [-0.09, 0],
        [0.09, 0],
        [-0.14, len],
      ]),
      PALETTE.dragonBelly,
      PALETTE.dragonEdge,
      { depth: 0.16, order: 22 },
    );
    track(horn.face, PALETTE.dragonBelly);
    puppet.attach("head", horn.mesh, 0, hx, 0);
    horn.mesh.position.y = hy;
  }

  // A row of small teeth along the jaw.
  for (let i = 0; i < 4; i++) {
    const tooth = kit.tintableCard(
      PaperKit.polygon([
        [-0.03, 0],
        [0.03, 0],
        [0, -0.09],
      ]),
      0xf0e0c0,
      0xf0e0c0,
      { depth: 0.04, order: 24 },
    );
    track(tooth.face, 0xf0e0c0);
    puppet.attach("head", tooth, -0.28, 0.2 + i * 0.15, 0.32);
  }

  // Eye + glow.
  const eyeGlow = kit.glowDisc(0.22, PALETTE.gold, 14);
  (eyeGlow.material as THREE.Material).opacity = 0.6;
  puppet.attach("head", eyeGlow, -0.06, 0.28, 0.28);

  const eye = kit.tintableCard(PaperKit.roundedRect(0.14, 0.16, 0.06), PALETTE.gold, PALETTE.gold, {
    depth: 0.04,
    order: 24,
  });
  track(eye.face, PALETTE.gold);
  puppet.attach("head", eye.mesh, -0.06, 0.28, 0.3);

  const pupil = kit.tintableCard(
    PaperKit.roundedRect(0.04, 0.16, 0.02),
    0x2a1a08,
    0x2a1a08,
    { depth: 0.03, order: 25 },
  );
  track(pupil.face, 0x2a1a08);
  puppet.attach("head", pupil.mesh, -0.06, 0.29, 0.32);

  // Mouth glow (charging) — a bigger, brighter halo, plus a base glow.
  const mawGlow = kit.glowDisc(0.75, PALETTE.skyEmber, 20);
  mawGlow.renderOrder = 25;
  mawGlow.visible = false;
  puppet.attach("head", mawGlow, -0.08, 0.95, 0.32);

  const mawCore = kit.glowDisc(0.4, PALETTE.arcaneCore, 16);
  mawCore.renderOrder = 26;
  mawCore.visible = false;
  puppet.attach("head", mawCore, -0.08, 0.95, 0.34);

  const setFlash = makeFlasher(tints);

  return {
    kind: "dragon",
    root: puppet.root,
    puppet,
    setFlash,
    update(input, breathCharge) {
      const t = input.time + input.phase;
      // Slow, heavy wingbeat — a fast flap would make it feel small.
      const flap = Math.sin(t * 3.2);
      puppet.get("armBack").rotation.z = -0.15 + flap * 0.5;
      puppet.get("armFront").rotation.z = -0.15 + flap * 0.5;
      puppet.get("body").rotation.z = flap * 0.05;
      puppet.get("body").position.y = flap * 0.18;
      puppet.get("extra").rotation.z = Math.sin(t * 2.4 + 0.8) * 0.3;
      puppet.get("head").rotation.z = Math.sin(t * 2.0) * 0.07 - breathCharge * 0.25;

      mawGlow.visible = breathCharge > 0.02;
      mawCore.visible = breathCharge > 0.02;
      if (mawGlow.visible) {
        mawGlow.scale.setScalar(0.4 + breathCharge * 1.3);
        mawCore.scale.setScalar(0.3 + breathCharge * 1.5);
        (mawGlow.material as THREE.Material).opacity = breathCharge;
        (mawCore.material as THREE.Material).opacity = breathCharge * 0.9;
      }

      dragonAuraMat.opacity = 0.2 + Math.sin(t * 0.9) * 0.05 + breathCharge * 0.3;
    },
    reset() {
      puppet.setSquash(1, 1);
      setFlash(0);
      mawGlow.visible = false;
      mawCore.visible = false;
    },
  };
}
