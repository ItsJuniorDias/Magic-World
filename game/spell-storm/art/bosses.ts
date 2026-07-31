import * as THREE from "three";
import type { BossKind } from "../config";
import type { Creature } from "./bestiary";
import { PALETTE, rim as rimColor, shade, shift } from "./palette";
import { PaperKit } from "./paper";
import { Puppet, type PoseInput } from "./puppet";

/**
 * The six new bosses — HD pass. (The seventh, the Storm Dragon, already
 * exists in bestiary.ts and is reused as the finale.)
 *
 * DESIGN RULE (unchanged): A BOSS IS A SILHOUETTE, NOT A DETAIL PASS
 *
 * At phone size a boss occupies maybe 300 pixels. Anything smaller than a
 * fingernail is wasted geometry. So each of these is still built around six
 * to twelve LARGE cards with one high-contrast accent — the crown, the
 * core, the eye — that carries all of the identity.
 *
 * WHAT HD ADDS
 *
 *   1. Rim cards. A brighter, slightly larger clone behind every primary
 *      card. On a phone that's the difference between "boss is a flat
 *      shape" and "boss has a low sun behind it".
 *   2. Aura discs. Every boss now sits inside a soft glow disc in its own
 *      hue — the whole silhouette reads as *charged*.
 *   3. Anatomy nudges. Where a shape was one polygon, it is now two or
 *      three: the trunk of the Thorn Warden splits into an inner glowing
 *      cavity; the Voidmaw grows a secondary tooth ring; the Cinder Warden
 *      grows shoulder pauldrons; the Lumen Choir grows radiant filigree.
 *   4. Secondary animations. Idle sway, breath, halo pulses, tooth flex —
 *      everything twitches even when the boss isn't attacking. That
 *      twitch is what tells the player the boss is alive between attacks,
 *      not "waiting for the next scripted move".
 *   5. Higher-order glow. Cores and cracks get their own layered glow
 *      discs, so a boss on fire looks on fire.
 *
 * TELEGRAPH IS PART OF THE ART (unchanged rule)
 *
 * Every builder reads `extra` (0..1) in `update` and pushes it into
 * something physical: the Warden's core brightens and swells, Voidmaw's
 * ring spins up, the Choir's orbs pull inward.
 *
 * Every card is tintable so the whole boss can flash white on a hit. On a
 * 70 HP enemy that flash is the only proof that the last thirty shots
 * landed.
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
  opts?: { bevel?: number },
): THREE.Mesh {
  const c = kit.tintableCard(shape, face, edge, { depth, order, bevel: opts?.bevel });
  tints.push({ material: c.face, base: new THREE.Color(face) });
  tints.push({ material: c.edge, base: new THREE.Color(edge) });
  return c.mesh;
}

/** A non-tintable card. Used for pure-decorative pieces like glow discs. */
function decor(
  kit: PaperKit,
  shape: THREE.Shape,
  face: number,
  edge: number,
  depth: number,
  order: number,
): THREE.Mesh {
  return kit.card(shape, face, edge, { depth, order });
}

/**
 * Add a rim card behind a primary shape. The rim is authored with the same
 * shape, scaled up slightly and drawn a hair behind. Returns the rim mesh
 * so callers can attach it wherever the primary was attached.
 */
function makeRim(
  kit: PaperKit,
  shape: THREE.Shape,
  faceHex: number,
  scale = 1.06,
  order = 0,
): THREE.Mesh {
  const rimHex = rimColor(faceHex, PALETTE.paperRim, 0.55);
  const mesh = decor(kit, shape, rimHex, rimHex, 0.02, order);
  mesh.scale.setScalar(scale);
  mesh.position.z = -0.06;
  return mesh;
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

  // Aura — the acid haze around her.
  const aura = kit.glowDisc(3.4, PALETTE.gorgeFace, 32, 1.4);
  (aura.material as THREE.Material).opacity = 0.22;
  puppet.attach("body", aura, 0, 0, -1);
  aura.renderOrder = 18;

  // The mass. One big wobbled blob does more than any amount of detail.
  const bodyShape = PaperKit.blob(1.85, 6, 0.11, 3.7, 0.82);
  const bodyRim = makeRim(kit, bodyShape, PALETTE.gorgeFace, 1.06, 19);
  puppet.attach("body", bodyRim, 0);

  const body = part(kit, tints, bodyShape, PALETTE.gorgeFace, PALETTE.gorgeEdge, 1.1, 20);
  puppet.attach("body", body, 0);

  // Belly glisten — a pale patch on the front lower half.
  const glisten = part(
    kit,
    tints,
    PaperKit.blob(1.0, 4, 0.14, 8.2, 0.55),
    PALETTE.gorgeGlisten,
    PALETTE.gorgeGlisten,
    0.15,
    21,
  );
  glisten.position.set(0, -0.4, 0.55);
  (glisten.material as THREE.Material[])[0].transparent = true;
  (glisten.material as THREE.Material[])[0].opacity = 0.65;
  puppet.attach("body", glisten, 0);

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
    22,
  );
  puppet.attach("body", core, 0.1, 0, 0.6);
  const coreGlow = kit.glowDisc(1.1, PALETTE.gorgeCore, 20);
  (coreGlow.material as THREE.Material).opacity = 0.55;
  puppet.attach("body", coreGlow, 0.1, 0, 0.55);

  // Crown — the one piece of iconography. Reads at any size.
  const crownShape = PaperKit.polygon([
    [-1.0, 0],
    [1.0, 0],
    [0.82, 0.34],
    [0.62, 0.06],
    [0.36, 0.52],
    [0.0, 0.1],
    [-0.36, 0.52],
    [-0.62, 0.06],
    [-0.82, 0.34],
  ]);
  const crownRim = makeRim(kit, crownShape, PALETTE.gorgeCrown, 1.07, 22);
  puppet.attach("head", crownRim, -0.2, 0, 0.35);

  const crown = part(kit, tints, crownShape, PALETTE.gorgeCrown, PALETTE.wispEdge, 0.24, 23);
  puppet.attach("head", crown, -0.2, 0, 0.4);

  // Gems set in the crown — three small warm dots.
  for (const dx of [-0.62, 0, 0.62]) {
    const gem = part(
      kit,
      tints,
      PaperKit.roundedRect(0.14, 0.16, 0.06),
      PALETTE.wispEdge,
      shift(PALETTE.wispEdge, -0.3),
      0.08,
      24,
    );
    puppet.attach("head", gem, -0.42, dx, 0.45);
  }

  // Slime dribbles hanging off the crown — vertical droplet cards.
  for (const [dx, len] of [[-0.4, 0.4], [0.4, 0.5], [0.9, 0.35], [-0.9, 0.35]] as const) {
    const drip = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.06, 0],
        [0.06, 0],
        [0.02, -len],
        [-0.02, -len],
      ]),
      PALETTE.gorgeFace,
      PALETTE.gorgeEdge,
      0.1,
      21,
    );
    puppet.attach("head", drip, -0.05, dx, 0.32);
  }

  for (const dx of [-0.52, 0.5]) {
    const eyeGlow = kit.glowDisc(0.4, PALETTE.gorgeCore, 16);
    (eyeGlow.material as THREE.Material).opacity = 0.5;
    puppet.attach("body", eyeGlow, -0.35, dx, 0.68);

    const eye = part(kit, tints, PaperKit.roundedRect(0.34, 0.46, 0.16), 0x14281a, 0x14281a, 0.1, 22);
    puppet.attach("body", eye, -0.35, dx, 0.72);
    const pupil = part(kit, tints, PaperKit.roundedRect(0.16, 0.28, 0.07), PALETTE.gorgeGlisten, PALETTE.gorgeGlisten, 0.06, 23);
    puppet.attach("body", pupil, -0.35, dx, 0.76);
    const glint = part(kit, tints, PaperKit.roundedRect(0.1, 0.14, 0.05), 0xffffff, 0xffffff, 0.05, 24);
    puppet.attach("body", glint, -0.45, dx + 0.07, 0.8);
  }

  const setFlash = makeFlasher(tints);
  const auraMat = aura.material as THREE.Material;
  const coreGlowMat = coreGlow.material as THREE.Material;

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

      auraMat.opacity = 0.2 + Math.sin(t * 1.2) * 0.06 + extra * 0.2;
      coreGlowMat.opacity = 0.5 + Math.sin(t * 3) * 0.15 + extra * 0.35;
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

  // Halo — a dim purple aura around her.
  const halo = kit.glowDisc(3.0, PALETTE.nightHalo, 28, 1.5);
  (halo.material as THREE.Material).opacity = 0.28;
  puppet.attach("body", halo, 0, 0, -1);

  const bodyShape = PaperKit.blob(0.86, 4, 0.09, 5.9, 1.15);
  const bodyRim = makeRim(kit, bodyShape, PALETTE.nightFace, 1.09, 19);
  puppet.attach("body", bodyRim, 0);

  const body = part(kit, tints, bodyShape, PALETTE.nightFace, PALETTE.nightEdge, 0.62, 20);
  puppet.attach("body", body, 0);

  // Belly stripes — three horizontal darker bands, textural detail.
  for (let i = 0; i < 3; i++) {
    const stripe = part(
      kit,
      tints,
      PaperKit.roundedRect(0.9, 0.05, 0.02),
      PALETTE.nightWing,
      PALETTE.nightWing,
      0.05,
      21,
    );
    puppet.attach("body", stripe, -0.25 + i * 0.15, 0, 0.34);
  }

  // Horns. Two triangles, and they do all the work of saying "matriarch".
  // HD pass: horns get a rim card.
  for (const [dx, tilt] of [
    [-0.34, -0.18],
    [0.34, 0.18],
  ] as const) {
    const hornShape = PaperKit.polygon([
      [-0.14, 0],
      [0.14, 0],
      [0.04, 0.86],
    ]);
    const hornRim = makeRim(kit, hornShape, PALETTE.nightFace, 1.12, 20);
    hornRim.rotation.z = tilt;
    puppet.attach("head", hornRim, -0.3, dx);

    const horn = part(kit, tints, hornShape, PALETTE.nightFace, PALETTE.nightEdge, 0.16, 21);
    horn.rotation.z = tilt;
    puppet.attach("head", horn, -0.3, dx);
  }

  // Wings: five-fingered, scalloped trailing edge, hinged at the shoulder.
  // Deliberately huge — this boss crosses the whole room and the wingspan is
  // what sells the speed.
  const wings: THREE.Mesh[] = [];
  for (const [joint, dir] of [
    ["armBack", -1],
    ["armFront", 1],
  ] as const) {
    const wingShape = PaperKit.polygon([
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
    ]);

    // Wing rim — a brighter clone slightly larger. Nightwing crosses fast
    // and the rim traces the silhouette as she goes.
    const wingRim = makeRim(kit, wingShape, PALETTE.nightWing, 1.05, 18);
    puppet.attach(joint, wingRim, 0);

    const wing = part(kit, tints, wingShape, PALETTE.nightWing, PALETTE.nightEdge, 0.1, 19);
    puppet.attach(joint, wing, 0);
    wings.push(wing);

    // Wing bones — three curved lines running from the shoulder to the
    // fingertips. Cardstock bones, not shaders — just three thin cards.
    for (let i = 0; i < 3; i++) {
      const tip = i * 0.75 - 0.25;
      const bone = part(
        kit,
        tints,
        PaperKit.polygon([
          [0, -0.02],
          [0, 0.02],
          [dir * (2.2 + i * 0.2), 0.24 + tip],
          [dir * (2.2 + i * 0.2), 0.20 + tip],
        ]),
        shift(PALETTE.nightFace, -0.15),
        shift(PALETTE.nightFace, -0.15),
        0.03,
        20,
      );
      bone.position.z = 0.08;
      puppet.attach(joint, bone, 0);
    }
  }

  const eyes: THREE.Object3D[] = [];
  const eyeGlows: THREE.Mesh[] = [];
  for (const dx of [-0.26, 0.26]) {
    const eyeGlow = kit.glowDisc(0.32, PALETTE.nightEye, 16);
    (eyeGlow.material as THREE.Material).opacity = 0.6;
    puppet.attach("head", eyeGlow, -0.02, dx, 0.36);
    eyeGlows.push(eyeGlow);

    const eye = part(kit, tints, PaperKit.roundedRect(0.22, 0.3, 0.1), PALETTE.nightEye, PALETTE.nightEye, 0.08, 22);
    puppet.attach("head", eye, -0.02, dx, 0.4);
    eyes.push(eye);

    const slit = part(kit, tints, PaperKit.roundedRect(0.05, 0.24, 0.02), 0x2a0812, 0x2a0812, 0.05, 23);
    puppet.attach("head", slit, -0.02, dx, 0.44);
  }

  // A wisp of pointed teeth beneath the eyes.
  const fangs = part(
    kit,
    tints,
    PaperKit.polygon([
      [-0.2, 0],
      [-0.1, -0.18],
      [-0.04, 0],
      [0.04, -0.18],
      [0.1, 0],
      [0.2, -0.14],
    ]),
    0xf0e0e6,
    0xa08088,
    0.05,
    22,
  );
  puppet.attach("head", fangs, -0.32, 0, 0.34);

  const setFlash = makeFlasher(tints);
  const haloMat = halo.material as THREE.Material;

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
      for (const e of eyeGlows) {
        (e.material as THREE.Material).opacity = 0.55 + extra * 0.4 + Math.sin(t * 6) * 0.08;
      }
      haloMat.opacity = 0.24 + extra * 0.25 + Math.sin(t * 1.4) * 0.05;
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

  // A dim ember aura around him.
  const aura = kit.glowDisc(3.6, PALETTE.cinderCore, 32, 1.4);
  (aura.material as THREE.Material).opacity = 0.22;
  puppet.attach("body", aura, 0, 0, -1);

  // Torso: a wide slab that narrows at the waist. Top-heavy silhouettes read
  // as dangerous; bottom-heavy ones read as furniture.
  const torsoShape = PaperKit.polygon([
    [-0.72, -0.9],
    [0.72, -0.9],
    [1.16, 0.62],
    [0.86, 1.0],
    [-0.86, 1.0],
    [-1.16, 0.62],
  ]);
  const torsoRim = makeRim(kit, torsoShape, PALETTE.cinderFace, 1.06, 19);
  puppet.attach("body", torsoRim, 0);

  const torso = part(kit, tints, torsoShape, PALETTE.cinderFace, PALETTE.cinderEdge, 0.86, 20);
  puppet.attach("body", torso, 0);

  // Cracks in the torso — three thin bright cards, ember-orange, seeping
  // through the stone.
  for (const [x, y, rot, len] of [
    [-0.3, 0.2, 0.3, 0.7],
    [0.4, -0.1, -0.5, 0.5],
    [-0.1, -0.5, 0.1, 0.9],
  ] as const) {
    const crack = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.02, 0],
        [0.02, 0],
        [-0.04, len],
        [-0.08, len],
      ]),
      PALETTE.cinderCrack,
      PALETTE.cinderCrack,
      0.05,
      21,
    );
    crack.rotation.z = rot;
    puppet.attach("body", crack, y, x, 0.44);
  }

  // Pauldrons — shoulder plates jutting out.
  for (const [dx, dir] of [[-0.94, -1], [0.94, 1]] as const) {
    const paul = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.4 * dir, 0.4],
        [0.32 * dir, 0.4],
        [0.5 * dir, 0],
        [0.2 * dir, -0.24],
        [-0.5 * dir, -0.16],
      ]),
      shift(PALETTE.cinderFace, -0.1),
      PALETTE.cinderEdge,
      0.5,
      21,
    );
    puppet.attach("body", paul, 0.6, dx, 0.28);

    // Little spike on each pauldron.
    const spike = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.12, 0],
        [0.12, 0],
        [dir * 0.02, 0.5],
      ]),
      PALETTE.cinderCore,
      PALETTE.cinderCrack,
      0.14,
      22,
    );
    puppet.attach("body", spike, 0.1, dx, 0.32);
  }

  // The core. Everything about this fight is keyed to it.
  const coreShape = PaperKit.softStar(6, 0.44, 0.42);
  const core = kit.tintableCard(coreShape, PALETTE.cinderCore, PALETTE.cinderGlow, {
    depth: 0.2,
    order: 23,
    bevel: 0.04,
  });
  tints.push({ material: core.face, base: new THREE.Color(PALETTE.cinderCore) });
  tints.push({ material: core.edge, base: new THREE.Color(PALETTE.cinderGlow) });
  puppet.attach("body", core.mesh, -0.1, 0, 0.5);
  const coreGlow = kit.glowDisc(1.35, PALETTE.cinderCore, 24);
  coreGlow.renderOrder = 22;
  puppet.attach("body", coreGlow, -0.1, 0, 0.44);
  const coreOuterGlow = kit.glowDisc(2.2, PALETTE.cinderGlow, 22, 1.5);
  (coreOuterGlow.material as THREE.Material).opacity = 0.35;
  puppet.attach("body", coreOuterGlow, -0.1, 0, 0.4);

  const headShape = PaperKit.polygon([
    [-0.5, -0.3],
    [0.5, -0.3],
    [0.42, 0.46],
    [-0.42, 0.46],
  ]);
  const headRim = makeRim(kit, headShape, PALETTE.cinderFace, 1.05, 20);
  puppet.attach("head", headRim, -0.3);

  const head = part(kit, tints, headShape, PALETTE.cinderFace, PALETTE.cinderEdge, 0.5, 21);
  puppet.attach("head", head, -0.3);

  // A single visor slit instead of eyes. Faceless is scarier at this size.
  const visorGlow = kit.glowDisc(0.55, PALETTE.cinderCore, 16);
  (visorGlow.material as THREE.Material).opacity = 0.65;
  puppet.attach("head", visorGlow, -0.32, 0, 0.28);

  const visor = part(
    kit,
    tints,
    PaperKit.roundedRect(0.7, 0.16, 0.06),
    PALETTE.cinderCore,
    PALETTE.cinderCore,
    0.06,
    24,
  );
  puppet.attach("head", visor, -0.32, 0, 0.3);

  // Two little horns cresting the head.
  for (const [dx, tilt] of [[-0.28, -0.3], [0.28, 0.3]] as const) {
    const horn = part(
      kit,
      tints,
      PaperKit.polygon([
        [-0.1, 0],
        [0.1, 0],
        [0.02, 0.36],
      ]),
      PALETTE.cinderEdge,
      shade(PALETTE.cinderEdge, 0.3),
      0.14,
      22,
    );
    horn.rotation.z = tilt;
    puppet.attach("head", horn, -0.66, dx);
  }

  for (const [joint, dir] of [
    ["armBack", -1],
    ["armFront", 1],
  ] as const) {
    const armShape = PaperKit.polygon([
      [dir * -0.3, 0.24],
      [dir * 0.3, 0.24],
      [dir * 0.46, -1.02],
      [dir * -0.4, -1.02],
    ]);
    const armRim = makeRim(kit, armShape, PALETTE.cinderFace, 1.06, dir > 0 ? 21 : 17);
    puppet.attach(joint, armRim, 0.24);

    const arm = part(kit, tints, armShape, PALETTE.cinderFace, PALETTE.cinderEdge, 0.44, dir > 0 ? 22 : 18);
    puppet.attach(joint, arm, 0.24);

    // Fists. The slam has to land with something.
    const fistShape = PaperKit.blob(0.42, 5, 0.12, 4.2 + dir, 0.92);
    const fistRim = makeRim(kit, fistShape, PALETTE.cinderFace, 1.06, dir > 0 ? 21 : 17);
    puppet.attach(joint, fistRim, 1.24, dir * 0.06);

    const fist = part(kit, tints, fistShape, PALETTE.cinderFace, PALETTE.cinderEdge, 0.5, dir > 0 ? 22 : 18);
    puppet.attach(joint, fist, 1.24, dir * 0.06);

    // Knuckle glow — a small ember-orange disc on each fist so the slams
    // read as a hot object landing.
    const knuckleGlow = kit.glowDisc(0.4, PALETTE.cinderCore, 14);
    (knuckleGlow.material as THREE.Material).opacity = 0.5;
    puppet.attach(joint, knuckleGlow, 1.24, dir * 0.06, 0.3);
  }

  for (const [joint, dir] of [
    ["legBack", -1],
    ["legFront", 1],
  ] as const) {
    const legShape = PaperKit.polygon([
      [-0.32, 0.2],
      [0.32, 0.2],
      [0.4, -0.84],
      [-0.4, -0.84],
    ]);
    const legRim = makeRim(kit, legShape, PALETTE.cinderFace, 1.06, dir > 0 ? 20 : 17);
    puppet.attach(joint, legRim, 0.2);

    const leg = part(kit, tints, legShape, PALETTE.cinderFace, PALETTE.cinderEdge, 0.44, dir > 0 ? 21 : 18);
    puppet.attach(joint, leg, 0.2);
  }

  const setFlash = makeFlasher(tints);
  const glowMat = coreGlow.material as THREE.Material;
  const outerGlowMat = coreOuterGlow.material as THREE.Material;
  const auraMat = aura.material as THREE.Material;
  const visorGlowMat = visorGlow.material as THREE.Material;

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
      coreOuterGlow.scale.set(pulse * 1.15, pulse * 1.15, 1);
      glowMat.opacity = 0.5 + extra * 0.5;
      outerGlowMat.opacity = 0.32 + extra * 0.35;
      visorGlowMat.opacity = 0.55 + Math.sin(t * 4.2) * 0.14 + extra * 0.25;
      auraMat.opacity = 0.2 + Math.sin(t * 1.1) * 0.06 + extra * 0.28;

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
      coreOuterGlow.scale.set(1, 1, 1);
      glowMat.opacity = 0.5;
      outerGlowMat.opacity = 0.32;
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

  // Outer aura — a wide soft cyan halo. The Choir is a light-being.
  const outerAura = kit.glowDisc(3.8, PALETTE.choirAura, 32, 1.4);
  (outerAura.material as THREE.Material).opacity = 0.28;
  puppet.attach("body", outerAura, 0, 0, -1);

  const coreShape = PaperKit.softStar(8, 0.78, 0.44);
  const coreRim = makeRim(kit, coreShape, PALETTE.choirCore, 1.06, 21);
  puppet.attach("body", coreRim, 0);

  const core = part(kit, tints, coreShape, PALETTE.choirCore, PALETTE.arcaneDeep, 0.3, 22, { bevel: 0.03 });
  puppet.attach("body", core, 0);

  // Radiant filigree — six thin curling ribbons emanating from the core.
  for (let i = 0; i < 6; i++) {
    const shape = PaperKit.filigree(1.4, 0.09, 0.6);
    const filigree = part(
      kit,
      tints,
      shape,
      PALETTE.choirEdge,
      shade(PALETTE.choirEdge, 0.3),
      0.06,
      21,
    );
    filigree.rotation.z = (i / 6) * Math.PI * 2;
    puppet.attach("body", filigree, 0);
  }

  const halo = kit.glowDisc(2.4, PALETTE.choirCore, 24);
  halo.renderOrder = 19;
  puppet.attach("body", halo, 0, 0, -0.3);

  // A second inner halo, warmer.
  const innerHalo = kit.glowDisc(1.35, PALETTE.choirOrb, 20);
  (innerHalo.material as THREE.Material).opacity = 0.55;
  innerHalo.renderOrder = 20;
  puppet.attach("body", innerHalo, 0, 0, -0.28);

  // Three orbiting voices, each on its own group so `update` can spin them
  // independently of the puppet hierarchy.
  const orbits: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    puppet.get("body").add(pivot);
    orbits.push(pivot);

    // Orb rim.
    const orbShape = PaperKit.blob(0.44, 5, 0.1, 6.2 + i * 3.1, 1.05);
    const orbRim = makeRim(kit, orbShape, PALETTE.choirFace, 1.08, 22);
    orbRim.position.set(2.15, 0, 0.15);
    pivot.add(orbRim);

    const orb = part(kit, tints, orbShape, PALETTE.choirFace, PALETTE.choirEdge, 0.3, 23);
    orb.position.set(2.15, 0, 0.2);
    pivot.add(orb);

    // Orb glow.
    const orbGlow = kit.glowDisc(0.7, PALETTE.choirCore, 18);
    (orbGlow.material as THREE.Material).opacity = 0.55;
    orbGlow.position.set(2.15, 0, 0.05);
    pivot.add(orbGlow);

    const flame = part(
      kit,
      tints,
      PaperKit.teardrop(0.28, 0.72),
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

    const eyeGlint = part(kit, tints, PaperKit.roundedRect(0.04, 0.06, 0.02), 0xffffff, 0xffffff, 0.04, 26);
    eyeGlint.position.set(2.18, 0.05, 0.44);
    pivot.add(eyeGlint);
  }

  const setFlash = makeFlasher(tints);
  const haloMat = halo.material as THREE.Material;
  const innerHaloMat = innerHalo.material as THREE.Material;
  const outerAuraMat = outerAura.material as THREE.Material;

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
      innerHaloMat.opacity = 0.45 + Math.sin(t * 3.2) * 0.12 + extra * 0.35;
      outerAuraMat.opacity = 0.24 + Math.sin(t * 0.9) * 0.06 + extra * 0.25;
    },
    reset() {
      puppet.setSquash(1, 1);
      puppet.get("body").scale.set(1, 1, 1);
      for (const o of orbits) o.scale.setScalar(1);
      haloMat.opacity = 0.42;
      innerHaloMat.opacity = 0.45;
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

  // Aura — a mossy warm glow around the whole tree.
  const aura = kit.glowDisc(3.8, PALETTE.thornSpike, 32, 1.4);
  (aura.material as THREE.Material).opacity = 0.16;
  puppet.attach("body", aura, -0.5, 0, -1);

  // Trunk. Wider at the base than the shoulders — this thing grew here and
  // it is not going anywhere, which is the whole premise of the fight.
  const trunkShape = PaperKit.polygon([
    [-1.26, -1.5],
    [1.26, -1.5],
    [0.86, 0.2],
    [0.66, 1.0],
    [-0.66, 1.0],
    [-0.86, 0.2],
  ]);
  const trunkRim = makeRim(kit, trunkShape, PALETTE.thornFace, 1.06, 19);
  puppet.attach("body", trunkRim, 0);

  const trunk = part(kit, tints, trunkShape, PALETTE.thornFace, PALETTE.thornEdge, 0.9, 20);
  puppet.attach("body", trunk, 0);

  // Bark grooves — three vertical thin darker cards, textural detail.
  for (const dx of [-0.6, 0, 0.6]) {
    const groove = part(
      kit,
      tints,
      PaperKit.roundedRect(0.05, 1.6, 0.02),
      PALETTE.thornEdge,
      PALETTE.thornEdge,
      0.04,
      21,
    );
    puppet.attach("body", groove, -0.3, dx, 0.46);
  }

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

  // Small moss patches on the trunk.
  for (const [dx, dy] of [[-0.4, -0.2], [0.3, -0.6], [-0.6, -0.9]] as const) {
    const moss = part(
      kit,
      tints,
      PaperKit.blob(0.32, 4, 0.15, dx * 10 + dy * 3, 0.55),
      PALETTE.thornMoss,
      PALETTE.thornEdge,
      0.1,
      21,
    );
    puppet.attach("body", moss, dy, dx, 0.48);
  }

  // Mask face — a hollow with two lights in it.
  const maskShape = PaperKit.blob(0.68, 5, 0.09, 2.9, 1.12);
  const maskRim = makeRim(kit, maskShape, PALETTE.thornEdge, 1.06, 20);
  puppet.attach("head", maskRim, -0.1);

  const mask = part(kit, tints, maskShape, PALETTE.thornEdge, 0x1c140c, 0.5, 21);
  puppet.attach("head", mask, -0.1);

  // Face highlights — small warm spots on the mask around the eyes.
  for (const dx of [-0.24, 0.24]) {
    const eyeGlow = kit.glowDisc(0.4, PALETTE.thornEye, 14);
    (eyeGlow.material as THREE.Material).opacity = 0.7;
    puppet.attach("head", eyeGlow, -0.12, dx, 0.3);

    const eye = part(kit, tints, PaperKit.softStar(4, 0.16, 0.3), PALETTE.thornEye, PALETTE.thornEye, 0.06, 24);
    puppet.attach("head", eye, -0.12, dx, 0.34);
  }

  // Antler crown of thorns.
  for (const [dx, rot, len] of [
    [-0.5, -0.6, 1.5],
    [-0.24, -0.24, 1.1],
    [0.24, 0.24, 1.1],
    [0.5, 0.6, 1.5],
  ] as const) {
    const spikeShape = PaperKit.polygon([
      [-0.13, 0],
      [0.13, 0],
      [0.02, len],
    ]);
    const spikeRim = makeRim(kit, spikeShape, PALETTE.thornSpike, 1.1, 21);
    spikeRim.rotation.z = rot;
    puppet.attach("head", spikeRim, -0.5, dx);

    const spike = part(kit, tints, spikeShape, PALETTE.thornSpike, PALETTE.thornEdge, 0.14, 22);
    spike.rotation.z = rot;
    puppet.attach("head", spike, -0.5, dx);
  }

  // Branch arms with leaf clusters.
  for (const [joint, dir] of [
    ["armBack", -1],
    ["armFront", 1],
  ] as const) {
    const branchShape = PaperKit.polygon([
      [dir * -0.22, 0.2],
      [dir * 0.22, 0.2],
      [dir * 0.5, -1.3],
      [dir * 0.16, -1.32],
    ]);
    const branchRim = makeRim(kit, branchShape, PALETTE.thornFace, 1.05, dir > 0 ? 21 : 17);
    puppet.attach(joint, branchRim, 0.2);

    const branch = part(kit, tints, branchShape, PALETTE.thornFace, PALETTE.thornEdge, 0.34, dir > 0 ? 22 : 18);
    puppet.attach(joint, branch, 0.2);

    // Leaf cluster — three overlapping blob cards for volume.
    for (let i = 0; i < 3; i++) {
      const leafShape = PaperKit.blob(0.5 + i * 0.06, 5 + i, 0.24, 8.4 + dir + i, 0.72);
      const leaves = part(
        kit,
        tints,
        leafShape,
        i === 0 ? PALETTE.thornLeaf : shift(PALETTE.thornLeaf, -0.1 * i),
        PALETTE.thornEdge,
        0.18,
        dir > 0 ? 23 - i : 17 + i,
      );
      leaves.position.set(dir * (i - 1) * 0.14, i * 0.06, i * 0.02);
      puppet.attach(joint, leaves, 1.5, dir * 0.3);
    }

    // Small berries in the leaves — red dots.
    for (let i = 0; i < 3; i++) {
      const berry = part(
        kit,
        tints,
        PaperKit.roundedRect(0.08, 0.08, 0.04),
        0xd94f3d,
        0x8c2a22,
        0.05,
        24,
      );
      puppet.attach(joint, berry, 1.4 + i * 0.1, dir * (0.2 + i * 0.15), 0.15);
    }
  }

  const setFlash = makeFlasher(tints);
  const auraMat = aura.material as THREE.Material;

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

      auraMat.opacity = 0.15 + Math.sin(t * 0.7) * 0.05 + extra * 0.2;
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

  // Outer aura — a purple void that grows during collapse.
  const outerAura = kit.glowDisc(4.2, PALETTE.voidAura, 32, 1.4);
  (outerAura.material as THREE.Material).opacity = 0.24;
  puppet.attach("body", outerAura, 0, 0, -1);

  // Three counter-rotating rings of teeth around a black sphere. The rings
  // are what make the pull legible: when they accelerate, so does the drag
  // on the player, and the player learns that link in about four seconds.
  const rings: THREE.Group[] = [];
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Group();
    puppet.get("body").add(ring);
    rings.push(ring);
    const teeth = 9 + r * 3;
    const radius = 1.35 + r * 0.5;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const toothShape = PaperKit.polygon([
        [-0.1, 0],
        [0.1, 0],
        [0, 0.5 - r * 0.09],
      ]);

      // Rim + tooth — the teeth catch the aura.
      const rimHex = rimColor(r === 0 ? PALETTE.voidTooth : PALETTE.voidRing, PALETTE.voidAura, 0.55);
      const rimTooth = decor(kit, toothShape, rimHex, rimHex, 0.05, 18 - r);
      rimTooth.scale.setScalar(1.15);
      rimTooth.position.set(Math.cos(a) * radius, Math.sin(a) * radius, -0.35 - r * 0.1);
      rimTooth.rotation.z = a - Math.PI / 2;
      ring.add(rimTooth);

      const tooth = part(
        kit,
        tints,
        toothShape,
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

  const sphereShape = PaperKit.blob(1.2, 7, 0.05, 1.7, 1);
  const sphereRim = makeRim(kit, sphereShape, PALETTE.voidFace, 1.06, 20);
  puppet.attach("body", sphereRim, 0);

  const sphere = part(kit, tints, sphereShape, PALETTE.voidFace, PALETTE.voidEdge, 0.7, 21);
  puppet.attach("body", sphere, 0);

  // The eye. Closed most of the time; it opens on the collapse, which is the
  // only window where the fight asks you to be somewhere specific.
  const irisGlow = kit.glowDisc(0.9, PALETTE.voidEye, 22);
  (irisGlow.material as THREE.Material).opacity = 0.5;
  puppet.attach("body", irisGlow, 0, 0, 0.4);

  const iris = part(kit, tints, PaperKit.blob(0.5, 6, 0.12, 5.3, 1), PALETTE.voidEye, PALETTE.voidRing, 0.16, 23);
  puppet.attach("body", iris, 0, 0, 0.5);
  const pupil = part(kit, tints, PaperKit.roundedRect(0.16, 0.5, 0.08), 0x07020f, 0x07020f, 0.08, 24);
  puppet.attach("body", pupil, 0, 0, 0.62);

  // A tiny highlight in the pupil.
  const irisHighlight = part(
    kit,
    tints,
    PaperKit.roundedRect(0.06, 0.1, 0.03),
    PALETTE.voidTooth,
    PALETTE.voidTooth,
    0.04,
    25,
  );
  puppet.attach("body", irisHighlight, 0.06, 0.06, 0.7);

  const aura = kit.glowDisc(2.8, PALETTE.voidRing, 26);
  aura.renderOrder = 18;
  puppet.attach("body", aura, 0, 0, -0.5);
  const auraMat = aura.material as THREE.Material;

  const setFlash = makeFlasher(tints);
  const irisGlowMat = irisGlow.material as THREE.Material;
  const outerAuraMat = outerAura.material as THREE.Material;

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
      rings[2].rotation.z = t * spin * 0.5;
      // Rings tighten as it charges — an inward spiral you can see coming.
      const draw = 1 - extra * 0.28;
      rings[0].scale.setScalar(draw);
      rings[1].scale.setScalar(draw);
      rings[2].scale.setScalar(draw);

      const open = 0.35 + extra * 0.9 + Math.sin(t * 2.2) * 0.05;
      iris.scale.set(open, open, 1);
      pupil.scale.set(1, open * 1.3, 1);
      irisGlowMat.opacity = 0.4 + extra * 0.5;
      auraMat.opacity = 0.3 + extra * 0.6;
      outerAuraMat.opacity = 0.2 + extra * 0.4;
      aura.scale.setScalar(1 + extra * 0.4);
      outerAura.scale.setScalar(1 + extra * 0.5);
      puppet.get("body").position.y = 1.35 + Math.sin(t * 1.1) * 0.22;
    },
    reset() {
      puppet.setSquash(1, 1);
      for (const r of rings) r.scale.setScalar(1);
      aura.scale.setScalar(1);
      outerAura.scale.setScalar(1);
      auraMat.opacity = 0.3;
      outerAuraMat.opacity = 0.2;
      setFlash(0);
    },
  };
}
