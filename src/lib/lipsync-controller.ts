import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch';
import { animationController } from './animation-controller';
import { live2dManager } from './live2d-manager';

type MouthShape = 'A' | 'U' | 'O';

type CoreModelLike = {
  getParameterIndex?: (id: string) => number;
  getParameterValue?: (index: number) => number;
  getParameterValueById?: (id: string) => number;
  setParameterValueById: (id: string, value: number) => void;
};

type InternalModelLike = {
  lipSyncValue?: number;
};

export class LipSyncController {
  private model: Live2DModel | null = null;
  private isSpeaking = false;
  private currentU = 0;
  private currentO = 0;
  private targetU = 0;
  private targetO = 0;
  private currentShape: MouthShape = 'A';
  private shapeTimer: ReturnType<typeof setTimeout> | null = null;
  private shapeActive = false;
  private tickerBound: (() => void) | null = null;

  private readonly LERP_SPEED = 0.2;
  private readonly SHAPE_INTERVAL_MIN = 120;
  private readonly SHAPE_INTERVAL_MAX = 250;
  private readonly MOUTH_OPEN_THRESHOLD = 0.1;

  init(model: Live2DModel): void {
    this.model = model;
    this.setupTicker();
    console.log('[LipSync] Simplified A/U/O initialized');
  }

  private setupTicker(): void {
    const app = live2dManager.getApp();
    if (!app || this.tickerBound) {
      return;
    }

    this.tickerBound = () => this.onTick();
    app.ticker.add(this.tickerBound, undefined, PIXI.UPDATE_PRIORITY.LOW);
  }

  private onTick(): void {
    if (!this.model) {
      return;
    }

    const core = this.model.internalModel?.coreModel as CoreModelLike | undefined;
    if (!core) {
      return;
    }

    this.currentU += (this.targetU - this.currentU) * this.LERP_SPEED;
    this.currentO += (this.targetO - this.currentO) * this.LERP_SPEED;

    const mouthOpen = this.getParamAValue(core);

    if (mouthOpen > this.MOUTH_OPEN_THRESHOLD && this.isSpeaking) {
      this.setParam(core, 'ParamU', this.currentU * mouthOpen);
      this.setParam(core, 'ParamO', this.currentO * mouthOpen);
      return;
    }

    this.setParam(core, 'ParamU', 0);
    this.setParam(core, 'ParamO', 0);
  }

  private getParamAValue(core: CoreModelLike): number {
    try {
      return core.getParameterValueById?.('ParamA') ?? 0;
    } catch {
      try {
        const index = core.getParameterIndex?.('ParamA') ?? -1;
        if (index >= 0) {
          return core.getParameterValue?.(index) ?? 0;
        }
      } catch {
        // Beberapa model expose ParamA dengan cara beda.
      }
    }

    return 0;
  }

  async speakWithAudio(audioUrl: string, _text?: string): Promise<void> {
    if (!this.model) {
      return;
    }

    this.stopSpeaking();
    this.isSpeaking = true;
    animationController.setSpeaking(true);
    this.startShapeCycling();

    return new Promise<void>((resolve) => {
      this.model!.speak(audioUrl, {
        volume: 1.0,
        crossOrigin: 'anonymous',
        onFinish: () => {
          this.onSpeakingDone();
          resolve();
        },
        onError: (error) => {
          console.error('[LipSync] Speak error:', error);
          this.onSpeakingDone();
          resolve();
        },
      });
    });
  }

  private startShapeCycling(): void {
    this.shapeActive = true;

    const cycle = () => {
      if (!this.shapeActive || !this.isSpeaking) {
        return;
      }

      const shapes: MouthShape[] = ['A', 'A', 'A', 'U', 'O'];
      this.currentShape = shapes[Math.floor(Math.random() * shapes.length)];

      switch (this.currentShape) {
        case 'A':
          this.targetU = 0;
          this.targetO = 0;
          break;
        case 'U':
          this.targetU = 0.6 + Math.random() * 0.3;
          this.targetO = 0;
          break;
        case 'O':
          this.targetU = 0;
          this.targetO = 0.5 + Math.random() * 0.3;
          break;
      }

      const delay =
        this.SHAPE_INTERVAL_MIN +
        Math.random() * (this.SHAPE_INTERVAL_MAX - this.SHAPE_INTERVAL_MIN);
      this.shapeTimer = setTimeout(cycle, delay);
    };

    cycle();
  }

  async speakWithText(text: string, speedMs = 80): Promise<void> {
    if (!this.model) {
      return;
    }

    this.stopSpeaking();
    this.isSpeaking = true;
    animationController.setSpeaking(true);

    const internal = this.model.internalModel as InternalModelLike | undefined;

    for (const char of text.toLowerCase()) {
      if (!this.isSpeaking) {
        break;
      }

      const mouth = this.charToMouth(char);
      if (mouth === null) {
        if (internal) {
          internal.lipSyncValue = 0;
        }
        this.targetU = 0;
        this.targetO = 0;
        await this.sleep(150);
        continue;
      }

      if (internal) {
        internal.lipSyncValue = mouth.open;
      }
      this.targetU = mouth.u;
      this.targetO = mouth.o;

      await this.sleep(speedMs);
    }

    if (internal) {
      internal.lipSyncValue = 0;
    }
    this.targetU = 0;
    this.targetO = 0;
    await this.sleep(300);

    this.onSpeakingDone();
  }

  private charToMouth(char: string): { open: number; u: number; o: number } | null {
    switch (char) {
      case 'a':
        return { open: 1.0, u: 0, o: 0 };
      case 'i':
        return { open: 0.5, u: 0, o: 0 };
      case 'u':
        return { open: 0.4, u: 0.8, o: 0 };
      case 'e':
        return { open: 0.6, u: 0, o: 0 };
      case 'o':
        return { open: 0.7, u: 0, o: 0.7 };
      case 'b':
      case 'p':
      case 'm':
        return { open: 0.15, u: 0.2, o: 0 };
      case 'f':
      case 'v':
        return { open: 0.2, u: 0, o: 0 };
      case 't':
      case 'd':
      case 'n':
      case 'l':
        return { open: 0.3, u: 0, o: 0 };
      case 's':
      case 'z':
      case 'c':
        return { open: 0.25, u: 0, o: 0 };
      case 'k':
      case 'g':
        return { open: 0.4, u: 0, o: 0.2 };
      case 'r':
        return { open: 0.3, u: 0, o: 0 };
      case 'w':
        return { open: 0.3, u: 0.6, o: 0.2 };
      case 'y':
      case 'j':
        return { open: 0.3, u: 0, o: 0 };
      case 'h':
        return { open: 0.5, u: 0, o: 0 };
      case ' ':
        return { open: 0.03, u: 0, o: 0 };
      case '.':
      case ',':
      case '!':
      case '?':
        return null;
      default:
        return { open: 0.3, u: 0, o: 0 };
    }
  }

  private onSpeakingDone(): void {
    this.isSpeaking = false;
    this.shapeActive = false;
    this.targetU = 0;
    this.targetO = 0;
    this.currentU = 0;
    this.currentO = 0;

    if (this.shapeTimer) {
      clearTimeout(this.shapeTimer);
      this.shapeTimer = null;
    }

    animationController.setSpeaking(false);
    console.log('[LipSync] Done');
  }

  stopSpeaking(): void {
    this.shapeActive = false;

    if (this.model) {
      try {
        this.model.stopSpeaking();
      } catch {
        // Aman kalau lagi tidak ada audio yang jalan.
      }

      const internal = this.model.internalModel as InternalModelLike | undefined;
      if (internal) {
        internal.lipSyncValue = 0;
      }
    }

    if (this.shapeTimer) {
      clearTimeout(this.shapeTimer);
      this.shapeTimer = null;
    }

    this.currentU = 0;
    this.currentO = 0;
    this.targetU = 0;
    this.targetO = 0;
    this.isSpeaking = false;

    animationController.setSpeaking(false);
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private setParam(core: CoreModelLike, id: string, value: number): void {
    try {
      core.setParameterValueById(id, value);
    } catch {
      // Skip kalau param ini tidak ada di model.
    }
  }

  destroy(): void {
    this.stopSpeaking();

    if (this.tickerBound) {
      const app = live2dManager.getApp();
      if (app) {
        app.ticker.remove(this.tickerBound);
      }
      this.tickerBound = null;
    }

    this.model = null;
  }
}

export const lipSyncController = new LipSyncController();
