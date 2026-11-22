import React from 'react';
import { cn } from '@/lib/utils';
import type { BadgeTone } from '@/lib/ui/status';

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-surface-elevated text-on-surface-variant border-border',
  primary: 'bg-accent-surface text-primary border-primary/20',
  success: 'bg-success-surface text-success border-success/20',
  warning: 'bg-warning-surface text-warning border-warning/20',
  error: 'bg-error-surface text-error border-error/20',
  info: 'bg-info-surface text-info border-info/20',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11.5px] font-semibold capitalize tracking-wide',
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}
