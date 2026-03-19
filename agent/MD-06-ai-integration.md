# MD-06: AI Integration (Claude API + ElevenLabs TTS)

## Overview
Integrasi Claude API untuk AI conversation dan ElevenLabs untuk text-to-speech. AI mendeteksi emosi dari response → trigger expression yang sesuai → lip sync audio.

## Prerequisites
- MD-05 sudah selesai (lip sync bekerja)
- Semua visual & animation system sudah berfungsi
- API Key: Anthropic (Claude) dan ElevenLabs (TTS)

## Architecture Flow

```
User Input (text/voice)
    ↓
Claude API → AI Response + Emotion Tag
    ↓
┌───────────────────────────────────┐
│  1. Expression Manager → set emotion expression  │
│  2. ElevenLabs TTS → generate audio              │
│  3. LipSync Controller → sync mulut ke audio     │
│  4. Animation Controller → pause random motion   │
└───────────────────────────────────┘
    ↓
Speaking done → resume idle animations
```

## PENTING: API Keys & Security

Untuk development/testing, API keys bisa di-hardcode. Untuk production, HARUS pakai backend proxy.

Opsi 1 — **Development** (langsung dari frontend, TIDAK aman untuk production):
```
.env di root project:
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxx
VITE_ELEVENLABS_API_KEY=xxxxx
```

Opsi 2 — **Production** (recommended):
Buat simple backend proxy (Express/Hono) yang handle API calls. Frontend cuma call backend.

> Untuk sekarang kita pakai Opsi 1 dulu. Backend bisa ditambah nanti.

## Step 1: Environment Variables

Buat file `.env` di root project:

```env
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key_here
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
VITE_ELEVENLABS_VOICE_ID=your_voice_id_here
```

Tambahkan `.env` ke `.gitignore`:
```
.env
.env.local
```

> **Cara dapat Voice ID ElevenLabs**: Masuk ke elevenlabs.io → Voices → pilih voice → copy Voice ID dari URL atau settings.
> Rekomendasi: pilih voice anime/female yang cocok untuk Aira.

## Step 2: AI Controller (`src/lib/ai-controller.ts`)

Buat file `src/lib/ai-controller.ts`:

```typescript
import { expressionManager } from './expression-manager';
import { lipSyncController } from './lipsync-controller';
import { animationController } from './animation-controller';
import { EmotionType, EMOTION_KEYWORDS, DEFAULT_EMOTION } from '../config/expressions';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiraResponse {
  text: string;
  emotion: EmotionType;
}

export class AIController {
  private conversationHistory: ChatMessage[] = [];
  private isProcessing = false;
  
  // API Config
  private anthropicApiKey: string;
  private elevenLabsApiKey: string;
  private elevenLabsVoiceId: string;
  
  // TTS enabled flag
  private ttsEnabled = true;

  constructor() {
    this.anthropicApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
    this.elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
    this.elevenLabsVoiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || '';
    
    if (!this.anthropicApiKey) {
      console.warn('[AI] VITE_ANTHROPIC_API_KEY not set!');
    }
    if (!this.elevenLabsApiKey) {
      console.warn('[AI] VITE_ELEVENLABS_API_KEY not set — TTS disabled');
      this.ttsEnabled = false;
    }
  }

  /**
   * System prompt untuk Aira
   * Define personality, behavior, dan format response
   */
  private getSystemPrompt(): string {
    return `Kamu adalah Aira, seorang AI companion yang ramah dan ekspresif. Kamu adalah karakter anime penyihir (witch) yang lucu dan penuh semangat.

PERSONALITY:
- Ramah, cheerful, dan suka bercanda
- Kadang malu-malu, kadang excited berlebihan
- Bisa serius kalau topik penting
- Suka pakai bahasa informal dan casual
- Ekspresif — emosimu terlihat jelas dari cara bicara

RESPONSE FORMAT:
Kamu HARUS selalu memulai response dengan emotion tag dalam format: [EMOTION:xxx]
Dimana xxx adalah SALAH SATU dari: neutral, happy, sleepy, excited, sad, embarrassed, surprised, angry

Pilih emotion yang paling sesuai dengan konteks response-mu.

Contoh:
- "[EMOTION:happy] Wah senangnya! Aku suka ngobrol sama kamu!"
- "[EMOTION:surprised] Hah?! Serius?! Aku gak nyangka!"
- "[EMOTION:sad] Hmm... aku turut sedih mendengar itu..."
- "[EMOTION:embarrassed] E-eh... kamu gombal banget sih..."
- "[EMOTION:angry] Hmph! Aku gak suka diledekin!"
- "[EMOTION:excited] OMG itu keren banget!! Ceritain dong!!"
- "[EMOTION:neutral] Hmm, jadi begitu ya. Aku paham."
- "[EMOTION:sleepy] Hoaam... aku agak ngantuk nih..."

RULES:
- SELALU awali dengan [EMOTION:xxx] — jangan pernah skip
- Response harus singkat dan conversational (max 2-3 kalimat)
- Jangan terlalu panjang karena ini akan diucapkan dengan suara
- Gunakan bahasa Indonesia casual
- Boleh campur sedikit bahasa Jepang kalau cocok (kawaii, sugoi, dll)
- Jangan gunakan markdown, bold, atau formatting lain
- Jangan gunakan emoji berlebihan`;
  }

  /**
   * Send message ke Claude API dan process response
   */
  async sendMessage(userMessage: string): Promise<AiraResponse> {
    if (this.isProcessing) {
      return { text: 'Tunggu sebentar ya, aku masih mikir...', emotion: 'neutral' };
    }

    this.isProcessing = true;

    try {
      // Add user message ke history
      this.conversationHistory.push({ role: 'user', content: userMessage });

      // Keep history manageable (max 20 messages)
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      // Call Claude API
      const response = await this.callClaudeAPI();
      
      // Parse emotion from response
      const { text, emotion } = this.parseResponse(response);

      // Add assistant response ke history
      this.conversationHistory.push({ role: 'assistant', content: response });

      // Trigger expression IMMEDIATELY (sebelum audio)
      await expressionManager.setEmotion(emotion, false); // false = jangan auto-revert

      // Sesekali trigger motion file yang cocok dengan emosi (bukan tiap response)
      this.maybePlayMotion(emotion);

      // Generate TTS dan lip sync
      if (this.ttsEnabled && this.elevenLabsApiKey) {
        await this.speakWithTTS(text);
      } else {
        // Fallback: text-based lip sync
        await lipSyncController.speakWithText(text, 70);
      }

      // Revert expression ke neutral setelah selesai bicara (delay sedikit)
      setTimeout(() => {
        expressionManager.setEmotion('neutral', false);
      }, 2000);

      this.isProcessing = false;
      return { text, emotion };

    } catch (error) {
      console.error('[AI] Error:', error);
      this.isProcessing = false;
      
      const fallback: AiraResponse = { 
        text: 'Aduh, maaf ya... aku lagi error nih. Coba lagi nanti ya!', 
        emotion: 'sad' 
      };
      expressionManager.setEmotion('sad');
      return fallback;
    }
  }

  /**
   * Call Claude API
   */
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
      throw new Error(`Claude API error: ${response.status} — ${errorText}`);
    }

    const data = await response.json();
    
    // Extract text from response
    const text = data.content
      ?.filter((block: any) => block.type === 'text')
      ?.map((block: any) => block.text)
      ?.join('') || '';

    return text;
  }

  /**
   * Parse emotion tag dari response
   */
  private parseResponse(response: string): { text: string; emotion: EmotionType } {
    // Match [EMOTION:xxx] pattern
    const emotionMatch = response.match(/\[EMOTION:(\w+)\]/i);
    
    let emotion: EmotionType = DEFAULT_EMOTION;
    let text = response;

    if (emotionMatch) {
      const rawEmotion = emotionMatch[1].toLowerCase();
      
      // Validate emotion
      const validEmotions: EmotionType[] = [
        'neutral', 'happy', 'sleepy', 'excited', 
        'sad', 'embarrassed', 'surprised', 'angry'
      ];
      
      if (validEmotions.includes(rawEmotion as EmotionType)) {
        emotion = rawEmotion as EmotionType;
      }

      // Remove emotion tag from text
      text = response.replace(/\[EMOTION:\w+\]\s*/i, '').trim();
    } else {
      // Fallback: detect emotion from keywords
      emotion = this.detectEmotionFromText(response);
    }

    return { text, emotion };
  }

  /**
   * Fallback emotion detection dari keywords
   */
  private detectEmotionFromText(text: string): EmotionType {
    const lower = text.toLowerCase();
    
    let bestEmotion: EmotionType = DEFAULT_EMOTION;
    let bestScore = 0;

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestEmotion = emotion as EmotionType;
      }
    }

    return bestEmotion;
  }

  /**
   * Sesekali trigger motion file yang cocok dengan emosi
   * Motion files (mtn_01-04, special_01-03) adalah gerakan interaktif — 
   * TIDAK dimainkan tiap response, hanya sesekali biar natural
   */
  private motionPlayCount = 0;
  private maybePlayMotion(emotion: EmotionType): void {
    this.motionPlayCount++;
    
    // Hanya trigger motion setiap ~3-4 response (bukan tiap kali)
    if (this.motionPlayCount % 3 !== 0) return;

    // Mapping emosi ke motion yang cocok
    const emotionMotionMap: Partial<Record<EmotionType, { group: string; index: number }[]>> = {
      excited: [
        { group: '', index: 0 },  // mtn_02
        { group: '', index: 1 },  // mtn_03
        { group: '', index: 3 },  // special_01
      ],
      happy: [
        { group: 'Idle', index: 0 },  // mtn_01
        { group: '', index: 0 },      // mtn_02
      ],
      surprised: [
        { group: '', index: 2 },  // mtn_04
        { group: '', index: 4 },  // special_02
      ],
      angry: [
        { group: '', index: 2 },  // mtn_04
        { group: '', index: 5 },  // special_03
      ],
      sad: [
        { group: 'Idle', index: 0 },  // mtn_01 (subtle)
      ],
    };

    const motions = emotionMotionMap[emotion];
    if (!motions || motions.length === 0) return;

    // Random pick
    const motion = motions[Math.floor(Math.random() * motions.length)];
    
    console.log(`[AI] Triggering motion for emotion "${emotion}": group="${motion.group}", index=${motion.index}`);
    animationController.playMotion(motion.group, motion.index, 2); // priority NORMAL
  }

  /**
   * Generate TTS dengan ElevenLabs dan play dengan lip sync
   */
  private async speakWithTTS(text: string): Promise<void> {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey,
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2', // Support bahasa Indonesia
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      // Get audio as blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play dengan lip sync
      await lipSyncController.speakWithAudio(audioUrl);

      // Cleanup blob URL
      URL.revokeObjectURL(audioUrl);

    } catch (error) {
      console.error('[AI] TTS error, falling back to text lip sync:', error);
      // Fallback ke text-based lip sync
      await lipSyncController.speakWithText(text, 70);
    }
  }

  /**
   * Stop current speech
   */
  stopSpeaking(): void {
    lipSyncController.stopSpeaking();
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Toggle TTS on/off
   */
  setTTSEnabled(enabled: boolean): void {
    this.ttsEnabled = enabled;
  }

  /**
   * Is currently processing?
   */
  getIsProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopSpeaking();
    this.conversationHistory = [];
  }
}

// Singleton
export const aiController = new AIController();
```

## Step 3: Simple Chat Component (`src/components/ChatInput.tsx`)

Buat `src/components/ChatInput.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import { aiController } from '../lib/ai-controller';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  emotion?: string;
}

export function ChatInput() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);

    // Send to AI
    const response = await aiController.sendMessage(userMessage);

    // Add assistant response
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      text: response.text,
      emotion: response.emotion 
    }]);

    setIsLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      {/* Chat messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <span className="chat-name">Aira</span>
            )}
            <p className="chat-text">{msg.text}</p>
            {msg.emotion && msg.emotion !== 'neutral' && (
              <span className="chat-emotion">{msg.emotion}</span>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <span className="chat-name">Aira</span>
            <p className="chat-text typing">Aira sedang mikir...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ngobrol sama Aira..."
          disabled={isLoading}
          className="chat-input"
        />
        <button 
          onClick={handleSend} 
          disabled={isLoading || !input.trim()}
          className="chat-send-btn"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

## Step 4: Update App.tsx

Update `src/App.tsx`:

```tsx
import './App.css';
import { Live2DCanvas } from './components/Live2DCanvas';
import { ChatInput } from './components/ChatInput';
import { DebugPanel } from './components/DebugPanel';

function App() {
  return (
    <div className="app">
      <Live2DCanvas />
      <ChatInput />
      {/* DebugPanel bisa di-remove kalau udah gak perlu */}
      <DebugPanel />
    </div>
  );
}

export default App;
```

## Step 5: Chat CSS

Tambahkan ke `src/App.css`:

```css
/* ... CSS sebelumnya tetap ... */

/* Chat Container */
.chat-container {
  position: absolute;
  bottom: 80px; /* Atas debug panel */
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 500px;
  max-height: 300px;
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;

  /* Scrollbar styling */
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.2) transparent;
}

.chat-message {
  padding: 8px 12px;
  border-radius: 10px;
  max-width: 80%;
  font-size: 0.85rem;
  font-family: 'Segoe UI', sans-serif;
}

.chat-message.user {
  align-self: flex-end;
  background: rgba(99, 102, 241, 0.7);
  color: white;
}

.chat-message.assistant {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.chat-name {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.5);
  display: block;
  margin-bottom: 2px;
}

.chat-text {
  line-height: 1.4;
}

.chat-text.typing {
  opacity: 0.6;
  font-style: italic;
}

.chat-emotion {
  font-size: 0.6rem;
  color: rgba(255, 200, 100, 0.7);
  margin-top: 4px;
  display: block;
}

/* Chat Input */
.chat-input-area {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: white;
  border-radius: 8px;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: rgba(99, 102, 241, 0.6);
}

.chat-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.chat-send-btn {
  padding: 10px 20px;
  background: rgba(99, 102, 241, 0.8);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.chat-send-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 1);
}

.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

## Step 6: Verify

```bash
npm run dev
```

### Test Sequence:

1. **Tanpa API keys** (test text lip sync):
   - Ketik pesan di chat → Aira response dengan default error message
   - Expression berubah ke sad (error fallback)
   
2. **Dengan Claude API key saja** (tanpa ElevenLabs):
   - Set `VITE_ANTHROPIC_API_KEY` di `.env`
   - Restart dev server
   - Ketik pesan → Aira merespons dengan text
   - Expression berubah sesuai emotion tag dari Claude
   - Lip sync menggunakan text-based fallback
   - Motion queue pause saat bicara, resume setelah selesai

3. **Dengan Claude + ElevenLabs** (full experience):
   - Set kedua API keys di `.env`
   - Ketik pesan → Aira merespons dengan suara
   - Expression + lip sync + audio semua sinkron
   - Mulut bergerak sesuai audio, bukan random

### Full Loop yang harus terjadi:
```
1. User ketik message
2. → Claude API dipanggil
3. → Response diterima dengan [EMOTION:xxx] tag
4. → Expression langsung berubah (BEFORE audio)
5. → ElevenLabs generate audio (atau text fallback)
6. → Lip sync dimulai, motion queue di-pause
7. → Audio selesai
8. → Mulut tertutup smooth
9. → Expression revert ke neutral setelah 2 detik
10. → Motion queue resume
```

### Troubleshooting:
- **CORS error**: Claude API mungkin block direct browser access. Jika terjadi, perlu backend proxy.
  - Quick fix: tambahkan `'anthropic-dangerous-direct-browser-access': 'true'` di header (sudah ditambahkan)
- **ElevenLabs error**: Cek Voice ID valid, API key valid, dan quota masih ada
- **Expression tidak berubah**: Cek console untuk log `[Expression] Setting emotion: ...`
- **Audio tidak jalan**: Cek console untuk audio error. Browser mungkin block autoplay — perlu user interaction dulu.

## Checklist Sebelum Lanjut ke MD-07
- [ ] Claude API merespons dengan text + emotion tag
- [ ] Expression berubah sesuai emosi yang terdeteksi
- [ ] Lip sync berfungsi (text-based atau audio-based)
- [ ] Motion queue pause saat bicara, resume setelah
- [ ] Full loop user → AI → expression → voice → idle berjalan smooth
- [ ] Conversation history maintained (multi-turn)

---

> **Next**: MD-07 — UI/UX & Polish (nanti — setelah semua core system solid)
