import * as THREE from "three";
import type { BossKind } from "../config";
import type { Creature } from "./bestiary";
import { PALETTE } from "./palette";
import { PaperKit } from "./paper";
import { Puppet, type PoseInput } from "./puppet";

/**
 * The six new bosses. (The seventh, the Storm Dragon, already exists in
 * bestiary.ts and is reused as the finale.)
 *
 * DESIGN RULE: A BOSS IS A SILHOUETTE, NOT A DETAIL PASS
 *
 * At phone size a boss occupies maybe 300 pixels. Anything smaller than a
 * fingernail is wasted geometry. So each of these is built from six to twelve
 * large cards with one high-contrast accent — the crown, the core, the eye —
 * that carries all of the identity. You should be able to name the boss from
 * its outline alone with the colours turned off.
 *
 * THE TELEGRAPH IS PART OF THE ART, NOT PART OF THE UI
 *
 * Every builder reads `extra` (0..1) in `update` and pushes it into something
 * physical: the Warden's core brightens and swells, Voidmaw's ring spins up,
 * the Choir's orbs pull inward. A boss that telegraphs with a screen-space
 * icon is telling the player what is about to happen; a boss that telegraphs
 * with its own body is *showing* them, and that is the difference between a
 * fight you memorise and a fight you read.
 *
 * Every card is tintable so the whole boss can flash white on a hit. On a
 * 70 HP enemy that flash is the only proof that the last thirty shots landed.
 */

interface Tintable {
  material: THREE.MeshBasicMaterial;
  base: THREE.Color;
}

function makeFlasher(tints: Tintable[]) {
  const white = new THREE.Color(PALETTE.hitFlash);
  return (amount: number) => {
    const a = Math.min(1, Math.max(0, amount));
    for (const t of tints) t.material.color.copy(t.base).lerp(white, a);
  };
}

/** Small helper: build a tintable card, register its materials, return the mesh. */
function part(
  kit: PaperKit,
  tints: Tintable[],
  shape: THREE.Shape,
  face: number,
  edge: number,
  depth: number,
  order: number,
): THREE.Mesh {
  const c = kit.tintableCard(shape, face, edge, { depth, order });
  tints.push({ material: c.face, base: new THREE.Color(face) });
  tints.push({ material: c.edge, base: new THREE.Color(edge) });
  return c.mesh;
}

export function createBoss(kit: PaperKit, kind: BossKind): Creature {
  switch (kind) {
    case "gorgeMother":
      return createGorgeMother(kit);
    case "nightwing":
      return createNightwing(kit);
    case "cinderWarden":
      return createCinderWarden(kit);
    case "lumenChoir":
      return createLumenChoir(kit);
    case "thornWarden":
      return createThornWarden(kit);
    case "voidmaw":
      return createVoidmaw(kit);
    default:
      // The dragon is built by bestiary.ts. This branch exists so the switch
      // is total; callers route "dragon" before they get here.
      return createGorgeMother(kit);
  }
}

// ---------------------------------------------------------------------------
// Gorge Mother — a slime the size of the room. Owns the floor.
// `extra` = landing squash impulse, 0..1
// ---------------------------------------------------------------------------
function createGorgeMother(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 1.35);
  puppet.joint("head", "body", 0, 0.85);
  const tints: Tintable[] = [];

  // The mass. One big wobbled blob does more than any amount of detail.
  const body = part(
    kit,
    tints,
    PaperKit.blob(1.85, 6, 0.11, 3.7, 0.82),
    PALETTE.gorgeFace,
    PALETTE.gorgeEdge,
    1.1,
    20,
  );
  puppet.attach("body", body, 0);

  // A swallowed core, visible through the jelly. Gives the silhouette a
  // centre of gravity so the hops read as heavy rather than as a bouncing
  // ball.
  const core = part(
    kit,
    tints,
    PaperKit.blob(0.62, 5, 0.16, 9.1, 0.9),
    PALETTE.gorgeCore,
    PALETTE.gorgeCore,
    0.2,
    21,
  );
  puppet.attach("body", core, 0.1, 0, 0.6);

  // Crown — the one piece of iconography. Reads at any size.
  const crown = part(
    kit,
    tints,
    PaperKit.polygon([
      [-1.0, 0],
      [1.0, 0],
      [0.82, 0.34],
      [0.62, 0.06],
      [0.36, 0.52],
      [0.0, 0.1],
      [-0.36, 0.52],
      [-0.62, 0.06],
      [-0.82, 0.34],
    ]),
    PALETTE.gorgeCrown,
    PALETTE.wispEdge,
    0.24,
    23,
  );
  puppet.attach("head", crown, -0.2, 0, 0.4);

  for (const dx of [-0.52, 0.5]) {
    const eye = part(kit, tints, PaperKit.roundedRect(0.3, 0.42, 0.14), 0x14281a, 0x14281a, 0.1, 22);
    puppet.attach("body", eye, -0.35, dx, 0.72);
    const glint = part(kit, tints, PaperKit.roundedRect(0.1, 0.14, 0.05), 0xffffff, 0xffffff, 0.05, 24);
    puppet.attach("body", glint, -0.45, dx + 0.07, 0.8);
  }

  const setFlash = makeFlasher(tints);

  return {
    kind: "gorgeMother",
    root: puppet.root,
    puppet,
    setFlash,
    update(input: PoseInput, extra: number) {
      const t = input.time + input.phase;
      // Jelly. A slime this big has to visibly carry momentum or it reads as
      // a sprite being translated.
      if (!input.onGround) {
        const stretch = 1 + Math.min(0.34, Math.abs(input.vy) * 0.012);
        puppet.setSquash(1 / stretch, stretch);
      } else {
        const settle = Math.sin(t * 9) * 0.05 * (1 - extra);
        const impact = extra * 0.36;
        puppet.setSquash(1 + settle + impact, 1 - settle - impact);
      }
      puppet.get("head").rotation.z = Math.sin(t * 1.6) * 0.07;
    },
    reset() {
      puppet.setSquash(1, 1);
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Nightwing — the bat matriarch. Owns the air.
// `extra` = dive windup, 0..1. The wings flare on the tell.
// ---------------------------------------------------------------------------
function createNightwing(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 0.5);
  puppet.joint("head", "body", 0, 0.34);
  puppet.joint("armBack", "body", -0.42, 0.16, 0, -0.22);
  puppet.joint("armFront", "body", 0.42, 0.16, 0, 0.22);
  const tints: Tintable[] = [];

  const body = part(
    kit,
    tints,
    PaperKit.blob(0.86, 4, 0.09, 5.9, 1.15),
    PALETTE.nightFace,
    PALETTE.nightEdge,
    0.62,
    20,
  );
  puppet.attach("body", body, 0);

  // Horns. Two triangles, and they do all the work of saying "matriarch".
  for (const [dx, tilt] of [
    [-0.34, -0.18],
    [0.34, 0.18],
  ] as const) {
    const horn = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.14, 0],
        [0.14, 0],
        [0.04, 0.86],
      ]),
      PALETTE.nightFace,
      PALETTE.nightEdge,
      0.16,
      21,
    );
    horn.rotation.z = tilt;
    puppet.attach("head", horn, -0.3, dx);
  }

  // Wings: five-fingered, scalloped trailing edge, hinged at the shoulder.
  // Deliberately huge — this boss crosses the whole room and the wingspan is
  // what sells the speed.
  for (const [joint, dir] of [
    ["armBack", -1],
    ["armFront", 1],
  ] as const) {
    const wing = part(
      kit,
      tints,
      PaperKit.polygon([
        [0, 0.1],
        [dir * 1.5, 0.62],
        [dir * 2.9, 0.3],
        [dir * 2.5, -0.06],
        [dir * 2.86, -0.42],
        [dir * 2.1, -0.5],
        [dir * 2.3, -0.98],
        [dir * 1.42, -0.72],
        [dir * 1.34, -1.16],
        [dir * 0.7, -0.66],
        [dir * 0.28, -0.9],
        [dir * 0.16, -0.3],
      ]),
      PALETTE.nightWing,
      PALETTE.nightEdge,
      0.1,
      19,
    );
    puppet.attach(joint, wing, 0);
  }

  const eyes: THREE.Object3D[] = [];
  for (const dx of [-0.26, 0.26]) {
    const eye = part(kit, tints, PaperKit.roundedRect(0.18, 0.24, 0.08), PALETTE.nightEye, PALETTE.nightEye, 0.08, 22);
    puppet.attach("head", eye, -0.02, dx, 0.4);
    eyes.push(eye);
  }

  const setFlash = makeFlasher(tints);

  return {
    kind: "nightwing",
    root: puppet.root,
    puppet,
    setFlash,
    update(input: PoseInput, extra: number) {
      const t = input.time + input.phase;
      // Winding up for a dive = wings held out, still. Flapping = travelling.
      // Stillness before a fast attack is the strongest telegraph there is.
      const flapAmp = 0.62 * (1 - extra);
      const flap = Math.sin(t * 11) * flapAmp + extra * 1.0;
      puppet.get("armFront").rotation.z = flap;
      puppet.get("armBack").rotation.z = -flap;
      puppet.get("body").rotation.z = Math.sin(t * 5.5) * 0.05;
      const glare = 1 + extra * 0.55;
      for (const e of eyes) e.scale.set(glare, glare, 1);
    },
    reset() {
      puppet.setSquash(1, 1);
      for (const e of eyes) e.scale.set(1, 1, 1);
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Cinder Warden — the golem lord. Punishes greed.
// `extra` = slam / charge windup, 0..1. The core is the tell.
// ---------------------------------------------------------------------------
function createCinderWarden(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 1.72);
  puppet.joint("head", "body", 0, 0.78);
  puppet.joint("armBack", "body", -0.86, 0.5, 0.24, -0.3);
  puppet.joint("armFront", "body", 0.86, 0.5, -0.24, 0.34);
  puppet.joint("legBack", "root", -0.44, 0.84, 0, -0.26);
  puppet.joint("legFront", "root", 0.44, 0.84, 0, 0.26);
  const tints: Tintable[] = [];

  // Torso: a wide slab that narrows at the waist. Top-heavy silhouettes read
  // as dangerous; bottom-heavy ones read as furniture.
  const torso = part(
    kit,
    tints,
    PaperKit.polygon([
      [-0.72, -0.9],
      [0.72, -0.9],
      [1.16, 0.62],
      [0.86, 1.0],
      [-0.86, 1.0],
      [-1.16, 0.62],
    ]),
    PALETTE.cinderFace,
    PALETTE.cinderEdge,
    0.86,
    20,
  );
  puppet.attach("body", torso, 0);

  // The core. Everything about this fight is keyed to it.
  const core = kit.tintableCard(PaperKit.star(6, 0.44, 0.42), PALETTE.cinderCore, PALETTE.cinderGlow, {
    depth: 0.2,
    order: 23,
  });
  tints.push({ material: core.face, base: new THREE.Color(PALETTE.cinderCore) });
  puppet.attach("body", core.mesh, -0.1, 0, 0.5);
  const coreGlow = kit.glowDisc(1.15, PALETTE.cinderCore, 16);
  coreGlow.renderOrder = 22;
  puppet.attach("body", coreGlow, -0.1, 0, 0.44);

  const head = part(
    kit,
    tints,
    PaperKit.polygon([
      [-0.5, -0.3],
      [0.5, -0.3],
      [0.42, 0.46],
      [-0.42, 0.46],
    ]),
    PALETTE.cinderFace,
    PALETTE.cinderEdge,
    0.5,
    21,
  );
  puppet.attach("head", head, -0.3);

  // A single visor slit instead of eyes. Faceless is scarier at this size.
  const visor = part(kit, tints, PaperKit.roundedRect(0.66, 0.13, 0.06), PALETTE.cinderCore, PALETTE.cinderCore, 0.06, 24);
  puppet.attach("head", visor, -0.32, 0, 0.3);

  for (const [joint, dir] of [
    ["armBack", -1],
    ["armFront", 1],
  ] as const) {
    const arm = part(
      kit,
      tints,
      PaperKit.polygon([
        [dir * -0.3, 0.24],
        [dir * 0.3, 0.24],
        [dir * 0.46, -1.02],
        [dir * -0.4, -1.02],
      ]),
      PALETTE.cinderFace,
      PALETTE.cinderEdge,
      0.44,
      dir > 0 ? 22 : 18,
    );
    puppet.attach(joint, arm, 0.24);
    // Fists. The slam has to land with something.
    const fist = part(
      kit,
      tints,
      PaperKit.blob(0.42, 5, 0.12, 4.2 + dir, 0.92),
      PALETTE.cinderFace,
      PALETTE.cinderEdge,
      0.5,
      dir > 0 ? 22 : 18,
    );
    puppet.attach(joint, fist, 1.24, dir * 0.06);
  }

  for (const [joint, dir] of [
    ["legBack", -1],
    ["legFront", 1],
  ] as const) {
    const leg = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.32, 0.2],
        [0.32, 0.2],
        [0.4, -0.84],
        [-0.4, -0.84],
      ]),
      PALETTE.cinderFace,
      PALETTE.cinderEdge,
      0.44,
      dir > 0 ? 21 : 18,
    );
    puppet.attach(joint, leg, 0.2);
  }

  const setFlash = makeFlasher(tints);
  const glowMat = coreGlow.material as THREE.Material;

  return {
    kind: "cinderWarden",
    root: puppet.root,
    puppet,
    setFlash,
    update(input: PoseInput, extra: number) {
      puppet.poseHumanoid(input);
      const t = input.time + input.phase;

      // The core swells and brightens through the windup, then the arms come
      // up over the head. By the time the fists are up the player has had
      // ~0.7s of warning from the glow alone.
      const pulse = 1 + Math.sin(t * 3.4) * 0.06 + extra * 0.75;
      core.mesh.scale.set(pulse, pulse, 1);
      coreGlow.scale.set(pulse, pulse, 1);
      glowMat.opacity = 0.5 + extra * 0.5;

      if (extra > 0.01) {
        const lift = -extra * 2.5;
        puppet.get("armFront").rotation.z = lift;
        puppet.get("armBack").rotation.z = lift * 0.9;
      }
    },
    reset() {
      puppet.setSquash(1, 1);
      core.mesh.scale.set(1, 1, 1);
      coreGlow.scale.set(1, 1, 1);
      glowMat.opacity = 0.5;
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Lumen Choir — three voices around one light. Pure bullet geometry.
// `extra` = volley charge, 0..1. The orbs pull inward before they fire.
// ---------------------------------------------------------------------------
function createLumenChoir(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 1.1);
  const tints: Tintable[] = [];

  const core = part(
    kit,
    tints,
    PaperKit.star(8, 0.78, 0.44),
    PALETTE.choirCore,
    PALETTE.arcaneDeep,
    0.3,
    22,
  );
  puppet.attach("body", core, 0);

  const halo = kit.glowDisc(1.9, PALETTE.choirCore, 20);
  halo.renderOrder = 19;
  puppet.attach("body", halo, 0, 0, -0.3);

  // Three orbiting voices, each on its own group so `update` can spin them
  // independently of the puppet hierarchy.
  const orbits: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    puppet.get("body").add(pivot);
    orbits.push(pivot);

    const orb = part(
      kit,
      tints,
      PaperKit.blob(0.44, 5, 0.1, 6.2 + i * 3.1, 1.05),
      PALETTE.choirFace,
      PALETTE.choirEdge,
      0.3,
      23,
    );
    orb.position.set(2.15, 0, 0.2);
    pivot.add(orb);

    const flame = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.16, 0],
        [0.16, 0],
        [0.0, 0.62],
      ]),
      PALETTE.choirOrb,
      PALETTE.choirEdge,
      0.12,
      24,
    );
    flame.position.set(2.15, 0.44, 0.3);
    pivot.add(flame);

    const eye = part(kit, tints, PaperKit.roundedRect(0.12, 0.16, 0.05), 0x2b1f08, 0x2b1f08, 0.05, 25);
    eye.position.set(2.15, 0.02, 0.42);
    pivot.add(eye);
  }

  const setFlash = makeFlasher(tints);
  const haloMat = halo.material as THREE.Material;

  return {
    kind: "lumenChoir",
    root: puppet.root,
    puppet,
    setFlash,
    update(input: PoseInput, extra: number) {
      const t = input.time + input.phase;
      // The orbs draw in as the volley charges. Radius is the telegraph:
      // tight ring = about to fire.
      const radius = 1 - extra * 0.42;
      for (let i = 0; i < orbits.length; i++) {
        orbits[i].rotation.z = t * 1.5 + (i * Math.PI * 2) / 3;
        orbits[i].scale.setScalar(radius);
      }
      const beat = 1 + Math.sin(t * 4.2) * 0.07 + extra * 0.3;
      puppet.get("body").scale.set(beat, beat, 1);
      puppet.get("body").rotation.z = t * 0.4;
      haloMat.opacity = 0.42 + extra * 0.58;
    },
    reset() {
      puppet.setSquash(1, 1);
      puppet.get("body").scale.set(1, 1, 1);
      for (const o of orbits) o.scale.setScalar(1);
      haloMat.opacity = 0.42;
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Thorn Warden — rooted. Turns the floor against you.
// `extra` = ground-wave windup, 0..1. It rears back before the floor erupts.
// ---------------------------------------------------------------------------
function createThornWarden(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 1.5);
  puppet.joint("head", "body", 0, 0.9);
  puppet.joint("armBack", "body", -0.82, 0.62, -0.5, -0.3);
  puppet.joint("armFront", "body", 0.82, 0.62, 0.5, 0.32);
  const tints: Tintable[] = [];

  // Trunk. Wider at the base than the shoulders — this thing grew here and
  // it is not going anywhere, which is the whole premise of the fight.
  const trunk = part(
    kit,
    tints,
    PaperKit.polygon([
      [-1.26, -1.5],
      [1.26, -1.5],
      [0.86, 0.2],
      [0.66, 1.0],
      [-0.66, 1.0],
      [-0.86, 0.2],
    ]),
    PALETTE.thornFace,
    PALETTE.thornEdge,
    0.9,
    20,
  );
  puppet.attach("body", trunk, 0);

  // Roots splaying onto the floor.
  for (const dx of [-1.1, -0.5, 0.5, 1.1]) {
    const root = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.2, 0.5],
        [0.2, 0.5],
        [Math.sign(dx) * 0.62, -0.6],
        [Math.sign(dx) * 0.3, -0.62],
      ]),
      PALETTE.thornEdge,
      PALETTE.thornEdge,
      0.3,
      19,
    );
    puppet.attach("body", root, 1.5, dx, -0.1);
  }

  // Mask face — a hollow with two lights in it.
  const mask = part(
    kit,
    tints,
    PaperKit.blob(0.68, 5, 0.09, 2.9, 1.12),
    PALETTE.thornEdge,
    0x1c140c,
    0.5,
    21,
  );
  puppet.attach("head", mask, -0.1);

  for (const dx of [-0.24, 0.24]) {
    const eye = part(kit, tints, PaperKit.star(4, 0.16, 0.3), PALETTE.thornEye, PALETTE.thornEye, 0.06, 24);
    puppet.attach("head", eye, -0.12, dx, 0.34);
  }

  // Antler crown of thorns.
  for (const [dx, rot, len] of [
    [-0.5, -0.6, 1.5],
    [-0.24, -0.24, 1.1],
    [0.24, 0.24, 1.1],
    [0.5, 0.6, 1.5],
  ] as const) {
    const spike = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.13, 0],
        [0.13, 0],
        [0.02, len],
      ]),
      PALETTE.thornSpike,
      PALETTE.thornEdge,
      0.14,
      22,
    );
    spike.rotation.z = rot;
    puppet.attach("head", spike, -0.5, dx);
  }

  // Branch arms with leaf clusters.
  for (const [joint, dir] of [
    ["armBack", -1],
    ["armFront", 1],
  ] as const) {
    const branch = part(
      kit,
      tints,
      PaperKit.polygon([
        [dir * -0.22, 0.2],
        [dir * 0.22, 0.2],
        [dir * 0.5, -1.3],
        [dir * 0.16, -1.32],
      ]),
      PALETTE.thornFace,
      PALETTE.thornEdge,
      0.34,
      dir > 0 ? 22 : 18,
    );
    puppet.attach(joint, branch, 0.2);

    const leaves = part(
      kit,
      tints,
      PaperKit.blob(0.6, 6, 0.24, 8.4 + dir, 0.72),
      PALETTE.thornLeaf,
      PALETTE.thornEdge,
      0.2,
      dir > 0 ? 23 : 17,
    );
    puppet.attach(joint, leaves, 1.5, dir * 0.3);
  }

  const setFlash = makeFlasher(tints);

  return {
    kind: "thornWarden",
    root: puppet.root,
    puppet,
    setFlash,
    update(input: PoseInput, extra: number) {
      const t = input.time + input.phase;
      // Rooted things sway. It also rears back as the ground wave charges —
      // the whole body is the wind-up animation.
      const sway = Math.sin(t * 0.9) * 0.05;
      puppet.get("body").rotation.z = sway - extra * 0.24;
      puppet.get("head").rotation.z = -sway * 1.6 - extra * 0.16;
      const raise = -extra * 1.9;
      puppet.get("armFront").rotation.z = raise + Math.sin(t * 1.3) * 0.07;
      puppet.get("armBack").rotation.z = raise * 0.85 - Math.sin(t * 1.3) * 0.07;
      const swell = 1 + extra * 0.12;
      puppet.setSquash(swell, swell);
    },
    reset() {
      puppet.setSquash(1, 1);
      setFlash(0);
    },
  };
}

// ---------------------------------------------------------------------------
// Voidmaw — it moves you instead of moving itself.
// `extra` = collapse charge, 0..1. Rings spin up, the eye opens.
// ---------------------------------------------------------------------------
function createVoidmaw(kit: PaperKit): Creature {
  const puppet = new Puppet();
  puppet.joint("body", "root", 0, 1.35);
  const tints: Tintable[] = [];

  // Two counter-rotating rings of teeth around a black sphere. The rings are
  // what make the pull legible: when they accelerate, so does the drag on
  // the player, and the player learns that link in about four seconds.
  const rings: THREE.Group[] = [];
  for (let r = 0; r < 2; r++) {
    const ring = new THREE.Group();
    puppet.get("body").add(ring);
    rings.push(ring);
    const teeth = 9 + r * 3;
    const radius = 1.35 + r * 0.5;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tooth = part(
        kit,
        tints,
        PaperKit.polygon([
          [-0.1, 0],
          [0.1, 0],
          [0, 0.46 - r * 0.12],
        ]),
        r === 0 ? PALETTE.voidTooth : PALETTE.voidRing,
        PALETTE.voidEdge,
        0.12,
        19 - r,
      );
      tooth.position.set(Math.cos(a) * radius, Math.sin(a) * radius, -0.2 - r * 0.1);
      tooth.rotation.z = a - Math.PI / 2;
      ring.add(tooth);
    }
  }

  const sphere = part(
    kit,
    tints,
    PaperKit.blob(1.2, 7, 0.05, 1.7, 1),
    PALETTE.voidFace,
    PALETTE.voidEdge,
    0.7,
    21,
  );
  puppet.attach("body", sphere, 0);

  // The eye. Closed most of the time; it opens on the collapse, which is the
  // only window where the fight asks you to be somewhere specific.
  const iris = part(kit, tints, PaperKit.blob(0.5, 6, 0.12, 5.3, 1), PALETTE.voidEye, PALETTE.voidRing, 0.16, 23);
  puppet.attach("body", iris, 0, 0, 0.5);
  const pupil = part(kit, tints, PaperKit.roundedRect(0.16, 0.5, 0.08), 0x07020f, 0x07020f, 0.08, 24);
  puppet.attach("body", pupil, 0, 0, 0.62);

  const aura = kit.glowDisc(2.6, PALETTE.voidRing, 22);
  aura.renderOrder = 18;
  puppet.attach("body", aura, 0, 0, -0.5);
  const auraMat = aura.material as THREE.Material;

  const setFlash = makeFlasher(tints);

  return {
    kind: "voidmaw",
    root: puppet.root,
    puppet,
    setFlash,
    update(input: PoseInput, extra: number) {
      const t = input.time + input.phase;
      const spin = 0.8 + extra * 5.5;
      rings[0].rotation.z = t * spin;
      rings[1].rotation.z = -t * spin * 0.7;
      // Rings tighten as it charges — an inward spiral you can see coming.
      const draw = 1 - extra * 0.28;
      rings[0].scale.setScalar(draw);
      rings[1].scale.setScalar(draw);

      const open = 0.35 + extra * 0.9 + Math.sin(t * 2.2) * 0.05;
      iris.scale.set(open, open, 1);
      pupil.scale.set(1, open * 1.3, 1);
      auraMat.opacity = 0.3 + extra * 0.6;
      aura.scale.setScalar(1 + extra * 0.4);
      puppet.get("body").position.y = 1.35 + Math.sin(t * 1.1) * 0.22;
    },
    reset() {
      puppet.setSquash(1, 1);
      for (const r of rings) r.scale.setScalar(1);
      aura.scale.setScalar(1);
      auraMat.opacity = 0.3;
      setFlash(0);
    },
  };
}
