import React from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/LoginForm';
import { BrandLogo } from '@/components/layout/BrandLogo';

export const metadata: Metadata = {
  title: 'Sign In — RM AI Dialer',
  description: 'Corporate dialer portal for RM Group operations and logistics.',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background text-on-surface flex flex-col justify-center items-center p-6 relative">
      <div className="w-full max-w-md mx-auto flex flex-col items-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4">
            <BrandLogo size={48} />
          </div>

          <h1 className="text-[22px] font-bold text-on-surface tracking-tight mb-1.5">
            RM AI Dialer
          </h1>
          <p className="text-[14px] text-on-surface-variant max-w-xs">
            Operational outbound calling system for RM Group
          </p>
        </div>

        {/* Login Card */}
        <React.Suspense
          fallback={
            <div className="w-full h-72 rounded-xl bg-surface border border-border flex items-center justify-center text-on-surface-variant text-[14px]">
              Loading sign in...
            </div>
          }
        >
          <LoginForm />
        </React.Suspense>

        {/* Footer info */}
        <div className="mt-8 text-center text-[13px] text-on-surface-muted">
          RM Group • Recycling & Raw Materials Management
        </div>
      </div>
    </main>
  );
}
