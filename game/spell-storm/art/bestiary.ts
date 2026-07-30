import * as THREE from "three";
import type { EnemyKind } from "../config";
import { PALETTE } from "./palette";
import { PaperKit } from "./paper";
import { Puppet, type PoseInput } from "./puppet";

/**
 * Every enemy in the game.
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
      return createDragon(kit);
  }
}

// ---------------------------------------------------------------------------
// Slime — the tutorial enemy. Hops, squashes on landing.
// ---------------------------------------------------------------------------
function createSlime(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 0.4);
  const tints: Tintable[] = [];

  const body = kit.tintableCard(PaperKit.blob(0.52, 5, 0.1, 2.3, 0.85), PALETTE.slimeFace, PALETTE.slimeEdge, {
    depth: 0.4,
    order: 20,
  });
  tints.push(
    { material: body.face, base: new THREE.Color(PALETTE.slimeFace) },
    { material: body.edge, base: new THREE.Color(PALETTE.slimeEdge) },
  );
  puppet.attach("body", body.mesh, 0);

  const shine = kit.tintableCard(PaperKit.blob(0.15, 3, 0.1, 7.1, 0.7), PALETTE.slimeShine, PALETTE.slimeShine, {
    depth: 0.05,
    order: 21,
  });
  tints.push({ material: shine.face, base: new THREE.Color(PALETTE.slimeShine) });
  puppet.attach("body", shine.mesh, -0.18, -0.16, 0.22);

  for (const dx of [-0.1, 0.16]) {
    const eye = kit.tintableCard(PaperKit.roundedRect(0.08, 0.11, 0.04), 0x1e2b18, 0x1e2b18, {
      depth: 0.04,
      order: 22,
    });
    tints.push({ material: eye.face, base: new THREE.Color(0x1e2b18) });
    puppet.attach("body", eye.mesh, -0.02, dx, 0.22);
  }

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
// ---------------------------------------------------------------------------
function createBat(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 0.34);
  puppet.joint("armBack", "body", -0.14, 0.06, 0, -0.1);
  puppet.joint("armFront", "body", 0.14, 0.06, 0, 0.1);
  const tints: Tintable[] = [];

  const body = kit.tintableCard(PaperKit.blob(0.3, 4, 0.08, 5.5, 1.1), PALETTE.batFace, PALETTE.batEdge, {
    depth: 0.26,
    order: 20,
  });
  tints.push(
    { material: body.face, base: new THREE.Color(PALETTE.batFace) },
    { material: body.edge, base: new THREE.Color(PALETTE.batEdge) },
  );
  puppet.attach("body", body.mesh, 0);

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
    tints.push({ material: ear.face, base: new THREE.Color(PALETTE.batFace) });
    puppet.attach("body", ear.mesh, -0.26, dx);
  }

  // Wings: scalloped trailing edge, hinged at the shoulder.
  for (const [joint, dir] of [
    ["armBack", -1],
    ["armFront", 1],
  ] as const) {
    const wing = kit.tintableCard(
      PaperKit.polygon([
        [0, 0],
        [dir * 0.62, 0.16],
        [dir * 0.52, -0.02],
        [dir * 0.66, -0.1],
        [dir * 0.44, -0.14],
        [dir * 0.5, -0.24],
        [dir * 0.16, -0.16],
      ]),
      PALETTE.batEdge,
      PALETTE.batEdge,
      { depth: 0.05, order: 19 },
    );
    tints.push({ material: wing.face, base: new THREE.Color(PALETTE.batEdge) });
    puppet.attach(joint, wing.mesh, 0);
  }

  for (const dx of [-0.09, 0.09]) {
    const eye = kit.tintableCard(PaperKit.roundedRect(0.06, 0.06, 0.03), PALETTE.gold, PALETTE.gold, {
      depth: 0.03,
      order: 22,
    });
    tints.push({ material: eye.face, base: new THREE.Color(PALETTE.gold) });
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
  }

  const torso = kit.tintableCard(
    PaperKit.polygon([
      [-0.62, 0.5],
      [0.62, 0.5],
      [0.5, -0.52],
      [-0.5, -0.52],
    ]),
    PALETTE.golemFace,
    PALETTE.golemEdge,
    { depth: 0.5, order: 20 },
  );
  track(torso.face, PALETTE.golemFace);
  track(torso.edge, PALETTE.golemEdge);
  puppet.attach("body", torso.mesh, 0);

  // The core. Doubles as the tell: it brightens during the slam windup, so a
  // player who has died to it once knows to move before the arms come down.
  const core = kit.tintableCard(PaperKit.blob(0.19, 6, 0.14, 3.3), PALETTE.golemCore, PALETTE.golemCore, {
    depth: 0.06,
    order: 21,
  });
  track(core.face, PALETTE.golemCore);
  puppet.attach("body", core.mesh, 0.04, 0, 0.28);
  const coreGlow = kit.glowDisc(0.5, PALETTE.golemCore, 14);
  coreGlow.renderOrder = 21;
  puppet.attach("body", coreGlow, 0.04, 0, 0.24);

  const head = kit.tintableCard(PaperKit.roundedRect(0.5, 0.4, 0.12), PALETTE.golemFace, PALETTE.golemEdge, {
    depth: 0.36,
    order: 22,
  });
  track(head.face, PALETTE.golemFace);
  puppet.attach("head", head.mesh, -0.2);

  for (const dx of [-0.11, 0.11]) {
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
    const fist = kit.tintableCard(PaperKit.blob(0.22, 5, 0.12, 6.6), PALETTE.golemFace, PALETTE.golemEdge, {
      depth: 0.3,
      order: name === "armFront" ? 24 : 19,
    });
    track(fist.face, PALETTE.golemFace);
    puppet.attach(name, fist.mesh, 0.58);
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
        (coreGlow.material as THREE.Material).opacity = 0.5 + windup * 0.5;
      } else {
        coreGlow.scale.setScalar(1 + Math.sin(input.time * 2.4) * 0.1);
        (coreGlow.material as THREE.Material).opacity = 0.45;
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
// ---------------------------------------------------------------------------
function createWisp(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 0.5);
  const tints: Tintable[] = [];

  const core = kit.tintableCard(PaperKit.blob(0.28, 6, 0.12, 8.2), PALETTE.wispFace, PALETTE.wispEdge, {
    depth: 0.24,
    order: 20,
  });
  tints.push(
    { material: core.face, base: new THREE.Color(PALETTE.wispFace) },
    { material: core.edge, base: new THREE.Color(PALETTE.wispEdge) },
  );
  puppet.attach("body", core.mesh, 0);

  const glow = kit.glowDisc(0.7, PALETTE.wispFace, 16);
  glow.renderOrder = 19;
  puppet.attach("body", glow, 0);

  // Three trailing tails that lag behind the body.
  const tails: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const tail = kit.tintableCard(PaperKit.blob(0.13 - i * 0.03, 4, 0.16, i * 4.1), PALETTE.wispFace, PALETTE.wispEdge, {
      depth: 0.08,
      order: 19,
    });
    tints.push({ material: tail.face, base: new THREE.Color(PALETTE.wispFace) });
    const holder = new THREE.Group();
    holder.add(tail.mesh);
    puppet.get("body").add(holder);
    tails.push(holder);
  }

  for (const dx of [-0.09, 0.09]) {
    const eye = kit.tintableCard(PaperKit.roundedRect(0.05, 0.09, 0.025), 0x4a3210, 0x4a3210, {
      depth: 0.03,
      order: 22,
    });
    tints.push({ material: eye.face, base: new THREE.Color(0x4a3210) });
    puppet.attach("body", eye.mesh, -0.02, dx, 0.16);
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
        tail.position.set(Math.sin(t * 2.2 - lag) * 0.22, -0.32 - i * 0.19, -0.1);
      });
      const pulse = 1 + Math.sin(t * 3) * 0.12 + charge * 0.7;
      glow.scale.setScalar(pulse);
      (glow.material as THREE.Material).opacity = 0.45 + charge * 0.5;
    },
    reset() {
      puppet.setSquash(1, 1);
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Dragon — the wave 10 boss. Big enough that silhouette is all that matters.
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

  // Wings first so they sit behind everything.
  for (const [joint, dir, order] of [
    ["armBack", -1, 17],
    ["armFront", 1, 18],
  ] as const) {
    const wing = kit.tintableCard(
      PaperKit.polygon([
        [0, 0],
        [-0.5, 1.9],
        [0.35, 1.55],
        [0.5, 2.15],
        [1.15, 1.4],
        [1.05, 0.75],
        [1.55, 0.55],
        [0.6, 0.15],
      ]),
      PALETTE.dragonWing,
      PALETTE.dragonEdge,
      { depth: 0.08, order },
    );
    track(wing.face, PALETTE.dragonWing);
    const mesh = puppet.attach(joint, wing.mesh, 0);
    mesh.position.z = dir * 0.25;
  }

  const body = kit.tintableCard(PaperKit.blob(1.25, 5, 0.14, 9.4, 0.66), PALETTE.dragonFace, PALETTE.dragonEdge, {
    depth: 0.7,
    order: 20,
  });
  track(body.face, PALETTE.dragonFace);
  track(body.edge, PALETTE.dragonEdge);
  puppet.attach("body", body.mesh, 0);

  const belly = kit.tintableCard(PaperKit.blob(0.78, 4, 0.1, 2.8, 0.42), PALETTE.dragonBelly, PALETTE.dragonBelly, {
    depth: 0.1,
    order: 21,
  });
  track(belly.face, PALETTE.dragonBelly);
  puppet.attach("body", belly.mesh, 0.34, 0.1, 0.36);

  // Tail: three tapering segments on one joint, offset along -x.
  for (let i = 0; i < 3; i++) {
    const seg = kit.tintableCard(PaperKit.blob(0.42 - i * 0.11, 4, 0.1, i * 3.3, 0.7), PALETTE.dragonFace, PALETTE.dragonEdge, {
      depth: 0.3,
      order: 19,
    });
    track(seg.face, PALETTE.dragonFace);
    puppet.attach("extra", seg.mesh, 0, -i * 0.5, -0.05);
  }

  const head = kit.tintableCard(
    PaperKit.polygon([
      [-0.45, -0.4],
      [0.72, -0.32],
      [0.95, -0.05],
      [0.6, 0.2],
      [0.1, 0.48],
      [-0.45, 0.35],
    ]),
    PALETTE.dragonFace,
    PALETTE.dragonEdge,
    { depth: 0.55, order: 23 },
  );
  track(head.face, PALETTE.dragonFace);
  track(head.edge, PALETTE.dragonEdge);
  puppet.attach("head", head.mesh, 0);

  // Horns
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

  const eye = kit.tintableCard(PaperKit.roundedRect(0.12, 0.14, 0.05), PALETTE.gold, PALETTE.gold, {
    depth: 0.04,
    order: 24,
  });
  track(eye.face, PALETTE.gold);
  puppet.attach("head", eye.mesh, -0.06, 0.28, 0.3);

  const mawGlow = kit.glowDisc(0.62, PALETTE.skyEmber, 16);
  mawGlow.renderOrder = 25;
  mawGlow.visible = false;
  puppet.attach("head", mawGlow, -0.08, 0.95, 0.32);

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
      if (mawGlow.visible) {
        mawGlow.scale.setScalar(0.4 + breathCharge * 1.3);
        (mawGlow.material as THREE.Material).opacity = breathCharge;
      }
    },
    reset() {
      puppet.setSquash(1, 1);
      setFlash(0);
      mawGlow.visible = false;
    },
  };
}
