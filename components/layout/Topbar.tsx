'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Sun, Moon, Menu, PhoneCall, ChevronDown, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useTheme, useThemeMounted } from '@/lib/theme/theme-context';
import { mockCurrentUser } from '@/lib/mock';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsMenu } from './NotificationsMenu';

interface TopbarProps {
  onOpenMobile: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobile }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const themeReady = useThemeMounted();
  const dark = themeReady && resolvedTheme === 'dark';
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const getPageInfo = () => {
    if (pathname.includes('/workstation') || pathname.includes('/dialer')) {
      return { title: 'Workstation', subtitle: 'AI calling console' };
    }
    if (pathname.includes('/leads')) {
      return { title: 'Leads', subtitle: 'Pipeline and contact registry' };
    }
    if (pathname.includes('/campaigns')) {
      return { title: 'Campaigns', subtitle: 'Outbound programs' };
    }
    if (pathname.includes('/calls')) {
      return { title: 'Calls & recordings', subtitle: 'Transcripts and outcomes' };
    }
    if (pathname.includes('/agents')) {
      return { title: 'AI Agents Studio', subtitle: 'Voice, prompts and publishing' };
    }
    if (pathname.includes('/analytics')) {
      return { title: 'Analytics', subtitle: 'Telephony intelligence' };
    }
    if (pathname.includes('/settings')) {
      return { title: 'Settings & gateways', subtitle: 'Providers, appearance and security' };
    }
    return { title: 'Dashboard', subtitle: 'Workspace overview' };
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    window.location.href = '/login';
  };

  const currentUser = user ?? mockCurrentUser;
  const pageInfo = getPageInfo();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-md sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant hover:bg-muted hover:text-on-surface lg:hidden"
          type="button"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden items-center gap-2 text-[13px] font-medium leading-5 sm:flex">
          <span className="text-muted-foreground">Workspace</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate text-foreground" title={pageInfo.subtitle}>{pageInfo.title}</span>
        </div>
        <span className="text-sm font-semibold text-foreground sm:hidden">RM AI Dialer</span>
      </div>

      <div className="mx-4 hidden min-w-0 max-w-md flex-1 items-center md:flex">
        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/workstation"
          className="hidden h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover sm:inline-flex"
        >
          <PhoneCall className="h-3.5 w-3.5" />
          <span>Dial</span>
        </Link>

        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-on-surface-variant transition-colors hover:bg-muted hover:text-on-surface"
          type="button"
          title={`Switch to ${dark ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {dark ? (
            <Sun className="h-4 w-4 text-primary" />
          ) : (
            <Moon className="h-4 w-4 text-on-surface-variant" />
          )}
        </button>

        <NotificationsMenu />

        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex h-8 items-center gap-2 rounded-lg px-1 transition-colors duration-fast hover:bg-muted focus:outline-none"
            type="button"
            aria-expanded={userMenuOpen}
            aria-label="User account menu"
          >
            <div
              className="relative flex-shrink-0 overflow-hidden rounded-full border border-border bg-surface-high"
              style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, maxWidth: 28, maxHeight: 28 }}
            >
              <Image
                alt={currentUser.name}
                src={currentUser.avatarUrl}
                width={28}
                height={28}
                className="h-full w-full rounded-full object-cover"
                priority
              />
            </div>
            <div className="hidden flex-col text-left xl:flex">
              <span className="max-w-[120px] truncate text-[13px] font-medium leading-5 text-on-surface">
                {currentUser.name}
              </span>
              <span className="text-[11px] capitalize leading-4 text-on-surface-muted">{currentUser.role}</span>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-on-surface-variant xl:inline" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-surface p-1 shadow-lg rm-panel">
              <div className="flex flex-col border-b border-border p-3">
                <span className="truncate text-[14px] font-semibold text-on-surface">{currentUser.name}</span>
                <span className="truncate text-[12px] text-on-surface-variant">{currentUser.email}</span>
              </div>

              <div className="flex flex-col py-1">
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded px-3 py-2 text-[14px] text-on-surface transition-colors hover:bg-surface-high"
                >
                  <Settings className="h-4 w-4 text-on-surface-variant" />
                  <span>Settings</span>
                </Link>
                <Link
                  href="/workstation"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded px-3 py-2 text-[14px] text-on-surface transition-colors hover:bg-surface-high"
                >
                  <PhoneCall className="h-4 w-4 text-primary" />
                  <span>Workstation</span>
                </Link>
              </div>

              <div className="border-t border-border pt-1">
                <button
                  onClick={handleLogout}
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-[14px] text-error transition-colors hover:bg-error-surface"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
