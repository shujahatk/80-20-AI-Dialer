import React from 'react';
import { cn } from '@/lib/utils';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-9 w-full appearance-none rounded-md border border-input-border bg-input px-3 pr-8 text-[13.5px] text-on-surface transition-colors duration-fast ease-rm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);

Select.displayName = 'Select';
