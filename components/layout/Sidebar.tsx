'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTheme, useThemeMounted } from '@/lib/theme/theme-context';
import { BrandLogo } from './BrandLogo';
import { ProviderStatusMenu } from './ProviderStatusMenu';
import { useAuth } from '@/lib/auth/auth-context';
import { mockCurrentUser } from '@/lib/mock';
import type { UserRole } from '@/types';
import {
  LayoutDashboard,
  PhoneCall,
  Headset,
  Users,
  Megaphone,
  PhoneForwarded,
  ArrowRightLeft,
  Grid3x3,
  Upload,
  BadgeCheck,
  CalendarClock,
  PhoneOff,
  History,
  BarChart3,
  Bot,
  SlidersHorizontal,
  Activity,
  MoreHorizontal,
  ChevronDown,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  LogOut,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';

export interface SubNavItem {
  name: string;
  href: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'primary';
}

export interface SidebarNavItem {
  id: string;
  name: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'primary' | 'live';
  allowedRoles: UserRole[];
  subItems?: SubNavItem[];
  isProminent?: boolean;
}

export interface SidebarSection {
  id: string;
  title: string;
  allowedRoles?: UserRole[];
  items: SidebarNavItem[];
}

const workstationRoles: UserRole[] = ['admin', 'manager', 'operator', 'sdr'];
const leadRoles: UserRole[] = ['admin', 'manager', 'operator', 'sdr'];

/**
 * 6 Essential Main Modules kept prominently visible in the sidebar
 */
export const mainNavItems: SidebarNavItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    subtitle: 'Operational overview',
    href: '/dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['admin', 'manager', 'executive', 'viewer'],
  },
  {
    id: 'workstation',
    name: 'Workstation',
    subtitle: 'Call & lead workspace',
    href: '/workstation',
    icon: PhoneCall,
    isProminent: true,
    allowedRoles: workstationRoles,
  },
  {
    id: 'active-call',
    name: 'Active Call Console',
    subtitle: 'Live calling console',
    href: '/workstation?tab=console',
    icon: Headset,
    allowedRoles: workstationRoles,
  },
  {
    id: 'leads',
    name: 'Leads',
    subtitle: 'Contacts and pipeline',
    href: '/leads',
    icon: Users,
    allowedRoles: leadRoles,
  },
  {
    id: 'campaigns',
    name: 'Campaigns',
    subtitle: 'Outbound calling programs',
    href: '/campaigns',
    icon: Megaphone,
    allowedRoles: ['admin', 'manager', 'executive'],
  },
  {
    id: 'callback-queue',
    name: 'Callback Queue',
    subtitle: 'Scheduled callbacks',
    href: '/workstation?tab=callbacks',
    icon: PhoneForwarded,
    allowedRoles: workstationRoles,
  },
];

/**
 * Secondary and administrative modules moved into the collapsible More section
 */
export const moreNavItems: SidebarNavItem[] = [
  {
    id: 'handoff-queue',
    name: 'Handoff Queue',
    subtitle: 'Calls ready for handoff',
    href: '/workstation?tab=handoffs',
    icon: ArrowRightLeft,
    allowedRoles: workstationRoles,
  },
  {
    id: 'manual-dialpad',
    name: 'Manual Dialpad',
    subtitle: 'Place a manual call',
    href: '/workstation?action=dial',
    icon: Grid3x3,
    allowedRoles: workstationRoles,
  },
  {
    id: 'import-csv',
    name: 'Import CSV',
    subtitle: 'Import contacts',
    href: '/leads?action=import',
    icon: Upload,
    allowedRoles: leadRoles,
  },
  {
    id: 'qualified-pipeline',
    name: 'Qualified Pipeline',
    subtitle: 'Qualified contacts',
    href: '/leads?status=qualified',
    icon: BadgeCheck,
    allowedRoles: leadRoles,
  },
  {
    id: 'scheduled-callbacks',
    name: 'Scheduled Callbacks',
    subtitle: 'Leads waiting on a callback',
    href: '/leads?status=callback',
    icon: CalendarClock,
    allowedRoles: leadRoles,
  },
  {
    id: 'dnc-search',
    name: 'DNC Search List',
    subtitle: 'Do not call records',
    href: '/leads?status=dnc',
    icon: PhoneOff,
    allowedRoles: leadRoles,
  },
  {
    id: 'calls',
    name: 'Calls & Recordings',
    subtitle: 'Transcripts and outcomes',
    href: '/calls',
    icon: History,
    allowedRoles: ['admin', 'manager', 'operator', 'sdr', 'executive', 'viewer'],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    subtitle: 'Telephony and conversion reports',
    href: '/analytics',
    icon: BarChart3,
    allowedRoles: ['admin', 'manager', 'executive', 'viewer'],
  },
  {
    id: 'agents',
    name: 'AI Agents Studio',
    subtitle: 'Train & publish agents',
    href: '/agents',
    icon: Bot,
    allowedRoles: ['admin', 'manager'],
  },
  {
    id: 'settings',
    name: 'Settings & Gateways',
    subtitle: 'Telephony, security and rules',
    href: '/settings',
    icon: SlidersHorizontal,
    allowedRoles: ['admin'],
  },
  {
    id: 'system-health',
    name: 'System Health',
    subtitle: 'Provider and gateway status',
    href: '/settings?tab=providers',
    icon: Activity,
    allowedRoles: ['admin'],
  },
];

export const sidebarSections: SidebarSection[] = [
  {
    id: 'main',
    title: 'MAIN',
    items: mainNavItems,
  },
  {
    id: 'more',
    title: 'MORE',
    items: moreNavItems,
  },
];

function matchScore(href: string, pathname: string, search: string) {
  const [path, query = ''] = href.split('?');
  if (path !== pathname) return -1;
  const wanted = new URLSearchParams(query);
  const current = new URLSearchParams(search);
  for (const [key, value] of wanted.entries()) {
    if (current.get(key) !== value) return -1;
  }
  return Array.from(wanted.keys()).length;
}

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const themeReady = useThemeMounted();
  const currentUser = user ?? mockCurrentUser;
  const userRole: UserRole = currentUser?.role || 'sdr';
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMoreExpanded, setIsMoreExpanded] = useState(false);
  const search = searchParams?.toString() || '';

  // Filter items by user role
  const visibleMainItems = mainNavItems.filter((item) => item.allowedRoles.includes(userRole));
  const visibleMoreItems = moreNavItems.filter((item) => item.allowedRoles.includes(userRole));
  const allNavItems = [...visibleMainItems, ...visibleMoreItems];

  // Calculate active link based on pathname & search params
  const scored = allNavItems.map((item) => ({
    id: item.id,
    score: matchScore(item.href, pathname, search),
  }));
  const bestScore = scored.reduce((best, item) => Math.max(best, item.score), -1);
  const activeId = scored.find((item) => item.score === bestScore && bestScore >= 0)?.id;
  const activeIds = new Set(activeId ? [activeId] : []);

  // Check if an item inside "More" is currently active
  const isMoreItemActive = visibleMoreItems.some((item) => activeIds.has(item.id));

  // Auto-expand "More" if the user navigates directly to a module inside "More"
  useEffect(() => {
    if (isMoreItemActive) {
      setIsMoreExpanded(true);
    }
  }, [isMoreItemActive]);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`sidebar-width fixed top-0 z-50 flex h-screen shrink-0 select-none flex-col border-r border-sidebar-border bg-sidebar text-sidebar-text transition-all duration-200 ease-out lg:sticky ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <Link
            href="/dashboard"
            aria-label="RM AI Dialer dashboard"
            className="flex min-w-0 items-center"
            onClick={onCloseMobile}
          >
            <BrandLogo size={32} showText={!collapsed} />
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-hover hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Navigation Area */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <nav aria-label="Main navigation" className="space-y-1 px-3 py-3">
            {/* Essential Main Navigation */}
            <div className="flex flex-col gap-0.5">
              {visibleMainItems.map((item) => {
                const isActive = activeIds.has(item.id);
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.name : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium leading-5 transition-colors duration-150 ${
                      collapsed ? 'justify-center px-0' : ''
                    } ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-sidebar-text/80 hover:bg-sidebar-hover hover:text-sidebar-text'
                    }`}
                  >
                    <IconComponent className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>

            {/* Collapsible More Section */}
            {visibleMoreItems.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsMoreExpanded((prev) => !prev)}
                  title={collapsed ? (isMoreExpanded ? 'Collapse more' : 'Expand more') : undefined}
                  aria-expanded={isMoreExpanded}
                  className={`flex w-full min-h-9 items-center justify-between rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150 ${
                    collapsed ? 'justify-center px-0' : ''
                  } ${
                    isMoreItemActive && !isMoreExpanded
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-text'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MoreHorizontal className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {!collapsed && <span>More</span>}
                  </div>
                  {!collapsed && (
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        isMoreExpanded ? 'rotate-180 text-sidebar-text' : 'text-muted-foreground'
                      }`}
                      strokeWidth={1.75}
                    />
                  )}
                </button>

                {/* Animated Collapsible Items */}
                <div
                  className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    isMoreExpanded ? 'max-h-[600px] opacity-100 mt-0.5' : 'max-h-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    {visibleMoreItems.map((item) => {
                      const isActive = activeIds.has(item.id);
                      const IconComponent = item.icon;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={onCloseMobile}
                          title={collapsed ? item.name : undefined}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium leading-5 transition-colors duration-150 ${
                            collapsed ? 'justify-center px-0' : ''
                          } ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : 'text-sidebar-text/75 hover:bg-sidebar-hover hover:text-sidebar-text'
                          }`}
                        >
                          <IconComponent className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                          {!collapsed && <span className="truncate">{item.name}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </nav>
        </div>

        {/* Footer Area */}
        <div className="flex shrink-0 flex-col gap-1 border-t border-sidebar-border bg-sidebar p-3">
          <ProviderStatusMenu collapsed={collapsed} />

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex w-full items-center rounded-lg text-sidebar-text transition-colors hover:bg-sidebar-hover ${
                collapsed ? 'justify-center p-1.5' : 'justify-between px-2 py-1.5'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="relative shrink-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-hover text-xs font-medium text-sidebar-text">
                    {currentUser.name.charAt(0)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-sidebar ${
                      currentUser.status === 'in-call'
                        ? 'bg-amber-400'
                        : currentUser.status === 'active'
                          ? 'bg-emerald-400'
                          : 'bg-sidebar-text/40'
                    }`}
                  />
                </div>
                {!collapsed && (
                  <div className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-[13px] font-medium leading-5">{currentUser.name}</span>
                    <span className="truncate text-[11px] uppercase leading-4 text-muted-foreground">{currentUser.role}</span>
                  </div>
                )}
              </div>
            </button>

            {showUserMenu && (
              <div
                className={`absolute bottom-full z-50 mb-2 rounded-lg border border-border bg-surface-elevated p-2 text-[13px] text-on-surface shadow-lg ${
                  collapsed ? 'left-16 w-56' : 'left-0 right-0'
                }`}
              >
                <div className="border-b border-border/50 px-2.5 py-1.5">
                  <div className="truncate font-medium text-on-surface">{currentUser.name}</div>
                  <div className="truncate text-[12px] text-on-surface-muted">{currentUser.email}</div>
                </div>
                <div className="flex flex-col gap-0.5 py-1">
                  {userRole === 'admin' && (
                    <Link
                      href="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 rounded px-2.5 py-1.5 text-on-surface-variant hover:bg-surface-secondary hover:text-on-surface"
                    >
                      <SettingsIcon className="h-3.5 w-3.5" />
                      <span>Admin Settings</span>
                    </Link>
                  )}
                  <Link
                    href="/settings?tab=appearance"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 rounded px-2.5 py-1.5 text-on-surface-variant hover:bg-surface-secondary hover:text-on-surface"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Appearance & Theme</span>
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowUserMenu(false);
                      await logout();
                      router.push('/login');
                    }}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-error hover:bg-error/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={`flex w-full items-center rounded-lg text-[13px] font-medium leading-5 text-sidebar-text/80 transition-colors hover:bg-sidebar-hover hover:text-sidebar-text ${
              collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-1.5'
            }`}
            title="Toggle theme"
          >
            {themeReady && resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed && <span>Appearance</span>}
          </button>

          {collapsed && (
            <button
              onClick={onToggleCollapse}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-hover hover:text-foreground"
              type="button"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
