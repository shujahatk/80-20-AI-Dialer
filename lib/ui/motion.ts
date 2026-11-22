export const MOTION = {
  fast: 150,
  normal: 220,
  extended: 320,
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
