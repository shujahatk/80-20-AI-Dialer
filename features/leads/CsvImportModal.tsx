'use client';

import React, { useState, useRef } from 'react';
import { Icon } from '@/lib/ui/icons';
import { parseCsv } from '@/lib/csv/parser';
import {
  autoDetectMappings,
  RM_FIELD_DEFINITIONS,
  type RmSystemField,
  type ColumnMappingResult,
} from '@/lib/csv/mapping';
import type { CsvPreviewSummary, DuplicateStrategy, ImportProblemRow } from '@/lib/csv/importer';
import { generateErrorCsv } from '@/lib/csv/importer';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (count: number) => void;
}

interface ImportResultData {
  inserted: number;
  updated: number;
  skipped: number;
  invalid: number;
  dncProtected: number;
  jobId?: string;
  totalRows?: number;
  intraFileDuplicates?: number;
  existingDuplicates?: number;
  problemRows?: ImportProblemRow[];
  errorCsv?: string | null;
}

const SAMPLE_CSV = `Full Name,Work Phone,Organisation,Role,Direct Email,City,Country
Marcus Brody,+1 415 890 2104,PrimeFreight Inc.,VP Operations,m.brody@primefreight.io,San Francisco,US
Elena Rostova,+1 312 402 9981,Titan Supply Corp,Logistics Director,elena.rostova@titansupply.com,Chicago,US
David Vance,+1 206 555 0199,Apex Carrier Ltd,Dispatch Lead,d.vance@apexcarrier.com,Seattle,US
Rachel Adams,+1 214 555 0144,LoneStar Hauling,Fleet Manager,rachel@lonestarhaul.com,Dallas,US
Thomas Wright,+1 404 555 0188,Atlanta Express,VP Procurement,t.wright@atlantaexp.com,Atlanta,US`;

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvContent, setCsvContent] = useState<string>('');
  const [filename, setFilename] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [parsedRowsCount, setParsedRowsCount] = useState(0);
  const [mappings, setMappings] = useState<ColumnMappingResult[]>([]);
  const [dedupStrat, setDedupStrat] = useState<DuplicateStrategy>('skip');
  const [previewSummary, setPreviewSummary] = useState<CsvPreviewSummary | null>(null);
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);
  const [showIssuesReview, setShowIssuesReview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    setFilename(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setCsvContent(text);
        const parsed = parseCsv(text);
        const detected = autoDetectMappings(parsed.headers, parsed.rows);
        setMappings(detected);
        setParsedRowsCount(parsed.totalRows);
        setStep(2);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read CSV file. Please check file format.');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setCsvContent(SAMPLE_CSV);
    setFilename('sample_logistics_leads.csv');
    setFileSize('1.2 KB');
    const parsed = parseCsv(SAMPLE_CSV);
    setMappings(autoDetectMappings(parsed.headers, parsed.rows));
    setParsedRowsCount(parsed.totalRows);
    setStep(2);
  };

  const handleFieldChange = (csvHeader: string, newField: RmSystemField) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.csvHeader === csvHeader
          ? {
              ...m,
              systemField: newField,
              statusLabel: newField === 'do_not_map' ? 'Ignore' : 'Matched',
            }
          : m
      )
    );
  };

  const handleGoToPreview = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const mappingConfig: Record<string, RmSystemField> = {};
      mappings.forEach((m) => {
        mappingConfig[m.csvHeader] = m.systemField;
      });

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          csvContent,
          mappings: mappingConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze CSV');
      }

      setPreviewSummary(data.data);
      setStep(3);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error generating preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessImport = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const mappingConfig: Record<string, RmSystemField> = {};
      mappings.forEach((m) => {
        mappingConfig[m.csvHeader] = m.systemField;
      });

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          csvContent,
          mappings: mappingConfig,
          strategy: dedupStrat,
          filename: filename || 'leads_import.csv',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete import');
      }

      setImportResult(data.data);
      setStep(4);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    if (importResult) {
      onImportComplete?.(importResult.inserted + importResult.updated);
    }
    onClose();
  };

  const handleDownloadCsv = (csvData: string, filePrefix: string = 'import_issues') => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filePrefix}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSystemFieldLabel = (field: RmSystemField): string => {
    const def = RM_FIELD_DEFINITIONS.find((d) => d.id === field);
    return def ? def.label : field;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      id="importModal"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 4) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-surface rounded-xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150 border border-border">
        {/* Modal Header */}
        <div className="p-4 sm:px-6 sm:py-4 bg-surface flex items-center justify-between border-b border-border">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Icon name="table_view" size={24} className="text-primary" />
              <h2 className="text-[18px] text-on-surface font-bold tracking-tight">
                Import Leads from CSV
              </h2>
              {step <= 3 && (
                <span className="px-2 py-0.5 rounded bg-surface-elevated text-primary text-[12px] uppercase font-semibold border border-border">
                  Step {step} of 3
                </span>
              )}
            </div>
            <span className="text-[13px] text-on-surface-variant">
              {step === 1 && 'Upload your contact spreadsheet to get started.'}
              {step === 2 && 'Review and match CSV columns to lead fields.'}
              {step === 3 && 'Review validation issues and choose duplicate resolution.'}
              {step === 4 && 'Import complete. All leads have been processed.'}
            </span>
          </div>
          <button
            onClick={step === 4 ? handleFinish : onClose}
            className="w-8 h-8 rounded-lg bg-surface-elevated hover:bg-surface-secondary text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors border border-border"
            id="closeModalBtn"
            type="button"
            aria-label="Close modal"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Stepper Indicator */}
        {step <= 3 && (
          <div className="grid grid-cols-3 bg-surface-elevated text-center text-[12px] uppercase font-semibold border-b border-border">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`py-2.5 px-3 flex items-center justify-center gap-2 transition-colors ${
                step === 1
                  ? 'bg-primary text-on-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full font-bold flex items-center justify-center text-[10px] ${
                  step === 1
                    ? 'bg-on-primary text-primary'
                    : 'bg-surface-secondary text-on-surface'
                }`}
              >
                {step > 1 ? '✓' : '1'}
              </span>
              <span>1. Upload CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (csvContent) setStep(2);
              }}
              disabled={!csvContent}
              className={`py-2.5 px-3 flex items-center justify-center gap-2 transition-colors ${
                step === 2
                  ? 'bg-primary text-on-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full font-bold flex items-center justify-center text-[10px] ${
                  step === 2
                    ? 'bg-on-primary text-primary'
                    : 'bg-surface-secondary text-on-surface'
                }`}
              >
                {step > 2 ? '✓' : '2'}
              </span>
              <span>2. Review Columns</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (csvContent) handleGoToPreview();
              }}
              disabled={!csvContent}
              className={`py-2.5 px-3 flex items-center justify-center gap-2 transition-colors ${
                step === 3
                  ? 'bg-primary text-on-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full font-bold flex items-center justify-center text-[10px] ${
                  step === 3
                    ? 'bg-on-primary text-primary'
                    : 'bg-surface-secondary text-on-surface'
                }`}
              >
                3
              </span>
              <span>3. Review Issues &amp; Import</span>
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />

        {/* Modal Body */}
        <div className="p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[65vh]">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-error-surface text-error text-[13px] border border-error/30 flex items-center gap-2">
              <Icon name="error" size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD CSV */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="border-2 border-dashed border-border hover:border-primary rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors bg-surface-elevated hover:bg-surface-secondary"
              >
                <Icon name="cloud_upload" size={36} className="text-primary" />
                <div className="flex flex-col">
                  <span className="text-[16px] font-semibold text-on-surface">
                    Drag &amp; drop your CSV file here
                  </span>
                  <span className="text-[13px] text-on-surface-variant mt-1">
                    Accepts flexible columns, arbitrary headers, and standard delimiters.
                  </span>
                </div>
                <button
                  type="button"
                  className="mt-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold text-[13px] shadow-sm hover:bg-primary-hover transition-colors"
                >
                  Browse File
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border text-[13px] text-on-surface-variant">
                <span>Want to test with sample data?</span>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="text-primary font-semibold hover:underline"
                >
                  Load Sample Leads
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW COLUMNS (COLUMN MAPPER) */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {/* File details banner */}
              <div className="p-3 sm:p-4 rounded-xl bg-surface-elevated flex flex-wrap items-center justify-between gap-3 border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-surface text-primary border border-border">
                    <Icon name="description" size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[15px] font-semibold text-on-surface">
                      {filename || 'Uploaded File'}
                    </span>
                    <span className="text-[13px] text-on-surface-variant">
                      {fileSize ? `${fileSize} • ` : ''}{parsedRowsCount.toLocaleString()} rows detected
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-on-surface-variant hover:text-on-surface text-[13px] font-medium underline"
                  type="button"
                >
                  Choose Different File
                </button>
              </div>

              {/* Column Mapping Table */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-on-surface">
                    Map Columns to RM Fields
                  </span>
                  <span className="text-[12px] text-on-surface-variant">
                    {mappings.filter((m) => m.systemField !== 'do_not_map').length} of {mappings.length} columns mapped
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg bg-surface border border-border">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr className="bg-surface-elevated text-on-surface-variant text-[12px] uppercase font-semibold border-b border-border">
                        <th className="py-2.5 px-3">CSV Column</th>
                        <th className="py-2.5 px-3">Mapped To</th>
                        <th className="py-2.5 px-3">Example</th>
                        <th className="py-2.5 px-3">Match Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mappings.map((row) => (
                        <tr
                          key={row.csvHeader}
                          className="hover:bg-surface-elevated transition-colors"
                        >
                          <td className="py-2.5 px-3 font-semibold text-on-surface">
                            {row.csvHeader}
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={row.systemField}
                              onChange={(e) =>
                                handleFieldChange(row.csvHeader, e.target.value as RmSystemField)
                              }
                              className="w-full px-2.5 py-1.5 rounded bg-surface-elevated text-on-surface text-[13px] focus:outline-none focus:border-primary border border-border cursor-pointer"
                            >
                              {RM_FIELD_DEFINITIONS.map((def) => (
                                <option key={def.id} value={def.id}>
                                  {def.label} {def.isRequired ? '(Required)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-on-surface-variant max-w-[180px] truncate">
                            {row.sampleValue || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            {row.systemField !== 'do_not_map' ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    row.confidence >= 80
                                      ? 'bg-success/15 text-success border border-success/30'
                                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  {row.confidence >= 80 ? 'Matched' : 'Manual Review'} ({row.confidence}%)
                                </span>
                              </div>
                            ) : (
                              <span className="text-[12px] text-on-surface-muted italic">Ignored</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW ISSUES & PREVIEW */}
          {step === 3 && previewSummary && (
            <div className="flex flex-col gap-4">
              {/* Clean KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                {/* Total Rows */}
                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col">
                  <span className="text-[18px] font-bold text-on-surface">
                    {previewSummary.totalRows.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-medium">Total Rows</span>
                </div>

                {/* Ready to Import */}
                <div className="p-3 rounded-xl bg-accent-surface border border-secondary/30 flex flex-col">
                  <span className="text-[18px] font-bold text-primary">
                    {previewSummary.readyRows.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-success font-medium">Valid &amp; Ready</span>
                </div>

                {/* Intra-file Duplicates */}
                <div className="p-3 rounded-xl bg-surface-elevated border border-amber-500/30 flex flex-col">
                  <span className="text-[18px] font-bold text-amber-600 dark:text-amber-400">
                    {(previewSummary.intraFileDuplicates ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-medium">File Duplicates</span>
                </div>

                {/* Database Duplicates */}
                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col">
                  <span className="text-[18px] font-bold text-on-surface">
                    {(previewSummary.existingDuplicates ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-medium">DB Existing</span>
                </div>

                {/* Invalid */}
                <div className="p-3 rounded-xl bg-surface-elevated border border-error/30 flex flex-col">
                  <span className="text-[18px] font-bold text-error">
                    {previewSummary.invalidRows.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-error font-medium">Invalid</span>
                </div>

                {/* DNC Protected */}
                <div className="p-3 rounded-xl bg-surface-elevated border border-error/30 flex flex-col">
                  <span className="text-[18px] font-bold text-error">
                    {previewSummary.dncCount.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-error font-medium">DNC Blocked</span>
                </div>
              </div>

              {/* Duplicate Strategy Selection */}
              <div className="p-4 rounded-xl bg-surface-elevated flex flex-col gap-2 border border-border">
                <span className="text-[14px] font-semibold text-on-surface">
                  Duplicate Resolution Strategy
                </span>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-secondary cursor-pointer transition-colors">
                    <input
                      checked={dedupStrat === 'skip'}
                      onChange={() => setDedupStrat('skip')}
                      className="mt-1 accent-primary"
                      name="dedup_strat"
                      type="radio"
                    />
                    <div className="flex flex-col">
                      <span className="text-on-surface font-semibold text-[14px]">
                        Skip Existing (Recommended)
                      </span>
                      <span className="text-on-surface-variant text-[12px]">
                        If a phone matches an existing contact, keep the original without modifications.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-secondary cursor-pointer transition-colors">
                    <input
                      checked={dedupStrat === 'update_missing'}
                      onChange={() => setDedupStrat('update_missing')}
                      className="mt-1 accent-primary"
                      name="dedup_strat"
                      type="radio"
                    />
                    <div className="flex flex-col">
                      <span className="text-on-surface font-semibold text-[14px]">
                        Update Missing Information
                      </span>
                      <span className="text-on-surface-variant text-[12px]">
                        Fills in any blank details on existing contacts without changing existing fields.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-secondary cursor-pointer transition-colors">
                    <input
                      checked={dedupStrat === 'overwrite'}
                      onChange={() => setDedupStrat('overwrite')}
                      className="mt-1 accent-primary"
                      name="dedup_strat"
                      type="radio"
                    />
                    <div className="flex flex-col">
                      <span className="text-on-surface font-semibold text-[14px]">
                        Replace Existing Information
                      </span>
                      <span className="text-on-surface-variant text-[12px]">
                        Updates existing contacts with the new CSV values. Do Not Call protections are never cleared.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Review Issues Accordion */}
              {previewSummary.problemRows && previewSummary.problemRows.length > 0 && (
                <div className="rounded-xl bg-surface border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowIssuesReview(!showIssuesReview)}
                    className="w-full p-3 flex items-center justify-between text-[14px] font-semibold text-on-surface hover:bg-surface-elevated transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        name={showIssuesReview ? 'expand_less' : 'expand_more'}
                        size={18}
                        className="text-on-surface-variant"
                      />
                      <span>Review Issues ({previewSummary.problemRows.length} flagged records)</span>
                    </div>
                    <span className="text-[12px] text-primary font-medium">
                      {showIssuesReview ? 'Hide details' : 'Show details'}
                    </span>
                  </button>

                  {showIssuesReview && (
                    <div className="p-3 border-t border-border overflow-x-auto max-h-56">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="text-on-surface-variant text-[12px] font-semibold border-b border-border pb-1">
                            <th className="py-1 px-2">Row</th>
                            <th className="py-1 px-2">Name</th>
                            <th className="py-1 px-2">Phone</th>
                            <th className="py-1 px-2">Status</th>
                            <th className="py-1 px-2">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-[13px]">
                          {previewSummary.problemRows.map((prob, idx) => (
                            <tr key={idx} className="hover:bg-surface-elevated">
                              <td className="py-1.5 px-2 text-on-surface-variant font-mono">
                                #{prob.rowNumber}
                              </td>
                              <td className="py-1.5 px-2 font-medium text-on-surface">
                                {prob.name}
                              </td>
                              <td className="py-1.5 px-2 text-on-surface-variant font-mono">
                                {prob.phone}
                              </td>
                              <td className="py-1.5 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                    prob.issueType === 'dnc_protected'
                                      ? 'bg-error-surface text-error'
                                      : prob.issueType === 'invalid_data'
                                      ? 'bg-error-surface text-error'
                                      : prob.issueType === 'duplicate_csv'
                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                      : 'bg-surface-secondary text-on-surface'
                                  }`}
                                >
                                  {prob.issue}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 text-on-surface-variant">
                                {prob.details}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {showIssuesReview && previewSummary.problemRows.length > 0 && (
                    <div className="p-2.5 bg-surface-elevated border-t border-border flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadCsv(
                            generateErrorCsv(previewSummary.problemRows),
                            'pre_import_issues'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-secondary text-primary font-semibold text-[12px] border border-border shadow-sm transition-colors"
                      >
                        <Icon name="download" size={14} />
                        <span>Download Flagged Records CSV</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: IMPORT RESULTS (COMPLETION) */}
          {step === 4 && importResult && (
            <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-accent-surface text-primary flex items-center justify-center border border-secondary/30">
                <Icon name="check_circle" size={32} className="font-bold" />
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-[18px] font-bold text-on-surface">
                  Import Completed Successfully
                </h3>
                <span className="text-[14px] text-on-surface-variant max-w-md">
                  All records have been processed and saved to your leads database.
                </span>
                {importResult.jobId && (
                  <div className="mt-1">
                    <span className="inline-block px-3 py-0.5 rounded-full bg-surface-elevated text-on-surface-variant text-[12px] font-mono border border-border">
                      RPC Job ID: <strong className="text-on-surface">{importResult.jobId}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* 5 Result Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full max-w-2xl">
                <div className="p-3 rounded-xl bg-accent-surface border border-secondary/30 flex flex-col">
                  <span className="text-[18px] font-bold text-primary">
                    {importResult.inserted.toLocaleString()}
                  </span>
                  <span className="text-[12px] text-success">Imported</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col">
                  <span className="text-[18px] font-bold text-on-surface">
                    {importResult.updated.toLocaleString()}
                  </span>
                  <span className="text-[12px] text-on-surface-variant">Updated</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col">
                  <span className="text-[18px] font-bold text-on-surface">
                    {importResult.skipped.toLocaleString()}
                  </span>
                  <span className="text-[12px] text-on-surface-variant">Skipped</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-error/30 flex flex-col">
                  <span className="text-[18px] font-bold text-error">
                    {importResult.invalid.toLocaleString()}
                  </span>
                  <span className="text-[12px] text-error">Invalid</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-error/30 flex flex-col col-span-2 sm:col-span-1">
                  <span className="text-[18px] font-bold text-error">
                    {importResult.dncProtected.toLocaleString()}
                  </span>
                  <span className="text-[12px] text-error">DNC Protected</span>
                </div>
              </div>

              {importResult.errorCsv && (
                <div className="flex flex-col items-center gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadCsv(importResult.errorCsv!, 'lead_import_problem_rows')
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-secondary text-primary font-semibold text-[13px] border border-border shadow-sm transition-colors"
                  >
                    <Icon name="download" size={16} />
                    <span>Download Problem Rows CSV</span>
                  </button>
                  <span className="text-[11px] text-on-surface-variant">
                    Contains skipped duplicates, invalid rows, and DNC protected records with explanations.
                  </span>
                </div>
              )}

              <p className="text-[12px] text-on-surface-variant">
                Do Not Call safeguards and duplicate rules were strictly enforced.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 sm:py-4 bg-surface-elevated flex items-center justify-between border-t border-border">
          {step <= 3 ? (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-surface text-on-surface text-[14px] hover:bg-surface-secondary transition-colors border border-border"
                  id="cancelModalBtn"
                  type="button"
                >
                  Cancel
                </button>
                {step > 1 && (
                  <button
                    onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                    className="px-4 py-2 rounded-lg text-on-surface-variant hover:text-on-surface text-[14px]"
                    type="button"
                  >
                    Back
                  </button>
                )}
              </div>

              <div>
                {step === 1 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-on-primary text-[14px] font-semibold shadow-sm hover:bg-primary-hover transition-colors"
                    type="button"
                  >
                    <span>Select File</span>
                    <Icon name="arrow_forward" size={16} />
                  </button>
                )}

                {step === 2 && (
                  <button
                    onClick={handleGoToPreview}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-on-primary text-[14px] font-semibold shadow-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
                    type="button"
                  >
                    <span>{isProcessing ? 'Analyzing...' : 'Next: Review Issues'}</span>
                    <Icon name="arrow_forward" size={16} />
                  </button>
                )}

                {step === 3 && (
                  <button
                    onClick={handleProcessImport}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-on-primary text-[14px] font-semibold shadow-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
                    id="processImportBtn"
                    type="button"
                  >
                    <Icon name="cloud_done" size={16} />
                    <span>
                      {isProcessing
                        ? 'Importing Leads...'
                        : `Import Leads (${previewSummary?.readyRows ?? 0} ready)`}
                    </span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                onClick={() => {
                  setStep(1);
                  setCsvContent('');
                  setFilename('');
                  setPreviewSummary(null);
                  setImportResult(null);
                }}
                className="px-4 py-2 rounded-lg bg-surface text-on-surface text-[14px] hover:bg-surface-secondary transition-colors border border-border"
                type="button"
              >
                Upload Another CSV
              </button>
              <button
                onClick={handleFinish}
                className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-primary text-on-primary text-[14px] font-semibold shadow-sm hover:bg-primary-hover transition-colors"
                id="viewLeadsBtn"
                type="button"
              >
                <span>View Leads</span>
                <Icon name="arrow_forward" size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
