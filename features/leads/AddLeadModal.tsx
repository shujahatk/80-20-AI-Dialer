'use client';

import React, { useState } from 'react';
import { authenticatedFetch } from '@/lib/api/client';
import { Icon } from '@/lib/ui/icons';
import { normalizePhone } from '@/lib/telephony/phone';
import type { LeadCreateInput } from '@/lib/validation';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: () => void;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ isOpen, onClose, onLeadCreated }) => {
  const [formData, setFormData] = useState<Partial<LeadCreateInput>>({
    firstName: '',
    lastName: '',
    companyName: '',
    jobTitle: '',
    phone: '',
    email: '',
    city: '',
    country: 'United States',
    status: 'new',
    priority: 'medium',
    tags: [],
    note: '',
    isDnc: false,
    timezone: 'America/New_York',
  });

  const [tagInput, setTagInput] = useState('');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags?.filter((t) => t !== tag) || [] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Simple phone normalization & validation
    const phoneNorm = normalizePhone(formData.phone || '', formData.country || 'US');
    if (!phoneNorm.isValid || !phoneNorm.e164) {
      setErrorMessage('Invalid phone number. Please enter a valid telephone number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        phoneE164: phoneNorm.e164,
        email: formData.email?.trim() ? formData.email.trim() : null,
      };

      const res = await authenticatedFetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create lead');
      }

      onLeadCreated();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-space-base sm:p-space-lg bg-surface-container-lowest/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-surface-container-low rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-outline-variant/20">
        {/* Modal Header */}
        <div className="p-space-base sm:px-space-lg sm:py-space-md bg-surface-container flex items-center justify-between border-b border-outline-variant/10">
          <div className="flex items-center gap-space-sm">
            <Icon name="person_add" size={24} className="text-primary" />
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
              Add New Lead
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center transition-colors border border-outline-variant/10"
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-space-base sm:p-space-lg flex flex-col gap-space-md overflow-y-auto">
          {errorMessage && (
            <div className="p-space-sm rounded-lg bg-error-container/40 text-error font-body-sm text-body-sm border border-error/20 flex items-center gap-space-xs">
              <Icon name="error" size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div>
              <label className="block text-body-sm font-semibold text-on-surface mb-1">
                First Name *
              </label>
              <input
                required
                name="firstName"
                value={formData.firstName || ''}
                onChange={handleChange}
                className="w-full px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15"
                placeholder="e.g. Sarah"
                type="text"
              />
            </div>

            <div>
              <label className="block text-body-sm font-semibold text-on-surface mb-1">
                Last Name *
              </label>
              <input
                required
                name="lastName"
                value={formData.lastName || ''}
                onChange={handleChange}
                className="w-full px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15"
                placeholder="e.g. Jenkins"
                type="text"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div>
              <label className="block text-body-sm font-semibold text-on-surface mb-1">
                Company *
              </label>
              <input
                required
                name="companyName"
                value={formData.companyName || ''}
                onChange={handleChange}
                className="w-full px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15"
                placeholder="e.g. Apex Logistics"
                type="text"
              />
            </div>

            <div>
              <label className="block text-body-sm font-semibold text-on-surface mb-1">
                Job Title
              </label>
              <input
                name="jobTitle"
                value={formData.jobTitle || ''}
                onChange={handleChange}
                className="w-full px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15"
                placeholder="e.g. VP of Operations"
                type="text"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div>
              <label className="block text-body-sm font-semibold text-on-surface mb-1">
                Phone Number *
              </label>
              <input
                required
                name="phone"
                value={formData.phone || ''}
                onChange={handleChange}
                className="w-full px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15 font-mono"
                placeholder="e.g. +1 (312) 555-0199"
                type="tel"
              />
            </div>

            <div>
              <label className="block text-body-sm font-semibold text-on-surface mb-1">
                Email
              </label>
              <input
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className="w-full px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15"
                placeholder="e.g. sarah@apexlogistics.com"
                type="email"
              />
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div>
              <label className="block text-body-sm font-semibold text-on-surface mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status || 'new'}
                onChange={handleChange}
                className="w-full px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15 cursor-pointer"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="needs-review">Needs Review</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Meeting Booked</option>
                <option value="unqualified">Unreachable</option>
              </select>
            </div>

            <div>
              <label className="block text-body-sm font-semibold text-on-surface mb-1">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority || 'medium'}
                onChange={handleChange}
                className="w-full px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15 cursor-pointer"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Initial Note */}
          <div>
            <label className="block text-body-sm font-semibold text-on-surface mb-1">
              Notes
            </label>
            <textarea
              name="note"
              rows={2}
              value={formData.note || ''}
              onChange={handleChange}
              className="w-full px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15"
              placeholder="Add any initial context or background info..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-body-sm font-semibold text-on-surface mb-1">
              Tags
            </label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/15"
                placeholder="Type tag name and press Enter..."
                type="text"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-space-md py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-outline-variant/15"
              >
                Add
              </button>
            </div>

            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-xs text-on-surface border border-outline-variant/10"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-on-surface-variant hover:text-error"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Progressive Disclosure: More Details */}
          <div className="border-t border-outline-variant/10 pt-2">
            <button
              type="button"
              onClick={() => setShowMoreDetails(!showMoreDetails)}
              className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
            >
              <span>{showMoreDetails ? 'Hide More Details' : 'More Details (Location & Timezone)'}</span>
              <Icon name={showMoreDetails ? 'expand_less' : 'expand_more'} size={16} />
            </button>

            {showMoreDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md mt-space-sm pt-space-xs animate-in fade-in">
                <div>
                  <label className="block text-body-xs text-on-surface-variant mb-1">
                    City
                  </label>
                  <input
                    name="city"
                    value={formData.city || ''}
                    onChange={handleChange}
                    className="w-full px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/15"
                    placeholder="e.g. Chicago"
                  />
                </div>

                <div>
                  <label className="block text-body-xs text-on-surface-variant mb-1">
                    Country
                  </label>
                  <input
                    name="country"
                    value={formData.country || 'United States'}
                    onChange={handleChange}
                    className="w-full px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/15"
                    placeholder="e.g. United States"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-space-sm pt-space-md border-t border-outline-variant/10">
            <button
              type="button"
              onClick={onClose}
              className="px-space-lg py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-medium transition-colors border border-outline-variant/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-space-lg py-2 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Lead...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
