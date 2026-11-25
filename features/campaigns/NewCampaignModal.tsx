'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { authenticatedFetch } from '@/lib/api/client';
import { Icon } from '@/lib/ui/icons';

interface NewCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

interface LeadSummary {
  id: string;
  name: string;
  company: string;
  phone: string;
  isDnc: boolean;
  status: string;
}

export const NewCampaignModal: React.FC<NewCampaignModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load leads when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMessage(null);
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
            // Default select all non-DNC leads
            setSelectedLeadIds(list.filter((l) => !l.isDnc).map((l) => l.id));
          }
        })
        .catch(() => {
          // Fallback gracefully
        })
        .finally(() => {
          setIsLoadingLeads(false);
        });
    }
  }, [isOpen]);

  // Lead eligibility summary metrics
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

  if (!isOpen) return null;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(availableLeads.map((l) => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleDay = (dayNum: number) => {
    setCallingDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort()
    );
  };

  const handleCreateCampaign = async (startImmediately: boolean) => {
    if (!name.trim()) {
      setErrorMessage('Please enter a campaign name.');
      setStep(1);
      return;
    }
    if (callingDays.length === 0) {
      setErrorMessage('Please select at least one calling day.');
      setStep(3);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Create the campaign
      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          status: 'draft',
          aiAgentId: agentId,
          callingDays,
          callingWindowStart,
          callingWindowEnd,
          timezone,
          maxAttemptsPerLead: parseInt(maxAttempts, 10) || 4,
          retryDelayMinutes: parseInt(retryDelayMinutes, 10) || 60,
          concurrencyLimit: parseInt(concurrencyLimit, 10) || 10,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        }),
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to create campaign');
      }

      const campaignId = createData.data.id;

      // 2. Enroll selected leads if any
      if (selectedLeadIds.length > 0) {
        const enrollRes = await fetch(`/api/campaigns/${campaignId}/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds: selectedLeadIds }),
        });
        const enrollData = await enrollRes.json();
        if (!enrollData.success) {
          throw new Error(enrollData.error || 'Failed to enroll leads');
        }
      }

      // 3. Start immediately if user requested
      if (startImmediately) {
        const startRes = await fetch(`/api/campaigns/${campaignId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        });
        const startData = await startRes.json();
        if (!startData.success) {
          throw new Error(startData.error || 'Campaign created but failed to start');
        }
      }

      onCreated?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while creating the campaign.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysLabel = [
    { num: 1, label: 'Mon' },
    { num: 2, label: 'Tue' },
    { num: 3, label: 'Wed' },
    { num: 4, label: 'Thu' },
    { num: 5, label: 'Fri' },
    { num: 6, label: 'Sat' },
    { num: 0, label: 'Sun' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-container-lowest/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-surface-container-low rounded-2xl p-6 shadow-2xl border border-outline-variant/20 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              <Icon name="rocket_launch" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                Create Outbound Campaign
              </h2>
              <p className="text-xs text-on-surface-variant">
                Configure your calling campaign, assign leads, and define calling windows.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            type="button"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 text-xs font-semibold border-b border-outline-variant/10 pb-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 ${
              step === 1 ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-surface-container text-[0.6875rem]">
              1
            </span>
            <span>Details</span>
          </button>
          <span className="text-outline-variant/40">→</span>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`flex items-center gap-1.5 ${
              step === 2 ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-surface-container text-[0.6875rem]">
              2
            </span>
            <span>Leads</span>
          </button>
          <span className="text-outline-variant/40">→</span>
          <button
            type="button"
            onClick={() => setStep(3)}
            className={`flex items-center gap-1.5 ${
              step === 3 ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-surface-container text-[0.6875rem]">
              3
            </span>
            <span>Schedule</span>
          </button>
          <span className="text-outline-variant/40">→</span>
          <button
            type="button"
            onClick={() => setStep(4)}
            className={`flex items-center gap-1.5 ${
              step === 4 ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-surface-container text-[0.6875rem]">
              4
            </span>
            <span>Review &amp; Launch</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-error-container/30 border border-error/20 text-error text-xs flex items-center gap-2">
            <Icon name="error" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-on-surface">Campaign Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Q4 Logistics Decision Makers Blast"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface-container text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/10 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-on-surface">Description</label>
              <textarea
                rows={2}
                placeholder="Brief campaign purpose and prospect qualification goals..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-surface-container text-on-surface text-xs rounded-lg px-3 py-2 border border-outline-variant/10 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-on-surface">Assigned AI Agent *</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="bg-surface-container text-on-surface text-xs rounded-lg px-3 py-2 border border-outline-variant/10 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ag_rachel">Rachel — Enterprise Outbound SDR (Direct &amp; Consultative)</option>
                <option value="ag_marcus">Marcus — Fleet Account Executive (Discovery &amp; Objection Handling)</option>
                <option value="ag_elena">Elena — Fast Qualification &amp; Demo Booking (High Energy)</option>
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    setErrorMessage('Please enter a campaign name');
                    return;
                  }
                  setErrorMessage(null);
                  setStep(2);
                }}
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold transition-all"
              >
                Next: Choose Leads →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Leads Selection */}
        {step === 2 && (
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-on-surface">
                Select Leads to Enroll ({selectedLeadIds.length} of {availableLeads.length} selected)
              </span>
              <button
                type="button"
                onClick={() => handleSelectAll(selectedLeadIds.length < availableLeads.length)}
                className="text-primary hover:underline font-semibold"
              >
                {selectedLeadIds.length < availableLeads.length ? 'Select All' : 'Deselect All'}
              </button>
            </div>

            {/* Eligibility Quick Strip */}
            <div className="grid grid-cols-4 gap-2 text-center p-2 rounded-lg bg-surface-container border border-outline-variant/10">
              <div>
                <span className="text-[0.6875rem] text-on-surface-variant block">Selected</span>
                <span className="text-sm font-bold text-on-surface">{eligibility.total}</span>
              </div>
              <div>
                <span className="text-[0.6875rem] text-primary block">Eligible</span>
                <span className="text-sm font-bold text-primary">{eligibility.eligible}</span>
              </div>
              <div>
                <span className="text-[0.6875rem] text-error block">DNC Excluded</span>
                <span className="text-sm font-bold text-error">{eligibility.dnc}</span>
              </div>
              <div>
                <span className="text-[0.6875rem] text-on-surface-variant block">Invalid Phone</span>
                <span className="text-sm font-bold text-on-surface-variant">{eligibility.invalid}</span>
              </div>
            </div>

            {/* Leads Table Preview */}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-outline-variant/10 bg-surface-container-low">
              {isLoadingLeads ? (
                <div className="p-4 text-center text-on-surface-variant">Loading available leads...</div>
              ) : availableLeads.length === 0 ? (
                <div className="p-4 text-center text-on-surface-variant">No leads available to enroll.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-surface-container border-b border-outline-variant/10 sticky top-0">
                    <tr>
                      <th className="p-2 w-8"></th>
                      <th className="p-2 font-semibold text-on-surface">Name</th>
                      <th className="p-2 font-semibold text-on-surface">Company</th>
                      <th className="p-2 font-semibold text-on-surface">Phone</th>
                      <th className="p-2 font-semibold text-on-surface">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {availableLeads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          className={`hover:bg-surface-container/60 transition-colors ${
                            lead.isDnc ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLead(lead.id)}
                              className="rounded border-outline-variant/30 text-primary focus:ring-primary"
                            />
                          </td>
                          <td className="p-2 font-medium text-on-surface">{lead.name}</td>
                          <td className="p-2 text-on-surface-variant">{lead.company}</td>
                          <td className="p-2 text-on-surface-variant font-mono text-[0.6875rem]">
                            {lead.phone || 'Missing'}
                          </td>
                          <td className="p-2">
                            {lead.isDnc ? (
                              <span className="px-1.5 py-0.5 rounded text-[0.625rem] font-bold bg-error-container/40 text-error">
                                DNC
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[0.625rem] font-bold bg-surface-container text-on-surface-variant">
                                Callable
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold transition-all"
              >
                Next: Calling Schedule →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Schedule & Retries */}
        {step === 3 && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Calling Days */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-on-surface">Calling Days *</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {daysLabel.map((day) => {
                  const isChecked = callingDays.includes(day.num);
                  return (
                    <button
                      key={day.num}
                      type="button"
                      onClick={() => toggleDay(day.num)}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors ${
                        isChecked
                          ? 'bg-primary-container text-on-primary-container border border-primary/30'
                          : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calling Hours & Timezone */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Start Hour (Local)</label>
                <input
                  type="time"
                  value={callingWindowStart}
                  onChange={(e) => setCallingWindowStart(e.target.value)}
                  className="bg-surface-container text-on-surface rounded-lg px-2.5 py-1.5 border border-outline-variant/10 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">End Hour (Local)</label>
                <input
                  type="time"
                  value={callingWindowEnd}
                  onChange={(e) => setCallingWindowEnd(e.target.value)}
                  className="bg-surface-container text-on-surface rounded-lg px-2.5 py-1.5 border border-outline-variant/10 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="bg-surface-container text-on-surface rounded-lg px-2.5 py-1.5 border border-outline-variant/10 text-xs"
                >
                  <option value="America/New_York">Eastern Time (EST/EDT)</option>
                  <option value="America/Chicago">Central Time (CST/CDT)</option>
                  <option value="America/Denver">Mountain Time (MST/MDT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                  <option value="UTC">UTC Universal</option>
                </select>
              </div>
            </div>

            {/* Max Attempts & Retry Delay */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Maximum Attempts per Lead</label>
                <select
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  className="bg-surface-container text-on-surface rounded-lg px-2.5 py-1.5 border border-outline-variant/10 text-xs"
                >
                  <option value="2">2 attempts</option>
                  <option value="3">3 attempts</option>
                  <option value="4">4 attempts (Recommended)</option>
                  <option value="6">6 attempts</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Retry Delay</label>
                <select
                  value={retryDelayMinutes}
                  onChange={(e) => setRetryDelayMinutes(e.target.value)}
                  className="bg-surface-container text-on-surface rounded-lg px-2.5 py-1.5 border border-outline-variant/10 text-xs"
                >
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour (Recommended)</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                  <option value="1440">24 hours (Next day)</option>
                </select>
              </div>
            </div>

            {/* Advanced section toggle */}
            <div className="border border-outline-variant/10 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-2.5 bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-semibold text-on-surface"
              >
                <span>Advanced Calling Settings</span>
                <Icon name={showAdvanced ? 'expand_less' : 'expand_more'} size={16} />
              </button>

              {showAdvanced && (
                <div className="p-3 bg-surface-container-low flex flex-col gap-3 border-t border-outline-variant/10">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[0.6875rem] text-on-surface-variant font-medium">
                        Simultaneous Line Limit
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={concurrencyLimit}
                        onChange={(e) => setConcurrencyLimit(e.target.value)}
                        className="bg-surface-container text-on-surface rounded px-2.5 py-1.5 border border-outline-variant/10 text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[0.6875rem] text-on-surface-variant font-medium">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-surface-container text-on-surface rounded px-2.5 py-1.5 border border-outline-variant/10 text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[0.6875rem] text-on-surface-variant font-medium">
                        End Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-surface-container text-on-surface rounded px-2.5 py-1.5 border border-outline-variant/10 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold transition-all"
              >
                Review Campaign →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Launch */}
        {step === 4 && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-on-surface">{name}</span>
                <span className="px-2 py-0.5 rounded text-[0.6875rem] font-semibold bg-tertiary-container/30 text-tertiary">
                  Ready to Launch
                </span>
              </div>
              <p className="text-on-surface-variant text-xs">{description || 'No description'}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-outline-variant/10 text-[0.6875rem]">
                <div>
                  <span className="text-on-surface-variant block">Calling Window</span>
                  <span className="font-semibold text-on-surface">
                    {callingWindowStart} - {callingWindowEnd}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Timezone</span>
                  <span className="font-semibold text-on-surface">{timezone.split('/')[1] || timezone}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Max Attempts</span>
                  <span className="font-semibold text-on-surface">{maxAttempts} attempts</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Retry Delay</span>
                  <span className="font-semibold text-on-surface">{retryDelayMinutes} mins</span>
                </div>
              </div>
            </div>

            {/* Summary Lead Eligibility Breakdown */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/10 flex flex-col gap-2">
              <span className="font-semibold text-on-surface">Lead Enrollment Breakdown</span>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded bg-surface-container">
                  <span className="text-[0.6875rem] text-on-surface-variant block">Total Selected</span>
                  <span className="text-base font-bold text-on-surface">{eligibility.total}</span>
                </div>
                <div className="p-2 rounded bg-tertiary-container/20">
                  <span className="text-[0.6875rem] text-tertiary block">Callable Leads</span>
                  <span className="text-base font-bold text-tertiary">{eligibility.eligible}</span>
                </div>
                <div className="p-2 rounded bg-error-container/20">
                  <span className="text-[0.6875rem] text-error block">DNC Protected</span>
                  <span className="text-base font-bold text-error">{eligibility.dnc}</span>
                </div>
                <div className="p-2 rounded bg-surface-container">
                  <span className="text-[0.6875rem] text-on-surface-variant block">Invalid Excluded</span>
                  <span className="text-base font-bold text-on-surface-variant">{eligibility.invalid}</span>
                </div>
              </div>
              <p className="text-[0.6875rem] text-on-surface-variant mt-1">
                🛡️ Do-Not-Call (DNC) protection is actively enforced. DNC leads will not be enqueued.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface"
              >
                ← Back
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCreateCampaign(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCreateCampaign(true)}
                  className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold shadow-sm transition-all"
                >
                  {isSubmitting ? 'Starting...' : 'Start Campaign Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
