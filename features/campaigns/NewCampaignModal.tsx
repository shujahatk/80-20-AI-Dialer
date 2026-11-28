'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { authenticatedFetch } from '@/lib/api/client';
import {
  Sparkles,
  Users,
  Calendar,
  Rocket,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  PhoneCall,
  Mail,
  Clock,
  ShieldAlert,
  Search,
  Upload,
  AlertCircle,
  CheckCircle2,
  Sliders,
  FileText,
  Building2,
  UserCheck,
  CalendarClock,
  Send,
  Eye,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  campaignId?: string | null;
}

const DESIRED_OUTCOME_PRESETS = [
  {
    id: 'commercial-quote',
    title: 'Commercial Materials & Quotation',
    badge: 'Recommended',
    description: 'Confirm decision-maker authority, target material interest, estimated tonnage/volume, and agreement to receive formal commercial quotation.',
  },
  {
    id: 'consultation-booking',
    title: 'Technical Consultation & Callback',
    badge: 'Executive',
    description: 'Confirm procurement responsibility, current supply pain points, and secure scheduled technical review consultation with senior desk.',
  },
  {
    id: 'general-qualification',
    title: 'General Commercial Interest',
    badge: 'Broad',
    description: 'Confirm that prospect is active buyer of industrial materials, captures primary commercial contact email, and validates procurement cycle.',
  },
];

export const NewCampaignModal: React.FC<NewCampaignModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Step 1: Campaign Details & Intelligence ---
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentId, setAgentId] = useState('ag_rachel');
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; name: string; retell_agent_id?: string; voice?: string }>>([]);
  const [desiredOutcome, setDesiredOutcome] = useState(DESIRED_OUTCOME_PRESETS[0].description);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('commercial-quote');

  // --- Step 2: Leads Selection ---
  const [availableLeads, setAvailableLeads] = useState<LeadSummary[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadEligibilityFilter, setLeadEligibilityFilter] = useState<'all' | 'callable' | 'unassigned'>('all');

  // --- Step 3: Email & Schedule ---
  const [emailFollowupEnabled, setEmailFollowupEnabled] = useState(true);
  const [emailSubject, setEmailSubject] = useState(
    'RM Global Materials — Commercial Follow-Up for {{company_name}}'
  );
  const [emailBody, setEmailBody] = useState(
    'Dear {{contact_name}},\n\nThank you for speaking with our commercial desk today regarding {{material_interest}}.\n\nAs discussed on our call, we have noted your requirement for {{estimated_volume}} and prepared our technical specifications and commercial terms for {{company_name}}.\n\nPlease reply with your preferred delivery schedule so we can finalize your formal quotation.'
  );
  const [companySignature, setCompanySignature] = useState(
    'RM Global Materials — Commercial Desk | sales@rmrg.be'
  );
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Scheduling
  const [launchMode, setLaunchMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [callingDays, setCallingDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [callingWindowStart, setCallingWindowStart] = useState('09:00');
  const [callingWindowEnd, setCallingWindowEnd] = useState('17:00');
  const [timezone, setTimezone] = useState('America/New_York');

  // Load leads and agents when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMessage(null);
      setIsLoadingLeads(true);
      Promise.all([
        authenticatedFetch('/api/leads?limit=100').then((res) => res.json()).catch(() => ({})),
        authenticatedFetch('/api/agents').then((res) => res.json()).catch(() => ({})),
      ])
        .then(([data, agentsJson]) => {
          if (data.success && Array.isArray(data.data)) {
            const list: LeadSummary[] = data.data.map((l: any) => ({
              id: l.id,
              name: l.name || l.fullName || 'Unnamed prospect',
              company: l.company || l.companyName || '—',
              phone: l.phone || l.phone_e164 || '',
              isDnc: Boolean(l.isDnc || l.is_dnc || l.status === 'dnc'),
              status: l.status || 'new',
              campaignId: l.campaignId || null,
            }));
            setAvailableLeads(list);
            // Default select callable leads up to 100
            setSelectedLeadIds(list.filter((l) => !l.isDnc && l.phone && l.phone.length >= 7).slice(0, 100).map((l) => l.id));
          }
          const rawAgents = Array.isArray(agentsJson.data)
            ? agentsJson.data
            : Array.isArray(agentsJson.agents)
            ? agentsJson.agents
            : [];
          if (rawAgents.length > 0) {
            setAvailableAgents(rawAgents);
            setAgentId(rawAgents[0].id);
          } else {
            // Default agent fallback
            setAvailableAgents([
              {
                id: 'ag_rachel',
                name: 'Rachel — RM Commercial Trading & Materials Agent',
                retell_agent_id: 'agent_25a6c8f0015fbdc154a572e2a8',
                voice: 'retell-rachel-neural',
              },
            ]);
          }
        })
        .finally(() => {
          setIsLoadingLeads(false);
        });
    }
  }, [isOpen]);

  // Lead metrics
  const leadStats = useMemo(() => {
    const selected = availableLeads.filter((l) => selectedLeadIds.includes(l.id));
    const dncCount = selected.filter((l) => l.isDnc).length;
    const callableCount = selected.filter((l) => !l.isDnc && l.phone && l.phone.length >= 7).length;
    const capacityLimit = 100;

    return {
      totalSelected: selected.length,
      callableCount,
      dncCount,
      capacityLimit,
      isOverCapacity: selected.length > capacityLimit,
      availableCallableTotal: availableLeads.filter((l) => !l.isDnc && l.phone && l.phone.length >= 7).length,
    };
  }, [availableLeads, selectedLeadIds]);

  // Filtered leads in table
  const displayedLeads = useMemo(() => {
    return availableLeads.filter((lead) => {
      if (leadSearch.trim()) {
        const query = leadSearch.toLowerCase();
        const matchesName = lead.name.toLowerCase().includes(query);
        const matchesCompany = lead.company.toLowerCase().includes(query);
        const matchesPhone = lead.phone.includes(query);
        if (!matchesName && !matchesCompany && !matchesPhone) return false;
      }
      if (leadEligibilityFilter === 'callable') {
        if (lead.isDnc || !lead.phone || lead.phone.length < 7) return false;
      }
      if (leadEligibilityFilter === 'unassigned') {
        if (lead.campaignId) return false;
      }
      return true;
    });
  }, [availableLeads, leadSearch, leadEligibilityFilter]);

  if (!isOpen) return null;

  const handleSelectAllCallable = () => {
    const callable = availableLeads.filter((l) => !l.isDnc && l.phone && l.phone.length >= 7).slice(0, 100);
    setSelectedLeadIds(callable.map((l) => l.id));
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
  };

  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleDay = (dayNum: number) => {
    setCallingDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort()
    );
  };

  // Launch or Schedule Campaign
  const handleSubmitCampaign = async (mode: 'now' | 'schedule' | 'draft') => {
    if (!name.trim()) {
      setErrorMessage('Please enter a campaign name.');
      setStep(1);
      return;
    }
    if (selectedLeadIds.length === 0) {
      setErrorMessage('Please select at least one lead for this campaign.');
      setStep(2);
      return;
    }
    if (leadStats.isOverCapacity) {
      setErrorMessage('Campaign capacity limit is 100 leads. Please adjust your selection.');
      setStep(2);
      return;
    }
    if (mode === 'schedule' && !scheduledDateTime) {
      setErrorMessage('Please specify the date and time for the scheduled start.');
      setStep(3);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const scheduledIso =
        mode === 'schedule' && scheduledDateTime
          ? new Date(scheduledDateTime).toISOString()
          : undefined;

      // 1. Create the campaign
      const createRes = await authenticatedFetch('/api/campaigns', {
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
          maxAttemptsPerLead: 3,
          retryDelayMinutes: 60,
          concurrencyLimit: 10,
          scheduledAt: mode === 'schedule' ? scheduledIso : null,
          desiredOutcome: desiredOutcome.trim() || null,
          emailFollowupEnabled,
          emailSubject: emailSubject.trim() || null,
          emailBody: emailBody.trim() || null,
          companySignature: companySignature.trim() || null,
          qualificationCriteria: {
            desiredOutcome: desiredOutcome.trim() || null,
            requireDecisionMaker: true,
            requireMaterialOrVolume: true,
          },
          requiredCommercialInfo: ['material_interest', 'estimated_volume', 'decision_maker'],
        }),
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to create campaign');
      }

      const campaignId = createData.data.id;

      // 2. Enroll selected leads
      if (selectedLeadIds.length > 0) {
        const enrollRes = await authenticatedFetch(`/api/campaigns/${campaignId}/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds: selectedLeadIds }),
        });
        const enrollData = await enrollRes.json();
        if (!enrollData.success) {
          throw new Error(enrollData.error || 'Failed to enroll leads into campaign');
        }
      }

      // 3. Launch or Schedule Action
      if (mode === 'now') {
        const startRes = await authenticatedFetch(`/api/campaigns/${campaignId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        });
        const startData = await startRes.json();
        if (!startData.success) {
          throw new Error(startData.error || 'Campaign created, but failed to start calling');
        }
      } else if (mode === 'schedule') {
        const schedRes = await authenticatedFetch(`/api/campaigns/${campaignId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'schedule', scheduledAt: scheduledIso }),
        });
        const schedData = await schedRes.json();
        if (!schedData.success) {
          throw new Error(schedData.error || 'Campaign created, but failed to schedule');
        }
      }

      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during campaign creation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsMeta = [
    { num: 1, title: 'Details & Voice', icon: Sparkles },
    { num: 2, title: 'Audience', icon: Users },
    { num: 3, title: 'Email & Schedule', icon: Calendar },
    { num: 4, title: 'Review & Launch', icon: Rocket },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs rm-fade overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-wizard-title"
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-surface text-on-surface shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header with 4-Step Progress Indicator */}
        <div className="shrink-0 border-b border-border bg-surface px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="campaign-wizard-title" className="text-[17px] font-semibold text-on-surface">
                New Outbound Campaign
              </h2>
              <p className="text-[12px] text-on-surface-variant">
                Autonomous Retell AI voice calling with Claude qualification &amp; Resend follow-ups
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-secondary hover:text-on-surface transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stepper Navigation */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {stepsMeta.map((s) => {
              const isPast = step > s.num;
              const isCurrent = step === s.num;
              const IconComp = s.icon;
              return (
                <button
                  key={s.num}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    if (s.num < step) setStep(s.num as any);
                  }}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all ${
                    isCurrent
                      ? 'bg-primary/10 border border-primary/25 text-primary'
                      : isPast
                      ? 'hover:bg-surface-secondary text-on-surface'
                      : 'text-on-surface-muted opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold ${
                      isPast
                        ? 'bg-primary text-white'
                        : isCurrent
                        ? 'bg-primary text-white'
                        : 'border border-border bg-surface-secondary text-on-surface-muted'
                    }`}
                  >
                    {isPast ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </div>
                  <div className="min-w-0 flex-1 hidden sm:block">
                    <div className="truncate text-[12px] font-medium leading-tight">{s.title}</div>
                    <div className="text-[10px] text-on-surface-muted leading-none mt-0.5">Step {s.num} of 4</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Error Banner if any */}
        {errorMessage && (
          <div className="shrink-0 flex items-center gap-2 border-b border-error/20 bg-error-surface px-6 py-2.5 text-[12.5px] font-medium text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6">
          {/* ================= STEP 1: CAMPAIGN DETAILS & INTELLIGENCE ================= */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-[14.5px] font-semibold text-on-surface">1. Campaign Strategy &amp; Voice Intelligence</h3>
                <p className="text-[12.5px] text-on-surface-variant">
                  Define your campaign name, assign the Retell voice agent, and establish Claude qualification criteria.
                </p>
              </div>

              {/* Name & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[12.5px] font-medium text-on-surface">
                    Campaign Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Q4 European Steel &amp; Industrial Metals Outreach"
                    className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-[13px] text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[12.5px] font-medium text-on-surface">
                    Description <span className="text-[11px] font-normal text-on-surface-muted">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief objective for your commercial desk..."
                    className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-[13px] text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Voice Agent Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[12.5px] font-medium text-on-surface">
                  Assigned Retell Voice Agent
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {availableAgents.map((ag) => {
                    const isSelected = agentId === ag.id;
                    return (
                      <div
                        key={ag.id}
                        onClick={() => setAgentId(ag.id)}
                        className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border bg-surface hover:bg-surface-secondary'
                        }`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-surface-secondary text-on-surface-variant'}`}>
                          <PhoneCall className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-[13px] text-on-surface truncate">{ag.name}</span>
                            {isSelected && <Badge tone="success">Selected</Badge>}
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-on-surface-variant line-clamp-1">
                            Neural voice engine · Real-time bi-directional audio
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Desired Qualification Outcome */}
              <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface-secondary/50 p-4">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <label className="text-[13px] font-semibold text-on-surface">
                      Claude AI Desired Qualification Outcome
                    </label>
                    <p className="text-[12px] text-on-surface-variant mt-0.5">
                      This criteria is evaluated by Claude against the live call transcript. Only leads satisfying this objective are marked <strong>QUALIFIED</strong> and trigger automated follow-up.
                    </p>
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {DESIRED_OUTCOME_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPresetId(preset.id);
                          setDesiredOutcome(preset.description);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface border border-border text-on-surface hover:bg-surface-secondary'
                        }`}
                      >
                        <span>{preset.title}</span>
                        <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-white/20' : 'bg-surface-secondary text-on-surface-muted'}`}>
                          {preset.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={3}
                  value={desiredOutcome}
                  onChange={(e) => {
                    setDesiredOutcome(e.target.value);
                    setSelectedPresetId('custom');
                  }}
                  placeholder="Describe the exact qualification benchmark..."
                  className="w-full rounded-lg border border-border bg-surface p-2.5 text-[12.5px] leading-relaxed text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ================= STEP 2: SELECT LEADS ================= */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-[14.5px] font-semibold text-on-surface">2. Select Leads Audience</h3>
                  <p className="text-[12.5px] text-on-surface-variant">
                    Choose contacts to enroll in this campaign. Maximum capacity is 100 leads per batch.
                  </p>
                </div>
                {/* Capacity Counter */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className={`px-3 py-1 rounded-lg border font-mono text-[12px] font-semibold ${
                    leadStats.isOverCapacity
                      ? 'border-error bg-error-surface text-error'
                      : 'border-primary/20 bg-primary/10 text-primary'
                  }`}>
                    {leadStats.totalSelected} / {leadStats.capacityLimit} Leads Selected
                  </div>
                </div>
              </div>

              {/* Toolbar & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-surface p-2.5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-muted" />
                  <input
                    type="text"
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search name, company or phone..."
                    className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-[12.5px] text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLeadEligibilityFilter('all')}
                    className={`h-7 px-2.5 rounded text-[11.5px] font-medium transition-colors ${
                      leadEligibilityFilter === 'all' ? 'bg-primary text-white' : 'border border-border hover:bg-surface-secondary text-on-surface'
                    }`}
                  >
                    All ({availableLeads.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadEligibilityFilter('callable')}
                    className={`h-7 px-2.5 rounded text-[11.5px] font-medium transition-colors ${
                      leadEligibilityFilter === 'callable' ? 'bg-primary text-white' : 'border border-border hover:bg-surface-secondary text-on-surface'
                    }`}
                  >
                    Callable Only ({leadStats.availableCallableTotal})
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllCallable}
                    className="h-7 px-2.5 rounded border border-border bg-surface text-[11.5px] font-medium text-primary hover:bg-surface-secondary transition-colors"
                  >
                    Select All Callable
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="h-7 px-2 rounded border border-border text-[11.5px] font-medium text-on-surface-muted hover:text-on-surface transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Leads Table Container */}
              <div className="rounded-xl border border-border bg-surface overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th className="w-10">
                          <input
                            type="checkbox"
                            checked={displayedLeads.length > 0 && displayedLeads.every((l) => selectedLeadIds.includes(l.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newIds = Array.from(new Set([...selectedLeadIds, ...displayedLeads.map((l) => l.id)]));
                                setSelectedLeadIds(newIds.slice(0, 100));
                              } else {
                                const displayedSet = new Set(displayedLeads.map((l) => l.id));
                                setSelectedLeadIds(selectedLeadIds.filter((id) => !displayedSet.has(id)));
                              }
                            }}
                            className="rounded border-border"
                          />
                        </th>
                        <th>Prospect</th>
                        <th>Company</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Eligibility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingLeads ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[12.5px] text-on-surface-muted">
                            Loading contacts from CRM...
                          </td>
                        </tr>
                      ) : displayedLeads.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[12.5px] text-on-surface-muted">
                            No matching leads found.
                          </td>
                        </tr>
                      ) : (
                        displayedLeads.map((lead) => {
                          const isSelected = selectedLeadIds.includes(lead.id);
                          const isCallable = !lead.isDnc && lead.phone && lead.phone.length >= 7;
                          return (
                            <tr
                              key={lead.id}
                              onClick={() => toggleLead(lead.id)}
                              className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleLead(lead.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded border-border"
                                />
                              </td>
                              <td className="font-medium text-on-surface">{lead.name}</td>
                              <td className="text-on-surface-variant">{lead.company}</td>
                              <td className="font-mono text-[12px] text-on-surface">{lead.phone || '—'}</td>
                              <td>
                                <span className="text-[11px] uppercase font-medium text-on-surface-muted">{lead.status}</span>
                              </td>
                              <td>
                                {lead.isDnc ? (
                                  <Badge tone="error">DNC Blocked</Badge>
                                ) : !lead.phone || lead.phone.length < 7 ? (
                                  <Badge tone="warning">Missing Phone</Badge>
                                ) : (
                                  <Badge tone="success">Callable</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Summary Bar */}
              <div className="flex flex-wrap items-center justify-between text-[12px] text-on-surface-variant bg-surface-secondary/60 rounded-lg px-3.5 py-2">
                <div className="flex items-center gap-3">
                  <span>Selected: <strong>{leadStats.totalSelected}</strong></span>
                  <span>·</span>
                  <span className="text-primary font-medium">Ready to dial: {leadStats.callableCount}</span>
                  {leadStats.dncCount > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-error font-medium">{leadStats.dncCount} DNC excluded</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-on-surface-muted">
                  Capacity limit: 100 leads per campaign batch
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: EMAIL & SCHEDULE ================= */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-[14.5px] font-semibold text-on-surface">3. Timing &amp; Follow-Up Automation</h3>
                <p className="text-[12.5px] text-on-surface-variant">
                  Configure execution timing and personalize follow-up emails sent to qualified prospects.
                </p>
              </div>

              {/* Timing Selection Cards */}
              <div className="flex flex-col gap-2">
                <label className="text-[12.5px] font-medium text-on-surface">Campaign Start Timing</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setLaunchMode('now')}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                      launchMode === 'now'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border bg-surface hover:bg-surface-secondary'
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${launchMode === 'now' ? 'bg-primary text-white' : 'bg-surface-secondary text-on-surface-variant'}`}>
                      <Rocket className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-[13px] text-on-surface">
                        <span>Start Immediately</span>
                        {launchMode === 'now' && <Badge tone="success">Active</Badge>}
                      </div>
                      <p className="text-[11.5px] text-on-surface-variant mt-0.5">
                        Queue begins dialing prospects as soon as campaign is launched.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setLaunchMode('schedule')}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                      launchMode === 'schedule'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border bg-surface hover:bg-surface-secondary'
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${launchMode === 'schedule' ? 'bg-primary text-white' : 'bg-surface-secondary text-on-surface-variant'}`}>
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-[13px] text-on-surface">
                        <span>Schedule for Later</span>
                        {launchMode === 'schedule' && <Badge tone="info">Scheduled</Badge>}
                      </div>
                      <p className="text-[11.5px] text-on-surface-variant mt-0.5">
                        Specify exact launch date, time and timezone.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Scheduled DateTime Picker */}
                {launchMode === 'schedule' && (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-secondary/40 p-3.5 mt-1">
                    <div className="flex flex-col gap-1 min-w-[200px]">
                      <label className="text-[11.5px] font-medium text-on-surface-variant">Scheduled Start Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        className="h-8 rounded-md border border-border bg-surface px-2 text-[12.5px] text-on-surface focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 min-w-[180px]">
                      <label className="text-[11.5px] font-medium text-on-surface-variant">Timezone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="h-8 rounded-md border border-border bg-surface px-2 text-[12.5px] text-on-surface focus:border-primary focus:outline-none"
                      >
                        <option value="America/New_York">Eastern Time (US / New York)</option>
                        <option value="America/Chicago">Central Time (US / Chicago)</option>
                        <option value="America/Denver">Mountain Time (US / Denver)</option>
                        <option value="America/Los_Angeles">Pacific Time (US / Los Angeles)</option>
                        <option value="Europe/London">London / GMT</option>
                        <option value="Europe/Berlin">Central Europe (Berlin/Brussels)</option>
                        <option value="Asia/Dubai">Gulf Standard Time (Dubai)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Calling Window Days */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-medium text-on-surface">Calling Days (Business Hours)</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { num: 1, label: 'Mon' },
                    { num: 2, label: 'Tue' },
                    { num: 3, label: 'Wed' },
                    { num: 4, label: 'Thu' },
                    { num: 5, label: 'Fri' },
                    { num: 6, label: 'Sat' },
                    { num: 0, label: 'Sun' },
                  ].map((d) => {
                    const isSelected = callingDays.includes(d.num);
                    return (
                      <button
                        key={d.num}
                        type="button"
                        onClick={() => toggleDay(d.num)}
                        className={`h-7 px-3 rounded-md text-[12px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'border border-border bg-surface text-on-surface-variant hover:bg-surface-secondary'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Email Automation Section */}
              <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-on-surface">Resend Email Follow-Up</div>
                      <div className="text-[11.5px] text-on-surface-variant">
                        Strict rule: Automatically dispatched ONLY to leads verified as QUALIFIED by Claude
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailFollowupEnabled}
                      onChange={(e) => setEmailFollowupEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {emailFollowupEnabled && (
                  <div className="flex flex-col gap-3 pt-2 border-t border-border/60">
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-medium text-on-surface">Subject Line</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="h-8 rounded-md border border-border bg-surface px-2.5 text-[12.5px] text-on-surface focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] font-medium text-on-surface">Email Body</label>
                        <div className="flex items-center gap-1 text-[11px] text-on-surface-muted">
                          <span>Supported tags:</span>
                          <span className="font-mono bg-surface-secondary px-1 rounded text-primary">&#123;&#123;contact_name&#125;&#125;</span>
                          <span className="font-mono bg-surface-secondary px-1 rounded text-primary">&#123;&#123;company_name&#125;&#125;</span>
                          <span className="font-mono bg-surface-secondary px-1 rounded text-primary">&#123;&#123;material_interest&#125;&#125;</span>
                        </div>
                      </div>
                      <textarea
                        rows={4}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        className="w-full rounded-md border border-border bg-surface p-2.5 text-[12.5px] leading-relaxed text-on-surface focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 4: REVIEW & LAUNCH ================= */}
          {step === 4 && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-[14.5px] font-semibold text-on-surface">4. Review &amp; Activate Campaign</h3>
                <p className="text-[12.5px] text-on-surface-variant">
                  Verify campaign settings and audience parameters before launching autonomous calling.
                </p>
              </div>

              {/* 4 Clean Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Voice Strategy */}
                <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-primary text-[12px] font-semibold">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Voice Intelligence</span>
                  </div>
                  <div className="text-[13.5px] font-semibold text-on-surface truncate">{name}</div>
                  <div className="text-[12px] text-on-surface-variant">
                    Agent: <strong>{availableAgents.find((a) => a.id === agentId)?.name || 'Rachel'}</strong>
                  </div>
                  <p className="text-[11.5px] text-on-surface-muted line-clamp-2 mt-1">
                    Objective: {desiredOutcome}
                  </p>
                </div>

                {/* 2. Audience */}
                <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-primary text-[12px] font-semibold">
                    <Users className="h-3.5 w-3.5" />
                    <span>Enrolled Audience</span>
                  </div>
                  <div className="text-[13.5px] font-semibold text-on-surface">
                    {leadStats.totalSelected} Prospects Selected
                  </div>
                  <div className="text-[12px] text-on-surface-variant">
                    {leadStats.callableCount} Callable · {leadStats.dncCount} DNC Excluded
                  </div>
                  <div className="flex items-center gap-1.5 text-[11.5px] text-success mt-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Within 100-lead safe batch capacity</span>
                  </div>
                </div>

                {/* 3. Schedule & Dispatch */}
                <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-primary text-[12px] font-semibold">
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span>Execution Schedule</span>
                  </div>
                  <div className="text-[13.5px] font-semibold text-on-surface">
                    {launchMode === 'now' ? 'Instant Activation' : `Scheduled for ${new Date(scheduledDateTime || Date.now()).toLocaleDateString()}`}
                  </div>
                  <div className="text-[12px] text-on-surface-variant">
                    Days: {callingDays.length} active business days · {callingWindowStart} to {callingWindowEnd}
                  </div>
                  <div className="text-[11.5px] text-on-surface-muted mt-1">
                    Max 3 retry attempts for unreached prospects
                  </div>
                </div>

                {/* 4. Follow-Up Email */}
                <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-primary text-[12px] font-semibold">
                    <Mail className="h-3.5 w-3.5" />
                    <span>Qualified Email Dispatch</span>
                  </div>
                  <div className="text-[13.5px] font-semibold text-on-surface">
                    {emailFollowupEnabled ? 'Resend Automation Active' : 'No Automated Emails'}
                  </div>
                  <div className="text-[12px] text-on-surface-variant truncate">
                    Subject: {emailSubject}
                  </div>
                  <div className="text-[11.5px] text-on-surface-muted mt-1">
                    Triggered exclusively on Claude DECISION_MAKER_QUALIFIED outcome
                  </div>
                </div>
              </div>

              {/* Safety notice */}
              <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-[12px] text-on-surface">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Concurrency safeguards active: Single-active-call locks prevent duplicate dialing. Autonomous retry engine handles busy/no-answer.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-border bg-surface px-6 py-3.5 sm:px-8">
          <div>
            {step > 1 ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[12.5px] font-medium text-on-surface hover:bg-surface-secondary transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="h-8.5 rounded-lg px-3 text-[12.5px] font-medium text-on-surface-variant hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !name.trim()) {
                    setErrorMessage('Please enter a campaign name.');
                    return;
                  }
                  if (step === 2 && selectedLeadIds.length === 0) {
                    setErrorMessage('Please select at least one lead.');
                    return;
                  }
                  setErrorMessage(null);
                  setStep((prev) => (prev + 1) as any);
                }}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-white hover:bg-primary-hover transition-colors shadow-xs"
              >
                <span>Continue</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmitCampaign('draft')}
                  className="h-8.5 rounded-lg border border-border bg-surface px-3.5 text-[12.5px] font-medium text-on-surface hover:bg-surface-secondary transition-colors disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || leadStats.isOverCapacity || selectedLeadIds.length === 0}
                  onClick={() => handleSubmitCampaign(launchMode)}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-white hover:bg-primary-hover transition-colors shadow-xs disabled:opacity-50"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  <span>
                    {isSubmitting
                      ? 'Creating...'
                      : launchMode === 'now'
                      ? 'Launch Campaign'
                      : 'Schedule Campaign'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
