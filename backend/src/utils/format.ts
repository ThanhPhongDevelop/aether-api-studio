/** Round a number to a fixed number of decimal places (default 2). */
export function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * URL-friendly slug that also handles Vietnamese diacritics:
 * "Bàn phím Cơ Đỏ" → "ban-phim-co-do".
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Percentage with one decimal, safe when the total is zero. */
export function percentage(part: number, total: number): number {
  return total === 0 ? 0 : roundTo((part / total) * 100, 1);
}
