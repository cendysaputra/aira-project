export type EmotionType =
  | 'neutral'
  | 'happy'
  | 'sleepy'
  | 'excited'
  | 'sad'
  | 'embarrassed'
  | 'surprised'
  | 'angry';

export interface ExpressionConfig {
  expressionIndex: number;
  emotion: EmotionType;
  label: string;
  compatibleMotions: { group: string; index: number }[];
  minDuration: number;
  priority: number;
}

export interface EmotionMotionProfile {
  head: number;
  body: number;
  breath: number;
  brow: number;
  eyeLook: number;
  overall: number;
  arm: number;
  forceClosedEyes?: boolean;
}

export const EXPRESSION_MAP: Record<EmotionType, ExpressionConfig> = {
  neutral: {
    expressionIndex: 0,
    emotion: 'neutral',
    label: 'Neutral',
    compatibleMotions: [
      { group: 'Idle', index: 0 },
      { group: '', index: 0 },
      { group: '', index: 1 },
      { group: '', index: 2 },
    ],
    minDuration: 1000,
    priority: 1,
  },
  happy: {
    expressionIndex: 1,
    emotion: 'happy',
    label: 'Happy / Smile',
    compatibleMotions: [
      { group: 'Idle', index: 0 },
      { group: '', index: 0 },
      { group: '', index: 1 },
    ],
    minDuration: 2000,
    priority: 3,
  },
  sleepy: {
    expressionIndex: 2,
    emotion: 'sleepy',
    label: 'Sleepy / Relaxed',
    compatibleMotions: [{ group: 'Idle', index: 0 }],
    minDuration: 3000,
    priority: 2,
  },
  excited: {
    expressionIndex: 3,
    emotion: 'excited',
    label: 'Excited / Sparkle',
    compatibleMotions: [
      { group: '', index: 0 },
      { group: '', index: 1 },
      { group: '', index: 2 },
      { group: '', index: 3 },
    ],
    minDuration: 2000,
    priority: 4,
  },
  sad: {
    expressionIndex: 4,
    emotion: 'sad',
    label: 'Sad / Upset',
    compatibleMotions: [
      { group: 'Idle', index: 0 },
      { group: '', index: 1 },
    ],
    minDuration: 2500,
    priority: 3,
  },
  embarrassed: {
    expressionIndex: 5,
    emotion: 'embarrassed',
    label: 'Embarrassed / Shy',
    compatibleMotions: [
      { group: 'Idle', index: 0 },
      { group: '', index: 0 },
      { group: '', index: 2 },
    ],
    minDuration: 2000,
    priority: 3,
  },
  surprised: {
    expressionIndex: 6,
    emotion: 'surprised',
    label: 'Surprised / Shocked',
    compatibleMotions: [
      { group: '', index: 0 },
      { group: '', index: 2 },
      { group: '', index: 4 },
    ],
    minDuration: 1500,
    priority: 5,
  },
  angry: {
    expressionIndex: 7,
    emotion: 'angry',
    label: 'Angry / Irritated',
    compatibleMotions: [
      { group: '', index: 2 },
      { group: '', index: 5 },
    ],
    minDuration: 2000,
    priority: 4,
  },
};

export const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  neutral: [],
  happy: [
    'senang',
    'suka',
    'love',
    'hehe',
    'haha',
    'yay',
    'asyik',
    'bagus',
    'keren',
    'mantap',
    'nice',
    'great',
    'awesome',
    'senyum',
    'tertawa',
    'gembira',
    'bahagia',
    'horee',
    'wah',
    'yeay',
  ],
  sleepy: ['ngantuk', 'capek', 'lelah', 'tidur', 'bosan', 'males', 'hoam', 'zzz', 'sleepy', 'tired'],
  excited: [
    'wow',
    'gila',
    'anjir',
    'sial keren',
    'amazing',
    'luar biasa',
    'excited',
    'semangat',
    'antusias',
    'epic',
    'bangga',
    'berhasil',
    'sukses',
    '!!',
    'omg',
  ],
  sad: [
    'sedih',
    'kecewa',
    'gagal',
    'maaf',
    'sorry',
    'menyesal',
    'sakit',
    'nangis',
    'huhu',
    'hiks',
    'kasian',
    'malang',
  ],
  embarrassed: [
    'malu',
    'blush',
    'ehehe',
    'aduh',
    'duh',
    'shy',
    'embarrass',
    'gombal',
    'flirt',
    'geer',
    'ge-er',
    'ah masa',
  ],
  surprised: [
    'kaget',
    'shock',
    'serius',
    'beneran',
    'masa',
    'hah',
    'surprise',
    'gak nyangka',
    'tiba-tiba',
    'mendadak',
    'what',
    'eh',
    'astaga',
    'ya ampun',
  ],
  angry: [
    'marah',
    'kesal',
    'bete',
    'jelek',
    'ugly',
    'hina',
    'ngatain',
    'nyebelin',
    'norak',
    'bodoh',
    'tolol',
    'annoying',
    'sinis',
    'geram',
    'bangsat',
    'kampret',
    'jengkel',
    'sebal',
    'dongkol',
    'hmph',
  ],
};

export const DEFAULT_EMOTION: EmotionType = 'neutral';
export const EXPRESSION_AUTO_REVERT_MS = 8000;

export const EXPRESSION_AUTO_REVERT_MS_BY_EMOTION: Partial<Record<EmotionType, number>> = {
  angry: 15000,
};

export const EMOTION_MOTION_PROFILE: Record<EmotionType, EmotionMotionProfile> = {
  neutral: {
    head: 1,
    body: 1,
    breath: 1,
    brow: 1,
    eyeLook: 1,
    overall: 1,
    arm: 0.8,
  },
  happy: {
    head: 1.18,
    body: 1.08,
    breath: 1.06,
    brow: 1.2,
    eyeLook: 0.2,
    overall: 1.04,
    arm: 1.15,
    forceClosedEyes: true,
  },
  sleepy: {
    head: 0.55,
    body: 0.7,
    breath: 0.92,
    brow: 0.55,
    eyeLook: 0.05,
    overall: 0.8,
    arm: 0.25,
    forceClosedEyes: true,
  },
  excited: {
    head: 1.3,
    body: 1.15,
    breath: 1.12,
    brow: 1.3,
    eyeLook: 1.25,
    overall: 1.15,
    arm: 1.25,
  },
  sad: {
    head: 0.72,
    body: 0.82,
    breath: 0.95,
    brow: 0.75,
    eyeLook: 0.45,
    overall: 0.78,
    arm: 0.35,
  },
  embarrassed: {
    head: 0.95,
    body: 0.78,
    breath: 1.05,
    brow: 0.9,
    eyeLook: 0.35,
    overall: 0.76,
    arm: 0.4,
  },
  surprised: {
    head: 1.45,
    body: 0.92,
    breath: 1.08,
    brow: 1.4,
    eyeLook: 0.12,
    overall: 1.02,
    arm: 0.65,
  },
  angry: {
    head: 0.85,
    body: 1.22,
    breath: 1.14,
    brow: 1.35,
    eyeLook: 0.3,
    overall: 0.92,
    arm: 0.9,
  },
};
