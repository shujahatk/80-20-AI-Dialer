import React from 'react';
import { Icon } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon = 'folder_open',
  title,
  description,
  action,
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-14 text-center', className)}>
      <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated text-on-surface-muted">
        <Icon name={icon} size={20} />
      </div>
      <h3 className="text-[15px] font-semibold text-on-surface">{title}</h3>
      {description && <p className="max-w-sm text-[13px] text-on-surface-variant">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
