import React from 'react';
import { cn } from '@/lib/utils';

export function PageShell({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn('rm-page w-full bg-background text-on-surface', className)}>
      <div className={cn('mx-auto flex w-full flex-col gap-4 px-5 py-5 lg:px-6 lg:py-5', wide ? 'max-w-[1760px]' : 'max-w-[1600px]')}>
        {children}
      </div>
    </div>
  );
}
