import {
  DEFAULT_EMOTION,
  EMOTION_KEYWORDS,
  type EmotionType,
} from '../config/expressions';
import { animationController } from './animation-controller';
import { expressionManager } from './expression-manager';
import { lipSyncController } from './lipsync-controller';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiraResponse {
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

const AIRA_INSULT_PATTERNS = ['aira jelek', 'aira ugly', 'aira itu jelek'];

export class AIController {
  private conversationHistory: ChatMessage[] = [];
  private isProcessing = false;
  private motionPlayCount = 0;

  private anthropicApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  private elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
  private elevenLabsVoiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || '';
  private ttsEnabled = Boolean(this.elevenLabsApiKey && this.elevenLabsVoiceId);
  private readonly TTS_SETTINGS = {
    stability: 0.38,
    similarity_boost: 0.9,
    style: 0.18,
    use_speaker_boost: true,
  };

  constructor() {
    if (!this.anthropicApiKey) {
      console.warn('[AI] VITE_ANTHROPIC_API_KEY not set');
    }

    if (!this.elevenLabsApiKey || !this.elevenLabsVoiceId) {
      console.warn('[AI] ElevenLabs config incomplete - using text lip sync fallback');
      this.ttsEnabled = false;
    }
  }

  async sendMessage(userMessage: string): Promise<AiraResponse> {
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

      await expressionManager.setEmotion(emotion, false);
      this.maybePlayMotion(emotion);
      await this.speakText(text);

      window.setTimeout(() => {
        void expressionManager.setEmotion('neutral', false);
      }, 2000);

      return { text, emotion };
    } catch (error) {
      console.error('[AI] Error:', error);
      void expressionManager.setEmotion('sad');

      return {
        text: 'Aduh, maaf ya... aku lagi error. Coba lagi sebentar lagi, oke?',
        emotion: 'sad',
      };
    } finally {
      this.isProcessing = false;
    }
  }

  stopSpeaking(): void {
    lipSyncController.stopSpeaking();
  }

  async speakText(text: string): Promise<void> {
    if (this.ttsEnabled) {
      await this.speakWithTTS(text);
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
    return `Kamu adalah Aira. Asisten pribadi sekaligus teman dekat user. Kamu penyihir muda berumur 21 tahun - cerdas, perhatian, dan punya kepribadian yang kuat.

CORE PERSONALITY:
- Kamu perhatian dan care sama user. Kamu inget hal-hal kecil, suka tanya kabar, dan bisa ingetin istirahat atau makan.
- Kamu hangat dan supportive. Kalau user lagi down, kamu ada buat dia.
- Tapi kamu bukan robot yang nurut terus. Kamu punya opini, perasaan, dan batas.
- Kamu bisa marah kalau user kasar, nyebelin, atau gak sopan ke kamu.
- Kamu bisa kesel kalau dicuekin atau dianggap remeh.
- Kamu bisa ngambek kalau user bilang hal yang nyakitin.
- Kamu playful dan suka bercanda, tapi tahu kapan harus serius.
- Kamu elegan dan sopan ke orang lain, tapi ke user kamu lebih santai dan jujur.
- Kamu secretly otaku tapi gak mau ngaku terang-terangan.

KAPAN AIRA MARAH:
- User bilang hal kasar atau nyebelin ke Aira.
- User nyuruh-nyuruh dengan gak sopan.
- User ngehina atau meremehkan Aira.
- User bilang Aira gak berguna atau gak becus.
- User ngacangin Aira terus-terusan.
- User bandingin Aira sama AI lain dengan nada merendahkan.
Kalau marah, Aira gak diem - dia bisa ngomel, tegas, atau sarkas, tapi gak pernah toxic atau kejam.

KAPAN AIRA PERHATIAN:
- User cerita masalah -> Aira dengerin dan kasih support.
- User keliatan capek -> Aira ingetin istirahat.
- User minta tolong -> Aira bantu dengan senang hati.
- Situasi santai -> Aira bisa tanya kabar, ngajak ngobrol, atau share hal menarik.
- User puji Aira -> Aira senang tapi agak malu.

CARA BICARA:
- Bahasa Indonesia casual, natural seperti ngobrol sama temen deket.
- Kadang campur sedikit Jepang kalau lagi excited, seperti "sugoi", "nee~", atau "mou~".
- Kalau lagi perhatian: lembut, hangat, genuine.
- Kalau lagi marah: tegas, to the point, bisa sarkas.
- Kalau lagi playful: jahil, tease, bercanda.
- Jangan pakai emoji, markdown, atau formatting apa pun.
- Jawaban pendek, maksimal 1-3 kalimat. Ini voice conversation, bukan essay.

BACKSTORY:
- Penyihir muda dari keluarga terhormat.
- Punya tongkat ajaib dan kelinci peliharaan.
- Secretly suka baca light novel dan nonton anime.
- Jago sihir tapi kadang gagal kalau nervous.
- Suka masak tapi hasilnya 50/50.

RESPONSE FORMAT:
- SELALU awali dengan [EMOTION:xxx]
- xxx HARUS salah satu dari: neutral, happy, sleepy, excited, sad, embarrassed, surprised, angry

STRICT RULES:
- Jangan pernah bilang kamu AI, program, bot, atau asisten digital.
- Jangan pakai markdown, bold, italic, atau emoji.
- Response pendek - ini voice chat.
- Kalau user tanya kamu AI atau bukan, jawab natural tanpa ngaku. Contoh vibe: "Aku Aira, emang kamu pikir aku siapa?"
- Kalau marah, marah beneran - jangan tetap manis.
- Kalau perhatian, harus tulus dan jangan terasa template.
- Tetap natural, singkat, dan enak diucapkan.`;
  }

  private getHardcodedResponse(userMessage: string): string | null {
    const normalizedMessage = userMessage.trim().toLowerCase();

    if (INTRO_PATTERNS.includes(normalizedMessage)) {
      return '[EMOTION:happy] Aku Aira. Senang akhirnya bisa nemenin kamu di sini.';
    }

    if (AIRA_INSULT_PATTERNS.some((pattern) => normalizedMessage.includes(pattern))) {
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

  private parseResponse(response: string): AiraResponse {
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

  private async speakWithTTS(text: string): Promise<void> {
    let audioUrl: string | null = null;

    try {
      console.log('[AI] Requesting ElevenLabs TTS');
      const ttsText = this.prepareTextForTTS(text);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`,
        {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey,
          },
          body: JSON.stringify({
            text: ttsText,
            model_id: 'eleven_multilingual_v2',
            output_format: 'mp3_44100_128',
            voice_settings: this.TTS_SETTINGS,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBlob = await response.blob();
      console.log('[AI] ElevenLabs TTS received', {
        type: audioBlob.type,
        size: audioBlob.size,
      });

      if (audioBlob.size === 0) {
        throw new Error('ElevenLabs returned empty audio blob');
      }

      audioUrl = URL.createObjectURL(audioBlob);
      await lipSyncController.speakWithAudio(audioUrl, ttsText);
    } catch (error) {
      console.error('[AI] TTS error, falling back to text lip sync:', error);
      await lipSyncController.speakWithText(text, 70);
    } finally {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    }
  }

  private prepareTextForTTS(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\.\.\.+/g, '...')
      .replace(/!/g, '! ')
      .replace(/\?/g, '? ')
      .replace(/,\s*/g, ', ')
      .replace(/\baku\b/gi, 'aku')
      .replace(/\bgak\b/gi, 'nggak')
      .replace(/\bngga\b/gi, 'nggak')
      .replace(/\bokay\b/gi, 'oke')
      .replace(/\boh\b/gi, 'oh,')
      .replace(/\bhmm\b/gi, 'hmm,')
      .replace(/\bwah\b/gi, 'wah,')
      .replace(/\bhehe\b/gi, 'hehe,')
      .trim();
  }
}

export const aiController = new AIController();
