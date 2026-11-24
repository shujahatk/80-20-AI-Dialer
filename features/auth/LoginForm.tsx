'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Icon } from '@/lib/ui/icons';

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/dashboard';
  const { login } = useAuth();

  const [email, setEmail] = useState('operator@rmlogistics.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await login({ email, password, rememberMe });

      if (!result.success) {
        setErrorMessage(result.error ?? 'Invalid email or password. Please try again.');
        setIsLoading(false);
        return;
      }

      router.push(redirectTo);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred during sign in.');
      setIsLoading(false);
    }
  };

  return (
    <div className="rm-card w-full p-8">
      {/* Error Message Alert */}
      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-lg bg-error/15 border border-error/30 text-error flex items-center gap-3 text-[14px]">
          <Icon name="error" size={20} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* Email Field */}
        <div>
          <label
            className="block text-[14px] font-semibold text-on-surface mb-1.5"
            htmlFor="email"
          >
            Email Address
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-on-surface-muted flex items-center pointer-events-none">
              <Icon name="mail" size={20} />
            </span>
            <input
              className="w-full bg-surface-elevated text-on-surface placeholder:text-on-surface-muted rounded-lg pl-11 pr-4 py-2.5 text-[15px] border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@rm-group.be"
              required
              type="email"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              className="block text-[14px] font-semibold text-on-surface"
              htmlFor="password"
            >
              Password
            </label>
            <button
              type="button"
              className="text-[13px] text-secondary hover:text-primary font-medium transition-colors"
              onClick={() => setShowForgotNotice((prev) => !prev)}
            >
              Forgot password?
            </button>
          </div>
          {showForgotNotice && (
            <div className="mb-2 p-2.5 rounded-lg bg-surface-secondary border border-border text-xs text-on-surface-variant flex items-center gap-2 animate-in fade-in">
              <Icon name="info" size={16} className="text-primary shrink-0" />
              <span>Please contact your RM Group system administrator to reset credentials.</span>
            </div>
          )}
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-on-surface-muted flex items-center pointer-events-none">
              <Icon name="lock" size={20} />
            </span>
            <input
              className="w-full bg-surface-elevated text-on-surface placeholder:text-on-surface-muted rounded-lg pl-11 pr-11 py-2.5 text-[15px] border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              type={showPassword ? 'text' : 'password'}
            />
            <button
              aria-label="Toggle password visibility"
              className="absolute right-3.5 text-on-surface-muted hover:text-on-surface flex items-center transition-colors"
              id="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              type="button"
            >
              <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-0 cursor-pointer accent-primary"
              type="checkbox"
            />
            <span className="text-[14px] text-on-surface-variant">
              Remember this device
            </span>
          </label>
        </div>

        {/* Action Button */}
        <button
          className={`w-full rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-[15px] font-semibold py-3 px-4 flex items-center justify-center gap-2 transition-colors duration-150 shadow-sm ${
            isLoading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? (
            <>
              <Icon name="progress_activity" size={18} className="animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>
    </div>
  );
};
