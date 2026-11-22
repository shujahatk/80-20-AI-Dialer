'use client';

import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/ui/motion';

function parseMetric(value: string | number): { prefix: string; number: number | null; suffix: string } {
  const text = String(value);
  const match = text.match(/^([^\d-]*)(-?\d+(?:,\d{3})*(?:\.\d+)?)(.*)$/);
  if (!match) return { prefix: '', number: null, suffix: text };
  return {
    prefix: match[1],
    number: Number(match[2].replace(/,/g, '')),
    suffix: match[3],
  };
}

export function AnimatedNumber({ value, className }: { value: string | number; className?: string }) {
  const parsed = parseMetric(value);
  const [display, setDisplay] = useState(String(value));
  const previous = useRef<number | null>(null);

  useEffect(() => {
    if (parsed.number === null || prefersReducedMotion()) {
      setDisplay(String(value));
      previous.current = parsed.number;
      return;
    }

    const from = previous.current ?? 0;
    const to = parsed.number;
    previous.current = to;
    const started = performance.now();
    const duration = 420;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      const formatted = Number.isInteger(to) ? String(Math.round(current)) : current.toFixed(1);
      setDisplay(`${parsed.prefix}${formatted}${parsed.suffix}`);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [parsed.number, parsed.prefix, parsed.suffix, value]);

  return <span className={className}>{display}</span>;
}
