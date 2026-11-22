import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClientEnv, isMockDevMode } from '@/lib/env';

interface LocalRateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory store used strictly in local development/mock mode
const memoryStore = new Map<string, LocalRateLimitRecord>();

// Periodically purge expired records from in-memory store in dev (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (record.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (timer.unref) timer.unref();
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed in window. Default: 60 */
  limit?: number;
  /** Window size in milliseconds. Default: 60,000 (1 minute) */
  windowMs?: number;
  /** Custom key prefix to segment different endpoints */
  prefix?: string;
  /** Explicit identifier (e.g. user ID or org ID) instead of IP */
  identifier?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  /** Flag set to true if the rate limiting service failed or is unavailable */
  isUnavailable?: boolean;
}

/**
 * Extracts a client IP from NextRequest headers
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return '127.0.0.1';
}

/**
 * In-memory sliding window rate limiter strictly reserved for local development and mock mode.
 */
function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || record.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetMs: windowMs,
    };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetMs: Math.max(0, record.resetAt - now),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - record.count),
    resetMs: Math.max(0, record.resetAt - now),
  };
}

/**
 * Production-safe shared rate limiter.
 * Coordinates rate limiting across serverless function instances using Supabase PostgreSQL.
 *
 * Security Model:
 * - In production or live mode, the shared database limiter MUST be used.
 * - If the shared database limiter is unavailable in production, sensitive endpoints FAIL CLOSED
 *   with an HTTP 503 response. Automatic in-memory fallback is strictly disabled in production.
 * - In local development or mock mode, falls back to the in-memory store.
 * - Logs database errors without exposing secrets, hostnames, or connection details.
 */
export async function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const {
    limit = 60,
    windowMs = 60 * 1000,
    prefix = 'api',
    identifier,
  } = options;

  const id = identifier || getClientIp(req);
  const key = `${prefix}:${id}`;

  const isProductionOrLive =
    process.env.NODE_ENV === 'production' ||
    process.env.RM_PROVIDER_MODE === 'live';

  // Local development / mock mode: use in-memory store
  if (isMockDevMode()) {
    return checkMemoryRateLimit(key, limit, windowMs);
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('check_shared_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });

    if (error) {
      // Log sanitized error message without exposing connection strings, URLs, or secrets
      console.error(`[RateLimiter] Database rate limit RPC failure (code: ${error.code || 'UNKNOWN'}).`);

      if (isProductionOrLive) {
        // Fail closed in production / live mode
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetMs: 5000,
          isUnavailable: true,
        };
      }

      // Non-production dev fallback
      return checkMemoryRateLimit(key, limit, windowMs);
    }

    if (!data || data.length === 0) {
      console.error('[RateLimiter] Database rate limit RPC returned no rows.');
      if (isProductionOrLive) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetMs: 5000,
          isUnavailable: true,
        };
      }
      return checkMemoryRateLimit(key, limit, windowMs);
    }

    const row = data[0];
    return {
      allowed: Boolean(row.allowed),
      limit,
      remaining: row.remaining,
      resetMs: row.reset_ms,
    };
  } catch (err: unknown) {
    // Sanitize log - never print connection details or error trace that might leak environment variables
    const errorType = err instanceof Error ? err.name : 'UnknownError';
    console.error(`[RateLimiter] Rate limit check encountered unexpected error (${errorType}).`);

    if (isProductionOrLive) {
      // Fail closed in production / live mode with 503
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetMs: 5000,
        isUnavailable: true,
      };
    }

    // Local development fallback
    return checkMemoryRateLimit(key, limit, windowMs);
  }
}

/**
 * Synchronous in-memory variant strictly for testing or development.
 */
export function checkRateLimitSync(
  req: NextRequest,
  options: RateLimitOptions = {}
): RateLimitResult {
  const {
    limit = 60,
    windowMs = 60 * 1000,
    prefix = 'api',
    identifier,
  } = options;
  const id = identifier || getClientIp(req);
  const key = `${prefix}:${id}`;
  return checkMemoryRateLimit(key, limit, windowMs);
}

/**
 * Generates standard rate limit response:
 * - HTTP 503 Service Unavailable when the rate limiter is unavailable in production (fail closed).
 * - HTTP 429 Too Many Requests when rate limit threshold is exceeded.
 */
export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
  if (result.isUnavailable) {
    return NextResponse.json(
      {
        success: false,
        error: 'Service temporarily unavailable. Rate limiter service is unreachable.',
      },
      {
        status: 503,
        headers: {
          'Retry-After': '5',
        },
      }
    );
  }

  const retrySecs = Math.max(1, Math.ceil(result.resetMs / 1000));
  return NextResponse.json(
    {
      success: false,
      error: 'Too many requests. Please try again later.',
    },
    {
      status: 429,
      headers: {
        'Retry-After': retrySecs.toString(),
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + result.resetMs).toString(),
      },
    }
  );
}
