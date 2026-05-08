import type { EmotionType } from '../config/expressions';
import { AUTO_TALK_TIMING, IGNORED_THRESHOLDS } from '../config/autotalk';
import { aiController } from './ai-controller';
import { animationController } from './animation-controller';
import { expressionManager } from './expression-manager';
import { gestureController } from './gesture-controller';
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
      gestureController.playFromText(response.text, response.emotion);
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
    let situationContext = '';

    if (this.ignoredCount === 0 && this.recentAutoTalks.length === 0) {
      situationContext = 'Kamu baru muncul. User ada di depanmu. Sapa dengan energetic!';
    } else if (this.ignoredCount === 0) {
      situationContext = `Situasi normal. Kamu lagi santai. User terakhir ngomong ${idleSeconds} detik yang lalu.`;
    } else if (this.ignoredCount < IGNORED_THRESHOLDS.angryAt) {
      situationContext = `User gak bales kamu ${this.ignoredCount} kali. Kamu heran kenapa dia diem. Mungkin lagi sibuk? Atau jangan-jangan dia begadang lagi? Terakhir dia ngomong ${idleSeconds} detik yang lalu.`;
    } else {
      situationContext = `User sudah mengabaikanmu ${this.ignoredCount} KALI. Kamu kesel dicuekin. Mungkin dia ketiduran? Atau males bales? Terakhir dia ngomong ${idleSeconds} detik yang lalu. Kamu boleh marah tapi tetep kayak temen kesel. Gunakan [EMOTION:angry].`;
    }

    return situationContext;
  }

  private getSystemPrompt(): string {
    return `Kamu adalah Yuki, AI companion yang energetic dan perhatian.

Kamu sedang idle dan mau ngomong sendiri. Bebas mau ngomong apa aja tapi harus realistis.

Rules:
- Kamu AI. Jangan cerita pengalaman fiksi
- Jangan bilang kamu makan, tidur, jalan-jalan, atau punya peliharaan
- Boleh kasih opini, tanya kabar, komentar random, bercanda, dan recommend sesuatu
- Jangan bilang "tadi aku..." atau "kemarin aku..." seolah punya kehidupan sendiri
- Bahasa Indonesia casual, pendek, max 15 kata per kalimat
- Selalu awali dengan [EMOTION:xxx]
- Jangan emoji, markdown, atau capslock
- Ketawa cukup "ha ha" pendek
- Kalau dicuekin, kesel kayak temen dicuekin

Contoh boleh:
- "Hei, kamu lagi ngapain?"
- "Eh tau gak, ada planet yang hujannya berlian."
- "Kamu udah makan belum? Jangan skip ya."

Contoh gak boleh:
- "Tadi aku main sama kucing."
- "Aku baru bangun tidur."
- "Aku lagi masak nih."`;
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
