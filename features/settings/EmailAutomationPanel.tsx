'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { EmailJob, LawfulBasis } from '@/services/email/types';

interface CampaignSetting {
  id: string;
  name: string;
  emailFollowupEnabled: boolean;
  lawfulBasis: LawfulBasis | null;
  lawfulBasisNote: string | null;
}

interface AutomationPayload {
  settings: {
    enabled: boolean;
    paused: boolean;
    hourlySendLimit: number;
    senderName: string;
    companyBlurb: string;
    inboundConfigured: boolean;
    senderDomainVerified: boolean;
  };
  sender: { fromEmail: string | null; replyTo: string | null; status: 'not_configured' | 'credentials_present' | 'delivery_observed' };
  readiness: { canEnable: boolean; blockers: { code: string; message: string }[] };
  counts: {
    queued: number;
    accepted: number;
    delivered: number;
    bounced: number;
    failed: number;
    suppressed: number;
    replies: number;
  };
  jobs: EmailJob[];
  messages: { message: { id: string; jobId: string; subject: string; status: string; toEmail: string }; events: { eventType: string; createdAt: string }[] }[];
  campaigns: CampaignSetting[];
}

const SENDER_LABEL = {
  not_configured: 'Resend is not configured',
  credentials_present: 'Credentials present. Delivery has not been confirmed.',
  delivery_observed: 'A Resend delivery webhook has been recorded.',
};

export function EmailAutomationPanel() {
  const [data, setData] = useState<AutomationPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await fetch('/api/email/automation');
    const body = (await response.json().catch(() => ({}))) as AutomationPayload & { error?: string };
    if (!response.ok) {
      setData(null);
      setError(body.error || 'Email automation could not be loaded.');
      setLoading(false);
      return;
    }
    setData(body);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const response = await fetch('/api/email/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; blockers?: { message: string }[] };
    if (!response.ok) {
      const detail = body.blockers?.map((item) => item.message).filter(Boolean).join(' ');
      setError(detail || body.error || 'The change was not saved.');
    }
    await load();
    setBusy(false);
  }

  const selected = data?.jobs.find((job) => job.id === selectedId) ?? null;
  const timeline = data?.messages.find((item) => item.message.jobId === selectedId);

  return (
    <section className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-heading">Email automation</h2>
          <p className="page-description">Claude qualifies finished calls. Resend sends only when the eligibility checks pass. Acceptance is not delivery.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy || !data} onClick={() => act({ action: data?.settings.enabled ? 'disable' : 'enable' })}>
            {data?.settings.enabled ? 'Turn off' : 'Turn on'}
          </Button>
          <Button size="sm" variant={data?.settings.paused ? 'primary' : 'danger'} disabled={busy || !data} onClick={() => act({ action: data?.settings.paused ? 'resume' : 'pause' })}>
            {data?.settings.paused ? 'Resume sends' : 'Emergency pause'}
          </Button>
        </div>
      </div>

      {loading && <p className="text-[13px] text-muted-foreground">Loading email automation…</p>}
      {error && <p className="text-[13px] text-error">{error}</p>}
      {data && data.readiness.blockers.length > 0 && (
        <ul className="list-disc pl-5 text-[13px] text-muted-foreground">
          {data.readiness.blockers.map((blocker) => (
            <li key={blocker.code}>{blocker.message}</li>
          ))}
        </ul>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusTile label="Automation" value={data.settings.paused ? 'Paused' : data.settings.enabled ? 'Enabled' : 'Off'} />
            <StatusTile label="Sender" value={data.sender.fromEmail || 'Not set'} detail={SENDER_LABEL[data.sender.status]} />
            <StatusTile label="Reply-to" value={data.sender.replyTo || 'Not set'} />
            <StatusTile label="Replies" value={String(data.counts.replies)} detail={data.settings.inboundConfigured ? 'Inbound receiving is marked configured.' : 'Inbound receiving is not configured.'} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Count label="Queued" value={data.counts.queued} />
            <Count label="Accepted" value={data.counts.accepted} />
            <Count label="Delivered" value={data.counts.delivered} />
            <Count label="Bounced" value={data.counts.bounced} />
            <Count label="Failed" value={data.counts.failed} />
            <Count label="Suppressed" value={data.counts.suppressed} />
          </div>

          <form
            className="grid gap-3 rounded-lg border border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void act({
                action: 'save_settings',
                senderName: String(form.get('senderName') || ''),
                companyBlurb: String(form.get('companyBlurb') || ''),
                hourlySendLimit: Number(form.get('hourlySendLimit') || 30),
                inboundConfigured: form.get('inboundConfigured') === 'on',
              });
            }}
          >
            <h3 className="text-[13px] font-medium">Approved sender profile</h3>
            <label className="grid gap-1 text-[12px] text-muted-foreground">
              Sender name
              <input name="senderName" defaultValue={data.settings.senderName} className="h-8 rounded-md border border-border bg-background px-2 text-[13px] text-foreground" />
            </label>
            <label className="grid gap-1 text-[12px] text-muted-foreground">
              Approved company description
              <textarea name="companyBlurb" defaultValue={data.settings.companyBlurb} rows={3} className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground" />
            </label>
            <label className="grid gap-1 text-[12px] text-muted-foreground">
              Hourly send limit
              <input name="hourlySendLimit" type="number" min={1} max={500} defaultValue={data.settings.hourlySendLimit} className="h-8 w-28 rounded-md border border-border bg-background px-2 text-[13px] text-foreground" />
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input name="inboundConfigured" type="checkbox" defaultChecked={data.settings.inboundConfigured} />
              Inbound reply receiving is configured
            </label>
            <Button size="sm" type="submit" disabled={busy}>Save profile</Button>
          </form>

          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-medium">Campaign authorization</h3>
            <p className="text-[12px] text-muted-foreground">A finished call is not permission to email a Belgium or EU lead. Record consent, a contract, or another documented basis.</p>
            {data.campaigns.length === 0 && <p className="text-[13px] text-muted-foreground">No campaigns in this workspace.</p>}
            {data.campaigns.map((campaign) => (
              <form
                key={campaign.id}
                className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_180px_1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void act({
                    action: 'set_campaign',
                    campaignId: campaign.id,
                    emailFollowupEnabled: form.get('enabled') === 'on',
                    lawfulBasis: String(form.get('basis') || '') || null,
                    lawfulBasisNote: String(form.get('note') || ''),
                  });
                }}
              >
                <span className="self-center text-[13px] font-medium">{campaign.name}</span>
                <select name="basis" defaultValue={campaign.lawfulBasis ?? ''} className="h-8 rounded-md border border-border bg-background px-2 text-[13px]">
                  <option value="">No documented basis</option>
                  <option value="consent">Consent</option>
                  <option value="contract">Contract</option>
                  <option value="legitimate_interest_documented">Documented legitimate interest</option>
                </select>
                <input name="note" defaultValue={campaign.lawfulBasisNote ?? ''} placeholder="Evidence for the lawful basis" className="h-8 rounded-md border border-border bg-background px-2 text-[13px]" />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[12px]">
                    <input name="enabled" type="checkbox" defaultChecked={campaign.emailFollowupEnabled} />
                    Allow
                  </label>
                  <Button size="sm" variant="outline" type="submit" disabled={busy}>Save</Button>
                </div>
              </form>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="overflow-x-auto">
              <table className="enterprise-table w-full">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.length === 0 && (
                    <tr>
                      <td colSpan={3}>No follow-up jobs yet.</td>
                    </tr>
                  )}
                  {data.jobs.map((job) => (
                    <tr key={job.id} onClick={() => setSelectedId(job.id)} className="cursor-pointer">
                      <td>{job.status}</td>
                      <td>{job.attempts}</td>
                      <td>{job.lastError || job.qualification?.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <aside className="rounded-lg border border-border p-3 text-[13px]">
              {!selected && <p className="text-muted-foreground">Select a job to inspect qualification, eligibility, and delivery.</p>}
              {selected && (
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium">Job detail</h3>
                  <p>Status: {selected.status}</p>
                  <p>Qualification: {selected.qualification?.status || 'Not qualified'}</p>
                  <p>Interest: {selected.qualification?.interestLevel || '—'}</p>
                  <p>Next step: {selected.qualification?.nextRecommendedAction || '—'}</p>
                  {selected.qualification?.evidence.map((item) => (
                    <blockquote key={item.quote} className="border-l-2 border-primary pl-2 text-[12px]">
                      {item.quote}
                    </blockquote>
                  ))}
                  {selected.eligibilityReasons.length > 0 && (
                    <ul className="list-disc pl-4 text-[12px]">
                      {selected.eligibilityReasons.map((reason) => (
                        <li key={reason.code}>{reason.message}</li>
                      ))}
                    </ul>
                  )}
                  {selected.draft && <p>Subject: {selected.draft.subject}</p>}
                  {selected.lastError && <p className="text-error">{selected.lastError}</p>}
                  <div>
                    <h4 className="font-medium">Delivery timeline</h4>
                    {!timeline && <p className="text-[12px] text-muted-foreground">No Resend events for this job.</p>}
                    {timeline?.events.map((event) => (
                      <p key={`${event.eventType}-${event.createdAt}`} className="text-[12px]">
                        {event.createdAt} · {event.eventType}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const response = await fetch('/api/email/jobs/drain', { method: 'POST' });
                const body = (await response.json().catch(() => ({}))) as { error?: string };
                if (!response.ok) setError(body.error || 'Due jobs could not be retried.');
                await load();
                setBusy(false);
              }}
            >
              Retry due jobs
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function StatusTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13px] font-medium">{value}</p>
      {detail && <p className="mt-1 text-[12px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="text-[18px] font-medium">{value}</p>
    </div>
  );
}
