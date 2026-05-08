import * as PIXI from 'pixi.js';
import { Live2DModel, MotionPreloadStrategy } from 'pixi-live2d-display-lipsyncpatch/cubism4';

declare global {
  interface Window {
    PIXI?: typeof PIXI;
  }
}

window.PIXI = PIXI;

export class Live2DManager {
  private app: PIXI.Application | null = null;
  private model: Live2DModel | null = null;
  private resizeObserver: ResizeObserver | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.app) {
      return;
    }

    this.app = new PIXI.Application({
      view: canvas,
      resizeTo: canvas.parentElement || window,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.fitModel();
    });

    if (canvas.parentElement) {
      this.resizeObserver.observe(canvas.parentElement);
    }
  }

  async loadModel(modelPath: string): Promise<Live2DModel> {
    if (!this.app) {
      throw new Error('PixiJS Application belum di-init. Panggil init() dulu.');
    }

    try {
      this.model = await Live2DModel.from(modelPath, {
        motionPreload: MotionPreloadStrategy.NONE,
        autoInteract: false,
      });

      this.model.anchor.set(0.5, 0.5);
      this.app.stage.addChild(this.model as unknown as PIXI.DisplayObject);
      this.fitModel();

      console.log('[Live2D] Model loaded successfully');
      console.log(
        '[Live2D] Available motions:',
        Object.keys(this.model.internalModel.motionManager.definitions),
      );
      console.log(
        '[Live2D] Available expressions:',
        this.model.internalModel.motionManager.expressionManager?.definitions?.length || 0,
      );

      return this.model;
    } catch (error) {
      console.error('[Live2D] Failed to load model:', error);
      throw error;
    }
  }

  private fitModel(): void {
    if (!this.model || !this.app) {
      return;
    }

    const { width, height } = this.app.renderer.screen;

    // Reset dulu biar ukuran aslinya kebaca benar.
    this.model.scale.set(1);

    const bounds = this.model.getLocalBounds();
    const modelWidth = bounds.width || 1;
    const modelHeight = bounds.height || 1;

    const scale = Math.min((width * 1) / modelWidth, (height * 2) / modelHeight);

    const pivotX = bounds.x + bounds.width / 2;
    const pivotY = bounds.y + bounds.height / 4;

    this.model.scale.set(scale);
    this.model.pivot.set(pivotX, pivotY);

    // Model ini terasa agak berat ke kiri, jadi digeser dikit biar center-nya enak.
    this.model.x = width / 2 + width * 0.02;
    this.model.y = height / 2 - height * 0.12;
  }

  getModel(): Live2DModel | null {
    return this.model;
  }

  getApp(): PIXI.Application | null {
    return this.app;
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.model) {
      this.model.destroy();
      this.model = null;
    }

    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
  }
}

export const live2dManager = new Live2DManager();
