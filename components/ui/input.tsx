import React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-input-border bg-input px-3 text-[13.5px] text-on-surface placeholder:text-on-surface-muted transition-colors duration-fast ease-rm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
        className
      )}
      {...props}
    />
  )
);

Input.displayName = 'Input';
