import type { DashboardStats } from '@/types/models';

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const longDayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * Bucket labels arrive already in the viewer's local time:
 * "2026-11-06T14:00" for hours, "2026-11-06" for days.
 */
export function bucketTick(bucket: string, unit: DashboardStats['bucket']): string {
  if (unit === 'hour') return bucket.slice(11, 16);
  return dayFormat.format(new Date(`${bucket}T00:00:00`));
}

export function bucketTitle(bucket: string, unit: DashboardStats['bucket']): string {
  if (unit === 'hour') {
    const day = longDayFormat.format(new Date(`${bucket.slice(0, 10)}T00:00:00`));
    return `${day}, ${bucket.slice(11, 16)}`;
  }
  return longDayFormat.format(new Date(`${bucket}T00:00:00`));
}

/** SVG path for a column with a rounded data end (top) and a square baseline. */
export function columnPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (width <= 0 || height <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  if (r <= 0) return `M${x},${y}h${width}v${height}h${-width}Z`;
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

export const STATUS_CLASS_LABEL: Record<string, string> = {
  '2': 'Success',
  '3': 'Redirect',
  '4': 'Client error',
  '5': 'Server error',
};

/** Chart colour token for a status code ("ERR" = no response). */
export function statusChartColor(code: string): string {
  switch (code[0]) {
    case '2':
      return 'var(--chart-ok)';
    case '3':
      return 'var(--chart-redirect)';
    case '4':
      return 'var(--chart-warn)';
    default:
      return 'var(--chart-fail)';
  }
}
