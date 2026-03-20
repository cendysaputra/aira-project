/**
 * Auto Talk Configuration
 * Aira bicara sendiri secara random - timing dan escalation saja yang kita atur.
 */
export const AUTO_TALK_TIMING = {
  /** Delay pertama kali Aira nyapa setelah app load (detik) */
  initialDelay: 120,

  /** Interval random antar auto talk normal (detik) */
  intervalMin: 120,
  intervalMax: 140,

  /** Setelah user bicara, tunggu sedikit lebih lama sebelum auto talk lagi (detik) */
  afterUserMessageDelay: 120,

  /** Saat sudah ngambek, Aira lebih cepat ngomong lagi (detik) */
  angryIntervalMin: 120,
  angryIntervalMax: 140,
} as const;

export const IGNORED_THRESHOLDS = {
  /** Setelah berapa kali dicuekin mulai annoyed */
  annoyedAt: 1,
  /** Setelah berapa kali dicuekin masuk mode marah */
  angryAt: 3,
  /** Batas maksimum ignored counter */
  maxCount: 5,
} as const;
