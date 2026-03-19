# Aira — Virtual Companion

Aira adalah virtual companion bergaya anime witch yang bisa diajak ngobrol. Ditenagai Claude AI, dilengkapi Live2D model interaktif, ekspresi emosi dinamis, dan suara via ElevenLabs TTS.

## Tech Stack

- **React 19 + TypeScript** — UI framework
- **Vite 8** — build tool
- **PixiJS 7 + pixi-live2d-display** — rendering Live2D model
- **Claude API (claude-sonnet-4)** — AI conversation
- **ElevenLabs API** — text-to-speech
- **Howler.js** — audio playback

## Fitur

- Live2D model dengan fisika dan animasi natural
- Ekspresi emosi otomatis berdasarkan respons AI (`neutral`, `happy`, `sad`, `excited`, `angry`, `surprised`, `embarrassed`, `sleepy`)
- Lip sync sinkron dengan audio TTS atau text fallback
- Percakapan kontekstual dalam bahasa Indonesia casual
- Motion playback berbasis emosi

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Konfigurasi environment

Duplikat `.env.example` menjadi `.env` lalu isi dengan API key kamu:

```bash
cp .env.example .env
```

```env
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key_here
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here   # opsional
VITE_ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id_here # opsional
```

> Tanpa ElevenLabs, Aira tetap bisa berbicara menggunakan text-based lip sync sebagai fallback.

### 3. Tambahkan Live2D model

Letakkan folder model Live2D di:

```
public/models/
```

### 4. Jalankan dev server

```bash
npm run dev
```

### 5. Build untuk production

```bash
npm run build
```

## Struktur Proyek

```
src/
├── components/
│   ├── Live2DCanvas.tsx     # Rendering canvas Live2D
│   ├── ChatInput.tsx        # Input percakapan
│   └── DebugPanel.tsx       # Panel debug (disabled by default)
├── lib/
│   ├── ai-controller.ts     # Integrasi Claude API & orkestrasi respons
│   ├── live2d-manager.ts    # Manajemen model Live2D
│   ├── animation-controller.ts  # Kontrol motion & animasi
│   ├── expression-manager.ts    # Manajemen ekspresi emosi
│   └── lipsync-controller.ts    # Lip sync audio & text
├── config/
│   ├── expressions.ts       # Definisi emosi & keyword mapping
│   └── motions.ts           # Konfigurasi motion
└── types/
    └── live2d.d.ts          # Type definitions Live2D
```

## Catatan

- Model Live2D (`mao_pro_en/`) tidak disertakan di repo karena lisensi aset
- API key tidak boleh di-commit — pastikan `.env` ada di `.gitignore`
