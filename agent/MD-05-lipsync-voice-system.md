# MD-05: Lip Sync & Voice System

## Overview
Bikin mulut Aira bergerak sinkron saat bicara. Model punya 5 viseme (A, I, U, E, O) yang sempurna untuk lip sync. Integrasi dengan ElevenLabs untuk text-to-speech.

## Prerequisites
- MD-04 sudah selesai (expression system jalan)
- Model sudah bisa ganti ekspresi

## Model Mouth Parameters

Model Aira punya parameter mulut yang sangat lengkap:

| Parameter | ID | Deskripsi |
|-----------|-----|-----------|
| A | ParamA | Mulut buka lebar (vowel "A") |
| I | ParamI | Mulut lebar tipis (vowel "I") |
| U | ParamU | Mulut maju/monyong (vowel "U") |
| E | ParamE | Mulut setengah buka (vowel "E") |
| O | ParamO | Mulut bulat (vowel "O") |
| MouthUp | ParamMouthUp | Sudut mulut naik (senyum) |
| MouthDown | ParamMouthDown | Sudut mulut turun (cemberut) |
| MouthAngry | ParamMouthAngry | Mulut kesal |
| MouthAngryLine | ParamMouthAngryLine | Garis mulut kesal |

LipSync group di model: `ParamA` (dipakai untuk basic lip sync)

## STRATEGI LIP SYNC

Ada 2 mode lip sync yang harus diimplementasi:

### Mode 1: Audio-based Lip Sync (Primary)
- Pakai Web Audio API untuk analyze audio dari ElevenLabs
- Detect volume/amplitude → map ke mouth open (ParamA)
- Detect frequency bands → map ke viseme (A/I/U/E/O)

### Mode 2: Text-based Lip Sync (Fallback)  
- Kalau audio belum ready atau gagal
- Analyze text per karakter/suku kata
- Timing berdasarkan estimasi speaking rate

## Step 1: Lip Sync Controller (`src/lib/lipsync-controller.ts`)

Buat file `src/lib/lipsync-controller.ts`:

```typescript
import { Live2DModel } from 'pixi-live2d-display';
import { animationController } from './animation-controller';

/**
 * Viseme mapping
 * Masing-masing viseme mengontrol parameter mulut yang berbeda
 */
interface VisemeWeights {
  paramA: number;
  paramI: number;
  paramU: number;
  paramE: number;
  paramO: number;
}

const VISEME_SILENT: VisemeWeights = { paramA: 0, paramI: 0, paramU: 0, paramE: 0, paramO: 0 };

export class LipSyncController {
  private model: Live2DModel | null = null;

  // Audio analysis
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioSource: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private dataArray: Uint8Array | null = null;

  // Lip sync state
  private isSpeaking = false;
  private animationId: number | null = null;
  private currentViseme: VisemeWeights = { ...VISEME_SILENT };
  private targetViseme: VisemeWeights = { ...VISEME_SILENT };
  
  // Smoothing
  private readonly LERP_SPEED = 0.25;           // Kecepatan transisi viseme
  private readonly CLOSE_MOUTH_SPEED = 0.15;    // Kecepatan nutup mulut
  private readonly VOLUME_THRESHOLD = 0.08;     // Volume minimum untuk buka mulut
  private readonly VOLUME_SCALE = 2.5;          // Multiplier volume → mouth open

  // Text-based fallback
  private textQueue: string[] = [];
  private textTimerId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialize lip sync controller
   */
  init(model: Live2DModel): void {
    this.model = model;
    console.log('[LipSync] Controller initialized');
  }

  /**
   * ==========================================
   * AUDIO-BASED LIP SYNC (PRIMARY)
   * ==========================================
   */

  /**
   * Play audio dan sync lip ke audio
   * @param audioUrl URL audio (dari ElevenLabs atau local)
   */
  async speakWithAudio(audioUrl: string): Promise<void> {
    if (!this.model) return;

    try {
      // Cleanup audio sebelumnya
      this.stopSpeaking();

      // Create audio element
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.src = audioUrl;

      // Setup Web Audio API
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Resume audio context kalau suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.7;

      this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
      this.audioSource.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      // Start speaking state
      this.isSpeaking = true;
      animationController.setSpeaking(true);
      // animationController.setSpeaking(true) sudah dipanggil di atas
      // Ini akan dampen body/head motion secara otomatis di animation controller

      // Play audio
      await this.audioElement.play();

      // Start lip sync animation loop
      this.startAudioLipSync();

      // Handle audio end
      this.audioElement.onended = () => {
        this.onSpeakingDone();
      };

      this.audioElement.onerror = (e) => {
        console.error('[LipSync] Audio error:', e);
        this.onSpeakingDone();
      };

    } catch (error) {
      console.error('[LipSync] speakWithAudio failed:', error);
      this.onSpeakingDone();
    }
  }

  private startAudioLipSync(): void {
    const update = () => {
      if (!this.isSpeaking || !this.analyser || !this.dataArray || !this.model) {
        return;
      }

      // Get frequency data
      this.analyser.getByteFrequencyData(this.dataArray);

      // Calculate volume (RMS)
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const val = this.dataArray[i] / 255;
        sum += val * val;
      }
      const volume = Math.sqrt(sum / this.dataArray.length);

      // Calculate frequency bands untuk viseme estimation
      const lowFreq = this.getAverageFrequency(0, 10);    // Low — A, O
      const midFreq = this.getAverageFrequency(10, 40);   // Mid — E
      const highFreq = this.getAverageFrequency(40, 80);   // High — I, U

      // Map ke viseme weights
      if (volume > this.VOLUME_THRESHOLD) {
        const mouthOpen = Math.min(volume * this.VOLUME_SCALE, 1.0);
        
        // Estimate viseme berdasarkan frequency distribution
        const total = lowFreq + midFreq + highFreq + 0.001;
        const lowRatio = lowFreq / total;
        const midRatio = midFreq / total;
        const highRatio = highFreq / total;

        this.targetViseme = {
          paramA: mouthOpen * lowRatio * 1.5,          // "A" dominan di low freq
          paramI: mouthOpen * highRatio * 0.8,          // "I" dominan di high freq
          paramU: mouthOpen * highRatio * 0.4,          // "U" sedikit di high
          paramE: mouthOpen * midRatio * 1.0,           // "E" di mid range
          paramO: mouthOpen * lowRatio * 0.7,           // "O" mirip A tapi lebih kecil
        };
      } else {
        // Volume rendah → tutup mulut
        this.targetViseme = { ...VISEME_SILENT };
      }

      // Smooth lerp ke target
      this.lerpViseme();
      
      // Apply ke model
      this.applyViseme();

      this.animationId = requestAnimationFrame(update);
    };

    this.animationId = requestAnimationFrame(update);
  }

  private getAverageFrequency(startBin: number, endBin: number): number {
    if (!this.dataArray) return 0;
    let sum = 0;
    const count = Math.min(endBin, this.dataArray.length) - startBin;
    for (let i = startBin; i < Math.min(endBin, this.dataArray.length); i++) {
      sum += this.dataArray[i] / 255;
    }
    return count > 0 ? sum / count : 0;
  }

  /**
   * ==========================================
   * TEXT-BASED LIP SYNC (FALLBACK)
   * ==========================================
   */

  /**
   * Lip sync berdasarkan text (tanpa audio)
   * Berguna untuk testing atau kalau ElevenLabs belum tersedia
   */
  async speakWithText(text: string, speedMs = 80): Promise<void> {
    if (!this.model) return;

    this.stopSpeaking();
    this.isSpeaking = true;
    animationController.setSpeaking(true);
    // setSpeaking(true) sudah dampen body motion di animation controller

    // Convert text ke sequence of visemes
    const visemes = this.textToVisemes(text);

    // Start animation loop untuk smooth interpolation
    this.startVisemeLoop();

    // Play visemes sequentially
    for (let i = 0; i < visemes.length; i++) {
      if (!this.isSpeaking) break;

      this.targetViseme = visemes[i];
      
      await this.sleep(speedMs);
    }

    // Close mouth
    this.targetViseme = { ...VISEME_SILENT };
    await this.sleep(200);
    
    this.onSpeakingDone();
  }

  private textToVisemes(text: string): VisemeWeights[] {
    const visemes: VisemeWeights[] = [];
    const lower = text.toLowerCase();

    for (const char of lower) {
      const v = this.charToViseme(char);
      if (v) {
        visemes.push(v);
      }
    }

    return visemes;
  }

  private charToViseme(char: string): VisemeWeights | null {
    // Vowel mapping
    switch (char) {
      case 'a': return { paramA: 1.0, paramI: 0, paramU: 0, paramE: 0, paramO: 0 };
      case 'i': return { paramA: 0, paramI: 1.0, paramU: 0, paramE: 0, paramO: 0 };
      case 'u': return { paramA: 0, paramI: 0, paramU: 1.0, paramE: 0, paramO: 0 };
      case 'e': return { paramA: 0, paramI: 0, paramU: 0, paramE: 1.0, paramO: 0 };
      case 'o': return { paramA: 0, paramI: 0, paramU: 0, paramE: 0, paramO: 1.0 };
      
      // Consonant approximations
      case 'b': case 'p': case 'm':
        return { paramA: 0.3, paramI: 0, paramU: 0.2, paramE: 0, paramO: 0 };
      case 'f': case 'v':
        return { paramA: 0.1, paramI: 0.3, paramU: 0, paramE: 0.1, paramO: 0 };
      case 't': case 'd': case 'n': case 'l':
        return { paramA: 0.2, paramI: 0.2, paramU: 0, paramE: 0.3, paramO: 0 };
      case 's': case 'z': case 'c':
        return { paramA: 0, paramI: 0.4, paramU: 0, paramE: 0.2, paramO: 0 };
      case 'k': case 'g':
        return { paramA: 0.3, paramI: 0, paramU: 0, paramE: 0.2, paramO: 0.2 };
      case 'r':
        return { paramA: 0.2, paramI: 0, paramU: 0.1, paramE: 0.3, paramO: 0 };
      case 'w':
        return { paramA: 0, paramI: 0, paramU: 0.6, paramE: 0, paramO: 0.3 };
      case 'y': case 'j':
        return { paramA: 0, paramI: 0.5, paramU: 0, paramE: 0.2, paramO: 0 };
      case 'h':
        return { paramA: 0.4, paramI: 0, paramU: 0, paramE: 0.1, paramO: 0 };

      // Space = brief mouth close
      case ' ':
        return { paramA: 0.05, paramI: 0, paramU: 0, paramE: 0, paramO: 0 };

      // Punctuation = pause (mouth closed)
      case '.': case ',': case '!': case '?':
        return null; // Skip — creates a natural pause
      
      default:
        return { paramA: 0.2, paramI: 0, paramU: 0, paramE: 0.1, paramO: 0 };
    }
  }

  private startVisemeLoop(): void {
    const update = () => {
      if (!this.isSpeaking) return;
      this.lerpViseme();
      this.applyViseme();
      this.animationId = requestAnimationFrame(update);
    };
    this.animationId = requestAnimationFrame(update);
  }

  /**
   * ==========================================
   * SHARED HELPERS
   * ==========================================
   */

  private lerpViseme(): void {
    const speed = this.isSpeaking ? this.LERP_SPEED : this.CLOSE_MOUTH_SPEED;
    this.currentViseme.paramA += (this.targetViseme.paramA - this.currentViseme.paramA) * speed;
    this.currentViseme.paramI += (this.targetViseme.paramI - this.currentViseme.paramI) * speed;
    this.currentViseme.paramU += (this.targetViseme.paramU - this.currentViseme.paramU) * speed;
    this.currentViseme.paramE += (this.targetViseme.paramE - this.currentViseme.paramE) * speed;
    this.currentViseme.paramO += (this.targetViseme.paramO - this.currentViseme.paramO) * speed;
  }

  private applyViseme(): void {
    if (!this.model) return;

    const coreModel = this.model.internalModel?.coreModel;
    if (!coreModel) return;

    coreModel.setParameterValueById('ParamA', this.currentViseme.paramA);
    coreModel.setParameterValueById('ParamI', this.currentViseme.paramI);
    coreModel.setParameterValueById('ParamU', this.currentViseme.paramU);
    coreModel.setParameterValueById('ParamE', this.currentViseme.paramE);
    coreModel.setParameterValueById('ParamO', this.currentViseme.paramO);
  }

  private onSpeakingDone(): void {
    this.isSpeaking = false;
    
    // Smooth close mouth
    this.targetViseme = { ...VISEME_SILENT };
    
    // Brief animation to close mouth smoothly
    const closeAnimation = () => {
      this.lerpViseme();
      this.applyViseme();
      
      // Check if mouth is basically closed
      const total = Math.abs(this.currentViseme.paramA) + Math.abs(this.currentViseme.paramI) +
                    Math.abs(this.currentViseme.paramU) + Math.abs(this.currentViseme.paramE) +
                    Math.abs(this.currentViseme.paramO);
      
      if (total > 0.01) {
        requestAnimationFrame(closeAnimation);
      } else {
        // Fully closed — reset
        this.applyViseme();
      }
    };
    requestAnimationFrame(closeAnimation);

    // Resume motion queue
    animationController.setSpeaking(false);
    // setSpeaking(false) akan restore normal body motion amplitude

    console.log('[LipSync] Speaking done');
  }

  /**
   * Stop speaking immediately
   */
  stopSpeaking(): void {
    this.isSpeaking = false;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }

    if (this.textTimerId) {
      clearTimeout(this.textTimerId);
      this.textTimerId = null;
    }

    // Reset mouth
    this.currentViseme = { ...VISEME_SILENT };
    this.targetViseme = { ...VISEME_SILENT };
    this.applyViseme();

    animationController.setSpeaking(false);
  }

  /**
   * Is currently speaking?
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.textTimerId = setTimeout(resolve, ms);
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopSpeaking();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.model = null;
  }
}

// Singleton
export const lipSyncController = new LipSyncController();
```

## Step 2: Update Live2DCanvas

Update `src/components/Live2DCanvas.tsx` — tambahkan lipSyncController init:

```tsx
import { useEffect, useRef, useState } from 'react';
import { live2dManager } from '../lib/live2d-manager';
import { animationController } from '../lib/animation-controller';
import { expressionManager } from '../lib/expression-manager';
import { lipSyncController } from '../lib/lipsync-controller';

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

        // Init all controllers
        animationController.init(model);    // MD-03
        expressionManager.init(model);      // MD-04
        lipSyncController.init(model);      // MD-05

        setIsLoading(false);
        console.log('[Aira] All systems ready!');
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
      {isLoading && <div className="live2d-loading"><p>Loading Aira...</p></div>}
      {error && <div className="live2d-error"><p>Error: {error}</p></div>}
    </div>
  );
}
```

## Step 3: Update Debug Panel untuk testing lip sync

Update `src/components/DebugPanel.tsx`:

```tsx
import { expressionManager } from '../lib/expression-manager';
import { lipSyncController } from '../lib/lipsync-controller';
import { EmotionType } from '../config/expressions';

const emotions: EmotionType[] = [
  'neutral', 'happy', 'sleepy', 'excited', 
  'sad', 'embarrassed', 'surprised', 'angry'
];

const testTexts = [
  'Hai! Aku Aira, senang bertemu denganmu!',
  'Wah, itu keren banget! Aku excited!',
  'Hmm, aku agak sedih mendengar itu...',
];

export function DebugPanel() {
  const handleTestLipSync = (text: string) => {
    lipSyncController.speakWithText(text, 70);
  };

  const handleStopSpeaking = () => {
    lipSyncController.stopSpeaking();
  };

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

      <p className="debug-title" style={{ marginTop: '10px' }}>Lip Sync Test</p>
      <div className="debug-buttons">
        {testTexts.map((text, i) => (
          <button
            key={i}
            onClick={() => handleTestLipSync(text)}
            className="debug-btn"
          >
            Test {i + 1}
          </button>
        ))}
        <button onClick={handleStopSpeaking} className="debug-btn" style={{ borderColor: '#ff6b6b' }}>
          Stop
        </button>
      </div>
    </div>
  );
}
```

## Step 4: Verify

```bash
npm run dev
```

### Yang harus terjadi:
1. **Text lip sync**: Klik "Test 1/2/3" → mulut Aira bergerak sesuai text
2. **Viseme variety**: Mulut bergerak beda untuk huruf A, I, U, E, O (bukan cuma buka-tutup)
3. **Smooth transition**: Perpindahan antar viseme smooth, tidak patah-patah
4. **Body motion dampen saat bicara**: Gerakan badan/kepala jadi lebih pelan saat Aira bicara
5. **Resume setelah bicara**: Gerakan normal kembali setelah bicara selesai
6. **Stop button**: Langsung stop dan tutup mulut smooth
7. **Expression + lip sync bareng**: Set expression lalu test lip sync → keduanya jalan bersamaan

### PENTING — Sinkronisasi:
- Saat bicara: Mulut bergerak sesuai text, badan/kepala DAMPEN (gerak lebih pelan, bukan freeze total)
- Setelah bicara: Gerakan normal kembali
- Expression tetap aktif saat bicara
- Idle procedural animation tetap jalan tapi dengan amplitude rendah saat bicara

## Apa yang BELUM dilakukan di step ini
- ❌ ElevenLabs TTS integration (di MD-06 bersamaan dengan AI)
- ❌ Audio-based lip sync belum bisa ditest tanpa audio source

Audio-based lip sync (`speakWithAudio`) sudah siap kodenya, tinggal dipanggil dari AI controller saat audio URL tersedia dari ElevenLabs.

## Checklist Sebelum Lanjut ke MD-06
- [ ] Text-based lip sync berfungsi (mulut gerak sesuai text)
- [ ] Viseme variety terlihat (A/I/U/E/O berbeda)
- [ ] Transisi smooth antar viseme
- [ ] Body motion dampen saat bicara, normal setelah selesai
- [ ] Expression + lip sync bisa jalan bersamaan

---

> **Next**: MD-06 — AI Integration (Claude API + ElevenLabs TTS + emotion detection → full AI waifu loop)
