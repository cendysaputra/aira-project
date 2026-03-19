# MD-01: Project Setup & Installation

## Overview
Setup project **Aira** — AI Waifu dengan Live2D model menggunakan Vite + React + TypeScript.

## Project Path
```
C:\Users\Cendy Saputra\Desktop\Ruang Artefak\Portfolio\aira-project
```

## Step 1: Initialize Vite + React + TypeScript

```bash
cd "C:\Users\Cendy Saputra\Desktop\Ruang Artefak\Portfolio\aira-project"
npm create vite@latest . -- --template react-ts
```

> Jika folder sudah ada isinya dan Vite nanya, pilih **"Ignore files and continue"**.

## Step 2: Install Core Dependencies

```bash
npm install
```

### Live2D Cubism SDK (Web)
```bash
npm install pixi.js@7.3.2
npm install pixi-live2d-display@0.4.0
```

> **PENTING**: Gunakan pixi.js versi 7.x (BUKAN 8.x). pixi-live2d-display belum support pixi v8.
> pixi-live2d-display sudah include Cubism SDK loader di dalamnya.

### Tambahan yang dibutuhkan nanti (install sekarang sekalian)
```bash
npm install @anthropic-ai/sdk
npm install howler
npm install --save-dev @types/howler
```

## Step 3: Setup Cubism SDK Core

pixi-live2d-display butuh Cubism Core SDK yang harus di-load secara manual.

### Download Cubism SDK
1. Buka https://www.live2d.com/en/sdk/download/web/
2. Download **Cubism SDK for Web**
3. Extract, lalu copy file `live2dcubismcore.min.js` dari folder `Core/`

### Taruh di project
```
aira-project/
├── public/
│   └── lib/
│       └── live2dcubismcore.min.js    ← taruh di sini
```

### Load di index.html
Buka `index.html` di root project, tambahkan script SEBELUM `<script type="module" src="/src/main.tsx">`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aira - AI Waifu</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- Load Cubism Core SEBELUM app -->
    <script src="/lib/live2dcubismcore.min.js"></script>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## Step 4: Setup Folder Structure

Buat folder structure berikut di dalam `src/`:

```
src/
├── main.tsx                    # Entry point
├── App.tsx                     # Root component
├── App.css                     # Global styles
├── vite-env.d.ts               # Vite types
│
├── components/
│   └── Live2DCanvas.tsx        # Komponen canvas Live2D (dibuat di MD-02)
│
├── lib/
│   ├── live2d-manager.ts       # Live2D model loader & manager (dibuat di MD-02)
│   ├── animation-controller.ts # Physics & natural animation (dibuat di MD-03)
│   ├── expression-manager.ts   # Expression & motion system (dibuat di MD-04)
│   ├── lipsync-controller.ts   # Lip sync & voice (dibuat di MD-05)
│   └── ai-controller.ts       # AI integration (dibuat di MD-06)
│
├── config/
│   ├── expressions.ts          # Expression mapping config (dibuat di MD-04)
│   └── motions.ts              # Motion mapping config (dibuat di MD-03)
│
└── types/
    └── live2d.d.ts             # TypeScript declarations
```

Buat folder-folder ini:
```bash
mkdir -p src/components src/lib src/config src/types
```

## Step 5: TypeScript Declaration untuk Live2D

Buat file `src/types/live2d.d.ts`:

```typescript
/// <reference types="pixi.js" />

declare module 'pixi-live2d-display' {
  import * as PIXI from 'pixi.js';

  export class Live2DModel extends PIXI.Sprite {
    static from(source: string | object, options?: any): Promise<Live2DModel>;
    
    // Core
    readonly internalModel: any;
    
    // Motion
    motion(group: string, index?: number, priority?: number): Promise<boolean>;
    
    // Expression
    expression(index?: number | string): Promise<boolean>;
    
    // Lip sync
    readonly lipSync: boolean;
    
    // Hit test
    hitTest(x: number, y: number): string[];
    
    // Update
    update(dt: number): void;
    
    // Destroy
    destroy(options?: any): void;

    // Tap handling
    tap(x: number, y: number): void;

    // Tracker
    readonly tracker: any;
  }

  export class MotionPreloadStrategy {
    static ALL: string;
    static IDLE: string;
    static NONE: string;
  }

  export const MotionPriority: {
    NONE: number;
    IDLE: number;
    NORMAL: number;
    FORCE: number;
  };
}

declare module 'pixi-live2d-display/cubism4' {
  export * from 'pixi-live2d-display';
}
```

## Step 6: Setup Model Files

Model files sudah ada di:
```
C:\Users\Cendy Saputra\Desktop\Ruang Artefak\Portfolio\aira-project\mao_pro_en\
```

Pastikan struktur folder model seperti ini:
```
aira-project/
├── public/
│   └── models/
│       └── mao_pro/
│           ├── mao_pro.model3.json          ← rename dari mao_pro_model3.json
│           ├── mao_pro.moc3                 ← file .moc3 (harus sudah ada)
│           ├── mao_pro.4096/
│           │   └── texture_00.png           ← texture file (harus sudah ada)
│           ├── mao_pro.physics3.json        ← rename dari mao_pro_physics3.json
│           ├── mao_pro.pose3.json           ← rename dari mao_pro_pose3.json
│           ├── mao_pro.cdi3.json            ← rename dari mao_pro_cdi3.json
│           ├── expressions/
│           │   ├── exp_01.exp3.json         ← rename dari exp_01_exp3.json
│           │   ├── exp_02.exp3.json
│           │   ├── exp_03.exp3.json
│           │   ├── exp_04.exp3.json
│           │   ├── exp_05.exp3.json
│           │   ├── exp_06.exp3.json
│           │   ├── exp_07.exp3.json
│           │   └── exp_08.exp3.json
│           └── motions/
│               ├── mtn_01.motion3.json      ← rename dari mtn_01_motion3.json
│               ├── mtn_02.motion3.json
│               ├── mtn_03.motion3.json
│               ├── mtn_04.motion3.json
│               ├── special_01.motion3.json  ← rename dari special_01_motion3.json
│               ├── special_02.motion3.json
│               └── special_03.motion3.json
```

### PENTING tentang rename file:
File JSON di `mao_pro_model3.json` mereferensikan path seperti `expressions/exp_01.exp3.json` dan `motions/mtn_01.motion3.json`. Jadi file HARUS di-rename sesuai referensi di model3.json.

Jalankan script ini untuk copy & rename dari `mao_pro_en/` ke `public/models/mao_pro/`:

```bash
# Sesuaikan jika nama folder sumber berbeda
# Asumsi: file .moc3, texture, dan file lain sudah ada di mao_pro_en/

# Buat folder tujuan
mkdir -p public/models/mao_pro/expressions
mkdir -p public/models/mao_pro/motions
mkdir -p public/models/mao_pro/mao_pro.4096

# Copy & rename model files utama
# (sesuaikan source path kalau beda)
# Model JSON:
# Jika source file bernama mao_pro_model3.json → rename jadi mao_pro.model3.json
# Jika sudah bernama mao_pro.model3.json → langsung copy

# Copy .moc3 dan texture dari folder mao_pro_en (sesuaikan nama file)
# cp mao_pro_en/mao_pro.moc3 public/models/mao_pro/
# cp mao_pro_en/mao_pro.4096/texture_00.png public/models/mao_pro/mao_pro.4096/

# Copy & rename expression files
# cp mao_pro_en/exp_01_exp3.json public/models/mao_pro/expressions/exp_01.exp3.json
# (ulangi untuk exp_02 sampai exp_08)

# Copy & rename motion files
# cp mao_pro_en/mtn_01_motion3.json public/models/mao_pro/motions/mtn_01.motion3.json
# (ulangi untuk mtn_02, mtn_03, mtn_04, special_01, special_02, special_03)

# Copy physics, pose, cdi
# cp mao_pro_en/mao_pro_physics3.json public/models/mao_pro/mao_pro.physics3.json
# cp mao_pro_en/mao_pro_pose3.json public/models/mao_pro/mao_pro.pose3.json
# cp mao_pro_en/mao_pro_cdi3.json public/models/mao_pro/mao_pro.cdi3.json
```

> **Claude Code**: Otomatis detect file yang ada di `mao_pro_en/` dan copy+rename sesuai mapping di atas. Jika ada file .moc3 dan texture yang sudah benar namanya, langsung copy tanpa rename.

## Step 7: Basic App.tsx (Placeholder)

Buat `src/App.tsx`:

```tsx
import './App.css';

function App() {
  return (
    <div className="app">
      <h1>Aira - AI Waifu</h1>
      <p>Live2D Canvas will be here (MD-02)</p>
    </div>
  );
}

export default App;
```

Buat `src/App.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1a1a2e;
}

.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: 'Segoe UI', sans-serif;
}
```

## Step 8: Verify Setup

```bash
npm run dev
```

Buka browser di `http://localhost:5173`. Harus muncul halaman dengan text "Aira - AI Waifu".

## Checklist Sebelum Lanjut ke MD-02
- [ ] `npm run dev` jalan tanpa error
- [ ] Folder `public/models/mao_pro/` sudah berisi semua file model yang benar
- [ ] File `public/lib/live2dcubismcore.min.js` sudah ada
- [ ] Semua file expression & motion sudah di-rename sesuai referensi model3.json
- [ ] Folder structure `src/` sudah sesuai

---

> **Next**: MD-02 — Live2D Model Setup (load model ke canvas & render)
