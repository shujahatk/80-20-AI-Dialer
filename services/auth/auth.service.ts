import { createClient } from '@/lib/supabase/client';
import { loginSchema, type LoginInput } from '@/lib/validation';
import { UnauthorizedError } from '@/lib/errors';
import type { User } from '@/types';
import { mockCurrentUser } from '@/lib/mock';
import { isMockDevMode } from '@/lib/env';

export interface AuthSessionResult {
  success: boolean;
  user: User | null;
  error?: string;
}

export class AuthService {
  private _supabase: ReturnType<typeof createClient> | null = null;
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Authenticates user using Supabase Auth email/password.
   * Gracefully handles dev mock mode if Supabase credentials are in development default.
   */
  async login(input: LoginInput): Promise<AuthSessionResult> {
    const validated = loginSchema.parse(input);

    if (isMockDevMode()) {
      // In local dev mode, set a dev session cookie so middleware grants access
      if (typeof document !== 'undefined') {
        const expires = validated.rememberMe
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
          : '';
        document.cookie = `rm_session=usr_dev_operator; path=/; ${expires ? `expires=${expires};` : ''} SameSite=Lax`;
      }

      return {
        success: true,
        user: {
          ...mockCurrentUser,
          email: validated.email,
        },
      };
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) {
      return {
        success: false,
        user: null,
        error: error.message,
      };
    }

    if (!data.user) {
      throw new UnauthorizedError('User credentials valid but no active profile found');
    }

    // Load profile from database
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    // Query organization_memberships for role and active organization
    const { data: membership } = await this.supabase
      .from('organization_memberships')
      .select('role, organization_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    const roleName = (membership?.role as string) ?? (profile && 'role' in profile ? (profile.role as string) : 'agent');
    const role: User['role'] = roleName === 'admin' ? 'admin' : (roleName === 'manager' ? 'manager' : (roleName === 'agent' ? 'agent' : 'operator'));

    const user: User = {
      id: data.user.id,
      name: (profile && 'display_name' in profile && typeof profile.display_name === 'string' ? profile.display_name : null) ?? data.user.email?.split('@')[0] ?? 'Operator',
      email: data.user.email ?? validated.email,
      role,
      organizationId: membership?.organization_id || undefined,
      title: 'Senior Outbound Specialist',
      avatarUrl: (profile && 'avatar_url' in profile && typeof profile.avatar_url === 'string' ? profile.avatar_url : null) ?? mockCurrentUser.avatarUrl,
      status: 'active',
      nodeId: 'US-East-1 AWS Cluster (Node 09)',
    };

    return {
      success: true,
      user,
    };
  }

  /**
   * Logs out user from Supabase and clears session cookies
   */
  async logout(): Promise<void> {
    if (isMockDevMode()) {
      if (typeof document !== 'undefined') {
        document.cookie = 'rm_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      }
    } else {
      await this.supabase.auth.signOut();
    }
  }

  /**
   * Retrieves the current authenticated user session and profile
   */
  async getCurrentUser(): Promise<User | null> {
    if (isMockDevMode()) {
      if (typeof document !== 'undefined' && document.cookie.includes('rm_session=')) {
        return mockCurrentUser;
      }
      return null;
    }

    const { data } = await this.supabase.auth.getUser();
    if (!data.user) return null;

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    const { data: membership } = await this.supabase
      .from('organization_memberships')
      .select('role, organization_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    const roleName = (membership?.role as string) ?? (profile && 'role' in profile ? (profile.role as string) : 'agent');
    const role: User['role'] = roleName === 'admin' ? 'admin' : (roleName === 'manager' ? 'manager' : (roleName === 'agent' ? 'agent' : 'operator'));

    return {
      id: data.user.id,
      name: (profile && 'display_name' in profile && typeof profile.display_name === 'string' ? profile.display_name : null) ?? data.user.email?.split('@')[0] ?? 'Operator',
      email: data.user.email ?? '',
      role,
      organizationId: membership?.organization_id || undefined,
      title: 'Senior Outbound Specialist',
      avatarUrl: (profile && 'avatar_url' in profile && typeof profile.avatar_url === 'string' ? profile.avatar_url : null) ?? mockCurrentUser.avatarUrl,
      status: 'active',
      nodeId: 'US-East-1 AWS Cluster (Node 09)',
    };
  }
}

export const authService = new AuthService();
