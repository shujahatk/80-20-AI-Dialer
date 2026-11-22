import React from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-[11px] font-medium text-on-surface opacity-0 shadow-md transition-opacity duration-fast group-hover/tooltip:opacity-100">
        {label}
      </span>
    </span>
  );
}
