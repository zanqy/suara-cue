export function numSec(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 30) : 0;
}

export function clampPct(v: number): number {
  const n = Math.round(v);
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

export function fadeLevel(from: number, to: number, progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return from + (to - from) * p;
}

export function stateText(s: {muted: boolean; active: boolean; fading: 'out'|'in'|null; level: number; left: number; src: string; volume: number}): string {
  if (s.muted) return 'MUTE SEMUA';
  if (!s.active) return 'SIAP';
  if (s.fading === 'out') return `HITUNG MUNDUR ${s.left.toFixed(1)}s`;
  if (s.fading === 'in') return `FADE MASUK ${s.left.toFixed(1)}s`;
  if (s.level <= 0) return 'SUNYI · VOLUME 0%';
  return `ON AIR · ${s.src}`;
}
