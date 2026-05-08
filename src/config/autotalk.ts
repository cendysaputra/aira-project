export const AUTO_TALK_TIMING = {
  initialDelay: 120,
  intervalMin: 120,
  intervalMax: 140,
  afterUserMessageDelay: 120,
  angryIntervalMin: 120,
  angryIntervalMax: 140,
} as const;

export const IGNORED_THRESHOLDS = {
  annoyedAt: 1,
  angryAt: 3,
  maxCount: 5,
} as const;
