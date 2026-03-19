# MD-04: Expression & Motion System

## Overview
Mapping 8 ekspresi model ke emosi yang bisa di-trigger oleh AI. Termasuk transition logic supaya perpindahan ekspresi smooth dan natural.

## Prerequisites
- MD-03 sudah selesai (motion queue + mouse tracking jalan)
- Model sudah bisa bergerak natural

## Expression Analysis

Berdasarkan analisis parameter dari semua exp_XX.exp3.json:

| Expression | File | Key Parameters | Interpretasi Emosi |
|-----------|------|---------------|-------------------|
| exp_01 | exp_01.exp3.json | Semua default/neutral | **Neutral / Default** |
| exp_02 | exp_02.exp3.json | EyeOpen=0 (Multiply), EyeSmile=1 | **Happy / Smiling** (mata senyum, tertutup) |
| exp_03 | exp_03.exp3.json | EyeOpen=0 (Multiply), EyeSmile=0 | **Sleepy / Relaxed** (mata tutup tanpa senyum) |
| exp_04 | exp_04.exp3.json | EyeOpen=1.2, EyeSmile=1, EyeEffect=1 | **Excited / Sparkle** (mata besar, berbinar) |
| exp_05 | exp_05.exp3.json | BrowAngle=-1, BrowForm=-1, MouthUp=-1, MouthDown=1 | **Sad / Upset** (alis turun, mulut cemberut) |
| exp_06 | exp_06.exp3.json | Cheek=1, BrowAngle=-1, BrowForm=-1 | **Embarrassed / Shy** (pipi merah, alis worried) |
| exp_07 | exp_07.exp3.json | EyeOpen=1.2, EyeBallForm=-1, BrowForm=1, MouthUp=-1, MouthDown=1 | **Surprised / Shocked** (mata besar, pupil kecil) |
| exp_08 | exp_08.exp3.json | EyeForm=1, MouthUp=-1, MouthAngry=1, MouthAngryLine=1 | **Angry / Irritated** (mata tajam, mulut kesal) |

## Step 1: Expression Config (`src/config/expressions.ts`)

Buat file `src/config/expressions.ts`:

```typescript
/**
 * Expression mapping untuk AI emotion detection
 * 
 * AI akan mendeteksi emosi dari response text, lalu trigger expression yang sesuai.
 * Setiap emosi bisa punya fallback kalau expression utama sedang active.
 */

export type EmotionType = 
  | 'neutral'
  | 'happy'
  | 'sleepy'
  | 'excited'
  | 'sad'
  | 'embarrassed'
  | 'surprised'
  | 'angry';

export interface ExpressionConfig {
  expressionIndex: number;  // Index di model (0-7)
  emotion: EmotionType;
  label: string;            // Human readable
  /** Motion groups yang cocok dimainkan bareng expression ini (di-trigger oleh AI MD-06, BUKAN auto-play) */
  compatibleMotions: { group: string; index: number }[];
  /** Durasi minimum expression aktif sebelum bisa diganti (ms) */
  minDuration: number;
  /** Priority: higher = lebih penting, bisa override expression lain */
  priority: number;
}

export const EXPRESSION_MAP: Record<EmotionType, ExpressionConfig> = {
  neutral: {
    expressionIndex: 0,
    emotion: 'neutral',
    label: 'Neutral',
    compatibleMotions: [
      { group: 'Idle', index: 0 },
      { group: '', index: 0 },
      { group: '', index: 1 },
      { group: '', index: 2 },
    ],
    minDuration: 1000,
    priority: 1,
  },
  happy: {
    expressionIndex: 1,
    emotion: 'happy',
    label: 'Happy / Smile',
    compatibleMotions: [
      { group: 'Idle', index: 0 },
      { group: '', index: 0 },
      { group: '', index: 1 },
    ],
    minDuration: 2000,
    priority: 3,
  },
  sleepy: {
    expressionIndex: 2,
    emotion: 'sleepy',
    label: 'Sleepy / Relaxed',
    compatibleMotions: [
      { group: 'Idle', index: 0 },
    ],
    minDuration: 3000,
    priority: 2,
  },
  excited: {
    expressionIndex: 3,
    emotion: 'excited',
    label: 'Excited / Sparkle',
    compatibleMotions: [
      { group: '', index: 0 },
      { group: '', index: 1 },
      { group: '', index: 2 },
      { group: '', index: 3 }, // special_01
    ],
    minDuration: 2000,
    priority: 4,
  },
  sad: {
    expressionIndex: 4,
    emotion: 'sad',
    label: 'Sad / Upset',
    compatibleMotions: [
      { group: 'Idle', index: 0 },
      { group: '', index: 1 },
    ],
    minDuration: 2500,
    priority: 3,
  },
  embarrassed: {
    expressionIndex: 5,
    emotion: 'embarrassed',
    label: 'Embarrassed / Shy',
    compatibleMotions: [
      { group: 'Idle', index: 0 },
      { group: '', index: 0 },
      { group: '', index: 2 },
    ],
    minDuration: 2000,
    priority: 3,
  },
  surprised: {
    expressionIndex: 6,
    emotion: 'surprised',
    label: 'Surprised / Shocked',
    compatibleMotions: [
      { group: '', index: 0 },
      { group: '', index: 2 },
      { group: '', index: 4 }, // special_02
    ],
    minDuration: 1500,
    priority: 5, // High priority — surprise should override most expressions
  },
  angry: {
    expressionIndex: 7,
    emotion: 'angry',
    label: 'Angry / Irritated',
    compatibleMotions: [
      { group: '', index: 2 },
      { group: '', index: 5 }, // special_03
    ],
    minDuration: 2000,
    priority: 4,
  },
};

/**
 * AI Emotion keywords mapping
 * Digunakan oleh AI controller (MD-06) untuk detect emosi dari response text
 */
export const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  neutral: [],  // Default fallback
  happy: [
    'senang', 'suka', 'love', 'hehe', 'haha', 'yay', 'asyik', 'bagus',
    'keren', 'mantap', 'nice', 'great', 'awesome', 'senyum', 'tertawa',
    'gembira', 'bahagia', 'horee', 'wah', 'yeay',
  ],
  sleepy: [
    'ngantuk', 'capek', 'lelah', 'tidur', 'bosan', 'males',
    'hoam', 'zzz', 'sleepy', 'tired',
  ],
  excited: [
    'wow', 'gila', 'anjir', 'sial keren', 'amazing', 'luar biasa',
    'excited', 'semangat', 'antusias', 'epic', 'bangga', 'berhasil',
    'sukses', '!!', 'omg',
  ],
  sad: [
    'sedih', 'kecewa', 'gagal', 'maaf', 'sorry', 'menyesal',
    'sakit', 'nangis', 'huhu', 'hiks', 'kasian', 'malang',
  ],
  embarrassed: [
    'malu', 'blush', 'ehehe', 'aduh', 'duh', 'shy', 'embarrass',
    'gombal', 'flirt', 'geer', 'ge-er', 'ah masa',
  ],
  surprised: [
    'kaget', 'shock', 'serius', 'beneran', 'masa', 'hah',
    'surprise', 'gak nyangka', 'tiba-tiba', 'mendadak', 'what',
    'eh', 'astaga', 'ya ampun',
  ],
  angry: [
    'marah', 'kesal', 'bete', 'annoying', 'sinis', 'geram',
    'bangsat', 'kampret', 'jengkel', 'sebal', 'dongkol', 'hmph',
  ],
};

/**
 * Default expression ketika tidak ada emosi terdeteksi
 */
export const DEFAULT_EMOTION: EmotionType = 'neutral';

/**
 * Durasi expression sebelum auto-revert ke neutral (ms)
 * Kalau AI tidak mengirim emosi baru, expression akan kembali ke neutral
 */
export const EXPRESSION_AUTO_REVERT_MS = 8000;
```

## Step 2: Expression Manager (`src/lib/expression-manager.ts`)

Buat file `src/lib/expression-manager.ts`:

```typescript
import { Live2DModel } from 'pixi-live2d-display';
import { 
  EXPRESSION_MAP, 
  EXPRESSION_AUTO_REVERT_MS, 
  DEFAULT_EMOTION,
  EmotionType, 
  ExpressionConfig 
} from '../config/expressions';

export class ExpressionManager {
  private model: Live2DModel | null = null;
  
  // State
  private currentEmotion: EmotionType = 'neutral';
  private lastExpressionTime = 0;
  private revertTimer: ReturnType<typeof setTimeout> | null = null;
  private isTransitioning = false;

  /**
   * Initialize expression manager
   */
  init(model: Live2DModel): void {
    this.model = model;
    this.currentEmotion = 'neutral';
    console.log('[Expression] Manager initialized');
  }

  /**
   * Set expression berdasarkan emotion type
   * Ini yang akan dipanggil oleh AI controller (MD-06)
   */
  async setEmotion(emotion: EmotionType, autoRevert = true): Promise<void> {
    if (!this.model) return;

    const config = EXPRESSION_MAP[emotion];
    if (!config) {
      console.warn(`[Expression] Unknown emotion: ${emotion}`);
      return;
    }

    // Check minimum duration — jangan ganti expression terlalu cepat
    const now = Date.now();
    const currentConfig = EXPRESSION_MAP[this.currentEmotion];
    if (this.isTransitioning || (now - this.lastExpressionTime < currentConfig.minDuration)) {
      // Skip kalau expression sebelumnya belum cukup lama
      // Kecuali priority lebih tinggi
      if (config.priority <= currentConfig.priority) {
        console.log(`[Expression] Skipped ${emotion} — current ${this.currentEmotion} still active`);
        return;
      }
    }

    // Clear existing revert timer
    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }

    this.isTransitioning = true;
    this.currentEmotion = emotion;
    this.lastExpressionTime = now;

    console.log(`[Expression] Setting emotion: ${emotion} (${config.label})`);

    try {
      // Set expression via pixi-live2d-display
      // Expression fade in/out sudah dihandle oleh SDK (FadeInTime/FadeOutTime dari exp3.json)
      await this.model.expression(config.expressionIndex);
      
      // NOTE: Motion TIDAK auto-play di sini.
      // Motion file di-trigger oleh AI controller (MD-06) di saat yang tepat.
    } catch (e) {
      console.warn('[Expression] Failed to set expression:', e);
    }

    this.isTransitioning = false;

    // Auto revert ke neutral setelah beberapa detik
    if (autoRevert && emotion !== 'neutral') {
      this.revertTimer = setTimeout(() => {
        this.setEmotion('neutral', false);
      }, EXPRESSION_AUTO_REVERT_MS);
    }
  }

  /**
   * Get compatible motions for current emotion (used by AI controller MD-06)
   */
  getCompatibleMotions(): { group: string; index: number }[] {
    const config = EXPRESSION_MAP[this.currentEmotion];
    return config?.compatibleMotions || [];
  }

  /**
   * Get current emotion
   */
  getCurrentEmotion(): EmotionType {
    return this.currentEmotion;
  }

  /**
   * Reset ke neutral
   */
  resetToNeutral(): void {
    this.setEmotion('neutral', false);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
    }
    this.model = null;
  }
}

// Singleton
export const expressionManager = new ExpressionManager();
```

## Step 3: Update Live2DCanvas untuk integrate Expression Manager

Update `src/components/Live2DCanvas.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { live2dManager } from '../lib/live2d-manager';
import { animationController } from '../lib/animation-controller';
import { expressionManager } from '../lib/expression-manager';

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

        // Init controllers
        animationController.init(model);    // MD-03
        expressionManager.init(model);      // MD-04

        setIsLoading(false);
        console.log('[Aira] Fully initialized!');
      } catch (err) {
        console.error('[Aira] Init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setIsLoading(false);
      }
    };

    initLive2D();
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

## Step 4: Debug Panel (Temporary — untuk testing)

Tambahkan debug panel sementara untuk testing expression. Buat `src/components/DebugPanel.tsx`:

```tsx
import { expressionManager } from '../lib/expression-manager';
import { EmotionType } from '../config/expressions';

const emotions: EmotionType[] = [
  'neutral', 'happy', 'sleepy', 'excited', 
  'sad', 'embarrassed', 'surprised', 'angry'
];

export function DebugPanel() {
  return (
    <div className="debug-panel">
      <p className="debug-title">Expression Debug</p>
      <div className="debug-buttons">
        {emotions.map((emotion) => (
          <button
            key={emotion}
            onClick={() => expressionManager.setEmotion(emotion)}
            className="debug-btn"
          >
            {emotion}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Update `src/App.tsx` untuk include debug panel:

```tsx
import './App.css';
import { Live2DCanvas } from './components/Live2DCanvas';
import { DebugPanel } from './components/DebugPanel';

function App() {
  return (
    <div className="app">
      <Live2DCanvas />
      <DebugPanel />
    </div>
  );
}

export default App;
```

Tambahkan CSS untuk debug panel di `src/App.css`:

```css
/* ... CSS sebelumnya tetap ... */

/* Debug Panel (temporary) */
.debug-panel {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  padding: 12px 16px;
  border-radius: 12px;
  z-index: 100;
}

.debug-title {
  color: #888;
  font-size: 0.7rem;
  text-align: center;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.debug-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.debug-btn {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.debug-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
}
```

## Step 5: Verify

```bash
npm run dev
```

### Yang harus terjadi:
1. **Debug panel** muncul di bawah layar dengan 8 tombol emosi
2. **Klik tombol** → expression Aira berubah sesuai emosi
3. **Transisi smooth** — expression fade in/out, bukan langsung berubah
4. **Auto revert** — setelah ~8 detik, expression kembali ke neutral
5. **Idle animation tetap jalan** — procedural idle dari MD-03 tetap berjalan saat expression berubah
6. **Priority system** — expression dengan priority tinggi bisa override yang rendah

### Test skenario:
- Klik "happy" → Aira senyum, mata menutup smile
- Klik "angry" → Aira kesal, mulut angry
- Klik "surprised" → Mata membesar, pupil mengecil
- Klik "excited" → Mata berbinar, sparkle effect
- Klik "sad" → Alis turun, mulut cemberut
- Klik "embarrassed" → Pipi merah, alis worried
- Klik rapid succession → Expression dengan priority rendah di-skip

## Apa yang BELUM dilakukan
- ❌ Lip sync (MD-05) — mulut belum gerak saat ngomong
- ❌ AI trigger otomatis (MD-06) — masih manual via debug panel
- ❌ Gerakan sinkron saat bicara (MD-05)

## Checklist Sebelum Lanjut ke MD-05
- [ ] Semua 8 expression bisa di-trigger dan terlihat beda
- [ ] Transition antar expression smooth
- [ ] Auto revert ke neutral bekerja
- [ ] Expression + motion berjalan bersamaan tanpa konflik
- [ ] Procedural idle animation dari MD-03 masih berjalan normal

---

> **Next**: MD-05 — Lip Sync & Voice System (viseme mapping A/I/U/E/O, ElevenLabs integration)
