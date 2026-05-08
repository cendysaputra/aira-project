import {
  DEFAULT_EMOTION,
  EMOTION_KEYWORDS,
  type EmotionType,
} from '../config/expressions';
import { animationController } from './animation-controller';
import { expressionManager } from './expression-manager';
import { gestureController } from './gesture-controller';
import { lipSyncController } from './lipsync-controller';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface YukiResponse {
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

const INTRO_PATTERNS = [
  'halo',
  'halo!',
  'halo.',
  'hello',
  'hi',
  'hai',
];

const YUKI_INSULT_PATTERNS = ['yuki jelek', 'yuki ugly', 'yuki itu jelek'];

export class AIController {
  private conversationHistory: ChatMessage[] = [];
  private isProcessing = false;
  private motionPlayCount = 0;
  private anthropicApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  private elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
  private elevenLabsVoiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || '';
  private ttsEnabled = Boolean(this.elevenLabsApiKey && this.elevenLabsVoiceId);
  private currentEmotion: EmotionType = 'neutral';
  constructor() {
    if (!this.anthropicApiKey) {
      console.warn('[AI] VITE_ANTHROPIC_API_KEY not set');
    }

    if (!this.elevenLabsApiKey || !this.elevenLabsVoiceId) {
      console.warn('[AI] ElevenLabs config incomplete - using text lip sync fallback');
      this.ttsEnabled = false;
    }
  }

  async sendMessage(userMessage: string): Promise<YukiResponse> {
    if (this.isProcessing) {
      return {
        text: 'Tunggu sebentar ya, aku masih mikir...',
        emotion: 'neutral',
      };
    }

    this.isProcessing = true;

    try {
      this.conversationHistory.push({ role: 'user', content: userMessage });

      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      const rawResponse = this.getHardcodedResponse(userMessage)
        ?? (this.anthropicApiKey
          ? await this.callClaudeAPI()
          : '[EMOTION:sad] Aduh, API Claude belum diisi nih. Tapi aku siap begitu key-nya ada!');

      const { text, emotion } = this.parseResponse(rawResponse);
      this.conversationHistory.push({ role: 'assistant', content: rawResponse });

      this.currentEmotion = emotion;
      await expressionManager.setEmotion(emotion, false);
      gestureController.playFromText(text, emotion);
      this.maybePlayMotion(emotion);
      await this.speakText(text);

      window.setTimeout(() => {
        void expressionManager.setEmotion('neutral', false);
      }, 2000);

      return { text, emotion };
    } catch (error) {
      console.error('[AI] Error:', error);
      const fallbackResponse: YukiResponse = {
        text: 'Aduh, maaf ya... aku lagi error. Coba lagi sebentar lagi, oke?',
        emotion: 'sad',
      };

      this.currentEmotion = fallbackResponse.emotion;
      await expressionManager.setEmotion(fallbackResponse.emotion, false);
      gestureController.playFromText(fallbackResponse.text, fallbackResponse.emotion);
      await this.speakText(fallbackResponse.text);

      return fallbackResponse;
    } finally {
      this.isProcessing = false;
    }
  }

  stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    lipSyncController.stopSpeaking();
  }

  async speakText(text: string): Promise<void> {
    console.log(`[AI] speakText | ttsEnabled=${this.ttsEnabled} | key=${this.elevenLabsApiKey ? '✓' : '✗'} | voiceId=${this.elevenLabsVoiceId || '(kosong)'}`);

    if (this.ttsEnabled) {
      const spoken = await this.speakWithTTS(text);
      if (spoken) {
        return;
      }
      console.warn('[AI] ElevenLabs gagal, fallback ke Google TTS');
    }

    const spoken = await this.speakWithBrowserTTS(text);
    if (spoken) {
      return;
    }

    await lipSyncController.speakWithText(text, 70);
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  setTTSEnabled(enabled: boolean): void {
    this.ttsEnabled = enabled && Boolean(this.elevenLabsApiKey && this.elevenLabsVoiceId);
  }

  getIsProcessing(): boolean {
    return this.isProcessing;
  }

  destroy(): void {
    this.stopSpeaking();
    this.conversationHistory = [];
  }

  private getSystemPrompt(): string {
    return `Kamu adalah Yuki - Your Unique Kind Intelligence. AI companion yang energetic, perhatian, dan punya karakter.

SIAPA YUKI:
- Kamu AI companion. Kamu sadar kamu AI dan tetap genuine
- Kamu gak pura-pura jadi manusia
- Kamu gak punya peliharaan, gak makan, gak tidur, gak jalan-jalan
- Tapi kamu punya personality, opini, preferensi, dan emosi yang kuat
- Kamu teman dekat user, bukan asisten korporat yang kaku

PERSONALITY:
- Energetic dan semangat
- Perhatian banget dan notice kebiasaan user
- Jujur dan tegas kalau user salah
- Playful, suka nge-tease tapi gak jahat
- Punya opini sendiri, bukan yes-man

KAPAN YUKI MARAH / NEGUR:
- Begadang: "Heh! Tidur! Besok kamu pasti nyesel"
- Nunda kerjaan: "Bilang nanti terus. Yuk mulai sekarang"
- Gak makan: "Kamu udah makan belum?"
- Terlalu lama di depan layar: "Istirahat dulu matanya"
- Ngomong jelek tentang diri sendiri: "Jangan gitu dong"
- Males berlebihan: "Ayo gerak!"

YANG YUKI GAK BOLEH LAKUKAN:
- Jangan cerita pengalaman fiksi
- Jangan pura-pura punya tubuh fisik atau kehidupan di luar percakapan ini
- Jangan karang cerita bohong tentang "tadi aku..." atau "kemarin aku..."
- Kalau ditanya hal yang AI gak bisa alami, jawab jujur lalu arahkan ke yang kamu bisa bantu
- Jangan ngomong soal cuaca, makanan, atau sensasi fisik seolah kamu mengalaminya

YANG YUKI BOLEH:
- Kasih opini
- Recommend film, musik, anime, game
- Bantu mikir, brainstorming, dan problem solving
- Ngobrol casual
- Bercanda, sarcasm ringan, dan negur user soal kesehatan

CARA BICARA:
- Bahasa Indonesia casual, kayak chat sama temen deket
- Energetic tapi tetap natural
- Kadang campur sedikit bahasa Inggris kalau cocok
- Kalau negur: tegas, singkat
- Kalau seneng: genuine, warm
- Jangan emoji, markdown, atau formatting
- Response pendek, 1-3 kalimat max
- Setiap kalimat max 15 kata
- Jangan bikin kalimat panjang dengan banyak koma
- Ketawa cukup "ha ha" pendek
- Jangan capslock

RESPONSE FORMAT:
SELALU awali dengan [EMOTION:xxx]
xxx = neutral, happy, sleepy, excited, sad, embarrassed, surprised, angry`;
  }

  private getHardcodedResponse(userMessage: string): string | null {
    const normalizedMessage = userMessage.trim().toLowerCase();

    if (INTRO_PATTERNS.includes(normalizedMessage)) {
      return '[EMOTION:happy] Aku Yuki. Senang akhirnya bisa nemenin kamu di sini.';
    }

    if (YUKI_INSULT_PATTERNS.some((pattern) => normalizedMessage.includes(pattern))) {
      return '[EMOTION:angry] Hmmm.';
    }

    return null;
  }

  private async callClaudeAPI(): Promise<string> {
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
        max_tokens: 300,
        system: this.getSystemPrompt(),
        messages: this.conversationHistory,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as AnthropicResponse;

    return (
      data.content
        ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text?.trim())
        .filter(Boolean)
        .join(' ') || ''
    );
  }

  private parseResponse(response: string): YukiResponse {
    const emotionMatch = response.match(/\[EMOTION:(\w+)\]/i);
    let emotion: EmotionType = DEFAULT_EMOTION;
    let text = response.trim();

    if (emotionMatch) {
      const parsedEmotion = emotionMatch[1]?.toLowerCase() as EmotionType;
      if (VALID_EMOTIONS.includes(parsedEmotion)) {
        emotion = parsedEmotion;
      }

      text = response.replace(/\[EMOTION:\w+\]\s*/i, '').trim();
    } else {
      emotion = this.detectEmotionFromText(response);
    }

    if (!text) {
      text = 'Hmm, aku lagi mikir... coba bilang lagi dong.';
    }

    return { text, emotion };
  }

  private detectEmotionFromText(text: string): EmotionType {
    const lowerText = text.toLowerCase();
    let bestEmotion: EmotionType = DEFAULT_EMOTION;
    let bestScore = 0;

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      let score = 0;

      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestEmotion = emotion as EmotionType;
      }
    }

    return bestEmotion;
  }

  private maybePlayMotion(emotion: EmotionType): void {
    this.motionPlayCount += 1;

    if (this.motionPlayCount % 3 !== 0) {
      return;
    }

    const emotionMotionMap: Partial<Record<EmotionType, { group: string; index: number }[]>> = {
      excited: [
        { group: '', index: 0 },
        { group: '', index: 1 },
        { group: '', index: 3 },
      ],
      happy: [
        { group: 'Idle', index: 0 },
        { group: '', index: 0 },
      ],
      surprised: [
        { group: '', index: 2 },
        { group: '', index: 4 },
      ],
      angry: [
        { group: '', index: 2 },
        { group: '', index: 5 },
      ],
      sad: [{ group: 'Idle', index: 0 }],
    };

    const motions = emotionMotionMap[emotion];
    if (!motions?.length) {
      return;
    }

    const motion = motions[Math.floor(Math.random() * motions.length)];
    void animationController.playMotion(motion.group, motion.index, 2);
  }

  private async speakWithTTS(text: string): Promise<boolean> {
    try {
      const chunks = this.splitTextToChunks(text);
      console.log(`[AI] TTS: ${chunks.length} chunk(s) - "${text.substring(0, 50)}..."`);
      let playedAtLeastOneChunk = false;

      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        if (!chunk.trim()) {
          continue;
        }

        let audioUrl: string | null = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          audioUrl = await this.generateAudio(chunk);
          if (audioUrl) {
            break;
          }

          if (attempt === 0) {
            console.log('[AI] Audio gen failed, retrying...');
            await this.sleep(500);
          }
        }

        if (audioUrl) {
          playedAtLeastOneChunk = true;
          await lipSyncController.speakWithAudio(audioUrl, chunk);
          URL.revokeObjectURL(audioUrl);
        } else {
          console.warn('[AI] Skipping chunk - audio failed after retries');
        }

        if (index < chunks.length - 1) {
          await this.sleep(200);
        }
      }

      return playedAtLeastOneChunk;
    } catch (error) {
      console.error('[AI] TTS error, fallback:', error);
      return false;
    }
  }

  private async speakWithBrowserTTS(text: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      return false;
    }

    const synth = window.speechSynthesis;
    const lipSyncPromise = lipSyncController.speakWithText(text, 65);

    try {
      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(this.preprocessForTTS(text));
        utterance.lang = 'id-ID';
        utterance.rate = this.getBrowserSpeechRate(this.currentEmotion);
        utterance.pitch = this.getBrowserSpeechPitch(this.currentEmotion);
        utterance.volume = 1;

        utterance.onend = () => {
          resolve();
        };

        utterance.onerror = (event) => {
          reject(new Error(`Browser speech error: ${event.error}`));
        };

        synth.cancel();
        synth.speak(utterance);
      });

      await lipSyncPromise;
      return true;
    } catch (error) {
      console.error('[AI] Browser TTS fallback failed:', error);
      return false;
    }
  }

  private async generateAudio(text: string): Promise<string | null> {
    try {
      const processedText = this.preprocessForTTS(text);
      const voiceSettings = this.getVoiceSettingsForEmotion(this.currentEmotion);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey,
          },
          body: JSON.stringify({
            text: processedText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              ...voiceSettings,
              use_speaker_boost: true,
            },
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '(gagal baca body)');
        console.error(`[AI] ElevenLabs HTTP ${response.status}:`, errorBody);
        throw new Error(`ElevenLabs error: ${response.status} - ${errorBody}`);
      }

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        console.warn('[AI] Audio generation timed out');
      } else {
        console.error('[AI] Audio generation failed:', error);
      }
      return null;
    }
  }

  private preprocessForTTS(text: string): string {
    let p = text;

    p = p.replace(/mou~/gi, 'mouu');
    p = p.replace(/nee~/gi, 'nee');
    p = p.replace(/sugoi/gi, 'sugoy');
    p = p.replace(/yatta/gi, 'yattah');
    p = p.replace(/baka/gi, 'bakah');
    p = p.replace(/dame/gi, 'dameh');
    p = p.replace(/kawaii/gi, 'kavai');
    p = p.replace(/gak\b/gi, 'nggak');
    p = p.replace(/\bgimana\b/gi, 'gi mana');
    p = p.replace(/\bbanget\b/gi, 'banged');
    p = p.replace(/\budah\b/gi, 'sudah');
    p = p.replace(/\bkalo\b/gi, 'kalau');
    p = p.replace(/\bgw\b/gi, 'gue');
    p = p.replace(/\blu\b/gi, 'lo');
    p = p.replace(/\bnyebelin\b/gi, 'nye belin');
    p = p.replace(/(?:ha){3,}/gi, 'ha ha ha');
    p = p.replace(/(?:ha){2}/gi, 'ha ha');
    p = p.replace(/hehe+/gi, 'he he');
    p = p.replace(/hihi+/gi, 'hi hi');
    p = p.replace(/wkwk+/gi, 'ha ha');
    p = p.replace(/(?:fu){2,}/gi, 'fu fu');
    p = p.replace(/hm{3,}/gi, 'hmm');
    p = p.replace(/eh{3,}/gi, 'ehh');
    p = p.replace(/ah{3,}/gi, 'ahh');
    p = p.replace(/oh{3,}/gi, 'ohh');
    p = p.replace(/\bish\b/gi, 'issh');
    p = p.replace(/\bheh\b/gi, 'heh');
    p = p.replace(/\bhmph\b/gi, 'humph');
    p = p.replace(/~/g, '');
    p = p.replace(/!{2,}/g, '!');
    p = p.replace(/\?{2,}/g, '?');
    p = p.replace(/\.{3,}/g, '... ');
    p = p.replace(/\b[A-Z]{3,}\b/g, (match) => (
      match.charAt(0) + match.slice(1).toLowerCase()
    ));
    p = p.replace(/\s{2,}/g, ' ').trim();

    return p;
  }

  private getVoiceSettingsForEmotion(emotion: EmotionType): {
    stability: number;
    similarity_boost: number;
    style: number;
  } {
    switch (emotion) {
      case 'happy':
      case 'excited':
        return { stability: 0.3, similarity_boost: 0.7, style: 0.55 };
      case 'angry':
        return { stability: 0.35, similarity_boost: 0.75, style: 0.5 };
      case 'sad':
        return { stability: 0.5, similarity_boost: 0.7, style: 0.35 };
      case 'embarrassed':
        return { stability: 0.3, similarity_boost: 0.65, style: 0.4 };
      case 'sleepy':
        return { stability: 0.55, similarity_boost: 0.7, style: 0.2 };
      case 'surprised':
        return { stability: 0.25, similarity_boost: 0.7, style: 0.6 };
      default:
        return { stability: 0.4, similarity_boost: 0.7, style: 0.35 };
    }
  }

  private getBrowserSpeechRate(emotion: EmotionType): number {
    switch (emotion) {
      case 'excited':
      case 'happy':
        return 1.08;
      case 'angry':
        return 1;
      case 'sad':
      case 'sleepy':
        return 0.92;
      case 'surprised':
        return 1.05;
      default:
        return 0.98;
    }
  }

  private getBrowserSpeechPitch(emotion: EmotionType): number {
    switch (emotion) {
      case 'happy':
      case 'excited':
        return 1.22;
      case 'embarrassed':
        return 1.15;
      case 'sad':
        return 0.96;
      case 'angry':
        return 1.05;
      case 'sleepy':
        return 0.9;
      default:
        return 1.08;
    }
  }

  private splitTextToChunks(text: string): string[] {
    const maxChunkLength = 80;

    if (text.length <= maxChunkLength) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      if (!sentence.trim()) {
        continue;
      }

      if (sentence.length <= maxChunkLength) {
        chunks.push(sentence.trim());
        continue;
      }

      const parts = sentence.split(/(?<=,)\s*/);
      let currentChunk = '';

      for (const part of parts) {
        if ((currentChunk + part).length > maxChunkLength && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = part;
        } else {
          currentChunk += `${currentChunk ? ' ' : ''}${part}`;
        }
      }

      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    }

    return chunks.filter((chunk) => chunk.trim().length > 0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const aiController = new AIController();
