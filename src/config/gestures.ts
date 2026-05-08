export type GestureType =
  | 'nod'
  | 'shake'
  | 'tilt'
  | 'lean_forward'
  | 'lean_back'
  | 'look_away'
  | 'bounce'
  | 'emphasis'
  | 'none';

export interface GestureConfig {
  type: GestureType;
  duration: number;
  keyframes: GestureKeyframe[];
}

export interface GestureKeyframe {
  time: number;
  params: {
    angleX?: number;
    angleY?: number;
    angleZ?: number;
    bodyAngleX?: number;
    bodyAngleY?: number;
    bodyAngleZ?: number;
    eyeBallX?: number;
    eyeBallY?: number;
    browLY?: number;
    browRY?: number;
  };
}

export const GESTURES: Record<GestureType, GestureConfig> = {
  nod: {
    type: 'nod',
    duration: 600,
    keyframes: [
      { time: 0, params: { angleY: 0 } },
      { time: 0.25, params: { angleY: -8 } },
      { time: 0.5, params: { angleY: 3 } },
      { time: 0.75, params: { angleY: -5 } },
      { time: 1, params: { angleY: 0 } },
    ],
  },
  shake: {
    type: 'shake',
    duration: 800,
    keyframes: [
      { time: 0, params: { angleX: 0 } },
      { time: 0.2, params: { angleX: 12 } },
      { time: 0.4, params: { angleX: -12 } },
      { time: 0.6, params: { angleX: 8 } },
      { time: 0.8, params: { angleX: -6 } },
      { time: 1, params: { angleX: 0 } },
    ],
  },
  tilt: {
    type: 'tilt',
    duration: 1000,
    keyframes: [
      { time: 0, params: { angleZ: 0, browLY: 0, browRY: 0 } },
      { time: 0.3, params: { angleZ: 8, browLY: 0.4, browRY: 0.4 } },
      { time: 0.7, params: { angleZ: 8, browLY: 0.4, browRY: 0.4 } },
      { time: 1, params: { angleZ: 0, browLY: 0, browRY: 0 } },
    ],
  },
  lean_forward: {
    type: 'lean_forward',
    duration: 800,
    keyframes: [
      { time: 0, params: { bodyAngleY: 0, angleY: 0 } },
      { time: 0.3, params: { bodyAngleY: -4, angleY: -3 } },
      { time: 0.7, params: { bodyAngleY: -4, angleY: -3 } },
      { time: 1, params: { bodyAngleY: 0, angleY: 0 } },
    ],
  },
  lean_back: {
    type: 'lean_back',
    duration: 700,
    keyframes: [
      { time: 0, params: { bodyAngleY: 0, angleY: 0 } },
      { time: 0.3, params: { bodyAngleY: 5, angleY: 4 } },
      { time: 0.7, params: { bodyAngleY: 5, angleY: 4 } },
      { time: 1, params: { bodyAngleY: 0, angleY: 0 } },
    ],
  },
  look_away: {
    type: 'look_away',
    duration: 1200,
    keyframes: [
      { time: 0, params: { angleX: 0, eyeBallX: 0 } },
      { time: 0.2, params: { angleX: 15, eyeBallX: 0.5 } },
      { time: 0.6, params: { angleX: 15, eyeBallX: 0.3 } },
      { time: 0.8, params: { angleX: 8, eyeBallX: 0.1 } },
      { time: 1, params: { angleX: 0, eyeBallX: 0 } },
    ],
  },
  bounce: {
    type: 'bounce',
    duration: 500,
    keyframes: [
      { time: 0, params: { bodyAngleY: 0 } },
      { time: 0.2, params: { bodyAngleY: -3 } },
      { time: 0.4, params: { bodyAngleY: 2 } },
      { time: 0.6, params: { bodyAngleY: -2 } },
      { time: 0.8, params: { bodyAngleY: 1 } },
      { time: 1, params: { bodyAngleY: 0 } },
    ],
  },
  emphasis: {
    type: 'emphasis',
    duration: 600,
    keyframes: [
      { time: 0, params: { bodyAngleX: 0, angleY: 0 } },
      { time: 0.2, params: { bodyAngleX: 3, angleY: -4 } },
      { time: 0.5, params: { bodyAngleX: 3, angleY: -4 } },
      { time: 1, params: { bodyAngleX: 0, angleY: 0 } },
    ],
  },
  none: {
    type: 'none',
    duration: 0,
    keyframes: [],
  },
};

export const GESTURE_KEYWORDS: { keywords: string[]; gesture: GestureType; priority: number }[] = [
  {
    keywords: ['jangan', 'gak', 'gak boleh', 'nggak', 'enggak', 'bukan', 'salah', 'no', 'dame', 'nope'],
    gesture: 'shake',
    priority: 3,
  },
  {
    keywords: ['iya', 'betul', 'bener', 'setuju', 'yup', 'oke', 'sip', 'tentu', 'pasti', 'yoi'],
    gesture: 'nod',
    priority: 2,
  },
  {
    keywords: ['hmm', 'hah', 'apaan', 'gimana', 'kenapa', 'kok', 'masa', 'bingung', 'aneh'],
    gesture: 'tilt',
    priority: 2,
  },
  {
    keywords: ['malu', 'ih', 'apasih', 'gombal', 'geer', 'baka', 'mou~', 'aduh'],
    gesture: 'look_away',
    priority: 3,
  },
  {
    keywords: ['tidur', 'begadang', 'makan', 'sekarang', 'cepet', 'buruan', 'harus', 'wajib', 'pokoknya'],
    gesture: 'emphasis',
    priority: 4,
  },
  {
    keywords: ['yay', 'yatta', 'sugoi', 'asik', 'keren', 'mantap', 'berhasil', 'yes', 'horee'],
    gesture: 'bounce',
    priority: 2,
  },
  {
    keywords: ['kaget', 'serius', 'beneran', 'astaga', 'ya ampun', 'gila'],
    gesture: 'lean_back',
    priority: 3,
  },
];

export const EMOTION_DEFAULT_GESTURE: Record<string, GestureType> = {
  happy: 'nod',
  excited: 'bounce',
  angry: 'emphasis',
  sad: 'nod',
  embarrassed: 'look_away',
  surprised: 'lean_back',
  sleepy: 'none',
  neutral: 'none',
};
