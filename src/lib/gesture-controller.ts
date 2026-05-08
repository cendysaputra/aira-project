import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch';
import {
  EMOTION_DEFAULT_GESTURE,
  GESTURES,
  GESTURE_KEYWORDS,
  type GestureKeyframe,
  type GestureType,
} from '../config/gestures';
import { animationController } from './animation-controller';

type CoreModelLike = {
  setParameterValueById?: (id: string, value: number) => void;
};

export class GestureController {
  private model: Live2DModel | null = null;
  private isPlaying = false;
  private animFrameId: number | null = null;
  private gestureStartTime = 0;

  init(model: Live2DModel): void {
    this.model = model;
    console.log('[Gesture] Controller initialized');
  }

  playFromText(text: string, emotion: string): void {
    const gesture = this.detectGesture(text, emotion);
    if (gesture !== 'none') {
      this.playGesture(gesture);
    }
  }

  private detectGesture(text: string, emotion: string): GestureType {
    const lower = text.toLowerCase();
    let bestGesture: GestureType = 'none';
    let bestPriority = 0;

    for (const entry of GESTURE_KEYWORDS) {
      for (const keyword of entry.keywords) {
        if (lower.includes(keyword) && entry.priority > bestPriority) {
          bestGesture = entry.gesture;
          bestPriority = entry.priority;
        }
      }
    }

    if (bestGesture === 'none') {
      bestGesture = EMOTION_DEFAULT_GESTURE[emotion] || 'none';
    }

    return bestGesture;
  }

  playGesture(type: GestureType): void {
    if (!this.model || type === 'none') {
      return;
    }

    const config = GESTURES[type];
    if (!config || config.keyframes.length === 0) {
      return;
    }

    this.stop();
    this.isPlaying = true;
    this.gestureStartTime = performance.now();
    animationController.setGestureActive(true);
    console.log(`[Gesture] Playing: ${type}`);

    const animate = () => {
      if (!this.isPlaying || !this.model) {
        return;
      }

      const elapsed = performance.now() - this.gestureStartTime;
      const progress = Math.min(elapsed / config.duration, 1);
      const params = this.interpolateKeyframes(config.keyframes, progress);
      this.applyParams(params);

      if (progress < 1) {
        this.animFrameId = requestAnimationFrame(animate);
      } else {
        this.isPlaying = false;
        this.animFrameId = null;
        animationController.setGestureActive(false);
      }
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  private interpolateKeyframes(
    keyframes: GestureKeyframe[],
    progress: number,
  ): Record<string, number> {
    let kfBefore = keyframes[0];
    let kfAfter = keyframes[keyframes.length - 1];

    for (let index = 0; index < keyframes.length - 1; index += 1) {
      if (progress >= keyframes[index].time && progress <= keyframes[index + 1].time) {
        kfBefore = keyframes[index];
        kfAfter = keyframes[index + 1];
        break;
      }
    }

    const range = kfAfter.time - kfBefore.time;
    const localProgress = range > 0 ? (progress - kfBefore.time) / range : 1;
    const eased = localProgress < 0.5
      ? 4 * localProgress * localProgress * localProgress
      : 1 - ((-2 * localProgress + 2) ** 3) / 2;

    const result: Record<string, number> = {};
    const allKeys = new Set([
      ...Object.keys(kfBefore.params),
      ...Object.keys(kfAfter.params),
    ]);

    for (const key of allKeys) {
      const from = kfBefore.params[key as keyof GestureKeyframe['params']] ?? 0;
      const to = kfAfter.params[key as keyof GestureKeyframe['params']] ?? 0;
      result[key] = from + (to - from) * eased;
    }

    return result;
  }

  private applyParams(params: Record<string, number>): void {
    const core = this.model?.internalModel?.coreModel as CoreModelLike | undefined;
    if (!core) {
      return;
    }

    const paramMap: Record<string, string> = {
      angleX: 'ParamAngleX',
      angleY: 'ParamAngleY',
      angleZ: 'ParamAngleZ',
      bodyAngleX: 'ParamBodyAngleX',
      bodyAngleY: 'ParamBodyAngleY',
      bodyAngleZ: 'ParamBodyAngleZ',
      eyeBallX: 'ParamEyeBallX',
      eyeBallY: 'ParamEyeBallY',
      browLY: 'ParamBrowLY',
      browRY: 'ParamBrowRY',
    };

    for (const [key, value] of Object.entries(params)) {
      if (value === 0) {
        continue;
      }

      const paramId = paramMap[key];
      if (!paramId) {
        continue;
      }

      try {
        core.setParameterValueById?.(paramId, value);
      } catch {
        // Skip kalau param itu tidak dipakai model ini.
      }
    }
  }

  stop(): void {
    this.isPlaying = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    animationController.setGestureActive(false);
  }

  isActive(): boolean {
    return this.isPlaying;
  }

  destroy(): void {
    this.stop();
    this.model = null;
  }
}

export const gestureController = new GestureController();
