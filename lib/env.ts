import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_DEFAULT_ORG_ID: z
    .string()
    .regex(/^[0-9a-fA-F-]{36}$/, 'Must be a valid 36-character UUID format')
    .default('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
  RM_PROVIDER_MODE: z.enum(['development', 'live', 'test']).default('development'),
  AI_VOICE_RUNTIME: z.enum(['legacy', 'retell']).default('retell'),
  RETELL_CAMPAIGN_MODE: z.enum(['shadow', 'canary', 'live']).default('canary'),
});

const serverEnvSchema = clientEnvSchema.extend({
  RM_PROVIDER_MODE: z.enum(['development', 'live', 'test']).default('development'),
  AI_VOICE_RUNTIME: z.enum(['legacy', 'retell']).default('retell'),
  RETELL_CAMPAIGN_MODE: z.enum(['shadow', 'canary', 'live']).default('canary'),
  RETELL_CANARY_ALLOWLIST: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required for server administrative operations'),
  PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  TWILIO_ACCOUNT_SID: z.string().optional().default('AC_mock_account_sid_0000000000000000'),
  TWILIO_AUTH_TOKEN: z.string().optional().default('mock_auth_token_0000000000000000'),
  TWILIO_API_KEY: z.string().optional().default('SK_mock_api_key_0000000000000000'),
  TWILIO_API_SECRET: z.string().optional().default('mock_api_secret_0000000000000000'),
  TWILIO_TWIML_APP_SID: z.string().optional().default('AP_mock_twiml_app_sid_00000000000'),
  TWILIO_PHONE_NUMBER: z.string().optional().default('+18005550199'),
  ELEVENLABS_API_KEY: z.string().optional().default('mock_elevenlabs_key_0000000000000000'),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().optional().default('21m00Tcm4TlvDq8ikWAM'),
  ELEVENLABS_MODEL_ID: z.string().optional().default('eleven_turbo_v2_5'),
  RETELL_API_KEY: z.string().optional().default(''),
  RETELL_AGENT_ID: z.string().optional().default(''),
  RETELL_DEFAULT_AGENT_ID: z.string().optional().default(''),
  RETELL_PHONE_NUMBER: z.string().optional().default('+14158902341'),
  RETELL_API_BASE_URL: z.string().url().optional().default('https://api.retellai.com'),
  RETELL_WEBHOOK_SECRET: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().optional().default(''),
  RESEND_REPLY_TO: z.string().optional().default(''),
  RESEND_WEBHOOK_SECRET: z.string().optional().default(''),
  EMAIL_UNSUBSCRIBE_SECRET: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().optional().default('claude-sonnet-4-6'),
});

export type AiVoiceRuntime = 'legacy' | 'retell';
export type RetellCampaignMode = 'shadow' | 'canary' | 'live';

/**
 * Centrally retrieves and validates the active AI Voice Runtime feature flag.
 * Default is 'retell'. Returns 'legacy' only when explicitly requested for rollback.
 */
export function getAiVoiceRuntime(): AiVoiceRuntime {
  try {
    const runtime = process.env.AI_VOICE_RUNTIME || process.env.NEXT_PUBLIC_AI_VOICE_RUNTIME;
    if (runtime === 'legacy') return 'legacy';
    return 'retell';
  } catch {
    return 'retell';
  }
}

/**
 * Retrieves the Retell campaign dispatch safety mode: shadow | canary | live.
 * Default is 'shadow'.
 */
export function getRetellCampaignMode(): RetellCampaignMode {
  try {
    const mode = process.env.RETELL_CAMPAIGN_MODE || process.env.NEXT_PUBLIC_RETELL_CAMPAIGN_MODE;
    if (mode === 'live') return 'live';
    if (mode === 'canary') return 'canary';
    return 'shadow';
  } catch {
    return 'shadow';
  }
}

/**
 * Retrieves the allowlist of approved test phone numbers / lead IDs for canary testing.
 */
export function getCanaryAllowlist(): string[] {
  try {
    const raw = process.env.RETELL_CANARY_ALLOWLIST || process.env.NEXT_PUBLIC_RETELL_CANARY_ALLOWLIST || '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export type ProviderStatus = 'Configured' | 'Missing' | 'Invalid' | 'Untested';

export interface ProviderAuditResult {
  mode: 'development' | 'live' | 'test';
  aiVoiceRuntime: AiVoiceRuntime;
  supabase: ProviderStatus;
  twilio: ProviderStatus;
  elevenlabs: ProviderStatus;
  anthropic: ProviderStatus;
  retell: ProviderStatus;
  resend: ProviderStatus;
  details: {
    supabaseUrlConfigured: boolean;
    twilioSidConfigured: boolean;
    elevenlabsKeyConfigured: boolean;
    anthropicKeyConfigured: boolean;
    retellKeyConfigured: boolean;
    retellWebhookSecretConfigured: boolean;
    resendConfigured: boolean;
    publicUrlValid: boolean;
  };
}

/**
 * Authoritative system helper to determine whether the application runs in local development mock mode.
 * Security Boundaries:
 * 1. Strictly forbidden in production (NODE_ENV === 'production') - fails closed / returns false.
 * 2. Strictly forbidden when RM_PROVIDER_MODE === 'live' - fails closed / returns false.
 * 3. In local development or test mode, returns true if using mock or placeholder Supabase credentials.
 */
export function isMockDevMode(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  const mode = process.env.RM_PROVIDER_MODE || process.env.NEXT_PUBLIC_RM_PROVIDER_MODE;
  if (mode === 'live') {
    return false;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return (
    mode === 'development' ||
    mode === 'test' ||
    !url ||
    url.includes('mock-rm-dialer') ||
    url.includes('your-project') ||
    url.includes('example.com')
  );
}

/**
 * Validates client-safe environment variables.
 * Safe to call from both client and server components.
 */
export function getClientEnv() {
  const isProd = process.env.NODE_ENV === 'production' || process.env.RM_PROVIDER_MODE === 'live';
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isProd && (!rawUrl || rawUrl.includes('mock-rm-dialer') || rawUrl.includes('your-project') || !rawKey || rawKey.includes('mock-anon-key'))) {
    throw new Error('[RM AI Dialer Security Violation] Live/Production mode requires real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Mock endpoints are forbidden in production.');
  }

  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: rawUrl || 'https://mock-rm-dialer.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: rawKey || 'mock-anon-key-for-local-dev',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_DEFAULT_ORG_ID: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    RM_PROVIDER_MODE: process.env.RM_PROVIDER_MODE || (process.env.NODE_ENV === 'production' ? 'live' : 'development'),
    AI_VOICE_RUNTIME: process.env.AI_VOICE_RUNTIME || 'retell',
    RETELL_CAMPAIGN_MODE: process.env.RETELL_CAMPAIGN_MODE || 'canary',
  });

  if (!result.success) {
    const errorDetails = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`[RM AI Dialer] Client Environment Validation Failed: ${errorDetails}`);
  }

  return result.data;
}

/**
 * Validates server-only environment variables.
 * MUST ONLY be called in server environments (Node.js runtime).
 */
export function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('[RM AI Dialer Security Violation] getServerEnv() called in browser environment!');
  }

  const isProd = process.env.NODE_ENV === 'production' || process.env.RM_PROVIDER_MODE === 'live';
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isProd) {
    if (!rawUrl || rawUrl.includes('mock-rm-dialer') || rawUrl.includes('your-project')) {
      throw new Error('[RM AI Dialer Security Violation] Live/Production environment requires real NEXT_PUBLIC_SUPABASE_URL.');
    }
    if (!rawServiceKey || rawServiceKey.includes('mock-service-role-key')) {
      throw new Error('[RM AI Dialer Security Violation] Live/Production environment requires real SUPABASE_SERVICE_ROLE_KEY.');
    }
  }

  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: rawUrl || 'https://mock-rm-dialer.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: rawAnon || 'mock-anon-key-for-local-dev',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_DEFAULT_ORG_ID: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    RM_PROVIDER_MODE: process.env.RM_PROVIDER_MODE || (process.env.NODE_ENV === 'production' ? 'live' : 'development'),
    AI_VOICE_RUNTIME: process.env.AI_VOICE_RUNTIME || 'retell',
    RETELL_CAMPAIGN_MODE: process.env.RETELL_CAMPAIGN_MODE || 'canary',
    SUPABASE_SERVICE_ROLE_KEY: rawServiceKey || 'mock-service-role-key-for-local-dev',
    PUBLIC_URL: process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || (isProd ? '' : 'AC_mock_account_sid_0000000000000000'),
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || (isProd ? '' : 'mock_auth_token_0000000000000000'),
    TWILIO_API_KEY: process.env.TWILIO_API_KEY || (isProd ? '' : 'SK_mock_api_key_0000000000000000'),
    TWILIO_API_SECRET: process.env.TWILIO_API_SECRET || (isProd ? '' : 'mock_api_secret_0000000000000000'),
    TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID || (isProd ? '' : 'AP_mock_twiml_app_sid_00000000000'),
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || (isProd ? '' : '+18005550199'),
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || (isProd ? '' : 'mock_elevenlabs_key_0000000000000000'),
    ELEVENLABS_DEFAULT_VOICE_ID: process.env.ELEVENLABS_DEFAULT_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
    ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
    RETELL_API_KEY: process.env.RETELL_API_KEY || (isProd ? '' : 'mock_retell_key_0000000000000000'),
    RETELL_AGENT_ID: process.env.RETELL_AGENT_ID || process.env.RETELL_DEFAULT_AGENT_ID || '',
    RETELL_DEFAULT_AGENT_ID: process.env.RETELL_AGENT_ID || process.env.RETELL_DEFAULT_AGENT_ID || '',
    RETELL_PHONE_NUMBER: process.env.RETELL_PHONE_NUMBER || '+14158902341',
    RETELL_API_BASE_URL: process.env.RETELL_API_BASE_URL || 'https://api.retellai.com',
    RETELL_WEBHOOK_SECRET: process.env.RETELL_WEBHOOK_SECRET || '',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || '',
    RESEND_REPLY_TO: process.env.RESEND_REPLY_TO || '',
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET || '',
    EMAIL_UNSUBSCRIBE_SECRET: process.env.EMAIL_UNSUBSCRIBE_SECRET || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  });

  if (!result.success) {
    const errorDetails = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`[RM AI Dialer] Server Environment Validation Failed: ${errorDetails}`);
  }

  return result.data;
}

/**
 * Audits provider configurations and classifies them securely without exposing secret values.
 */
export function auditProviderConfiguration(): ProviderAuditResult {
  const env = getServerEnv();
  const mode = env.RM_PROVIDER_MODE as 'development' | 'live' | 'test';
  const runtime = getAiVoiceRuntime();

  const isPlaceholder = (val?: string) =>
    !val ||
    val.includes('mock') ||
    val.includes('your-') ||
    val.includes('xxxxxxxx') ||
    val.includes('sk-ant-xxx') ||
    val.includes('AC_mock') ||
    val.includes('mock-anon-key');

  const supabaseConfigured =
    Boolean(env.NEXT_PUBLIC_SUPABASE_URL) &&
    !isPlaceholder(env.NEXT_PUBLIC_SUPABASE_URL) &&
    !isPlaceholder(env.SUPABASE_SERVICE_ROLE_KEY);

  const twilioConfigured =
    Boolean(env.TWILIO_ACCOUNT_SID) &&
    !isPlaceholder(env.TWILIO_ACCOUNT_SID) &&
    !isPlaceholder(env.TWILIO_AUTH_TOKEN) &&
    !isPlaceholder(env.TWILIO_API_KEY);

  const elevenlabsConfigured =
    Boolean(env.ELEVENLABS_API_KEY) && !isPlaceholder(env.ELEVENLABS_API_KEY);

  const retellConfigured =
    Boolean(env.RETELL_API_KEY) && !isPlaceholder(env.RETELL_API_KEY);

  const retellWebhookConfigured =
    Boolean(env.RETELL_WEBHOOK_SECRET) && !isPlaceholder(env.RETELL_WEBHOOK_SECRET);

  const resendConfigured =
    Boolean(env.RESEND_API_KEY) &&
    !isPlaceholder(env.RESEND_API_KEY) &&
    Boolean(env.RESEND_FROM_EMAIL) &&
    env.RESEND_FROM_EMAIL.includes('@');

  const anthropicConfigured =
    Boolean(env.ANTHROPIC_API_KEY) && !isPlaceholder(env.ANTHROPIC_API_KEY);

  return {
    mode,
    aiVoiceRuntime: runtime,
    supabase: supabaseConfigured ? 'Configured' : mode === 'live' ? 'Missing' : 'Untested',
    twilio: twilioConfigured ? 'Configured' : mode === 'live' ? 'Missing' : 'Untested',
    elevenlabs: elevenlabsConfigured ? 'Configured' : mode === 'live' ? 'Missing' : 'Untested',
    anthropic: anthropicConfigured ? 'Configured' : mode === 'live' ? 'Missing' : 'Untested',
    retell: retellConfigured ? 'Configured' : mode === 'live' ? 'Missing' : 'Untested',
    resend: resendConfigured ? 'Configured' : mode === 'live' ? 'Missing' : 'Untested',
    details: {
      supabaseUrlConfigured: supabaseConfigured,
      twilioSidConfigured: twilioConfigured,
      elevenlabsKeyConfigured: elevenlabsConfigured,
      anthropicKeyConfigured: anthropicConfigured,
      retellKeyConfigured: retellConfigured,
      retellWebhookSecretConfigured: retellWebhookConfigured,
      resendConfigured,
      publicUrlValid: Boolean(env.PUBLIC_URL && !isPlaceholder(env.PUBLIC_URL)),
    },
  };
}
