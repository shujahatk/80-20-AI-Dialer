'use client';

import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-xs',
  secondary: 'bg-surface-elevated text-on-surface border border-border hover:bg-surface-secondary',
  ghost: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-secondary',
  danger: 'bg-error/12 text-error border border-error/20 hover:bg-error/18',
  outline: 'bg-transparent text-on-surface border border-border hover:bg-surface-elevated',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5',
  md: 'h-9 px-3.5 text-[13px] gap-1.5',
  lg: 'h-10 px-4 text-[14px] gap-2',
  icon: 'h-9 w-9 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-semibold transition-all duration-fast ease-rm active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none',
          variantClass[variant],
          sizeClass[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
