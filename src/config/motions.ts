/**
 * Natural idle animation config.
 * Semua gerakan di sini procedural, bukan dari motion JSON files.
 */

export const BREATHING = {
  speed: 0.0025,
  amplitude: 0.6,
  offset: 0.4,
};

export const HEAD_MOTION = {
  angleX: {
    amplitude: 6,
    speed1: 0.0008,
    speed2: 0.0013,
    speed3: 0.0005,
  },
  angleY: {
    amplitude: 4,
    speed1: 0.0006,
    speed2: 0.001,
    speed3: 0.0004,
  },
  angleZ: {
    amplitude: 3,
    speed1: 0.0005,
    speed2: 0.0009,
    speed3: 0.0003,
  },
};

export const BODY_SWAY = {
  angleX: {
    amplitude: 2.5,
    speed1: 0.0004,
    speed2: 0.0007,
  },
  angleY: {
    amplitude: 1.5,
    speed1: 0.0003,
    speed2: 0.0006,
  },
  angleZ: {
    amplitude: 1.5,
    speed1: 0.0003,
    speed2: 0.0005,
  },
};

export const EYE_LOOK = {
  rangeX: 0.5,
  rangeY: 0.3,
  holdMin: 2000,
  holdMax: 5000,
  transitionSpeed: 0.04,
  centerChance: 0.35,
};

export const BROW_MOTION = {
  amplitude: 0.15,
  speed1: 0.0004,
  speed2: 0.0007,
};

export const OVERALL_SWAY = {
  x: {
    amplitude: 0.008,
    speed: 0.0003,
  },
  y: {
    amplitude: 0.006,
    speed: 0.0005,
  },
  rotate: {
    amplitude: 0.5,
    speed: 0.0002,
  },
};

export interface MotionTriggerConfig {
  group: string;
  index: number;
  label: string;
  category: 'idle' | 'general' | 'special';
}

export const MOTION_TRIGGERS: MotionTriggerConfig[] = [
  { group: 'Idle', index: 0, label: 'mtn_01 (idle pose)', category: 'idle' },
  { group: '', index: 0, label: 'mtn_02 (gesture 1)', category: 'general' },
  { group: '', index: 1, label: 'mtn_03 (gesture 2)', category: 'general' },
  { group: '', index: 2, label: 'mtn_04 (gesture 3)', category: 'general' },
  { group: '', index: 3, label: 'special_01 (special pose)', category: 'special' },
  { group: '', index: 4, label: 'special_02 (special pose)', category: 'special' },
  { group: '', index: 5, label: 'special_03 (special pose)', category: 'special' },
];
