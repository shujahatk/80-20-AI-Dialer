import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { hasDocumentedLawfulBasis } from '@/services/email/eligibility';
import { assessAutomationReadiness, campaignCanAuthorizeFollowUp, lookupVerifiedResendDomain } from '@/services/email/readiness';
import { SupabaseEmailStore } from '@/services/email/supabase-store';
import type { LawfulBasis } from '@/services/email/types';
import { isEmailAdmin, requireEmailAdmin } from '../access';

const BASES = new Set(['consent', 'contract', 'legitimate_interest_documented']);

function asBasis(value: unknown): LawfulBasis | null {
  return typeof value === 'string' && BASES.has(value) ? (value as LawfulBasis) : null;
}

function senderStatus(delivered: number) {
  const env = getServerEnv();
  const key = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;
  const configured = Boolean(key && from && !key.includes('mock') && !key.includes('your-') && from.includes('@'));
  if (delivered > 0) return 'delivery_observed';
  if (configured) return 'credentials_present';
  return 'not_configured';
}

export async function GET() {
  const access = await requireEmailAdmin();
  if (!isEmailAdmin(access)) return access;
  try {
    const store = new SupabaseEmailStore();
    const [settings, counts, jobs, messages, campaigns] = await Promise.all([
      store.getSettings(access.organizationId),
      store.counts(access.organizationId),
      store.listRecentJobs(access.organizationId, 40),
      store.listMessages(access.organizationId),
      store.listCampaigns(access.organizationId),
    ]);
    const env = getServerEnv();
    const campaignAuthorized = campaigns.some(
      (campaign) => campaign.emailFollowupEnabled && hasDocumentedLawfulBasis(campaign.lawfulBasis, campaign.lawfulBasisNote)
    );
    const readiness = assessAutomationReadiness({
      resendApiKey: env.RESEND_API_KEY,
      fromEmail: env.RESEND_FROM_EMAIL,
      replyTo: env.RESEND_REPLY_TO,
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
      senderDomainVerified: settings.senderDomainVerified,
      campaignAuthorized,
    });
    const timelines = await Promise.all(messages.slice(0, 40).map(async (message) => ({ message, events: await store.listEvents(message.id) })));
    return NextResponse.json({
      settings,
      sender: {
        fromEmail: env.RESEND_FROM_EMAIL || null,
        replyTo: env.RESEND_REPLY_TO || null,
        status: senderStatus(counts.delivered),
      },
      readiness,
      counts,
      jobs,
      messages: timelines,
      campaigns,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email storage is unavailable.';
    return NextResponse.json(
      { error: 'Email storage is unavailable. Apply the email automation migration before using this screen.', detail: message },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireEmailAdmin();
  if (!isEmailAdmin(access)) return access;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ error: 'A valid action is required.' }, { status: 400 });
  }
  const store = new SupabaseEmailStore();
  try {
    const current = await store.getSettings(access.organizationId);
    if (body.action === 'pause') await store.saveSettings(access.organizationId, { ...current, paused: true });
    else if (body.action === 'resume') await store.saveSettings(access.organizationId, { ...current, paused: false });
    else if (body.action === 'enable') {
      const env = getServerEnv();
      let senderDomainVerified = false;
      try {
        senderDomainVerified = await lookupVerifiedResendDomain(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
      } catch {
        senderDomainVerified = false;
      }
      const campaigns = await store.listCampaigns(access.organizationId);
      const readiness = assessAutomationReadiness({
        resendApiKey: env.RESEND_API_KEY,
        fromEmail: env.RESEND_FROM_EMAIL,
        replyTo: env.RESEND_REPLY_TO,
        webhookSecret: env.RESEND_WEBHOOK_SECRET,
        senderDomainVerified,
        campaignAuthorized: campaigns.some(
          (campaign) => campaign.emailFollowupEnabled && hasDocumentedLawfulBasis(campaign.lawfulBasis, campaign.lawfulBasisNote)
        ),
      });
      await store.saveSettings(access.organizationId, {
        ...current,
        enabled: readiness.canEnable,
        senderDomainVerified,
      });
      if (!readiness.canEnable) {
        return NextResponse.json(
          { error: 'Email automation stays off until sender setup and campaign authorization are verified.', blockers: readiness.blockers },
          { status: 409 }
        );
      }
    } else if (body.action === 'disable') await store.saveSettings(access.organizationId, { ...current, enabled: false, paused: false });
    else if (body.action === 'save_settings') {
      const hourly = Number(body.hourlySendLimit);
      await store.saveSettings(access.organizationId, {
        ...current,
        senderName: typeof body.senderName === 'string' && body.senderName.trim() ? body.senderName.trim().slice(0, 80) : current.senderName,
        companyBlurb: typeof body.companyBlurb === 'string' ? body.companyBlurb.trim().slice(0, 800) : current.companyBlurb,
        hourlySendLimit: Number.isFinite(hourly) ? Math.min(500, Math.max(1, Math.round(hourly))) : current.hourlySendLimit,
        inboundConfigured: Boolean(body.inboundConfigured),
      });
    } else if (body.action === 'set_campaign') {
      if (typeof body.campaignId !== 'string') return NextResponse.json({ error: 'Campaign is required.' }, { status: 400 });
      const lawfulBasis = asBasis(body.lawfulBasis);
      const lawfulBasisNote = typeof body.lawfulBasisNote === 'string' ? body.lawfulBasisNote.trim().slice(0, 500) : null;
      const authorizationError = campaignCanAuthorizeFollowUp(Boolean(body.emailFollowupEnabled), lawfulBasis, lawfulBasisNote);
      if (authorizationError) return NextResponse.json({ error: authorizationError }, { status: 400 });
      await store.setCampaign({
        organizationId: access.organizationId,
        campaignId: body.campaignId,
        emailFollowupEnabled: Boolean(body.emailFollowupEnabled),
        lawfulBasis,
        lawfulBasisNote,
      });
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The email setting could not be saved.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
