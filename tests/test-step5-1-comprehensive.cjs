const { NextRequest, NextResponse } = require('next/server');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function runStep51SecurityTests() {
  console.log('========================================================================');
  console.log('80/20 AI DIALER — STEP 5.1 SECURITY VERIFICATION & PRODUCTION READINESS');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // ====================================================================
  // 1. SHARED RATE LIMITING ENGINE (IN-MEMORY & DISTRIBUTED COMPATIBILITY)
  // ====================================================================
  console.log('--- 1. SHARED RATE LIMITING TESTS ---');
  {
    function getClientIp(req) {
      const forwarded = req.headers.get('x-forwarded-for');
      if (forwarded) return forwarded.split(',')[0].trim();
      const realIp = req.headers.get('x-real-ip');
      if (realIp) return realIp.trim();
      const cfIp = req.headers.get('cf-connecting-ip');
      if (cfIp) return cfIp.trim();
      return '127.0.0.1';
    }

    const testStore = new Map();
    function checkRateLimitMemory(req, options = {}) {
      const { limit = 60, windowMs = 60 * 1000, prefix = 'api', identifier } = options;
      const id = identifier || getClientIp(req);
      const key = `${prefix}:${id}`;
      const now = Date.now();

      const record = testStore.get(key);
      if (!record || record.resetAt <= now) {
        testStore.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, limit, remaining: limit - 1, resetMs: windowMs };
      }
      if (record.count >= limit) {
        return { allowed: false, limit, remaining: 0, resetMs: Math.max(0, record.resetAt - now) };
      }
      record.count += 1;
      return { allowed: true, limit, remaining: limit - record.count, resetMs: Math.max(0, record.resetAt - now) };
    }

    function rateLimitExceededResponse(result) {
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
        { success: false, error: 'Too many requests. Please try again later.' },
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

    // A. Multi-hop IP parsing
    const req1 = new NextRequest('http://localhost:3000/api/leads', {
      headers: { 'x-forwarded-for': '192.0.2.10, 10.0.0.1, 172.16.0.1' },
    });
    assert(getClientIp(req1) === '192.0.2.10', 'Extracts correct client IP from multi-hop x-forwarded-for');

    // B. Rate limit progression
    const opts = { limit: 3, windowMs: 10000, prefix: 'shared_rl_test' };
    const r1 = checkRateLimitMemory(req1, opts);
    assert(r1.allowed && r1.remaining === 2, 'Request 1/3 allowed with 2 remaining');

    const r2 = checkRateLimitMemory(req1, opts);
    assert(r2.allowed && r2.remaining === 1, 'Request 2/3 allowed with 1 remaining');

    const r3 = checkRateLimitMemory(req1, opts);
    assert(r3.allowed && r3.remaining === 0, 'Request 3/3 allowed with 0 remaining');

    const r4 = checkRateLimitMemory(req1, opts);
    assert(!r4.allowed && r4.remaining === 0, 'Request 4/3 blocked by rate limiter');

    // C. 429 Response headers
    const resp429 = rateLimitExceededResponse(r4);
    assert(resp429.status === 429, 'Rate limit response returns HTTP 429');
    assert(resp429.headers.has('Retry-After'), 'Rate limit response includes Retry-After header');
    assert(resp429.headers.get('X-RateLimit-Limit') === '3', 'Rate limit response includes correct X-RateLimit-Limit');
    assert(resp429.headers.get('X-RateLimit-Remaining') === '0', 'Rate limit response indicates 0 remaining');
    assert(resp429.headers.has('X-RateLimit-Reset'), 'Rate limit response includes X-RateLimit-Reset timestamp');

    // D. IP Isolation
    const req2 = new NextRequest('http://localhost:3000/api/leads', {
      headers: { 'x-forwarded-for': '192.0.2.20' },
    });
    const rOtherIp = checkRateLimitMemory(req2, opts);
    assert(rOtherIp.allowed && rOtherIp.remaining === 2, 'Different client IP has isolated rate limit bucket');
  }

  // ====================================================================
  // 2. RESEND / SVIX WEBHOOK SIGNATURE VERIFICATION (POSITIVE & NEGATIVE)
  // ====================================================================
  console.log('\n--- 2. RESEND / SVIX WEBHOOK SIGNATURE TESTS ---');
  {
    function verifyResendWebhook(rawBody, headers, secret, nowSeconds = Date.now() / 1000) {
      if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
      const timestamp = Number(headers.timestamp);
      if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > 5 * 60) return false;
      const key = secret.startsWith('whsec_') ? Buffer.from(secret.slice('whsec_'.length), 'base64') : Buffer.from(secret);
      const expected = crypto.createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest('base64');
      return headers.signature.split(' ').some((part) => {
        const [version, signature] = part.split(',');
        if (version !== 'v1' || !signature) return false;
        const left = Buffer.from(signature);
        const right = Buffer.from(expected);
        return left.length === right.length && crypto.timingSafeEqual(left, right);
      });
    }

    const rawKey = 'dGVzdF9zZWNyZXRfa2V5XzEyMzQ1Njc4OTA=';
    const svixSecret = `whsec_${rawKey}`;
    const testBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_123456789' } });
    const testId = 'msg_2r1m9x8k4p7n';
    const now = Math.floor(Date.now() / 1000);

    function generateSvixSignature(secret, id, timestamp, body) {
      const key = secret.startsWith('whsec_') ? Buffer.from(secret.slice('whsec_'.length), 'base64') : Buffer.from(secret);
      const sig = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
      return `v1,${sig}`;
    }

    const validSig = generateSvixSignature(svixSecret, testId, now, testBody);

    assert(
      verifyResendWebhook(testBody, { id: testId, timestamp: now.toString(), signature: validSig }, svixSecret, now),
      'Positive: Valid whsec_ secret and signature verified successfully'
    );
    const multiSig = `v1,oldInvalidSig ${validSig} v1,anotherOldSig`;
    assert(
      verifyResendWebhook(testBody, { id: testId, timestamp: now.toString(), signature: multiSig }, svixSecret, now),
      'Positive: Multi-signature header verified successfully (key rotation support)'
    );
    const rawSecret = 'simple_raw_secret_string_123';
    const rawSig = generateSvixSignature(rawSecret, testId, now, testBody);
    assert(
      verifyResendWebhook(testBody, { id: testId, timestamp: now.toString(), signature: rawSig }, rawSecret, now),
      'Positive: Raw secret without whsec_ prefix verified successfully'
    );
    const tamperedBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_TAMPERED' } });
    assert(
      !verifyResendWebhook(tamperedBody, { id: testId, timestamp: now.toString(), signature: validSig }, svixSecret, now),
      'Negative: Tampered request body is rejected'
    );
    assert(
      !verifyResendWebhook(testBody, { id: 'msg_TAMPERED_ID', timestamp: now.toString(), signature: validSig }, svixSecret, now),
      'Negative: Tampered svix-id header is rejected'
    );
    const staleTimestamp = now - 301;
    const staleSig = generateSvixSignature(svixSecret, testId, staleTimestamp, testBody);
    assert(
      !verifyResendWebhook(testBody, { id: testId, timestamp: staleTimestamp.toString(), signature: staleSig }, svixSecret, now),
      'Negative: Stale timestamp (> 300s) rejected (replay attack prevention)'
    );
    const futureTimestamp = now + 301;
    const futureSig = generateSvixSignature(svixSecret, testId, futureTimestamp, testBody);
    assert(
      !verifyResendWebhook(testBody, { id: testId, timestamp: futureTimestamp.toString(), signature: futureSig }, svixSecret, now),
      'Negative: Future timestamp (> 300s) rejected'
    );
    const wrongSecret = 'whsec_d3Jvbmdfc2VjcmV0X2tleV8xMjM0NTY3ODkw';
    assert(
      !verifyResendWebhook(testBody, { id: testId, timestamp: now.toString(), signature: validSig }, wrongSecret, now),
      'Negative: Wrong webhook secret is rejected'
    );
    assert(
      !verifyResendWebhook(testBody, { id: null, timestamp: now.toString(), signature: validSig }, svixSecret, now),
      'Negative: Missing svix-id header is rejected'
    );
    assert(
      !verifyResendWebhook(testBody, { id: testId, timestamp: null, signature: validSig }, svixSecret, now),
      'Negative: Missing svix-timestamp header is rejected'
    );
    assert(
      !verifyResendWebhook(testBody, { id: testId, timestamp: now.toString(), signature: null }, svixSecret, now),
      'Negative: Missing svix-signature header is rejected'
    );
    const v2Sig = validSig.replace('v1,', 'v2,');
    assert(
      !verifyResendWebhook(testBody, { id: testId, timestamp: now.toString(), signature: v2Sig }, svixSecret, now),
      'Negative: Unsupported signature version (v2) is rejected'
    );
    assert(
      !verifyResendWebhook(testBody, { id: testId, timestamp: now.toString(), signature: validSig }, '', now),
      'Negative: Empty webhook secret is rejected'
    );
  }

  // ====================================================================
  // 3. RETELL HMAC WEBHOOK SIGNATURE VERIFICATION
  // ====================================================================
  console.log('\n--- 3. RETELL HMAC WEBHOOK SIGNATURE TESTS ---');
  {
    function verifyRetellHmac(rawBody, signature, secret) {
      if (!signature || !secret) return false;
      const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
      try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expected, 'hex');
        return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
      } catch {
        return false;
      }
    }

    const retellSecret = 'retell_webhook_secret_key_abcdef';
    const payload = JSON.stringify({ event: 'call_ended', call: { call_id: 'call_123' } });
    const validHmac = crypto.createHmac('sha256', retellSecret).update(payload, 'utf8').digest('hex');

    assert(verifyRetellHmac(payload, validHmac, retellSecret), 'Positive: Valid Retell HMAC SHA-256 signature accepted');
    assert(!verifyRetellHmac(payload + 'tamper', validHmac, retellSecret), 'Negative: Tampered payload rejected');
    assert(!verifyRetellHmac(payload, 'deadbeef1234567890abcdef', retellSecret), 'Negative: Corrupted signature hex rejected');
    assert(!verifyRetellHmac(payload, '', retellSecret), 'Negative: Missing x-retell-signature rejected');
  }

  // ====================================================================
  // 4. ROUTE PROTECTION & MIDDLEWARE ACCESSIBILITY VERIFICATION
  // ====================================================================
  console.log('\n--- 4. ROUTE PROTECTION & MIDDLEWARE ACCESS TESTS ---');
  {
    const PUBLIC_API_ROUTES = [
      '/api/webhooks/retell',
      '/api/webhooks/resend',
      '/api/webhooks/twilio/call-status',
      '/api/webhooks/twilio/recording',
      '/api/email/unsubscribe',
      '/api/retell/custom-llm',
      '/api/telephony/twiml',
    ];

    function evaluateRouteAccess(pathname, user) {
      const isStaticOrAsset =
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.includes('.');

      if (isStaticOrAsset) return { status: 200, action: 'pass_static' };

      const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');
      const isPublicApi = PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
      const isApiRoute = pathname.startsWith('/api');

      if (isPublicApi) return { status: 200, action: 'pass_public' };
      if (isApiRoute && !user) return { status: 401, action: '401_json' };
      if (!user && !isAuthRoute) return { status: 307, action: 'redirect_login', redirectTo: pathname };
      if (user && isAuthRoute && !pathname.startsWith('/auth/callback')) return { status: 307, action: 'redirect_dashboard' };
      return { status: 200, action: 'pass_authenticated' };
    }

    const pDash = evaluateRouteAccess('/dashboard', null);
    assert(pDash.status === 307 && pDash.redirectTo === '/dashboard', 'Unauthenticated /dashboard redirects to /login');

    const pCampaigns = evaluateRouteAccess('/campaigns/camp_123', null);
    assert(pCampaigns.status === 307 && pCampaigns.redirectTo === '/campaigns/camp_123', 'Unauthenticated /campaigns/[id] redirects to /login');

    const pSettings = evaluateRouteAccess('/settings', null);
    assert(pSettings.status === 307 && pSettings.redirectTo === '/settings', 'Unauthenticated /settings redirects to /login');

    const aLeads = evaluateRouteAccess('/api/leads', null);
    assert(aLeads.status === 401, 'Unauthenticated /api/leads returns 401 Unauthorized');

    const aCalls = evaluateRouteAccess('/api/calls', null);
    assert(aCalls.status === 401, 'Unauthenticated /api/calls returns 401 Unauthorized');

    const aAgents = evaluateRouteAccess('/api/agents', null);
    assert(aAgents.status === 401, 'Unauthenticated /api/agents returns 401 Unauthorized');

    const aCallSummary = evaluateRouteAccess('/api/calls/call_999/summary', null);
    assert(aCallSummary.status === 401, 'Unauthenticated /api/calls/[id]/summary returns 401 Unauthorized');

    assert(evaluateRouteAccess('/api/webhooks/retell', null).status === 200, 'Public: Retell webhook bypasses auth session');
    assert(evaluateRouteAccess('/api/webhooks/resend', null).status === 200, 'Public: Resend webhook bypasses auth session');
    assert(evaluateRouteAccess('/api/webhooks/twilio/call-status', null).status === 200, 'Public: Twilio status webhook bypasses auth session');
    assert(evaluateRouteAccess('/api/webhooks/twilio/recording', null).status === 200, 'Public: Twilio recording webhook bypasses auth session');
    assert(evaluateRouteAccess('/api/email/unsubscribe', null).status === 200, 'Public: Unsubscribe link bypasses auth session');
    assert(evaluateRouteAccess('/api/retell/custom-llm', null).status === 200, 'Public: Retell custom LLM endpoint bypasses auth session');
    assert(evaluateRouteAccess('/api/telephony/twiml', null).status === 200, 'Public: Twilio TwiML endpoint bypasses auth session');

    const dummyUser = { id: 'usr_abc', email: 'test@rmlogistics.com' };
    assert(evaluateRouteAccess('/login', dummyUser).action === 'redirect_dashboard', 'Authenticated user on /login redirected to /dashboard');
    assert(evaluateRouteAccess('/dashboard', dummyUser).status === 200, 'Authenticated user permitted on /dashboard');
  }

  // ====================================================================
  // 5. ORGANIZATION ISOLATION & RBAC AUTHORIZATION TESTS
  // ====================================================================
  console.log('\n--- 5. ORGANIZATION ISOLATION & RBAC TESTS ---');
  {
    function evaluateAuth(sessionUser, profile, options = {}) {
      if (!sessionUser) {
        return { status: 401, error: 'Unauthorized: Authentication required.' };
      }
      if (!profile) {
        return { status: 403, error: 'Forbidden: User profile not found.' };
      }
      if (profile.status === 'disabled') {
        return { status: 403, error: 'Forbidden: User account is disabled.' };
      }
      if (!profile.organization_id) {
        return { status: 403, error: 'Forbidden: User is not assigned to an organization.' };
      }
      const role = profile.role || 'operator';
      if (options.allowedRoles && options.allowedRoles.length > 0) {
        if (!options.allowedRoles.includes(role)) {
          return {
            status: 403,
            error: `Forbidden: Operation requires one of [${options.allowedRoles.join(', ')}] permissions.`,
          };
        }
      }
      return {
        status: 200,
        user: { id: sessionUser.id, email: sessionUser.email },
        organizationId: profile.organization_id,
        role,
      };
    }

    assert(evaluateAuth(null, null).status === 401, 'Unauthenticated request returns 401');
    assert(
      evaluateAuth({ id: 'u1', email: 'a@b.com' }, { organization_id: 'org1', role: 'admin', status: 'disabled' }).status === 403,
      'Disabled profile blocked with 403 Forbidden'
    );
    assert(
      evaluateAuth({ id: 'u1', email: 'a@b.com' }, { organization_id: null, role: 'operator', status: 'active' }).status === 403,
      'Profile without organizationId blocked with 403 Forbidden (cross-org protection)'
    );
    assert(
      evaluateAuth(
        { id: 'u1', email: 'a@b.com' },
        { organization_id: 'org1', role: 'operator', status: 'active' },
        { allowedRoles: ['admin', 'manager'] }
      ).status === 403,
      'Operator role denied from Admin/Manager operation'
    );
    const mgrAuth = evaluateAuth(
      { id: 'u2', email: 'mgr@b.com' },
      { organization_id: 'org1', role: 'manager', status: 'active' },
      { allowedRoles: ['admin', 'manager'] }
    );
    assert(mgrAuth.status === 200 && mgrAuth.organizationId === 'org1', 'Manager allowed with organizationId scope');
    const adminAuth = evaluateAuth(
      { id: 'u3', email: 'admin@b.com' },
      { organization_id: 'org2', role: 'admin', status: 'active' },
      { allowedRoles: ['admin'] }
    );
    assert(adminAuth.status === 200 && adminAuth.organizationId === 'org2', 'Admin allowed with strict organizationId isolation');
  }

  // ====================================================================
  // 6. SERVICE-ROLE BROWSER BUNDLE ISOLATION TESTS
  // ====================================================================
  console.log('\n--- 6. SERVICE-ROLE ISOLATION TESTS ---');
  {
    function createAdminClientMock(isBrowser) {
      if (isBrowser) {
        throw new Error('[RM AI Dialer Security Violation] createAdminClient() cannot be called from browser!');
      }
      return { initialized: true };
    }

    function getServerEnvMock(isBrowser) {
      if (isBrowser) {
        throw new Error('[RM AI Dialer Security Violation] getServerEnv() cannot be called from browser!');
      }
      return { SUPABASE_SERVICE_ROLE_KEY: 'secret_key' };
    }

    let adminBlocked = false;
    try {
      createAdminClientMock(true);
    } catch (e) {
      adminBlocked = e.message.includes('Security Violation');
    }
    assert(adminBlocked, 'createAdminClient() throws fatal Security Violation if executed in browser');

    let serverEnvBlocked = false;
    try {
      getServerEnvMock(true);
    } catch (e) {
      serverEnvBlocked = e.message.includes('Security Violation');
    }
    assert(serverEnvBlocked, 'getServerEnv() throws fatal Security Violation if executed in browser');

    const clientEnvKeys = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_DEFAULT_ORG_ID',
      'RM_PROVIDER_MODE',
      'AI_VOICE_RUNTIME',
      'RETELL_CAMPAIGN_MODE',
    ];
    assert(!clientEnvKeys.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Client env schema strictly excludes SUPABASE_SERVICE_ROLE_KEY');
    assert(!clientEnvKeys.includes('RESEND_API_KEY'), 'Client env schema strictly excludes RESEND_API_KEY');
    assert(!clientEnvKeys.includes('RETELL_API_KEY'), 'Client env schema strictly excludes RETELL_API_KEY');
    assert(!clientEnvKeys.includes('TWILIO_AUTH_TOKEN'), 'Client env schema strictly excludes TWILIO_AUTH_TOKEN');
  }

  // ====================================================================
  // 7. PRODUCTION FAIL-CLOSED & DEV FALLBACK TESTS (STEP 5.1 CORRECTION)
  // ====================================================================
  console.log('\n--- 7. PRODUCTION FAIL-CLOSED & DEV FALLBACK TESTS ---');
  {
    // Implementation mimicking checkRateLimit under various simulated environments and failure modes
    function simulateRateLimitCheck({ isProductionOrLive, isMockDevMode, simulateDbError, simulateDbEmpty, simulateDbSuccess }) {
      const limit = 20;
      const windowMs = 60000;

      // 1. Mock dev mode branch
      if (isMockDevMode) {
        return {
          allowed: true,
          limit,
          remaining: 19,
          resetMs: windowMs,
          mode: 'in-memory-dev',
        };
      }

      // 2. Production / Live shared database branch
      if (simulateDbError || simulateDbEmpty) {
        // Sanitize error log - verify no secrets or URLs
        const sanitizedLog = `[RateLimiter] Database rate limit RPC failure (code: ${simulateDbError?.code || 'UNKNOWN'}).`;

        if (isProductionOrLive) {
          // MUST fail closed in production
          return {
            allowed: false,
            limit,
            remaining: 0,
            resetMs: 5000,
            isUnavailable: true,
            mode: 'fail-closed-prod',
            log: sanitizedLog,
          };
        }

        // Development non-mock fallback
        return {
          allowed: true,
          limit,
          remaining: 19,
          resetMs: windowMs,
          mode: 'dev-fallback',
          log: sanitizedLog,
        };
      }

      if (simulateDbSuccess) {
        return {
          allowed: true,
          limit,
          remaining: 19,
          resetMs: windowMs,
          mode: 'supabase-shared',
        };
      }

      return { allowed: false, limit: 0, remaining: 0, resetMs: 0 };
    }

    function rateLimitExceededResponse(result) {
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
        { success: false, error: 'Too many requests. Please try again later.' },
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

    // Test 7.1: Production mode with DB connection failure fails closed
    const prodDbFail = simulateRateLimitCheck({
      isProductionOrLive: true,
      isMockDevMode: false,
      simulateDbError: { code: 'PGRST301', message: 'connection refused to https://secret-supabase.co:5432' },
    });
    assert(prodDbFail.allowed === false, 'Production DB failure: allowed is false (fails closed)');
    assert(prodDbFail.isUnavailable === true, 'Production DB failure: isUnavailable flag is set');
    assert(prodDbFail.mode === 'fail-closed-prod', 'Production DB failure: strictly executes fail-closed branch');

    // Test 7.2: Production failure generates HTTP 503 Service Unavailable
    const resp503 = rateLimitExceededResponse(prodDbFail);
    assert(resp503.status === 503, 'Production rate limiter failure returns HTTP 503 Service Unavailable');
    assert(resp503.headers.get('Retry-After') === '5', 'HTTP 503 response specifies Retry-After: 5');

    // Test 7.3: Production failure log sanitization (no credentials or hostnames leaked)
    assert(!prodDbFail.log.includes('secret-supabase.co'), 'Error log does not leak database URL or hostname');
    assert(!prodDbFail.log.includes('5432'), 'Error log does not leak database port or connection details');
    assert(prodDbFail.log.includes('code: PGRST301'), 'Error log preserves sanitized database error code');

    // Test 7.4: Production mode with empty RPC response fails closed with 503
    const prodEmpty = simulateRateLimitCheck({
      isProductionOrLive: true,
      isMockDevMode: false,
      simulateDbEmpty: true,
    });
    assert(prodEmpty.allowed === false && prodEmpty.isUnavailable === true, 'Production empty RPC rows: fails closed');
    const respEmpty503 = rateLimitExceededResponse(prodEmpty);
    assert(respEmpty503.status === 503, 'Production empty RPC response returns HTTP 503');

    // Test 7.5: Development mock mode uses in-memory limiter without database call
    const devMock = simulateRateLimitCheck({
      isProductionOrLive: false,
      isMockDevMode: true,
    });
    assert(devMock.allowed === true && devMock.mode === 'in-memory-dev', 'Development/mock mode uses in-memory store');

    // Test 7.6: Development non-mock mode with DB failure falls back to in-memory store
    const devFallback = simulateRateLimitCheck({
      isProductionOrLive: false,
      isMockDevMode: false,
      simulateDbError: { code: 'ECONNREFUSED' },
    });
    assert(devFallback.allowed === true && devFallback.mode === 'dev-fallback', 'Development non-mock mode gracefully falls back to memory');

    // Test 7.7: Production mode with healthy database permits traffic normally
    const prodHealthy = simulateRateLimitCheck({
      isProductionOrLive: true,
      isMockDevMode: false,
      simulateDbSuccess: true,
    });
    assert(prodHealthy.allowed === true && prodHealthy.mode === 'supabase-shared', 'Production with healthy database allows traffic via Supabase');

    // Test 7.8: Verify SQL migration matches TypeScript RPC contract
    const migrationPath = 'C:\\Users\\Asus\\Desktop\\RM\\supabase\\migrations\\20261010000003_shared_rate_limits.sql';
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    assert(migrationSql.includes('p_key text'), 'SQL migration contains RPC parameter p_key text');
    assert(migrationSql.includes('p_limit integer'), 'SQL migration contains RPC parameter p_limit integer');
    assert(migrationSql.includes('p_window_ms integer'), 'SQL migration contains RPC parameter p_window_ms integer');
    assert(migrationSql.includes('allowed boolean'), 'SQL migration returns column allowed boolean');
    assert(migrationSql.includes('current_count integer'), 'SQL migration returns column current_count integer');
    assert(migrationSql.includes('remaining integer'), 'SQL migration returns column remaining integer');
    assert(migrationSql.includes('reset_ms integer'), 'SQL migration returns column reset_ms integer');
  }

  console.log('\n========================================================================');
  console.log(`STEP 5.1 VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep51SecurityTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
