const UNIT_SECONDS = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;

/** "15m" → 900, "7d" → 604800. */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`Invalid duration "${value}" — use a number followed by s, m, h or d`);
  return Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS];
}
