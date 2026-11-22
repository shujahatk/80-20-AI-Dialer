import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  lightMode?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 32,
  className = '',
  showText = false,
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="relative flex-shrink-0 rounded-xl flex items-center justify-center bg-primary font-bold tracking-tight text-on-primary shadow-sm select-none"
        style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.42)) }}
      >
        <span>RM</span>
      </div>
      {showText && (
        <div className="flex flex-col min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight tracking-tight text-sidebar-text">
            RM AI Dialer
          </span>
          <span className="block truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            RM Group
          </span>
        </div>
      )}
    </div>
  );
};
