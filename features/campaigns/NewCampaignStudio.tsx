'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api/client';
import { Icon } from '@/lib/ui/icons';

interface LeadSummary {
  id: string;
  name: string;
  company: string;
  phone: string;
  isDnc: boolean;
  status: string;
}

export const NewCampaignStudio: React.FC = () => {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentId, setAgentId] = useState('ag_rachel');

  // Step 2: Leads
  const [availableLeads, setAvailableLeads] = useState<LeadSummary[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Step 3: Schedule & Retries
  const [callingDays, setCallingDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [callingWindowStart, setCallingWindowStart] = useState('09:00');
  const [callingWindowEnd, setCallingWindowEnd] = useState('17:00');
  const [timezone, setTimezone] = useState('America/New_York');
  const [maxAttempts, setMaxAttempts] = useState('4');
  const [retryDelayMinutes, setRetryDelayMinutes] = useState('60');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [concurrencyLimit, setConcurrencyLimit] = useState('10');

  useEffect(() => {
    setIsLoadingLeads(true);
    authenticatedFetch('/api/leads?limit=100')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const list: LeadSummary[] = data.data.map((l: any) => ({
            id: l.id,
            name: l.name || l.fullName || 'Unknown',
            company: l.company || l.companyName || 'Unknown',
            phone: l.phone || '',
            isDnc: Boolean(l.isDnc || l.is_dnc || l.status === 'dnc'),
            status: l.status || 'new',
          }));
          setAvailableLeads(list);
          setSelectedLeadIds(list.filter((l) => !l.isDnc).map((l) => l.id));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingLeads(false));
  }, []);

  const eligibility = useMemo(() => {
    const selected = availableLeads.filter((l) => selectedLeadIds.includes(l.id));
    const dncCount = selected.filter((l) => l.isDnc).length;
    const invalidCount = selected.filter((l) => !l.phone || l.phone.length < 7).length;
    const eligibleCount = selected.filter((l) => !l.isDnc && l.phone && l.phone.length >= 7).length;

    return {
      total: selected.length,
      dnc: dncCount,
      invalid: invalidCount,
      eligible: eligibleCount,
    };
  }, [availableLeads, selectedLeadIds]);

  const handleToggleDay = (day: number) => {
    setCallingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSelectAllLeads = () => {
    if (selectedLeadIds.length === availableLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(availableLeads.map((l) => l.id));
    }
  };

  const handleSelectCallableOnly = () => {
    setSelectedLeadIds(availableLeads.filter((l) => !l.isDnc).map((l) => l.id));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErrorMessage('Campaign name is required.');
      setStep(1);
      return;
    }
    if (eligibility.eligible === 0) {
      setErrorMessage('Must select at least 1 eligible, non-DNC lead to start campaign.');
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          agentId,
          leadIds: selectedLeadIds,
          callingDays,
          callingWindowStart,
          callingWindowEnd,
          timezone,
          maxAttemptsPerLead: parseInt(maxAttempts, 10) || 3,
          retryDelayMinutes: parseInt(retryDelayMinutes, 10) || 60,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          concurrencyLimit: parseInt(concurrencyLimit, 10) || 10,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      router.push('/campaigns');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error creating campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysOfWeek = [
    { num: 1, name: 'Mon' },
    { num: 2, name: 'Tue' },
    { num: 3, name: 'Wed' },
    { num: 4, name: 'Thu' },
    { num: 5, name: 'Fri' },
    { num: 6, name: 'Sat' },
    { num: 0, name: 'Sun' },
  ];

  return (
    <div className="flex flex-col w-full bg-background min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-[1200px] w-full mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              <Icon name="arrow_back" size={16} />
              <span>Back to Campaigns</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2.5">
              <Icon name="megaphone" size={26} className="text-primary" />
              <span>New Outbound Campaign Studio</span>
            </h1>
            <p className="text-sm text-on-surface-variant">
              Configure target list enrollment, assign a published Retell AI agent, and define TCPA pacing rules.
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-4 rounded-lg bg-surface border border-border overflow-hidden text-xs uppercase font-semibold">
          {[
            { s: 1, label: '1. Identity & Agent' },
            { s: 2, label: '2. Target Leads' },
            { s: 3, label: '3. Cadence & Rules' },
            { s: 4, label: '4. Review & Launch' },
          ].map((item) => (
            <button
              key={item.s}
              type="button"
              onClick={() => setStep(item.s as any)}
              className={`py-3 px-4 flex items-center justify-center gap-2 border-r last:border-r-0 border-border transition-colors ${
                step === item.s
                  ? 'bg-primary text-primary-foreground font-bold'
                  : step > item.s
                  ? 'bg-surface-secondary text-on-surface'
                  : 'text-on-surface-variant'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === item.s
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-surface text-on-surface border border-border'
                }`}
              >
                {step > item.s ? '✓' : item.s}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="p-4 rounded-lg bg-error/15 border border-error/30 text-error text-sm flex items-center gap-2">
            <Icon name="error" size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Basics & Agent */}
        {step === 1 && (
          <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-6 shadow-sm">
            <h3 className="text-lg font-bold text-on-surface">Campaign Identity & Assigned Voice Agent</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g. Q4 Industrial Surplus Recovery Outreach"
                  className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">Campaign Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Targeting warehouse operations managers and manufacturing procurement directors."
                  className="px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">Assigned AI Agent *</label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none focus:border-primary font-medium"
                >
                  <option value="ag_rachel">Rachel - RM Purchasing & Surplus Materials (Published v2.4 • Retell AI)</option>
                  <option value="ag_marcus">Marcus - Enterprise Logistics Dispatch (Published v1.8 • Retell AI)</option>
                </select>
                <span className="text-xs text-on-surface-variant">
                  Only published, simulation-verified AI voice agents can be assigned to active campaigns.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!name.trim()}
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary-hover disabled:opacity-50"
              >
                Next: Select Leads →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Leads Selection */}
        {step === 2 && (
          <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Enroll Target Leads</h3>
                <p className="text-xs text-on-surface-variant">
                  Select CRM leads to enroll into this campaign queue.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectCallableOnly}
                  className="px-3 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-secondary text-xs font-semibold text-primary border border-border"
                >
                  Select All Callable
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllLeads}
                  className="px-3 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-secondary text-xs font-semibold text-on-surface border border-border"
                >
                  Toggle All
                </button>
              </div>
            </div>

            {/* Eligibility summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-surface-elevated border border-border text-center">
                <span className="text-xs text-on-surface-variant font-mono uppercase">Selected</span>
                <span className="text-xl font-bold text-on-surface block mt-0.5">{eligibility.total}</span>
              </div>
              <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-center">
                <span className="text-xs text-success font-mono uppercase">Eligible to Dial</span>
                <span className="text-xl font-bold text-success block mt-0.5">{eligibility.eligible}</span>
              </div>
              <div className="p-3 rounded-lg bg-error/10 border border-error/30 text-center">
                <span className="text-xs text-error font-mono uppercase">DNC Blocked</span>
                <span className="text-xl font-bold text-error block mt-0.5">{eligibility.dnc}</span>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                <span className="text-xs text-amber-600 dark:text-amber-400 font-mono uppercase">Invalid Phone</span>
                <span className="text-xl font-bold text-amber-600 dark:text-amber-400 block mt-0.5">{eligibility.invalid}</span>
              </div>
            </div>

            {/* Leads selection table */}
            <div className="max-h-72 overflow-y-auto border border-border rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-elevated sticky top-0 border-b border-border font-mono uppercase text-on-surface-variant">
                  <tr>
                    <th className="p-2.5 w-10">Select</th>
                    <th className="p-2.5">Contact Name</th>
                    <th className="p-2.5">Company</th>
                    <th className="p-2.5">Phone</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {availableLeads.map((l) => {
                    const isSelected = selectedLeadIds.includes(l.id);
                    return (
                      <tr key={l.id} className={isSelected ? 'bg-primary/5' : 'hover:bg-surface-elevated'}>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setSelectedLeadIds((prev) =>
                                e.target.checked ? [...prev, l.id] : prev.filter((id) => id !== l.id)
                              );
                            }}
                          />
                        </td>
                        <td className="p-2.5 font-semibold text-on-surface">{l.name}</td>
                        <td className="p-2.5 text-on-surface-variant">{l.company}</td>
                        <td className="p-2.5 font-mono">{l.phone}</td>
                        <td className="p-2.5">
                          {l.isDnc ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-error/15 text-error">
                              DNC PROTECTED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/15 text-success">
                              CALLABLE
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-surface-elevated text-on-surface text-sm font-semibold border border-border hover:bg-surface-secondary"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={eligibility.eligible === 0}
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary-hover disabled:opacity-50"
              >
                Next: Cadence Rules →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Cadence & Rules */}
        {step === 3 && (
          <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-6 shadow-sm">
            <h3 className="text-lg font-bold text-on-surface">Calling Schedule, Timezone & Retry Cadence</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">Timezone Enforcement</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none"
                >
                  <option value="America/New_York">Eastern Time (US/New York)</option>
                  <option value="America/Chicago">Central Time (US/Chicago)</option>
                  <option value="America/Denver">Mountain Time (US/Denver)</option>
                  <option value="America/Los_Angeles">Pacific Time (US/Los Angeles)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">Max Dials per Lead</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">Calling Window (Start - End)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={callingWindowStart}
                    onChange={(e) => setCallingWindowStart(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm w-full"
                  />
                  <span className="text-xs text-on-surface-variant">to</span>
                  <input
                    type="time"
                    value={callingWindowEnd}
                    onChange={(e) => setCallingWindowEnd(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">Concurrency Limit</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={concurrencyLimit}
                  onChange={(e) => setConcurrencyLimit(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-on-surface text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Allowed Days */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface">Permissible Dialing Days</label>
              <div className="flex gap-2">
                {daysOfWeek.map((d) => (
                  <button
                    key={d.num}
                    type="button"
                    onClick={() => handleToggleDay(d.num)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                      callingDays.includes(d.num)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-elevated border border-border text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg bg-surface-elevated text-on-surface text-sm font-semibold border border-border hover:bg-surface-secondary"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary-hover"
              >
                Next: Review Campaign →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Launch */}
        {step === 4 && (
          <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-6 shadow-sm">
            <h3 className="text-lg font-bold text-on-surface">Review & Launch Campaign</h3>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-surface-elevated border border-border text-sm">
              <div>
                <span className="text-xs text-on-surface-variant uppercase font-mono block">Campaign Name</span>
                <span className="font-bold text-on-surface text-base">{name}</span>
              </div>
              <div>
                <span className="text-xs text-on-surface-variant uppercase font-mono block">Assigned Agent</span>
                <span className="font-bold text-primary text-base">Rachel (Retell AI v2.4)</span>
              </div>
              <div>
                <span className="text-xs text-on-surface-variant uppercase font-mono block">Enrolled Leads</span>
                <span className="font-bold text-success text-base">{eligibility.eligible} Active Callable Leads</span>
              </div>
              <div>
                <span className="text-xs text-on-surface-variant uppercase font-mono block">Calling Hours</span>
                <span className="font-bold text-on-surface text-base">{callingWindowStart} - {callingWindowEnd} ({timezone})</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-lg bg-surface-elevated text-on-surface text-sm font-semibold border border-border hover:bg-surface-secondary"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-3 rounded-lg bg-primary text-primary-foreground text-base font-bold hover:bg-primary-hover shadow-lg flex items-center gap-2"
              >
                <Icon name="rocket" size={20} />
                <span>{isSubmitting ? 'Creating Campaign...' : 'Launch Outbound Campaign'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
