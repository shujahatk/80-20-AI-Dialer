'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/lib/ui/icons';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  widthClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  widthClassName = 'max-w-xl',
  children,
  footer,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 rm-overlay rm-fade"
        onClick={onClose}
      />
      <aside
        className={cn(
          'relative z-10 flex h-full w-full flex-col border-l border-border bg-surface shadow-lg rm-drawer-in duration-slow',
          widthClassName
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <div className="text-[16px] font-semibold tracking-tight text-on-surface">{title}</div>}
            {subtitle && <div className="mt-0.5 text-[13px] text-on-surface-variant">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-fast hover:bg-surface-secondary hover:text-on-surface"
            aria-label="Close"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
      </aside>
    </div>
  );
}
