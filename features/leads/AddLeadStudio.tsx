'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/lib/ui/icons';

export const AddLeadStudio: React.FC = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    jobTitle: '',
    phone: '',
    email: '',
    timezone: 'America/New_York',
    fleetSize: '',
    tags: 'Inbound, Tier-1',
    initialNote: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const tagsArray = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          companyName: formData.companyName,
          jobTitle: formData.jobTitle || undefined,
          phone: formData.phone,
          email: formData.email || undefined,
          timezone: formData.timezone,
          tags: tagsArray,
          initialNote: formData.initialNote || undefined,
          customFields: {
            fleetSize: formData.fleetSize || undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create lead record');
      }

      router.push('/leads');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error creating lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full bg-background min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-[1000px] w-full mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <Link
              href="/leads"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              <Icon name="arrow_back" size={16} />
              <span>Back to Leads CRM</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2.5">
              <Icon name="person_add" size={26} className="text-primary" />
              <span>Add New Lead</span>
            </h1>
            <p className="text-sm text-on-surface-variant">
              Register a single contact record with E.164 phone normalization and instant DNC check.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-lg bg-error/15 border border-error/30 text-error text-sm flex items-center gap-2">
            <Icon name="error" size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Lead Form Studio */}
        <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                First Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Alexander"
                className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Last Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Wright"
                className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Company Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Starlight Logistics Inc."
                className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">Job Title</label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="VP of Operations"
                className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Phone Number (E.164) <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+14158902341"
                className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">Direct Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="a.wright@starlightlogistics.com"
                className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">Timezone</label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
              >
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                <option value="Europe/London">London / GMT</option>
                <option value="Europe/Brussels">Central European (CET)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">Tags (Comma-separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="Tier-1, Fleet Ops, Cold"
                className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Initial Context & Notes</label>
            <textarea
              rows={3}
              value={formData.initialNote}
              onChange={(e) => setFormData({ ...formData, initialNote: e.target.value })}
              placeholder="E.g. Met at Freight Logistics Expo 2026. Interested in autonomous dispatch and container return rebates."
              className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Link
              href="/leads"
              className="px-4 py-2 rounded-lg bg-surface-elevated text-on-surface text-sm font-semibold hover:bg-surface-secondary border border-border"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary-hover shadow-md"
            >
              {isSubmitting ? 'Creating Lead...' : 'Save & Register Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
