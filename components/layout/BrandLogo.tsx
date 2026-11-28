import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  lightMode?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 28,
  className = '',
  showText = false,
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="relative flex-shrink-0 rounded-lg flex items-center justify-center bg-[#2F5D50] text-[#EEF3F0] border border-[#7EAEA0]/30 font-semibold tracking-tight select-none"
        style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.4)) }}
      >
        <span>RM</span>
      </div>
      {showText && (
        <div className="flex flex-col min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-tight tracking-tight text-sidebar-text">
            RM AI Dialer
          </span>
          <span className="block truncate text-[10px] font-medium tracking-wide text-muted-foreground">
            RM Group CRM
          </span>
        </div>
      )}
    </div>
  );
};
