import { getServerEnv } from '@/lib/env';
import { createAnthropicJsonClient } from './claude-json';
import { hasDocumentedLawfulBasis } from './eligibility';
import { processFollowUp, type EngineDeps } from './engine';
import { assessAutomationReadiness } from './readiness';
import { createResendSender } from './resend';
import { SupabaseEmailStore } from './supabase-store';

function productionDeps(): EngineDeps {
  const env = getServerEnv();
  return {
    claude: createAnthropicJsonClient(),
    sender: createResendSender(),
    now: () => new Date(),
    appUrl: env.PUBLIC_URL || env.NEXT_PUBLIC_APP_URL,
    fromEmail: env.RESEND_FROM_EMAIL,
    replyTo: env.RESEND_REPLY_TO,
    unsubscribeSecret: env.EMAIL_UNSUBSCRIBE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export async function scheduleFollowUp(callId: string, trigger: 'analyzed' | 'completed'): Promise<void> {
  const store = new SupabaseEmailStore();
  const existing = await store.findJobByCallId(callId);
  if (trigger === 'completed' && !existing) return;
  const call = await store.loadCall(callId, trigger === 'analyzed');
  if (!call || !call.analyzed) return;
  const env = getServerEnv();
  const settings = await store.getSettings(call.organizationId);
  const readiness = assessAutomationReadiness({
    resendApiKey: env.RESEND_API_KEY,
    fromEmail: env.RESEND_FROM_EMAIL,
    replyTo: env.RESEND_REPLY_TO,
    webhookSecret: env.RESEND_WEBHOOK_SECRET,
    senderDomainVerified: settings.senderDomainVerified,
    campaignAuthorized: Boolean(
      call.campaign?.emailFollowupEnabled && hasDocumentedLawfulBasis(call.campaign.lawfulBasis, call.campaign.lawfulBasisNote)
    ),
  });
  const deps = productionDeps();
  deps.providerReady = readiness.canEnable;
  deps.providerBlockers = readiness.blockers;
  await processFollowUp(store, deps, call);
  const due = await store.listDueCallIds(call.organizationId, new Date().toISOString());
  for (const dueCallId of due) {
    if (dueCallId === callId) continue;
    const dueCall = await store.loadCall(dueCallId, false);
    if (!dueCall?.analyzed) continue;
    const dueReadiness = assessAutomationReadiness({
      resendApiKey: env.RESEND_API_KEY,
      fromEmail: env.RESEND_FROM_EMAIL,
      replyTo: env.RESEND_REPLY_TO,
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
      senderDomainVerified: settings.senderDomainVerified,
      campaignAuthorized: Boolean(
        dueCall.campaign?.emailFollowupEnabled &&
          hasDocumentedLawfulBasis(dueCall.campaign.lawfulBasis, dueCall.campaign.lawfulBasisNote)
      ),
    });
    await processFollowUp(store, { ...deps, providerReady: dueReadiness.canEnable, providerBlockers: dueReadiness.blockers }, dueCall);
  }
}
