'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';
import { ProviderGatewayCards } from '@/features/settings/ProviderGatewayCards';

export function IntegrationsPanel() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 className="text-base font-semibold text-on-surface">Providers &amp; gateways</h2>
            <p className="text-[13px] text-on-surface-variant">
              Live configuration status from the server environment. Credentials are never displayed.
            </p>
          </div>
        </div>
        <ProviderGatewayCards />
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="webhook" size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-on-surface">Outbound event webhooks</h2>
            <p className="text-[13px] text-on-surface-variant">
              Destination for call_started, call_ended, and call_analyzed events. Signing secrets stay in environment variables.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-on-surface">Webhook HTTPS endpoint</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="Configured in environment"
              className="rounded-lg border border-border bg-surface-elevated px-3.5 py-2.5 font-mono text-[12px] text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-on-surface">HMAC signing secret</label>
            <div className="flex items-center rounded-lg border border-border bg-surface-elevated px-3.5 py-2.5">
              <input
                type={showSecret ? 'text' : 'password'}
                readOnly
                value="••••••••••••••••••••"
                className="flex-1 border-none bg-transparent font-mono text-[12px] text-on-surface-variant focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowSecret((p) => !p)}
                className="ml-2 text-[12px] text-on-surface-variant hover:text-on-surface"
              >
                {showSecret ? 'Hidden' : 'Masked'}
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant">Secret values are stored server-side and are not shown here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
