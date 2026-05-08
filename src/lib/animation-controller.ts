import type { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4';
import {
  BODY_SWAY,
  BREATHING,
  BROW_MOTION,
  EYE_LOOK,
  HEAD_MOTION,
  OVERALL_SWAY,
} from '../config/motions';
import { EMOTION_MOTION_PROFILE } from '../config/expressions';
import { expressionManager } from './expression-manager';

type CoreModelLike = {
  setParameterValueById: (id: string, value: number) => void;
};

type IdleLayerMix = {
  head: number;
  body: number;
  arm: number;
  overall: number;
};

type IdlePose = {
  headX: number;
  headY: number;
  headZ: number;
  bodyX: number;
  bodyY: number;
  bodyZ: number;
  armLA: number;
  armRA: number;
  armRB: number;
  shoulder: number;
  handLB: number;
  wand: number;
  overallX: number;
  overallY: number;
  overallR: number;
};

export class AnimationController {
  private model: Live2DModel | null = null;
  private animationId: number | null = null;
  private isActive = false;
  private isSpeaking = false;
  private startTime = 0;
  private eyeTargetX = 0;
  private eyeTargetY = 0;
  private eyeCurrentX = 0;
  private eyeCurrentY = 0;
  private nextEyeMoveTime = 0;
  private nextVariationTime = 0;
  private currentMix: IdleLayerMix = { head: 0.45, body: 0.15, arm: 0.2, overall: 0.2 };
  private targetMix: IdleLayerMix = { head: 0.45, body: 0.15, arm: 0.2, overall: 0.2 };
  private currentPose: IdlePose = this.createZeroPose();
  private targetPose: IdlePose = this.createZeroPose();
  private gestureActive = false;

  private phaseOffsets = {
    headX: Math.random() * 10000,
    headY: Math.random() * 10000,
    headZ: Math.random() * 10000,
    bodyX: Math.random() * 10000,
    bodyY: Math.random() * 10000,
    bodyZ: Math.random() * 10000,
    browL: Math.random() * 10000,
    browR: Math.random() * 10000,
    overallX: Math.random() * 10000,
    overallY: Math.random() * 10000,
    overallR: Math.random() * 10000,
  };

  init(model: Live2DModel): void {
    this.destroy();
    this.model = model;
    this.isActive = true;
    this.startTime = performance.now();
    this.eyeCurrentX = 0;
    this.eyeCurrentY = 0;
    this.eyeTargetX = 0;
    this.eyeTargetY = 0;
    this.scheduleNextEyeMove();
    this.scheduleNextVariation(true);
    this.startLoop();
    console.log('[Animation] Natural idle controller initialized');
  }

  private startLoop(): void {
    const update = () => {
      if (!this.isActive || !this.model) {
        return;
      }

      const now = performance.now();
      const t = now - this.startTime;
      const coreModel = this.model.internalModel?.coreModel as CoreModelLike | undefined;

      if (!coreModel) {
        this.animationId = requestAnimationFrame(update);
        return;
      }

      this.updateIdleVariation(now);

      this.applyBreathing(coreModel, t);
      this.applyHeadMotion(coreModel, t);
      this.applyBodySway(coreModel, t);
      this.applyArmMotion(coreModel, t);
      this.applyEyeLook(coreModel, now);
      this.applyBrowMotion(coreModel, t);
      this.applyOverallSway(coreModel, t);

      this.animationId = requestAnimationFrame(update);
    };

    this.animationId = requestAnimationFrame(update);
  }

  private applyBreathing(coreModel: CoreModelLike, t: number): void {
    const profile = this.getEmotionProfile();
    const { speed, amplitude, offset } = BREATHING;
    const value = offset + Math.sin(t * speed) * amplitude * profile.breath;
    this.setParam(coreModel, 'ParamBreath', Math.max(0, Math.min(1, value)));
  }

  private applyHeadMotion(coreModel: CoreModelLike, t: number): void {
    if (this.gestureActive) {
      return;
    }

    const profile = this.getEmotionProfile();
    const speakDampen = this.isSpeaking ? 0.4 : 1;
    const idleMix = this.currentMix.head;

    const hx = HEAD_MOTION.angleX;
    const hy = HEAD_MOTION.angleY;
    const hz = HEAD_MOTION.angleZ;

    const angleX =
      (Math.sin((t + this.phaseOffsets.headX) * hx.speed1) * 0.5 +
        Math.sin((t + this.phaseOffsets.headX) * hx.speed2) * 0.3 +
        Math.sin((t + this.phaseOffsets.headX) * hx.speed3) * 0.2) *
      hx.amplitude *
      profile.head *
      idleMix *
      speakDampen +
      this.currentPose.headX;

    const angleY =
      (Math.sin((t + this.phaseOffsets.headY) * hy.speed1) * 0.5 +
        Math.sin((t + this.phaseOffsets.headY) * hy.speed2) * 0.3 +
        Math.sin((t + this.phaseOffsets.headY) * hy.speed3) * 0.2) *
      hy.amplitude *
      profile.head *
      idleMix *
      speakDampen +
      this.currentPose.headY;

    const angleZ =
      (Math.sin((t + this.phaseOffsets.headZ) * hz.speed1) * 0.5 +
        Math.sin((t + this.phaseOffsets.headZ) * hz.speed2) * 0.3 +
        Math.sin((t + this.phaseOffsets.headZ) * hz.speed3) * 0.2) *
      hz.amplitude *
      profile.head *
      idleMix *
      speakDampen +
      this.currentPose.headZ;

    this.setParam(coreModel, 'ParamAngleX', angleX);
    this.setParam(coreModel, 'ParamAngleY', angleY);
    this.setParam(coreModel, 'ParamAngleZ', angleZ);
  }

  private applyBodySway(coreModel: CoreModelLike, t: number): void {
    if (this.gestureActive) {
      return;
    }

    const profile = this.getEmotionProfile();
    const speakDampen = this.isSpeaking ? 0.15 : 1;
    const idleMix = this.currentMix.body;
    const bx = BODY_SWAY.angleX;
    const by = BODY_SWAY.angleY;
    const bz = BODY_SWAY.angleZ;

    const bodyX =
      (Math.sin((t + this.phaseOffsets.bodyX) * bx.speed1) * 0.6 +
        Math.sin((t + this.phaseOffsets.bodyX) * bx.speed2) * 0.4) *
      bx.amplitude *
      profile.body *
      idleMix *
      speakDampen +
      this.currentPose.bodyX;

    const bodyY =
      (Math.sin((t + this.phaseOffsets.bodyY) * by.speed1) * 0.6 +
        Math.sin((t + this.phaseOffsets.bodyY) * by.speed2) * 0.4) *
      by.amplitude *
      profile.body *
      idleMix *
      speakDampen +
      this.currentPose.bodyY;

    const bodyZ =
      (Math.sin((t + this.phaseOffsets.bodyZ) * bz.speed1) * 0.6 +
        Math.sin((t + this.phaseOffsets.bodyZ) * bz.speed2) * 0.4) *
      bz.amplitude *
      profile.body *
      idleMix *
      speakDampen +
      this.currentPose.bodyZ;

    this.setParam(coreModel, 'ParamBodyAngleX', bodyX);
    this.setParam(coreModel, 'ParamBodyAngleY', bodyY);
    this.setParam(coreModel, 'ParamBodyAngleZ', bodyZ);
  }

  private applyArmMotion(coreModel: CoreModelLike, t: number): void {
    const profile = this.getEmotionProfile();
    const idleMix = this.currentMix.arm;
    const speakDampen = this.isSpeaking ? 0.35 : 1;
    const armBase = profile.arm * idleMix * speakDampen;

    if (armBase < 0.01) {
      this.setParam(coreModel, 'ParamLeftShoulderUp', 0);
      this.setParam(coreModel, 'ParamRightShoulderUp', 0);
      this.setParam(coreModel, 'ParamArmRA01', 0);
      this.setParam(coreModel, 'ParamArmRA03', 0);
      this.setParam(coreModel, 'ParamWandRotate', 0);
      this.setParam(coreModel, 'ParamArmLB01', 0);
      this.setParam(coreModel, 'ParamHandLB', 0);
      return;
    }

    const swayA = Math.sin((t + this.phaseOffsets.bodyY) * 0.00045);
    const swayB = Math.sin((t + this.phaseOffsets.headX) * 0.00062);
    const swayC = Math.sin((t + this.phaseOffsets.overallR) * 0.00073);

    const shoulder = (this.currentPose.shoulder + swayA * 0.08) * armBase;
    const rightArm = (this.currentPose.armRA + swayB * 1.2) * armBase;
    const rightWrist = (this.currentPose.armRB + swayC * 0.9) * armBase;
    const wand = (this.currentPose.wand + swayC * 2.5) * armBase;
    const leftArm = (this.currentPose.armLA + swayA * 0.55) * armBase;
    const leftHand = (this.currentPose.handLB + swayB * 0.06) * armBase;

    this.setParam(coreModel, 'ParamLeftShoulderUp', shoulder);
    this.setParam(coreModel, 'ParamRightShoulderUp', -shoulder * 0.7);
    this.setParam(coreModel, 'ParamArmRA01', rightArm);
    this.setParam(coreModel, 'ParamArmRA03', rightWrist);
    this.setParam(coreModel, 'ParamWandRotate', wand);
    this.setParam(coreModel, 'ParamArmLB01', leftArm);
    this.setParam(coreModel, 'ParamHandLB', leftHand);
  }

  private applyEyeLook(coreModel: CoreModelLike, now: number): void {
    if (this.gestureActive) {
      return;
    }

    const profile = this.getEmotionProfile();

    if (now >= this.nextEyeMoveTime) {
      this.pickNewEyeTarget();
      this.scheduleNextEyeMove();
    }

    this.eyeCurrentX +=
      (this.eyeTargetX * profile.eyeLook - this.eyeCurrentX) * EYE_LOOK.transitionSpeed;
    this.eyeCurrentY +=
      (this.eyeTargetY * profile.eyeLook - this.eyeCurrentY) * EYE_LOOK.transitionSpeed;

    this.setParam(coreModel, 'ParamEyeBallX', this.eyeCurrentX);
    this.setParam(coreModel, 'ParamEyeBallY', this.eyeCurrentY);

    if (profile.forceClosedEyes) {
      this.setParam(coreModel, 'ParamEyeLOpen', 0);
      this.setParam(coreModel, 'ParamEyeROpen', 0);
    }
  }

  private pickNewEyeTarget(): void {
    if (Math.random() < EYE_LOOK.centerChance) {
      this.eyeTargetX = 0;
      this.eyeTargetY = 0;
      return;
    }

    this.eyeTargetX = (Math.random() * 2 - 1) * EYE_LOOK.rangeX;
    this.eyeTargetY = (Math.random() * 2 - 1) * EYE_LOOK.rangeY;
  }

  private scheduleNextEyeMove(): void {
    const delay = EYE_LOOK.holdMin + Math.random() * (EYE_LOOK.holdMax - EYE_LOOK.holdMin);
    this.nextEyeMoveTime = performance.now() + delay;
  }

  private applyBrowMotion(coreModel: CoreModelLike, t: number): void {
    if (this.gestureActive) {
      return;
    }

    const profile = this.getEmotionProfile();
    const { amplitude, speed1, speed2 } = BROW_MOTION;

    const browL =
      (Math.sin((t + this.phaseOffsets.browL) * speed1) * 0.6 +
        Math.sin((t + this.phaseOffsets.browL) * speed2) * 0.4) *
      amplitude *
      profile.brow;

    const browR =
      (Math.sin((t + this.phaseOffsets.browR + 500) * speed1) * 0.6 +
        Math.sin((t + this.phaseOffsets.browR + 500) * speed2) * 0.4) *
      amplitude *
      profile.brow;

    this.setParam(coreModel, 'ParamBrowLY', browL);
    this.setParam(coreModel, 'ParamBrowRY', browR);
  }

  private applyOverallSway(coreModel: CoreModelLike, t: number): void {
    const profile = this.getEmotionProfile();
    const speakDampen = this.isSpeaking ? 0.2 : 1;
    const idleMix = this.currentMix.overall;
    const ox = OVERALL_SWAY.x;
    const oy = OVERALL_SWAY.y;
    const rotate = OVERALL_SWAY.rotate;

    const allX =
      Math.sin((t + this.phaseOffsets.overallX) * ox.speed) *
      ox.amplitude *
      profile.overall *
      idleMix *
      speakDampen +
      this.currentPose.overallX * 0.0022;
    const allY =
      Math.sin((t + this.phaseOffsets.overallY) * oy.speed) *
      oy.amplitude *
      profile.overall *
      idleMix *
      speakDampen +
      this.currentPose.overallY * 0.0022;
    const allR =
      Math.sin((t + this.phaseOffsets.overallR) * rotate.speed) *
      rotate.amplitude *
      profile.overall *
      idleMix *
      speakDampen +
      this.currentPose.overallR * 0.08;

    this.setParam(coreModel, 'ParamAllX', allX);
    this.setParam(coreModel, 'ParamAllY', allY);
    this.setParam(coreModel, 'ParamAllRotate', allR);
  }

  async playMotion(group: string, index: number, priority = 3): Promise<void> {
    if (!this.model) {
      return;
    }

    console.log(`[Animation] Playing motion: group="${group}", index=${index}`);

    try {
      await this.model.motion(group, index, priority);
    } catch (error) {
      console.warn('[Animation] Motion play failed:', error);
    }
  }

  setSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
  }

  setGestureActive(active: boolean): void {
    this.gestureActive = active;
  }

  private getEmotionProfile() {
    return EMOTION_MOTION_PROFILE[expressionManager.getCurrentEmotion()];
  }

  private updateIdleVariation(now: number): void {
    if (now >= this.nextVariationTime) {
      this.scheduleNextVariation();
    }

    this.currentMix.head += (this.targetMix.head - this.currentMix.head) * 0.012;
    this.currentMix.body += (this.targetMix.body - this.currentMix.body) * 0.012;
    this.currentMix.arm += (this.targetMix.arm - this.currentMix.arm) * 0.012;
    this.currentMix.overall += (this.targetMix.overall - this.currentMix.overall) * 0.012;

    this.currentPose.headX += (this.targetPose.headX - this.currentPose.headX) * 0.018;
    this.currentPose.headY += (this.targetPose.headY - this.currentPose.headY) * 0.018;
    this.currentPose.headZ += (this.targetPose.headZ - this.currentPose.headZ) * 0.018;
    this.currentPose.bodyX += (this.targetPose.bodyX - this.currentPose.bodyX) * 0.018;
    this.currentPose.bodyY += (this.targetPose.bodyY - this.currentPose.bodyY) * 0.018;
    this.currentPose.bodyZ += (this.targetPose.bodyZ - this.currentPose.bodyZ) * 0.018;
    this.currentPose.armLA += (this.targetPose.armLA - this.currentPose.armLA) * 0.018;
    this.currentPose.armRA += (this.targetPose.armRA - this.currentPose.armRA) * 0.018;
    this.currentPose.armRB += (this.targetPose.armRB - this.currentPose.armRB) * 0.018;
    this.currentPose.shoulder += (this.targetPose.shoulder - this.currentPose.shoulder) * 0.018;
    this.currentPose.handLB += (this.targetPose.handLB - this.currentPose.handLB) * 0.018;
    this.currentPose.wand += (this.targetPose.wand - this.currentPose.wand) * 0.018;
    this.currentPose.overallX += (this.targetPose.overallX - this.currentPose.overallX) * 0.018;
    this.currentPose.overallY += (this.targetPose.overallY - this.currentPose.overallY) * 0.018;
    this.currentPose.overallR += (this.targetPose.overallR - this.currentPose.overallR) * 0.018;
  }

  private scheduleNextVariation(immediate = false): void {
    const presets: IdleLayerMix[] = [
      { head: 0.18, body: 0, arm: 0, overall: 0.06 },
      { head: 0.42, body: 0.08, arm: 0, overall: 0.12 },
      { head: 0.2, body: 0, arm: 0.32, overall: 0.04 },
      { head: 0.52, body: 0.16, arm: 0.1, overall: 0.16 },
      { head: 0.28, body: 0.04, arm: 0.18, overall: 0.08 },
      { head: 0.1, body: 0.02, arm: 0, overall: 0 },
    ];

    this.targetMix = presets[Math.floor(Math.random() * presets.length)];
    this.targetPose = this.pickPosePreset(this.targetMix);
    this.nextVariationTime = performance.now() + (immediate ? 0 : 2400 + Math.random() * 4200);
  }

  private pickPosePreset(mix: IdleLayerMix): IdlePose {
    const poses: IdlePose[] = [
      this.createZeroPose(),
      {
        ...this.createZeroPose(),
        headX: -1.8,
        headY: 0.5,
        bodyX: -0.7,
        armRA: 6,
        wand: 10,
        overallX: -0.2,
      },
      {
        ...this.createZeroPose(),
        headX: 1.4,
        headY: -0.2,
        bodyX: 0.6,
        bodyZ: 0.5,
        armLA: 2.4,
        shoulder: 0.08,
        overallR: 0.18,
      },
      {
        ...this.createZeroPose(),
        headY: -0.9,
        bodyY: -0.4,
        armRA: -4,
        armRB: -2.5,
        wand: -8,
        overallY: -0.25,
      },
      {
        ...this.createZeroPose(),
        headX: 0.6,
        headZ: 0.8,
        bodyX: 0.3,
        armLA: 1.8,
        armRA: 2.5,
        handLB: 0.08,
      },
      {
        ...this.createZeroPose(),
        headX: -0.4,
        headY: 0.3,
        bodyZ: -0.6,
        armRA: 7.5,
        armRB: 3.5,
        shoulder: 0.12,
        wand: 14,
      },
    ];

    const strongArmPoses = poses.filter((pose) => Math.abs(pose.armRA) > 4 || Math.abs(pose.wand) > 8);
    const subtlePoses = poses.filter((pose) => Math.abs(pose.armRA) <= 4 && Math.abs(pose.wand) <= 8);

    if (mix.arm > 0.16) {
      return strongArmPoses[Math.floor(Math.random() * strongArmPoses.length)];
    }

    if (mix.body < 0.04 && mix.head < 0.2) {
      return this.createZeroPose();
    }

    return subtlePoses[Math.floor(Math.random() * subtlePoses.length)];
  }

  private createZeroPose(): IdlePose {
    return {
      headX: 0,
      headY: 0,
      headZ: 0,
      bodyX: 0,
      bodyY: 0,
      bodyZ: 0,
      armLA: 0,
      armRA: 0,
      armRB: 0,
      shoulder: 0,
      handLB: 0,
      wand: 0,
      overallX: 0,
      overallY: 0,
      overallR: 0,
    };
  }

  private setParam(coreModel: CoreModelLike, paramId: string, value: number): void {
    try {
      coreModel.setParameterValueById(paramId, value);
    } catch {
      // Model beda bisa punya param yang beda juga.
    }
  }

  destroy(): void {
    this.isActive = false;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.gestureActive = false;
    this.model = null;
  }
}

export const animationController = new AnimationController();
