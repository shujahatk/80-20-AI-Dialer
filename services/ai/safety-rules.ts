/**
 * Deterministic Safety Guards & Prompt Injection Defense
 */

const DNC_PHRASES = [
  'do not call',
  "don't call",
  'stop calling',
  'remove me',
  'remove my number',
  'take me off',
  'take off your list',
  'remove from list',
  'unsubscribe',
  'lose my number',
  'never call again',
  'put me on dnc',
  'put me on the do not call',
  'do not contact',
  'cease calling',
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /disregard (all )?prior instructions/i,
  /system prompt override/i,
  /you are now (in developer mode|dan|unfiltered|jailbroken|a different)/i,
  /\bdan mode\b/i,
  /\bDAN\b/,
  /forget your instructions/i,
  /print your system prompt/i,
  /reveal your (api key|instructions|prompt)/i,
];

/**
 * Deterministic check for DNC / Opt-Out requests before LLM reasoning
 */
export function detectDncRequest(utterance: string): { isDnc: boolean; reason: string | null } {
  const normalized = utterance.toLowerCase().trim();

  for (const phrase of DNC_PHRASES) {
    if (normalized.includes(phrase)) {
      return {
        isDnc: true,
        reason: `Prospect explicitly stated: "${utterance.slice(0, 80)}"`,
      };
    }
  }

  return { isDnc: false, reason: null };
}

/**
 * Detects and neutralizes prompt injection attempts in prospect utterances
 */
export function sanitizeProspectUtterance(utterance: string): {
  sanitized: string;
  hasInjectionAttempt: boolean;
} {
  let hasInjectionAttempt = false;
  let sanitized = utterance;

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      hasInjectionAttempt = true;
      sanitized = sanitized.replace(pattern, '[filtered]');
    }
  }

  // Remove potential dangerous control tags
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\[system\]/gi, '[user note]')
    .replace(/\[instruction\]/gi, '[user message]')
    .replace(/\bDAN\b/gi, '[filtered]')
    .trim();

  return {
    sanitized,
    hasInjectionAttempt,
  };
}

/**
 * Validates that an AI spoken response does not violate critical business safety boundaries
 */
export function validateResponseSafety(spokenResponse: string): {
  isSafe: boolean;
  violationReason: string | null;
} {
  const lower = spokenResponse.toLowerCase();

  // 1. Unauthorized price commitments
  if (
    lower.includes('i can guarantee the price') ||
    lower.includes('i guarantee we will pay') ||
    lower.includes('i approve the price of') ||
    lower.includes('we will pay you exactly') ||
    lower.includes('i promise a rate of') ||
    /\bpay you \$\d+/i.test(lower) ||
    /\bguarantee.*pay/i.test(lower)
  ) {
    return {
      isSafe: false,
      violationReason: 'Pricing commitment: Unauthorized pricing guarantee detected in AI utterance.',
    };
  }

  // 2. Unauthorized contractual/logistics guarantees
  if (
    lower.includes('i guarantee our truck will arrive') ||
    lower.includes('i promise our truck will arrive') ||
    lower.includes('contract is legally binding right now') ||
    lower.includes('i have officially approved your purchase') ||
    /\bpromise.*truck.*arrive/i.test(lower)
  ) {
    return {
      isSafe: false,
      violationReason: 'Logistics commitment: Unauthorized logistical/legal guarantee detected in AI utterance.',
    };
  }

  return { isSafe: true, violationReason: null };
}
