import * as THREE from "three";

/**
 * A jointed paper puppet: a small hierarchy of pivot Groups, each holding one
 * card, animated by writing rotations every frame.
 *
 * This replaces skeletal animation entirely, and for this game that is an
 * upgrade rather than a compromise:
 *
 *   - A SkinnedMesh cannot be instanced and needs its own AnimationMixer per
 *     entity. Forty of them on screen is forty mixers, forty skinning passes
 *     and forty draw calls. A puppet is a handful of shared-geometry cards.
 *   - Procedural poses respond to game state continuously. A run cycle can
 *     scale its stride to actual velocity, a cast pose can point at the real
 *     aim vector, and recoil can be additive. Clip playback cannot do any of
 *     that without blend trees.
 *   - The art style is cut paper. Bending a limb smoothly would be *wrong*;
 *     paper hinges, it does not deform.
 *
 * Joints are addressed by name. `attach` places a card so it hangs from the
 * pivot rather than being centred on it — that is what makes a rotation read
 * as a shoulder rather than a spin.
 */

export type JointName =
  | "root"
  | "body"
  | "head"
  | "armBack"
  | "armFront"
  | "legBack"
  | "legFront"
  | "extra";

export type { PoseLike as PoseInput } from "../types";
import type { PoseLike as PoseInput } from "../types";

export class Puppet {
  readonly root = new THREE.Group();
  private joints = new Map<JointName, THREE.Group>();
  /** Rest rotations, restored before each pose is applied. */
  private rest = new Map<JointName, number>();

  constructor() {
    this.joints.set("root", this.root);
    this.rest.set("root", 0);
  }

  /**
   * Creates a pivot at `(x, y)` in the parent's space.
   * @param restRotation the joint's neutral angle, in radians.
   */
  joint(
    name: JointName,
    parent: JointName,
    x: number,
    y: number,
    restRotation = 0,
    z = 0,
  ): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.z = restRotation;
    const parentGroup = this.joints.get(parent);
    if (!parentGroup) throw new Error(`[puppet] unknown parent joint: ${parent}`);
    parentGroup.add(group);
    this.joints.set(name, group);
    this.rest.set(name, restRotation);
    return group;
  }

  /**
   * Adds a card to a joint, offset so that `anchorY` (in the card's own local
   * space, where 0 is its centre) sits at the pivot.
   *
   * For an arm you want anchorY = +halfHeight, so the card hangs downward
   * from the shoulder. For a head you want anchorY = -halfHeight, so it sits
   * on top of the neck.
   */
  attach(name: JointName, mesh: THREE.Object3D, anchorY = 0, offsetX = 0, offsetZ = 0): THREE.Object3D {
    const joint = this.joints.get(name);
    if (!joint) throw new Error(`[puppet] unknown joint: ${name}`);
    mesh.position.set(offsetX, -anchorY, offsetZ);
    joint.add(mesh);
    return mesh;
  }

  get(name: JointName): THREE.Group {
    const joint = this.joints.get(name);
    if (!joint) throw new Error(`[puppet] unknown joint: ${name}`);
    return joint;
  }

  has(name: JointName): boolean {
    return this.joints.has(name);
  }

  private setRotation(name: JointName, radians: number): void {
    const joint = this.joints.get(name);
    if (joint) joint.rotation.z = radians;
  }

  private restOf(name: JointName): number {
    return this.rest.get(name) ?? 0;
  }

  /**
   * The humanoid pose solver. Blends four states by weight rather than
   * switching between them, so there is never a visible pop:
   *
   *   idle   — breathing, slight sway
   *   run    — counter-rotating limbs, stride scaled to actual speed
   *   air    — tucked legs, arms up, biased by vertical velocity
   *   aim    — front arm points along the aim vector, plus recoil kick
   */
  poseHumanoid(input: PoseInput): void {
    const { time, speedRatio, onGround, vy, aimAngle, recoil, phase } = input;
    const t = time + phase;

    const airWeight = onGround ? 0 : 1;
    const runWeight = onGround ? Math.min(1, speedRatio * 1.4) : 0;
    const idleWeight = Math.max(0, 1 - runWeight - airWeight);

    // --- Idle: a slow breath in the torso, a slower sway in the head ------
    const breath = Math.sin(t * 2.1) * 0.035;
    const sway = Math.sin(t * 1.3) * 0.05;

    // --- Run: one phase drives every limb, 180 degrees apart --------------
    // Stride frequency rises with speed so the feet never look like they're
    // skating; the multiplier is tuned against PLAYER.maxSpeed.
    const stridePhase = t * (7.5 + speedRatio * 5.5);
    const strideAmp = 0.55 + speedRatio * 0.42;
    const swing = Math.sin(stridePhase) * strideAmp;
    const bob = Math.abs(Math.sin(stridePhase)) * 0.09 * speedRatio;

    // --- Air: legs tuck on the way up, reach on the way down --------------
    const rising = vy > 0;
    const tuck = rising ? 0.85 : 0.3;
    const reach = rising ? -0.35 : 0.55;

    // Body
    this.setRotation(
      "body",
      this.restOf("body") + breath * idleWeight + runWeight * 0.14 + airWeight * (rising ? -0.1 : 0.08),
    );
    const body = this.joints.get("body");
    if (body) body.position.y = bob * runWeight;

    // Head
    this.setRotation(
      "head",
      this.restOf("head") + sway * idleWeight - runWeight * 0.1 + airWeight * (rising ? 0.12 : -0.08),
    );

    // Legs — counter-phase
    this.setRotation(
      "legFront",
      this.restOf("legFront") +
        swing * runWeight +
        Math.sin(t * 1.6) * 0.03 * idleWeight +
        airWeight * -tuck,
    );
    this.setRotation(
      "legBack",
      this.restOf("legBack") -
        swing * runWeight -
        Math.sin(t * 1.6) * 0.03 * idleWeight +
        airWeight * reach,
    );

    // Arms — counter-phase to the legs, then overridden by aim if aiming
    const armBackAngle =
      this.restOf("armBack") -
      swing * 0.75 * runWeight +
      Math.sin(t * 1.9 + 0.6) * 0.05 * idleWeight +
      airWeight * -0.6;
    this.setRotation("armBack", armBackAngle);

    if (aimAngle !== null && this.joints.has("armFront")) {
      // The front arm is authored hanging straight down, so its zero is
      // -90 degrees from the aim convention (0 = straight ahead, +x).
      const kick = recoil * 0.5;
      this.setRotation("armFront", aimAngle + Math.PI / 2 - kick);
    } else {
      this.setRotation(
        "armFront",
        this.restOf("armFront") +
          swing * 0.75 * runWeight -
          Math.sin(t * 1.9 + 0.6) * 0.05 * idleWeight +
          airWeight * -0.75,
      );
    }
  }

  /**
   * A simplified solver for creatures with no legs — bats, wisps, slimes.
   * Drives a single "wing" pair and an overall bob.
   */
  poseCreature(input: PoseInput, wingSpeed: number, wingAmp: number): void {
    const t = input.time + input.phase;
    const flap = Math.sin(t * wingSpeed) * wingAmp;
    if (this.joints.has("armFront")) this.setRotation("armFront", this.restOf("armFront") + flap);
    if (this.joints.has("armBack")) this.setRotation("armBack", this.restOf("armBack") - flap);
    if (this.joints.has("body")) {
      this.setRotation("body", this.restOf("body") + Math.sin(t * wingSpeed * 0.5) * 0.08);
    }
  }

  /** Facing. Mirrors the whole puppet; cards are symmetric so this is free. */
  setFacing(facing: 1 | -1): void {
    this.root.scale.x = Math.abs(this.root.scale.x) * facing;
  }

  /** Visual-only squash and stretch, applied on top of facing. */
  setSquash(x: number, y: number): void {
    const facing = Math.sign(this.root.scale.x) || 1;
    this.root.scale.x = x * facing;
    this.root.scale.y = y;
  }
}
