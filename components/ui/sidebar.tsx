'use client';

import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Bot,
  ChevronsUpDown,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PhoneCall,
  Settings,
  SlidersHorizontal,
  UserCircle,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth/auth-context';
import { mockCurrentUser } from '@/lib/mock';
import { sidebarSections } from '@/components/layout/Sidebar';
import type { UserRole } from '@/types';
import type { LucideIcon } from 'lucide-react';

const sidebarVariants = {
  open: { width: '15rem' },
  closed: { width: '3.05rem' },
};

const contentVariants = {
  open: { display: 'block', opacity: 1 },
  closed: { display: 'block', opacity: 1 },
};

const variants = {
  open: {
    x: 0,
    opacity: 1,
    transition: { x: { stiffness: 1000, velocity: -100 } },
  },
  closed: {
    x: -20,
    opacity: 0,
    transition: { x: { stiffness: 100 } },
  },
};

const transitionProps = {
  type: 'tween' as const,
  ease: 'easeOut' as const,
  duration: 0.2,
};

const staggerVariants = {
  open: {
    transition: { staggerChildren: 0.03, delayChildren: 0.02 },
  },
};

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  workstation: PhoneCall,
  leads: Users,
  campaigns: Megaphone,
  agents: Bot,
  calls: History,
  analytics: BarChart3,
  settings: SlidersHorizontal,
  'system-health': Settings,
};

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function SessionNavBar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const currentUser = user ?? mockCurrentUser;
  const role = (currentUser.role || 'sdr') as UserRole;

  const items = sidebarSections
    .filter((section) => !section.allowedRoles || section.allowedRoles.includes(role))
    .flatMap((section) => section.items.filter((item) => item.allowedRoles.includes(role)));

  const signOut = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <motion.div
      className="sidebar fixed left-0 z-40 h-full shrink-0 border-r border-sidebar-border"
      initial={isCollapsed ? 'closed' : 'open'}
      animate={isCollapsed ? 'closed' : 'open'}
      variants={sidebarVariants}
      transition={transitionProps}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <motion.div
        className="relative z-40 flex h-full shrink-0 flex-col bg-sidebar text-sidebar-text transition-all"
        variants={contentVariants}
      >
        <motion.ul variants={staggerVariants} className="flex h-full flex-col">
          <div className="flex grow flex-col items-center">
            <div className="flex h-[54px] w-full shrink-0 border-b border-sidebar-border p-2">
              <div className="mt-[1.5px] flex w-full">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="w-full" asChild>
                    <Button variant="ghost" size="sm" className="flex w-fit items-center gap-2 px-2 text-sidebar-text hover:bg-sidebar-hover">
                      <Avatar className="size-4 rounded">
                        <AvatarFallback className="bg-sidebar-active text-[10px] text-sidebar-text">RM</AvatarFallback>
                      </Avatar>
                      <motion.li variants={variants} className="flex w-fit items-center gap-2">
                        {!isCollapsed && (
                          <>
                            <p className="text-sm font-medium">RM AI Dialer</p>
                            <ChevronsUpDown className="h-4 w-4 text-sidebar-text/50" />
                          </>
                        )}
                      </motion.li>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild className="flex items-center gap-2">
                      <Link href="/settings">
                        <Settings className="h-4 w-4" /> Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="flex items-center gap-2">
                      <Link href="/settings?tab=providers">
                        <SlidersHorizontal className="h-4 w-4" /> Providers
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings?tab=roles" className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> Users and roles
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex h-full w-full flex-col">
              <div className="flex grow flex-col gap-4">
                <ScrollArea className="h-16 grow p-2">
                  <div className="flex w-full flex-col gap-1">
                    {items.map((item) => {
                      const Icon = ICONS[item.id] || LayoutDashboard;
                      const href = item.href.split('?')[0];
                      const active =
                        item.id !== 'system-health' &&
                        (pathname === href || (href !== '/dashboard' && pathname?.startsWith(href)));
                      const showRule = item.id === 'agents' || item.id === 'calls';
                      return (
                        <div key={item.id} className="flex flex-col gap-1">
                          {showRule && <Separator className="w-full bg-sidebar-border" />}
                          <Link
                            href={item.href}
                            className={cn(
                              'flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-sidebar-hover hover:text-sidebar-text',
                              active && 'bg-sidebar-active text-sidebar-text'
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <motion.li variants={variants}>
                              {!isCollapsed && <p className="ml-2 text-sm font-medium">{item.name}</p>}
                            </motion.li>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
              <div className="flex flex-col p-2">
                <Link
                  href="/settings"
                  className="mt-auto flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-sidebar-hover hover:text-sidebar-text"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <motion.li variants={variants}>
                    {!isCollapsed && <p className="ml-2 text-sm font-medium">Settings</p>}
                  </motion.li>
                </Link>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="w-full">
                    <div className="flex h-8 w-full flex-row items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-sidebar-hover">
                      <Avatar className="size-4">
                        <AvatarFallback className="bg-sidebar-active text-[9px] text-sidebar-text">
                          {initials(currentUser.name)}
                        </AvatarFallback>
                      </Avatar>
                      <motion.li variants={variants} className="flex w-full items-center gap-2">
                        {!isCollapsed && (
                          <>
                            <p className="text-sm font-medium">{currentUser.name}</p>
                            <ChevronsUpDown className="ml-auto h-4 w-4 text-sidebar-text/50" />
                          </>
                        )}
                      </motion.li>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent sideOffset={5}>
                    <div className="flex flex-row items-center gap-2 p-2">
                      <Avatar className="size-6">
                        <AvatarFallback>{initials(currentUser.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-medium">{currentUser.name}</span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">{currentUser.email}</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="flex items-center gap-2">
                      <Link href="/settings?tab=appearance">
                        <UserCircle className="h-4 w-4" /> Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-center gap-2" onSelect={() => void signOut()}>
                      <LogOut className="h-4 w-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </motion.ul>
      </motion.div>
    </motion.div>
  );
}

export function SidebarDemo() {
  return (
    <div className="flex h-screen w-screen flex-row">
      <SessionNavBar />
      <main className="flex h-screen grow flex-col overflow-auto" />
    </div>
  );
}
