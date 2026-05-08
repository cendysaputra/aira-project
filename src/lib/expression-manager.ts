import type { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4';
import {
  DEFAULT_EMOTION,
  EXPRESSION_AUTO_REVERT_MS,
  EXPRESSION_AUTO_REVERT_MS_BY_EMOTION,
  EXPRESSION_MAP,
  type EmotionType,
} from '../config/expressions';

export class ExpressionManager {
  private model: Live2DModel | null = null;
  private currentEmotion: EmotionType = DEFAULT_EMOTION;
  private lastExpressionTime = 0;
  private revertTimer: ReturnType<typeof setTimeout> | null = null;
  private isTransitioning = false;
  private defaultEyeBlink: unknown = null;

  init(model: Live2DModel): void {
    this.model = model;
    this.currentEmotion = DEFAULT_EMOTION;
    this.lastExpressionTime = Date.now();
    this.defaultEyeBlink = (model.internalModel as { eyeBlink?: unknown } | undefined)?.eyeBlink ?? null;
    this.applyEyeBlinkMode(DEFAULT_EMOTION);
    console.log('[Expression] Manager initialized');
  }

  async setEmotion(emotion: EmotionType, autoRevert = true): Promise<void> {
    if (!this.model) {
      return;
    }

    const config = EXPRESSION_MAP[emotion];
    if (!config) {
      console.warn(`[Expression] Unknown emotion: ${emotion}`);
      return;
    }

    const now = Date.now();
    const currentConfig = EXPRESSION_MAP[this.currentEmotion];
    const isTooSoon = now - this.lastExpressionTime < currentConfig.minDuration;

    if ((this.isTransitioning || isTooSoon) && config.priority <= currentConfig.priority) {
      console.log(`[Expression] Skipped ${emotion} - current ${this.currentEmotion} still active`);
      return;
    }

    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }

    this.isTransitioning = true;
    this.currentEmotion = emotion;
    this.lastExpressionTime = now;
    this.applyEyeBlinkMode(emotion);

    console.log(`[Expression] Setting emotion: ${emotion} (${config.label})`);

    try {
      await this.model.expression(config.expressionIndex);
      this.pinClosedEyesIfNeeded();
    } catch (error) {
      console.warn('[Expression] Failed to set expression:', error);
    } finally {
      this.isTransitioning = false;
    }

    if (autoRevert && emotion !== DEFAULT_EMOTION) {
      const revertDelay = EXPRESSION_AUTO_REVERT_MS_BY_EMOTION[emotion] ?? EXPRESSION_AUTO_REVERT_MS;
      this.revertTimer = setTimeout(() => {
        void this.setEmotion(DEFAULT_EMOTION, false);
      }, revertDelay);
    }
  }

  getCompatibleMotions(): { group: string; index: number }[] {
    return EXPRESSION_MAP[this.currentEmotion]?.compatibleMotions || [];
  }

  getCurrentEmotion(): EmotionType {
    return this.currentEmotion;
  }

  resetToNeutral(): void {
    void this.setEmotion(DEFAULT_EMOTION, false);
  }

  destroy(): void {
    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }

    this.model = null;
  }

  private applyEyeBlinkMode(emotion: EmotionType): void {
    const internalModel = this.model?.internalModel as { eyeBlink?: unknown; coreModel?: { setParameterValueById: (id: string, value: number) => void } } | undefined;

    if (!internalModel) {
      return;
    }

    if (EXPRESSION_MAP[emotion].emotion === 'happy' || EXPRESSION_MAP[emotion].emotion === 'sleepy') {
      internalModel.eyeBlink = undefined;
      this.pinClosedEyesIfNeeded();
      return;
    }

    internalModel.eyeBlink = this.defaultEyeBlink ?? internalModel.eyeBlink;
  }

  private pinClosedEyesIfNeeded(): void {
    if (!this.model) {
      return;
    }

    if (this.currentEmotion !== 'happy' && this.currentEmotion !== 'sleepy') {
      return;
    }

    const coreModel = (this.model.internalModel as { coreModel?: { setParameterValueById: (id: string, value: number) => void } } | undefined)?.coreModel;
    coreModel?.setParameterValueById('ParamEyeLOpen', 0);
    coreModel?.setParameterValueById('ParamEyeROpen', 0);
  }
}

export const expressionManager = new ExpressionManager();
