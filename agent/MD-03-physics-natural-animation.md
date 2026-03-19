# MD-03: Natural Idle Animation

## Overview
Bikin Aira keliatan "hidup" secara mandiri — napas, kepala bergerak pelan, mata lirik random, badan sway halus. Semua gerakan ini BUKAN dari mouse tracking dan BUKAN dari motion JSON files. Ini murni parameter-based procedural animation yang jalan terus di background.

Motion dari JSON files (mtn_01-04, special_01-03) adalah gerakan interaktif (main tongkat, pose dramatis, dll) — ini akan di-trigger **sesekali oleh AI** di MD-06, bukan sebagai idle.

## Prerequisites
- MD-02 sudah selesai (model muncul di canvas)
- Model sudah loaded dan physics bawaan aktif

## Konsep: Layer-based Animation

Animasi idle Aira terdiri dari beberapa layer yang berjalan independen dan di-overlay:

```
Layer 1: Breathing         → ParamBreath (naik-turun halus)
Layer 2: Head Micro-motion → ParamAngleX/Y/Z (kepala gerak pelan random)  
Layer 3: Body Sway         → ParamBodyAngleX/Y/Z (badan goyang super pelan)
Layer 4: Eye Look          → ParamEyeBallX/Y (mata lirik random)
Layer 5: Brow Micro        → ParamBrowLY/RY (alis naik-turun subtle)
Layer 6: Overall Sway      → ParamAllX/Y/Rotate (seluruh badan geser pelan)
```

Physics bawaan (rambut, topi, ribbon, robe, pendant) sudah otomatis jalan dari SDK — kita TIDAK perlu atur itu. Physics ini akan bereaksi terhadap gerakan kepala & badan yang kita generate.

## Motion JSON Files — Kapan Dipakai

| File | Durasi | Deskripsi | Kapan Dipake |
|------|--------|-----------|-------------|
| mtn_01 (Idle) | 5.57s | Idle dasar | Sesekali di-trigger AI saat santai |
| mtn_02 | 3.47s | General gesture 1 | AI trigger saat ngobrol casual |
| mtn_03 | 4.4s | General gesture 2 | AI trigger saat ngobrol casual |
| mtn_04 | 4.2s | General gesture 3 | AI trigger saat ngobrol casual |
| special_01 | 7.8s | Pose spesial (complex) | AI trigger saat excited/special moment |
| special_02 | 9.37s | Pose spesial (complex) | AI trigger saat surprise/special |
| special_03 | 9.23s | Pose spesial (complex) | AI trigger saat angry/dramatic |

> Motion di-trigger dari MD-06 (AI Integration). MD-03 TIDAK auto-play motion files.

## Step 1: Motion Config (`src/config/motions.ts`)

Buat file `src/config/motions.ts`:

```typescript
/**
 * Natural idle animation config
 * Semua gerakan ini procedural (bukan dari motion JSON files)
 * 
 * Motion JSON files TIDAK dipakai untuk idle.
 * Motion JSON akan di-trigger oleh AI (MD-06) di saat yang tepat.
 */

/**
 * Breathing animation
 * ParamBreath: 0 = exhale, 1 = inhale
 */
export const BREATHING = {
  speed: 0.0025,        // Kecepatan siklus napas (lower = lebih pelan)
  amplitude: 0.6,       // Seberapa dalam napas (0-1)
  offset: 0.4,          // Baseline value
};

/**
 * Head micro-motion
 * Kepala bergerak pelan random — bukan tracking mouse
 * Pakai Perlin-like noise via layered sine waves
 */
export const HEAD_MOTION = {
  // ParamAngleX (kiri-kanan)
  angleX: {
    amplitude: 6,       // Max derajat kiri/kanan
    speed1: 0.0008,     // Primary wave speed (sangat pelan)
    speed2: 0.0013,     // Secondary wave speed (sedikit beda buat variasi)
    speed3: 0.0005,     // Tertiary wave (super slow drift)
  },
  // ParamAngleY (atas-bawah)
  angleY: {
    amplitude: 4,
    speed1: 0.0006,
    speed2: 0.001,
    speed3: 0.0004,
  },
  // ParamAngleZ (miring kiri-kanan)
  angleZ: {
    amplitude: 3,
    speed1: 0.0005,
    speed2: 0.0009,
    speed3: 0.0003,
  },
};

/**
 * Body sway
 * Badan goyang super halus — lebih pelan dari kepala
 */
export const BODY_SWAY = {
  angleX: {
    amplitude: 2.5,       // Lebih kecil dari kepala
    speed1: 0.0004,       // Lebih pelan dari kepala  
    speed2: 0.0007,
  },
  angleY: {
    amplitude: 1.5,
    speed1: 0.0003,
    speed2: 0.0006,
  },
  angleZ: {
    amplitude: 1.5,
    speed1: 0.0003,
    speed2: 0.0005,
  },
};

/**
 * Eye random look
 * Mata lirik ke arah random sesekali
 */
export const EYE_LOOK = {
  // Range lirik
  rangeX: 0.5,            // Max horizontal (-0.5 to 0.5)
  rangeY: 0.3,            // Max vertical (-0.3 to 0.3)
  
  // Timing
  holdMin: 2000,           // Min waktu nahan posisi lirik (ms)
  holdMax: 5000,           // Max waktu nahan
  transitionSpeed: 0.04,   // Kecepatan lerp mata pindah posisi
  
  // Kadang lirik balik ke tengah
  centerChance: 0.35,      // 35% chance lirik balik ke tengah
};

/**
 * Brow micro animation
 * Alis naik-turun super subtle
 */
export const BROW_MOTION = {
  amplitude: 0.15,         // Sangat subtle
  speed1: 0.0004,
  speed2: 0.0007,
};

/**
 * Overall body drift
 * Seluruh karakter bergeser sedikit (kayak napas seluruh badan)
 */
export const OVERALL_SWAY = {
  x: {
    amplitude: 0.008,      // Sangat kecil
    speed: 0.0003,
  },
  y: {
    amplitude: 0.006,
    speed: 0.0005,
  },
  rotate: {
    amplitude: 0.5,        // Derajat
    speed: 0.0002,
  },
};

/**
 * Motion trigger config — dipakai oleh AI (MD-06)
 * Ini BUKAN untuk idle, tapi referensi buat AI controller
 */
export interface MotionTriggerConfig {
  group: string;
  index: number;
  label: string;
  category: 'idle' | 'general' | 'special';
}

export const MOTION_TRIGGERS: MotionTriggerConfig[] = [
  { group: 'Idle', index: 0, label: 'mtn_01 (idle pose)', category: 'idle' },
  { group: '', index: 0, label: 'mtn_02 (gesture 1)', category: 'general' },
  { group: '', index: 1, label: 'mtn_03 (gesture 2)', category: 'general' },
  { group: '', index: 2, label: 'mtn_04 (gesture 3)', category: 'general' },
  { group: '', index: 3, label: 'special_01 (special pose)', category: 'special' },
  { group: '', index: 4, label: 'special_02 (special pose)', category: 'special' },
  { group: '', index: 5, label: 'special_03 (special pose)', category: 'special' },
];
```

## Step 2: Animation Controller (`src/lib/animation-controller.ts`)

Buat file `src/lib/animation-controller.ts`:

```typescript
import { Live2DModel } from 'pixi-live2d-display';
import {
  BREATHING,
  HEAD_MOTION,
  BODY_SWAY,
  EYE_LOOK,
  BROW_MOTION,
  OVERALL_SWAY,
} from '../config/motions';

/**
 * AnimationController
 * 
 * Handle semua gerakan natural idle Aira secara procedural.
 * TIDAK ada mouse tracking. TIDAK auto-play motion files.
 * Semua gerakan di-generate dari layered sine waves + random eye look.
 */
export class AnimationController {
  private model: Live2DModel | null = null;
  private animationId: number | null = null;
  private isActive = false;
  
  // Speaking state — saat bicara, kurangi gerakan badan
  private isSpeaking = false;

  // Time tracking
  private startTime = 0;

  // Eye look state
  private eyeTargetX = 0;
  private eyeTargetY = 0;
  private eyeCurrentX = 0;
  private eyeCurrentY = 0;
  private nextEyeMoveTime = 0;

  // Random offsets per-session biar tiap kali buka beda
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

  /**
   * Initialize animation controller dengan model
   */
  init(model: Live2DModel): void {
    this.model = model;
    this.isActive = true;
    this.startTime = performance.now();
    
    // Mulai eye look timer
    this.scheduleNextEyeMove();
    
    // Start animation loop
    this.startLoop();
    
    console.log('[Animation] Natural idle controller initialized');
  }

  /**
   * Main animation loop — runs every frame
   */
  private startLoop(): void {
    const update = () => {
      if (!this.isActive || !this.model) return;

      const now = performance.now();
      const t = now - this.startTime; // Elapsed time in ms

      const coreModel = this.model.internalModel?.coreModel;
      if (!coreModel) {
        this.animationId = requestAnimationFrame(update);
        return;
      }

      // === Layer 1: Breathing ===
      this.applyBreathing(coreModel, t);

      // === Layer 2: Head micro-motion ===
      this.applyHeadMotion(coreModel, t);

      // === Layer 3: Body sway ===
      this.applyBodySway(coreModel, t);

      // === Layer 4: Eye random look ===
      this.applyEyeLook(coreModel, now);

      // === Layer 5: Brow micro ===
      this.applyBrowMotion(coreModel, t);

      // === Layer 6: Overall sway ===
      this.applyOverallSway(coreModel, t);

      this.animationId = requestAnimationFrame(update);
    };

    this.animationId = requestAnimationFrame(update);
  }

  /**
   * === BREATHING ===
   * Smooth sine wave pada ParamBreath
   */
  private applyBreathing(coreModel: any, t: number): void {
    const { speed, amplitude, offset } = BREATHING;
    const value = offset + Math.sin(t * speed) * amplitude;
    this.setParam(coreModel, 'ParamBreath', Math.max(0, Math.min(1, value)));
  }

  /**
   * === HEAD MICRO-MOTION ===
   * 3 layered sine waves per axis buat pseudo-random organic motion
   */
  private applyHeadMotion(coreModel: any, t: number): void {
    const speakDampen = this.isSpeaking ? 0.4 : 1.0;

    const hx = HEAD_MOTION.angleX;
    const hy = HEAD_MOTION.angleY;
    const hz = HEAD_MOTION.angleZ;

    const angleX = (
      Math.sin((t + this.phaseOffsets.headX) * hx.speed1) * 0.5 +
      Math.sin((t + this.phaseOffsets.headX) * hx.speed2) * 0.3 +
      Math.sin((t + this.phaseOffsets.headX) * hx.speed3) * 0.2
    ) * hx.amplitude * speakDampen;

    const angleY = (
      Math.sin((t + this.phaseOffsets.headY) * hy.speed1) * 0.5 +
      Math.sin((t + this.phaseOffsets.headY) * hy.speed2) * 0.3 +
      Math.sin((t + this.phaseOffsets.headY) * hy.speed3) * 0.2
    ) * hy.amplitude * speakDampen;

    const angleZ = (
      Math.sin((t + this.phaseOffsets.headZ) * hz.speed1) * 0.5 +
      Math.sin((t + this.phaseOffsets.headZ) * hz.speed2) * 0.3 +
      Math.sin((t + this.phaseOffsets.headZ) * hz.speed3) * 0.2
    ) * hz.amplitude * speakDampen;

    this.setParam(coreModel, 'ParamAngleX', angleX);
    this.setParam(coreModel, 'ParamAngleY', angleY);
    this.setParam(coreModel, 'ParamAngleZ', angleZ);
  }

  /**
   * === BODY SWAY ===
   * Lebih pelan & halus dari kepala. Hampir diam saat bicara.
   */
  private applyBodySway(coreModel: any, t: number): void {
    const speakDampen = this.isSpeaking ? 0.15 : 1.0;

    const bx = BODY_SWAY.angleX;
    const by = BODY_SWAY.angleY;
    const bz = BODY_SWAY.angleZ;

    const bodyX = (
      Math.sin((t + this.phaseOffsets.bodyX) * bx.speed1) * 0.6 +
      Math.sin((t + this.phaseOffsets.bodyX) * bx.speed2) * 0.4
    ) * bx.amplitude * speakDampen;

    const bodyY = (
      Math.sin((t + this.phaseOffsets.bodyY) * by.speed1) * 0.6 +
      Math.sin((t + this.phaseOffsets.bodyY) * by.speed2) * 0.4
    ) * by.amplitude * speakDampen;

    const bodyZ = (
      Math.sin((t + this.phaseOffsets.bodyZ) * bz.speed1) * 0.6 +
      Math.sin((t + this.phaseOffsets.bodyZ) * bz.speed2) * 0.4
    ) * bz.amplitude * speakDampen;

    this.setParam(coreModel, 'ParamBodyAngleX', bodyX);
    this.setParam(coreModel, 'ParamBodyAngleY', bodyY);
    this.setParam(coreModel, 'ParamBodyAngleZ', bodyZ);
  }

  /**
   * === EYE RANDOM LOOK ===
   * Mata lirik ke posisi random, tahan beberapa detik, pindah lagi.
   */
  private applyEyeLook(coreModel: any, now: number): void {
    if (now >= this.nextEyeMoveTime) {
      this.pickNewEyeTarget();
      this.scheduleNextEyeMove();
    }

    this.eyeCurrentX += (this.eyeTargetX - this.eyeCurrentX) * EYE_LOOK.transitionSpeed;
    this.eyeCurrentY += (this.eyeTargetY - this.eyeCurrentY) * EYE_LOOK.transitionSpeed;

    this.setParam(coreModel, 'ParamEyeBallX', this.eyeCurrentX);
    this.setParam(coreModel, 'ParamEyeBallY', this.eyeCurrentY);
  }

  private pickNewEyeTarget(): void {
    if (Math.random() < EYE_LOOK.centerChance) {
      this.eyeTargetX = 0;
      this.eyeTargetY = 0;
    } else {
      this.eyeTargetX = (Math.random() * 2 - 1) * EYE_LOOK.rangeX;
      this.eyeTargetY = (Math.random() * 2 - 1) * EYE_LOOK.rangeY;
    }
  }

  private scheduleNextEyeMove(): void {
    const { holdMin, holdMax } = EYE_LOOK;
    const delay = holdMin + Math.random() * (holdMax - holdMin);
    this.nextEyeMoveTime = performance.now() + delay;
  }

  /**
   * === BROW MICRO ===
   * Alis naik-turun super subtle biar gak kaku
   */
  private applyBrowMotion(coreModel: any, t: number): void {
    const { amplitude, speed1, speed2 } = BROW_MOTION;

    const browL = (
      Math.sin((t + this.phaseOffsets.browL) * speed1) * 0.6 +
      Math.sin((t + this.phaseOffsets.browL) * speed2) * 0.4
    ) * amplitude;

    const browR = (
      Math.sin((t + this.phaseOffsets.browR + 500) * speed1) * 0.6 +
      Math.sin((t + this.phaseOffsets.browR + 500) * speed2) * 0.4
    ) * amplitude;

    this.setParam(coreModel, 'ParamBrowLY', browL);
    this.setParam(coreModel, 'ParamBrowRY', browR);
  }

  /**
   * === OVERALL SWAY ===
   * Seluruh karakter drift super halus
   */
  private applyOverallSway(coreModel: any, t: number): void {
    const speakDampen = this.isSpeaking ? 0.2 : 1.0;

    const ox = OVERALL_SWAY.x;
    const oy = OVERALL_SWAY.y;
    const or = OVERALL_SWAY.rotate;

    const allX = Math.sin((t + this.phaseOffsets.overallX) * ox.speed) * ox.amplitude * speakDampen;
    const allY = Math.sin((t + this.phaseOffsets.overallY) * oy.speed) * oy.amplitude * speakDampen;
    const allR = Math.sin((t + this.phaseOffsets.overallR) * or.speed) * or.amplitude * speakDampen;

    this.setParam(coreModel, 'ParamAllX', allX);
    this.setParam(coreModel, 'ParamAllY', allY);
    this.setParam(coreModel, 'ParamAllRotate', allR);
  }

  /**
   * ==========================================
   * PUBLIC API
   * ==========================================
   */

  /**
   * Play specific motion file (dipanggil dari AI controller MD-06)
   * Ini akan override idle animation sementara (motion file take priority)
   * Setelah motion selesai, idle procedural otomatis lanjut karena loop tetap jalan
   */
  async playMotion(group: string, index: number, priority: number = 3): Promise<void> {
    if (!this.model) return;

    console.log(`[Animation] Playing motion: group="${group}", index=${index}`);
    
    try {
      await this.model.motion(group, index, priority);
    } catch (e) {
      console.warn('[Animation] Motion play failed:', e);
    }
  }

  /**
   * Set speaking state
   * Saat bicara: kepala gerak lebih pelan, badan hampir diam
   * Supaya fokus ke mulut yang lagi lip sync
   */
  setSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
  }

  /**
   * Helper: Set parameter value
   */
  private setParam(coreModel: any, paramId: string, value: number): void {
    try {
      coreModel.setParameterValueById(paramId, value);
    } catch {
      // Parameter might not exist — ignore silently
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.model = null;
  }
}

// Singleton
export const animationController = new AnimationController();
```

## Step 3: Update Live2DCanvas

Update `src/components/Live2DCanvas.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { live2dManager } from '../lib/live2d-manager';
import { animationController } from '../lib/animation-controller';

const MODEL_PATH = '/models/mao_pro/mao_pro.model3.json';

export function Live2DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initLive2D = async () => {
      if (!canvasRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        await live2dManager.init(canvasRef.current);
        const model = await live2dManager.loadModel(MODEL_PATH);

        // Init natural idle animation (MD-03)
        animationController.init(model);

        setIsLoading(false);
        console.log('[Aira] Initialized with natural idle animations!');
      } catch (err) {
        console.error('[Aira] Init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setIsLoading(false);
      }
    };

    initLive2D();

    return () => {
      // animationController.destroy();
      // live2dManager.destroy();
    };
  }, []);

  return (
    <div className="live2d-container">
      <canvas ref={canvasRef} className="live2d-canvas" />
      
      {isLoading && (
        <div className="live2d-loading">
          <p>Loading Aira...</p>
        </div>
      )}
      
      {error && (
        <div className="live2d-error">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
}
```

## Step 4: Verify

```bash
npm run dev
```

### Yang harus terjadi — Aira keliatan "hidup":
1. **Napas**: Dada/badan naik-turun pelan (breathing)
2. **Kepala**: Gerak pelan random ke kiri-kanan, atas-bawah, miring — TANPA mouse tracking
3. **Badan**: Sway super halus, lebih pelan dari kepala
4. **Mata**: Sesekali lirik ke arah random, tahan beberapa detik, pindah lagi, kadang balik ke tengah
5. **Alis**: Naik-turun super subtle (hampir gak keliatan tapi bikin gak kaku)
6. **Overall**: Seluruh karakter drift halus
7. **Physics**: Rambut, topi, ribbon, robe ikut bergoyang otomatis karena kepala/badan gerak
8. **Blink**: Masih jalan otomatis dari SDK

### Yang TIDAK terjadi:
- ❌ Aira TIDAK ngikutin mouse
- ❌ Motion files TIDAK auto-play
- ❌ Gerakan TIDAK loop yang sama terus — karena sine waves di-layer dengan phase berbeda, gerakan selalu terasa berbeda

### Troubleshooting:
- **Gerakan terlalu cepat**: Turunkan semua `speed` values di config
- **Gerakan terlalu besar**: Turunkan `amplitude` values
- **Mata lirik terlalu sering**: Naikkan `EYE_LOOK.holdMax`
- **Badan kaku saat bicara**: Naikkan `speakDampen` values (closer to 1.0)
- **Parameter conflict dengan physics**: Harusnya gak konflik karena physics SDK handle parameter hair/accessory yang berbeda dari yang kita atur

## Apa yang TIDAK dilakukan di MD ini
- ❌ Mouse tracking (sengaja dihapus)
- ❌ Auto-play motion JSON files (dipakai sesekali oleh AI di MD-06)
- ❌ Expression switching (MD-04)
- ❌ Lip sync (MD-05)

## Checklist Sebelum Lanjut ke MD-04
- [ ] Aira bergerak natural secara mandiri tanpa input user
- [ ] Napas terlihat (dada naik-turun)
- [ ] Kepala bergerak pelan random (bukan static)
- [ ] Mata sesekali lirik random
- [ ] Physics bawaan (rambut, aksesoris) ikut bereaksi
- [ ] Blink otomatis masih jalan
- [ ] Tidak ada gerakan patah-patah atau jerky
- [ ] Gerakan tidak repetitif (terasa organic)

---

> **Next**: MD-04 — Expression & Motion System (mapping 8 ekspresi ke emosi AI)
