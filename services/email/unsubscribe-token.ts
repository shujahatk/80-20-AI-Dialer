import { createHmac, timingSafeEqual } from 'node:crypto';

interface UnsubscribePayload {
  organizationId: string;
  leadId: string;
  email: string;
  exp: number;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createUnsubscribeToken(
  input: { organizationId: string; leadId: string; email: string },
  secret: string,
  now = Date.now()
): string {
  const payload: UnsubscribePayload = {
    organizationId: input.organizationId,
    leadId: input.leadId,
    email: input.email.trim().toLowerCase(),
    exp: now + 180 * 24 * 60 * 60 * 1000,
  };
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function readUnsubscribeToken(token: string, secret: string, now = Date.now()): UnsubscribePayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = sign(body, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UnsubscribePayload;
    if (!payload.organizationId || !payload.leadId || !payload.email || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}
