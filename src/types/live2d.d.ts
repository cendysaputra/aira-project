/// <reference types="pixi.js" />

declare module 'pixi-live2d-display-lipsyncpatch' {
  import * as PIXI from 'pixi.js';

  export class Live2DModel extends PIXI.Sprite {
    static from(source: string | object, options?: any): Promise<Live2DModel>;

    readonly internalModel: any;

    motion(group: string, index?: number, priority?: number): Promise<boolean>;

    expression(index?: number | string): Promise<boolean>;

    speak(
      audioUrl: string,
      options?: {
        volume?: number;
        expression?: number | string;
        resetExpression?: boolean;
        crossOrigin?: string;
        onFinish?: () => void;
        onError?: (e: any) => void;
      }
    ): void;

    stopSpeaking(): void;

    readonly lipSync: boolean;

    hitTest(x: number, y: number): string[];

    update(dt: number): void;

    destroy(options?: any): void;

    tap(x: number, y: number): void;

    readonly tracker: any;
  }

  export class MotionPreloadStrategy {
    static ALL: string;
    static IDLE: string;
    static NONE: string;
  }

  export const MotionPriority: {
    NONE: number;
    IDLE: number;
    NORMAL: number;
    FORCE: number;
  };
}

declare module 'pixi-live2d-display-lipsyncpatch/cubism4' {
  export * from 'pixi-live2d-display-lipsyncpatch';
}
