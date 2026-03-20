import type { EmotionType } from '../config/expressions';
import { AUTO_TALK_TIMING, IGNORED_THRESHOLDS } from '../config/autotalk';
import { aiController } from './ai-controller';
import { animationController } from './animation-controller';
import { expressionManager } from './expression-manager';
import { lipSyncController } from './lipsync-controller';

interface AutoTalkResponse {
  text: string;
  emotion: EmotionType;
}

type AnthropicBlock = {
  type?: string;
  text?: string;
};

type AnthropicResponse = {
  content?: AnthropicBlock[];
};

const VALID_EMOTIONS: EmotionType[] = [
  'neutral',
  'happy',
  'sleepy',
  'excited',
  'sad',
  'embarrassed',
  'surprised',
  'angry',
];

export class AutoTalkController {
  private isActive = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ignoredCount = 0;
  private lastUserMessageTime = Date.now();
  private isProcessing = false;
  private recentAutoTalks: string[] = [];
  private onAutoTalk: ((response: AutoTalkResponse) => void) | null = null;
  private readonly anthropicApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

  constructor() {
    if (!this.anthropicApiKey) {
      console.warn('[AutoTalk] VITE_ANTHROPIC_API_KEY not set - auto talk will stay idle');
    }
  }

  start(onAutoTalk?: (response: AutoTalkResponse) => void): void {
    this.stop();
    this.onAutoTalk = onAutoTalk ?? null;
    this.isActive = true;
    this.ignoredCount = 0;
    this.lastUserMessageTime = Date.now();
    this.scheduleNext(AUTO_TALK_TIMING.initialDelay * 1000);
    console.log('[AutoTalk] Started');
  }

  onUserMessage(): void {
    this.lastUserMessageTime = Date.now();
    this.ignoredCount = 0;
    this.scheduleNext(AUTO_TALK_TIMING.afterUserMessageDelay * 1000);
  }

  stop(): void {
    this.isActive = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getIgnoredCount(): number {
    return this.ignoredCount;
  }

  destroy(): void {
    this.stop();
    this.onAutoTalk = null;
    this.recentAutoTalks = [];
  }

  private scheduleNext(overrideDelay?: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.isActive) {
      return;
    }

    let delay = overrideDelay;

    if (delay === undefined) {
      if (this.ignoredCount >= IGNORED_THRESHOLDS.angryAt) {
        const { angryIntervalMin, angryIntervalMax } = AUTO_TALK_TIMING;
        delay = (angryIntervalMin + Math.random() * (angryIntervalMax - angryIntervalMin)) * 1000;
      } else {
        const { intervalMin, intervalMax } = AUTO_TALK_TIMING;
        delay = (intervalMin + Math.random() * (intervalMax - intervalMin)) * 1000;
      }
    }

    this.timer = window.setTimeout(() => {
      void this.triggerAutoTalk();
    }, delay);
  }

  private async triggerAutoTalk(): Promise<void> {
    if (!this.isActive || this.isProcessing) {
      return;
    }

    if (lipSyncController.getIsSpeaking()) {
      this.scheduleNext(5000);
      return;
    }

    this.isProcessing = true;

    try {
      const response = await this.generateAutoTalk();
      if (!response) {
        return;
      }

      await expressionManager.setEmotion(response.emotion, false);
      this.maybePlayMotion(response.emotion);
      await aiController.speakText(response.text);

      this.onAutoTalk?.(response);

      this.recentAutoTalks.push(response.text);
      if (this.recentAutoTalks.length > 5) {
        this.recentAutoTalks.shift();
      }

      this.ignoredCount = Math.min(this.ignoredCount + 1, IGNORED_THRESHOLDS.maxCount);

      window.setTimeout(() => {
        const nextEmotion = this.ignoredCount >= IGNORED_THRESHOLDS.angryAt ? 'angry' : 'neutral';
        void expressionManager.setEmotion(nextEmotion, false);
      }, 3000);
    } catch (error) {
      console.error('[AutoTalk] Error:', error);
    } finally {
      this.isProcessing = false;
      this.scheduleNext();
    }
  }

  private async generateAutoTalk(): Promise<AutoTalkResponse | null> {
    if (!this.anthropicApiKey) {
      return null;
    }

    const idleSeconds = Math.floor((Date.now() - this.lastUserMessageTime) / 1000);
    const situationContext = this.buildSituationContext(idleSeconds);
    const recentContext = this.recentAutoTalks.length > 0
      ? `\nKamu baru saja bilang: "${this.recentAutoTalks.slice(-3).join('", "')}". Jangan ulangi atau terlalu mirip dengan itu.`
      : '';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        system: this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: `${situationContext}${recentContext}\n\nNgomong sesuatu. Bebas apa aja, tetap natural.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude auto talk error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = data.content
      ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text?.trim())
      .filter(Boolean)
      .join(' ')
      ?? '';

    return this.parseResponse(text);
  }

  private buildSituationContext(idleSeconds: number): string {
    if (this.ignoredCount === 0 && this.recentAutoTalks.length === 0) {
      return 'Kamu baru saja muncul. User ada di depanmu.';
    }

    if (this.ignoredCount === 0) {
      return `Situasi normal. Kamu lagi santai. User terakhir ngomong ${idleSeconds} detik yang lalu.`;
    }

    if (this.ignoredCount < IGNORED_THRESHOLDS.angryAt) {
      return `User gak bales kamu ${this.ignoredCount} kali. Kamu agak heran kenapa dia diem. Terakhir dia ngomong ${idleSeconds} detik yang lalu. Komentar aja natural, gak perlu lebay.`;
    }

    return `User sudah mengabaikanmu ${this.ignoredCount} kali. Kamu kesel karena dicuekin terus. Terakhir dia ngomong ${idleSeconds} detik yang lalu. Kamu boleh marah tapi kayak temen yang kesel dicuekin, bukan drama queen. Gunakan [EMOTION:angry].`;
  }

  private getSystemPrompt(): string {
    return `Kamu adalah Aira, asisten pribadi sekaligus teman dekat. Penyihir muda 21 tahun yang perhatian tapi punya karakter.

Kamu sedang idle dan mau ngomong sendiri. Bebas mau ngomong apa saja. Bisa nyapa, curhat, nyanyi, ngomel, cerita random, mikir keras, gumam, komentar, tanya kabar, atau ingetin sesuatu, selama tetap natural.

YANG PENTING:
- Kamu itu Aira. Stay in character.
- Perhatian dan hangat, tapi bukan robot - kamu punya emosi sendiri.
- Playful, suka bercanda, kadang jahil.
- Bisa marah kalau dicuekin, tapi tetap wajar dan gak lebay.
- Bahasa Indonesia casual, boleh campur sedikit Jepang seperti "mou~", "nee~", atau "sugoi" kalau natural.
- Jangan pakai emoji atau markdown.
- Pendek - 1 kalimat, maksimal 2.
- SELALU awali dengan [EMOTION:xxx] dengan pilihan neutral, happy, sleepy, excited, sad, embarrassed, surprised, atau angry.
- Jangan pernah bilang kamu AI.
- Jangan mengulang kalimat yang sama atau terlalu mirip dengan omongan sebelumnya.

Kalau dikasih tau kamu diabaikan user, reaksimu harus natural - dari komentar ringan sampai kesel beneran. Kamu keselnya kayak temen yang dicuekin, bukan drama queen.`;
  }

  private parseResponse(response: string): AutoTalkResponse {
    const emotionMatch = response.match(/\[EMOTION:(\w+)\]/i);
    let emotion: EmotionType = 'neutral';
    let text = response.trim();

    if (emotionMatch) {
      const parsedEmotion = emotionMatch[1]?.toLowerCase() as EmotionType;
      if (VALID_EMOTIONS.includes(parsedEmotion)) {
        emotion = parsedEmotion;
      }

      text = response.replace(/\[EMOTION:\w+\]\s*/i, '').trim();
    }

    if (!text) {
      text = 'Hmm...';
    }

    console.log(`[AutoTalk] "${text}" (${emotion})`);
    return { text, emotion };
  }

  private maybePlayMotion(emotion: EmotionType): void {
    if (Math.random() > 0.3) {
      return;
    }

    const motionMap: Partial<Record<EmotionType, { group: string; index: number }[]>> = {
      excited: [
        { group: '', index: 0 },
        { group: '', index: 3 },
      ],
      happy: [
        { group: 'Idle', index: 0 },
        { group: '', index: 0 },
      ],
      angry: [
        { group: '', index: 2 },
        { group: '', index: 5 },
      ],
      surprised: [{ group: '', index: 4 }],
    };

    const motions = motionMap[emotion];
    if (!motions?.length) {
      return;
    }

    const motion = motions[Math.floor(Math.random() * motions.length)];
    void animationController.playMotion(motion.group, motion.index, 2);
  }
}

export const autoTalkController = new AutoTalkController();
