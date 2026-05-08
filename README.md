# Yuki

Yuki is an anime-styled virtual agent you can have natural conversations with. The project combines an interactive Live2D model, Claude-powered AI, and ElevenLabs voice synthesis into a single conversational experience that feels alive.

Yuki has a consistent personality, reactive facial expressions, and a voice synchronized with real-time lip movements. Every response triggers matching emotion expressions and body animations. Conversations happen in casual Indonesian, feeling more like chatting with a friend than talking to a formal assistant.

## Features

- Live2D model with physics, motion, and natural idle animations
- Dynamic emotion expressions
- Real-time lip sync with TTS audio
- AI conversation with a defined personality via system prompt

## Tech Stack

| Layer            | Technology                              |
| ---------------- | --------------------------------------- |
| UI & Framework   | React 19 + TypeScript                   |
| Build Tool       | Vite 8                                  |
| Live2D Rendering | PixiJS 7 + pixi-live2d-display          |
| AI Conversation  | Anthropic Claude API (claude-sonnet-4)  |
| Text-to-Speech   | ElevenLabs API (eleven_multilingual_v2) |
| Audio Playback   | Howler.js                               |

## Project Structure

```
src/
├── components/
│   ├── Live2DCanvas.tsx         # Live2D model canvas rendering
│   └── ChatInput.tsx            # Chat input & conversation display
├── lib/
│   ├── ai-controller.ts         # Claude API, emotion & TTS orchestration
│   ├── live2d-manager.ts        # Model initialization and management
│   ├── animation-controller.ts  # Motion playback
│   ├── expression-manager.ts    # Emotion expression switching
│   └── lipsync-controller.ts    # Audio & text-based lip sync
└── config/
    ├── expressions.ts           # Emotion to Live2D expression mapping
    └── motions.ts               # Motion config per emotion
```
