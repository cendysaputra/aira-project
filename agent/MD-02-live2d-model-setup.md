# MD-02: Live2D Model Setup

## Overview
Load dan render Live2D model Aira ke canvas menggunakan PixiJS + pixi-live2d-display.

## Prerequisites
- MD-01 sudah selesai
- Semua file model sudah di folder `public/models/mao_pro/`
- `live2dcubismcore.min.js` sudah di `public/lib/`

## Step 1: Live2D Manager (`src/lib/live2d-manager.ts`)

Buat file `src/lib/live2d-manager.ts`:

```typescript
import * as PIXI from 'pixi.js';
import { Live2DModel, MotionPreloadStrategy } from 'pixi-live2d-display';

// Register PIXI ke window supaya pixi-live2d-display bisa akses
(window as any).PIXI = PIXI;

export class Live2DManager {
  private app: PIXI.Application | null = null;
  private model: Live2DModel | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  /**
   * Initialize PixiJS Application
   */
  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;

    this.app = new PIXI.Application({
      view: canvas,
      resizeTo: canvas.parentElement || window,
      backgroundAlpha: 0, // Transparent background
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => {
      this.fitModel();
    });
    if (canvas.parentElement) {
      this.resizeObserver.observe(canvas.parentElement);
    }
  }

  /**
   * Load Live2D Model
   */
  async loadModel(modelPath: string): Promise<Live2DModel> {
    if (!this.app) {
      throw new Error('PixiJS Application belum di-init. Panggil init() dulu.');
    }

    try {
      this.model = await Live2DModel.from(modelPath, {
        motionPreload: MotionPreloadStrategy.ALL, // Preload semua motion
      });

      // Setup awal model
      this.model.anchor.set(0.5, 0.5);
      
      // Tambah ke stage
      this.app.stage.addChild(this.model as unknown as PIXI.DisplayObject);
      
      // Fit model ke canvas
      this.fitModel();

      console.log('[Live2D] Model loaded successfully');
      console.log('[Live2D] Available motions:', Object.keys(this.model.internalModel.motionManager.definitions));
      console.log('[Live2D] Available expressions:', this.model.internalModel.motionManager.expressionManager?.definitions?.length || 0);

      return this.model;
    } catch (error) {
      console.error('[Live2D] Failed to load model:', error);
      throw error;
    }
  }

  /**
   * Fit model ke ukuran canvas dengan proporsional
   */
  private fitModel(): void {
    if (!this.model || !this.app) return;

    const { width, height } = this.app.renderer.screen;
    
    // Scale model supaya pas di canvas
    // Sesuaikan multiplier kalau model terlalu besar/kecil
    const scale = Math.min(width / 1400, height / 1400) * 1.0;
    
    this.model.scale.set(scale);
    this.model.x = width / 2;
    this.model.y = height / 2 + (height * 0.1); // Sedikit ke bawah biar natural
  }

  /**
   * Get model instance
   */
  getModel(): Live2DModel | null {
    return this.model;
  }

  /**
   * Get PixiJS app
   */
  getApp(): PIXI.Application | null {
    return this.app;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
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

// Singleton instance
export const live2dManager = new Live2DManager();
```

## Step 2: Live2D Canvas Component (`src/components/Live2DCanvas.tsx`)

Buat file `src/components/Live2DCanvas.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { live2dManager } from '../lib/live2d-manager';

const MODEL_PATH = '/models/mao_pro/mao_pro.model3.json';

export function Live2DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double init in React Strict Mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initLive2D = async () => {
      if (!canvasRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        // Init PixiJS
        await live2dManager.init(canvasRef.current);

        // Load model
        await live2dManager.loadModel(MODEL_PATH);

        setIsLoading(false);
        console.log('[Aira] Model ready!');
      } catch (err) {
        console.error('[Aira] Init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setIsLoading(false);
      }
    };

    initLive2D();

    return () => {
      // Cleanup saat unmount
      // Jangan destroy di dev mode karena strict mode double-mount
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

## Step 3: Update App.tsx

Update `src/App.tsx`:

```tsx
import './App.css';
import { Live2DCanvas } from './components/Live2DCanvas';

function App() {
  return (
    <div className="app">
      <Live2DCanvas />
    </div>
  );
}

export default App;
```

## Step 4: Update CSS

Update `src/App.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1a1a2e;
}

.app {
  width: 100%;
  height: 100%;
  position: relative;
}

/* Live2D Container */
.live2d-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.live2d-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

/* Loading Overlay */
.live2d-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-family: 'Segoe UI', sans-serif;
  font-size: 1.2rem;
  opacity: 0.7;
}

/* Error Display */
.live2d-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ff6b6b;
  font-family: 'Segoe UI', sans-serif;
  font-size: 1rem;
  text-align: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
}
```

## Step 5: Verify

```bash
npm run dev
```

### Yang harus muncul:
1. Background gelap (#1a1a2e)
2. Model Aira muncul di tengah canvas
3. Model sudah bisa blink otomatis (built-in dari Live2D SDK, karena ada EyeBlink group)
4. Physics rambut, topi, dll sudah aktif (bergoyang sendiri)
5. Di console browser, muncul log:
   - `[Live2D] Model loaded successfully`
   - `[Live2D] Available motions: ...`
   - `[Live2D] Available expressions: ...`

### Troubleshooting:
- **Model tidak muncul**: Cek console untuk error. Pastikan path file .moc3 dan texture benar.
- **"Live2DCubismCore is not defined"**: Pastikan `live2dcubismcore.min.js` di-load di `index.html` SEBELUM app script.
- **Texture hitam/kosong**: Pastikan `texture_00.png` ada di `public/models/mao_pro/mao_pro.4096/`.
- **Model kebesaran/kekecilan**: Adjust `scale` multiplier di `fitModel()`.

## Apa yang BELUM dilakukan di step ini
- ❌ Mouse tracking (MD-03)
- ❌ Motion playback (MD-03)
- ❌ Expression switching (MD-04)
- ❌ Custom idle behavior (MD-03)
- ❌ Lip sync (MD-05)

Model di tahap ini cuma muncul diam dengan physics bawaan (rambut goyang, blink otomatis). Animasi dan interaksi dihandle di MD selanjutnya.

## Checklist Sebelum Lanjut ke MD-03
- [ ] Model Aira muncul di layar
- [ ] Physics bawaan aktif (rambut, aksesoris goyang)
- [ ] Blink otomatis jalan
- [ ] Tidak ada error di console
- [ ] Canvas responsive (resize window → model tetap proporsional)

---

> **Next**: MD-03 — Physics & Natural Animation (idle behavior, mouse tracking, motion queue non-loop)
