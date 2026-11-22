import React from 'react';
import { Icon } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';

export function Toast({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 text-[13.5px] font-medium text-on-surface shadow-lg rm-fade',
        className
      )}
    >
      <Icon name="check_circle" size={16} className="text-success" />
      <span>{message}</span>
    </div>
  );
}
