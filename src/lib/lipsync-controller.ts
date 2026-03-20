import type { Live2DModel } from 'pixi-live2d-display/cubism4';
import { animationController } from './animation-controller';

interface VisemeWeights {
  paramA: number;
  paramI: number;
  paramU: number;
  paramE: number;
  paramO: number;
}

const VISEME_SILENT: VisemeWeights = { paramA: 0, paramI: 0, paramU: 0, paramE: 0, paramO: 0 };

type CoreModelLike = {
  setParameterValueById: (id: string, value: number) => void;
};

export class LipSyncController {
  private model: Live2DModel | null = null;
  private originalInternalModelUpdate:
    | ((dt: number, now: number) => void)
    | null = null;
  private updateHooked = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioSource: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private dataArray: Uint8Array | null = null;
  private timeDomainData: Uint8Array | null = null;
  private isSpeaking = false;
  private analysisAnimationId: number | null = null;
  private closeAnimationId: number | null = null;
  private currentViseme: VisemeWeights = { ...VISEME_SILENT };
  private targetViseme: VisemeWeights = { ...VISEME_SILENT };
  private textTimerId: ReturnType<typeof setTimeout> | null = null;
  private speakingDoneResolver: (() => void) | null = null;
  private speakingPromise: Promise<void> | null = null;
  private audioEnvelope = 0;
  private audioTextVisemes: VisemeWeights[] = [];

  private readonly LERP_SPEED = 0.25;
  private readonly CLOSE_MOUTH_SPEED = 0.15;
  private readonly VOLUME_THRESHOLD = 0.02;
  private readonly VOLUME_SCALE = 4;
  private readonly SPEAKING_INTENSITY = 1.15;
  private readonly SMILE_VISEME_REDUCTION = 0.72;
  private readonly MOUTH_CORNER_NEUTRALIZE = 0.12;
  private readonly CLOSED_MOUTH_NEUTRAL = 0;

  init(model: Live2DModel): void {
    if (this.model !== model) {
      this.unhookModelUpdate();
    }

    this.model = model;
    this.hookModelUpdate();
    console.log('[LipSync] Controller initialized');
  }

  async speakWithAudio(
    audioUrl: string,
    transcriptText = '',
  ): Promise<void> {
    if (!this.model) {
      return;
    }

    try {
      this.stopSpeaking();

      this.audioElement = new Audio();
      this.audioElement.preload = 'auto';
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.setAttribute('playsinline', 'true');
      this.audioElement.muted = false;
      this.audioElement.volume = 1;
      this.audioElement.src = audioUrl;
      this.audioTextVisemes = this.buildSpeechVisemeTimeline(transcriptText);

      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.7;

      this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
      this.audioSource.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeDomainData = new Uint8Array(this.analyser.fftSize);

      this.isSpeaking = true;
      animationController.setSpeaking(true);
      this.speakingPromise = new Promise<void>((resolve) => {
        this.speakingDoneResolver = resolve;
      });

      this.audioElement.onended = () => {
        console.log('[LipSync] Audio playback ended');
        this.onSpeakingDone();
      };

      this.audioElement.onerror = (event) => {
        console.error('[LipSync] Audio error:', event);
        this.onSpeakingDone();
      };

      await this.audioElement.play();
      console.log('[LipSync] Audio playback started');
      this.startAudioLipSync();
    } catch (error) {
      console.error('[LipSync] speakWithAudio failed:', error);
      this.onSpeakingDone();
      await this.playAudioWithoutAnalysis(audioUrl);
      return;
    }

    await this.speakingPromise;
  }

  async speakWithText(
    text: string,
    speedMs = 80,
  ): Promise<void> {
    if (!this.model) {
      return;
    }

    this.stopSpeaking();
    this.isSpeaking = true;
    animationController.setSpeaking(true);

    const visemes = this.textToVisemes(text);

    for (let index = 0; index < visemes.length; index += 1) {
      if (!this.isSpeaking) {
        break;
      }

      this.targetViseme = visemes[index];
      await this.sleep(speedMs);
    }

    this.targetViseme = { ...VISEME_SILENT };
    await this.sleep(200);
    this.onSpeakingDone();
  }

  stopSpeaking(): void {
    this.isSpeaking = false;

    if (this.analysisAnimationId !== null) {
      cancelAnimationFrame(this.analysisAnimationId);
      this.analysisAnimationId = null;
    }

    if (this.closeAnimationId !== null) {
      cancelAnimationFrame(this.closeAnimationId);
      this.closeAnimationId = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.onended = null;
      this.audioElement.onerror = null;
      this.audioElement.src = '';
      this.audioElement = null;
    }

    this.audioSource?.disconnect();
    this.audioSource = null;
    this.analyser?.disconnect();
    this.analyser = null;

    if (this.textTimerId) {
      clearTimeout(this.textTimerId);
      this.textTimerId = null;
    }

    this.currentViseme = { ...VISEME_SILENT };
    this.targetViseme = { ...VISEME_SILENT };
    this.audioEnvelope = 0;
    this.audioTextVisemes = [];
    this.forceApplyViseme();
    animationController.setSpeaking(false);
    this.resolveSpeakingPromise();
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  destroy(): void {
    this.stopSpeaking();

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.unhookModelUpdate();
    this.model = null;
  }

  private startAudioLipSync(): void {
    const update = () => {
      if (!this.isSpeaking || !this.analyser || !this.dataArray || !this.model) {
        return;
      }

      this.analyser.getByteFrequencyData(this.dataArray as unknown as Uint8Array<ArrayBuffer>);
      this.analyser.getByteTimeDomainData(
        this.timeDomainData as unknown as Uint8Array<ArrayBuffer>,
      );

      const lowFreq = this.getAverageFrequency(this.dataArray, 0, 10);
      const midFreq = this.getAverageFrequency(this.dataArray, 10, 40);
      const highFreq = this.getAverageFrequency(this.dataArray, 40, 80);
      const rawVolume = this.getTimeDomainRms(this.timeDomainData);
      const spectrumEnergy = lowFreq * 0.45 + midFreq * 0.35 + highFreq * 0.2;
      const detectedVolume = Math.max(rawVolume * 1.8, spectrumEnergy * 0.9);

      if (detectedVolume > this.audioEnvelope) {
        this.audioEnvelope += (detectedVolume - this.audioEnvelope) * 0.55;
      } else {
        this.audioEnvelope += (detectedVolume - this.audioEnvelope) * 0.12;
      }

      const textDrivenViseme = this.getAudioTextViseme();

      if (this.audioEnvelope > this.VOLUME_THRESHOLD) {
        const mouthOpen = Math.min(this.audioEnvelope * this.VOLUME_SCALE, 1);
        const total = lowFreq + midFreq + highFreq + 0.001;
        const lowRatio = lowFreq / total;
        const midRatio = midFreq / total;
        const highRatio = highFreq / total;

        const audioDrivenViseme = {
          paramA: mouthOpen * lowRatio * 1.5,
          paramI: mouthOpen * highRatio * 0.8,
          paramU: mouthOpen * highRatio * 0.4,
          paramE: mouthOpen * midRatio,
          paramO: mouthOpen * lowRatio * 0.7,
        };

        this.targetViseme = this.blendVisemes(audioDrivenViseme, textDrivenViseme, 0.88);
      } else {
        this.targetViseme = this.blendVisemes(
          this.getPlaybackFallbackViseme(),
          textDrivenViseme,
          0.92,
        );
      }

      this.analysisAnimationId = requestAnimationFrame(update);
    };

    this.analysisAnimationId = requestAnimationFrame(update);
  }

  private getAverageFrequency(data: ArrayLike<number>, startBin: number, endBin: number): number {
    let sum = 0;
    const safeEnd = Math.min(endBin, data.length);
    const count = safeEnd - startBin;

    for (let index = startBin; index < safeEnd; index += 1) {
      sum += data[index] / 255;
    }

    return count > 0 ? sum / count : 0;
  }

  private getTimeDomainRms(data: Uint8Array | null): number {
    if (!data || data.length === 0) {
      return 0;
    }

    let sum = 0;

    for (let index = 0; index < data.length; index += 1) {
      const centered = (data[index] - 128) / 128;
      sum += centered * centered;
    }

    return Math.sqrt(sum / data.length);
  }

  private getPlaybackFallbackViseme(): VisemeWeights {
    if (!this.audioElement || this.audioElement.paused) {
      return { ...VISEME_SILENT };
    }

    const pulse = (Math.sin(this.audioElement.currentTime * 14) + 1) * 0.5;
    const open = 0.16 + pulse * 0.2;

    return {
      paramA: open,
      paramI: open * 0.18,
      paramU: open * 0.1,
      paramE: open * 0.14,
      paramO: open * 0.2,
    };
  }

  private getAudioTextViseme(): VisemeWeights {
    if (!this.audioElement || !this.audioTextVisemes.length) {
      return { ...VISEME_SILENT };
    }

    const duration = Number.isFinite(this.audioElement.duration) ? this.audioElement.duration : 0;
    if (duration <= 0) {
      return this.amplifyViseme(this.audioTextVisemes[0] ?? { ...VISEME_SILENT });
    }

    const progress = Math.min(this.audioElement.currentTime / duration, 0.999);
    const exactIndex = progress * Math.max(this.audioTextVisemes.length - 1, 1);
    const baseIndex = Math.floor(exactIndex);
    const nextIndex = Math.min(baseIndex + 1, this.audioTextVisemes.length - 1);
    const mix = exactIndex - baseIndex;

    const baseViseme = this.amplifyViseme(this.audioTextVisemes[baseIndex] ?? { ...VISEME_SILENT });
    const nextViseme = this.amplifyViseme(this.audioTextVisemes[nextIndex] ?? { ...VISEME_SILENT });

    return this.blendVisemes(baseViseme, nextViseme, mix);
  }

  private blendVisemes(
    primary: VisemeWeights,
    secondary: VisemeWeights,
    secondaryWeight: number,
  ): VisemeWeights {
    const primaryWeight = 1 - secondaryWeight;

    return {
      paramA: primary.paramA * primaryWeight + secondary.paramA * secondaryWeight,
      paramI: primary.paramI * primaryWeight + secondary.paramI * secondaryWeight,
      paramU: primary.paramU * primaryWeight + secondary.paramU * secondaryWeight,
      paramE: primary.paramE * primaryWeight + secondary.paramE * secondaryWeight,
      paramO: primary.paramO * primaryWeight + secondary.paramO * secondaryWeight,
    };
  }

  private amplifyViseme(viseme: VisemeWeights): VisemeWeights {
    const total = viseme.paramA + viseme.paramI + viseme.paramU + viseme.paramE + viseme.paramO;

    if (total <= 0) {
      return { ...VISEME_SILENT };
    }

    return {
      paramA: Math.min(Math.max(viseme.paramA * 1.7, 0.16), 1),
      paramI: Math.min(Math.max(viseme.paramI * 1.45, 0), 0.9),
      paramU: Math.min(Math.max(viseme.paramU * 1.4, 0), 0.8),
      paramE: Math.min(Math.max(viseme.paramE * 1.5, 0.08), 0.95),
      paramO: Math.min(Math.max(viseme.paramO * 1.45, 0.08), 0.9),
    };
  }


  private buildSpeechVisemeTimeline(text: string): VisemeWeights[] {
    const timeline: VisemeWeights[] = [];
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();

    for (const char of normalized) {
      if (char === ' ') {
        timeline.push({ paramA: 0.16, paramI: 0, paramU: 0, paramE: 0.06, paramO: 0 });
        continue;
      }

      const viseme = this.charToSpeechViseme(char);
      if (!viseme) {
        continue;
      }

      const repeat = this.getSpeechHold(char);
      for (let index = 0; index < repeat; index += 1) {
        timeline.push(viseme);
      }
    }

    return timeline.length > 0 ? timeline : [{ paramA: 0.28, paramI: 0, paramU: 0, paramE: 0.12, paramO: 0 }];
  }

  private charToSpeechViseme(char: string): VisemeWeights | null {
    switch (char) {
      case 'a':
        return { paramA: 0.9, paramI: 0.06, paramU: 0, paramE: 0.24, paramO: 0.12 };
      case 'i':
        return { paramA: 0.2, paramI: 0.82, paramU: 0, paramE: 0.22, paramO: 0 };
      case 'u':
        return { paramA: 0.18, paramI: 0.08, paramU: 0.78, paramE: 0.08, paramO: 0.2 };
      case 'e':
        return { paramA: 0.36, paramI: 0.14, paramU: 0.02, paramE: 0.72, paramO: 0.08 };
      case 'o':
        return { paramA: 0.3, paramI: 0.04, paramU: 0.16, paramE: 0.08, paramO: 0.8 };
      case 'm':
      case 'n':
      case 'l':
      case 'r':
      case 'h':
      case 'y':
      case 'w':
        return { paramA: 0.28, paramI: 0.08, paramU: 0.06, paramE: 0.18, paramO: 0.08 };
      case 'b':
      case 'p':
      case 'd':
      case 't':
      case 'g':
      case 'k':
      case 'c':
      case 'j':
      case 's':
      case 'z':
      case 'f':
      case 'v':
      case 'x':
      case 'q':
        return { paramA: 0.22, paramI: 0.04, paramU: 0.04, paramE: 0.1, paramO: 0.04 };
      case '.':
      case ',':
      case '!':
      case '?':
        return { ...VISEME_SILENT };
      default:
        return { paramA: 0.26, paramI: 0.04, paramU: 0.04, paramE: 0.12, paramO: 0.04 };
    }
  }

  private getSpeechHold(char: string): number {
    if ('aiueo'.includes(char)) {
      return 4;
    }

    if ('mnlrhyw'.includes(char)) {
      return 2;
    }

    if (char === ' ') {
      return 1;
    }

    return 2;
  }

  private textToVisemes(text: string): VisemeWeights[] {
    const visemes: VisemeWeights[] = [];

    for (const char of text.toLowerCase()) {
      const viseme = this.charToViseme(char);
      if (viseme) {
        visemes.push(viseme);
      }
    }

    return visemes;
  }

  private charToViseme(char: string): VisemeWeights | null {
    switch (char) {
      case 'a':
        return { paramA: 1, paramI: 0, paramU: 0, paramE: 0, paramO: 0 };
      case 'i':
        return { paramA: 0, paramI: 1, paramU: 0, paramE: 0, paramO: 0 };
      case 'u':
        return { paramA: 0, paramI: 0, paramU: 1, paramE: 0, paramO: 0 };
      case 'e':
        return { paramA: 0, paramI: 0, paramU: 0, paramE: 1, paramO: 0 };
      case 'o':
        return { paramA: 0, paramI: 0, paramU: 0, paramE: 0, paramO: 1 };
      case 'b':
      case 'p':
      case 'm':
        return { paramA: 0.3, paramI: 0, paramU: 0.2, paramE: 0, paramO: 0 };
      case 'f':
      case 'v':
        return { paramA: 0.1, paramI: 0.3, paramU: 0, paramE: 0.1, paramO: 0 };
      case 't':
      case 'd':
      case 'n':
      case 'l':
        return { paramA: 0.2, paramI: 0.2, paramU: 0, paramE: 0.3, paramO: 0 };
      case 's':
      case 'z':
      case 'c':
        return { paramA: 0, paramI: 0.4, paramU: 0, paramE: 0.2, paramO: 0 };
      case 'k':
      case 'g':
        return { paramA: 0.3, paramI: 0, paramU: 0, paramE: 0.2, paramO: 0.2 };
      case 'r':
        return { paramA: 0.2, paramI: 0, paramU: 0.1, paramE: 0.3, paramO: 0 };
      case 'w':
        return { paramA: 0, paramI: 0, paramU: 0.6, paramE: 0, paramO: 0.3 };
      case 'y':
      case 'j':
        return { paramA: 0, paramI: 0.5, paramU: 0, paramE: 0.2, paramO: 0 };
      case 'h':
        return { paramA: 0.4, paramI: 0, paramU: 0, paramE: 0.1, paramO: 0 };
      case ' ':
        return { paramA: 0.05, paramI: 0, paramU: 0, paramE: 0, paramO: 0 };
      case '.':
      case ',':
      case '!':
      case '?':
        return null;
      default:
        return { paramA: 0.2, paramI: 0, paramU: 0, paramE: 0.1, paramO: 0 };
    }
  }

  private lerpViseme(): void {
    const speed = this.isSpeaking ? this.LERP_SPEED : this.CLOSE_MOUTH_SPEED;
    this.currentViseme.paramA += (this.targetViseme.paramA - this.currentViseme.paramA) * speed;
    this.currentViseme.paramI += (this.targetViseme.paramI - this.currentViseme.paramI) * speed;
    this.currentViseme.paramU += (this.targetViseme.paramU - this.currentViseme.paramU) * speed;
    this.currentViseme.paramE += (this.targetViseme.paramE - this.currentViseme.paramE) * speed;
    this.currentViseme.paramO += (this.targetViseme.paramO - this.currentViseme.paramO) * speed;
  }

  private forceApplyViseme(): void {
    const coreModel = this.model?.internalModel?.coreModel as CoreModelLike | undefined;

    if (!coreModel) {
      return;
    }

    const mouthIntensity = this.isSpeaking ? this.SPEAKING_INTENSITY : 1;
    const smileReduction = this.isSpeaking ? this.SMILE_VISEME_REDUCTION : 1;

    coreModel.setParameterValueById('ParamA', this.currentViseme.paramA * mouthIntensity);
    coreModel.setParameterValueById('ParamI', this.currentViseme.paramI * mouthIntensity * smileReduction);
    coreModel.setParameterValueById('ParamU', this.currentViseme.paramU * mouthIntensity);
    coreModel.setParameterValueById('ParamE', this.currentViseme.paramE * mouthIntensity * smileReduction);
    coreModel.setParameterValueById('ParamO', this.currentViseme.paramO * mouthIntensity);

    if (this.isSpeaking) {
      this.applySpeakingMouthOverride(coreModel);
    } else {
      this.applyClosedMouthOverride(coreModel);
    }
  }

  private applySpeakingMouthOverride(coreModel: CoreModelLike): void {
    coreModel.setParameterValueById('ParamMouthUp', 0);
    coreModel.setParameterValueById('ParamMouthDown', 0);
    coreModel.setParameterValueById('ParamMouthAngry', 0);
    coreModel.setParameterValueById('ParamMouthAngryLine', 0);

    // Some models keep a slight upward mouth bias from the base pose.
    // A small negative nudge helps speech read as "talking" instead of smiling.
    coreModel.setParameterValueById('ParamMouthDown', this.MOUTH_CORNER_NEUTRALIZE);
  }

  private applyClosedMouthOverride(coreModel: CoreModelLike): void {
    coreModel.setParameterValueById('ParamMouthUp', this.CLOSED_MOUTH_NEUTRAL);
    coreModel.setParameterValueById('ParamMouthDown', this.CLOSED_MOUTH_NEUTRAL);
    coreModel.setParameterValueById('ParamMouthAngry', this.CLOSED_MOUTH_NEUTRAL);
    coreModel.setParameterValueById('ParamMouthAngryLine', this.CLOSED_MOUTH_NEUTRAL);
  }

  private onSpeakingDone(): void {
    this.isSpeaking = false;
    this.targetViseme = { ...VISEME_SILENT };

    const closeAnimation = () => {
      this.closeAnimationId = requestAnimationFrame(closeAnimation);
      this.lerpViseme();
      this.forceApplyViseme();

      const total =
        Math.abs(this.currentViseme.paramA) +
        Math.abs(this.currentViseme.paramI) +
        Math.abs(this.currentViseme.paramU) +
        Math.abs(this.currentViseme.paramE) +
        Math.abs(this.currentViseme.paramO);

      if (total <= 0.01) {
        if (this.closeAnimationId !== null) {
          cancelAnimationFrame(this.closeAnimationId);
          this.closeAnimationId = null;
        }

        this.forceApplyViseme();
        this.resolveSpeakingPromise();
      }
    };

    if (this.analysisAnimationId !== null) {
      cancelAnimationFrame(this.analysisAnimationId);
      this.analysisAnimationId = null;
    }

    if (this.closeAnimationId !== null) {
      cancelAnimationFrame(this.closeAnimationId);
      this.closeAnimationId = null;
    }

    this.closeAnimationId = requestAnimationFrame(closeAnimation);
    animationController.setSpeaking(false);
    console.log('[LipSync] Speaking done');
  }

  private hookModelUpdate(): void {
    if (!this.model?.internalModel || this.updateHooked) {
      return;
    }

    this.originalInternalModelUpdate = this.model.internalModel.update.bind(this.model.internalModel);
    this.model.internalModel.update = (dt: number, now: number) => {
      this.originalInternalModelUpdate?.(dt, now);
      this.onFrameUpdate();
    };
    this.updateHooked = true;
    console.log('[LipSync] Hooked into internal model update loop');
  }

  private unhookModelUpdate(): void {
    if (!this.model?.internalModel || !this.updateHooked || !this.originalInternalModelUpdate) {
      this.originalInternalModelUpdate = null;
      this.updateHooked = false;
      return;
    }

    this.model.internalModel.update = this.originalInternalModelUpdate;
    this.originalInternalModelUpdate = null;
    this.updateHooked = false;
  }

  private onFrameUpdate(): void {
    if (!this.model) {
      return;
    }

    this.lerpViseme();
    this.forceApplyViseme();
  }

  private async playAudioWithoutAnalysis(audioUrl: string): Promise<void> {
    try {
      const fallbackAudio = new Audio(audioUrl);
      fallbackAudio.preload = 'auto';
      fallbackAudio.crossOrigin = 'anonymous';
      fallbackAudio.setAttribute('playsinline', 'true');
      fallbackAudio.muted = false;
      fallbackAudio.volume = 1;

      await fallbackAudio.play();
      console.warn('[LipSync] Falling back to plain audio playback without analysis');

      await new Promise<void>((resolve) => {
        fallbackAudio.onended = () => resolve();
        fallbackAudio.onerror = () => resolve();
      });
    } catch (fallbackError) {
      console.error('[LipSync] Plain audio fallback failed:', fallbackError);
    }
  }

  private resolveSpeakingPromise(): void {
    this.speakingDoneResolver?.();
    this.speakingDoneResolver = null;
    this.speakingPromise = null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.textTimerId = setTimeout(resolve, ms);
    });
  }
}

export const lipSyncController = new LipSyncController();
