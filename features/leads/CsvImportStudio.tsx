'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/lib/ui/icons';
import { parseCsv } from '@/lib/csv/parser';
import {
  autoDetectMappings,
  RM_FIELD_DEFINITIONS,
  type RmSystemField,
  type ColumnMappingResult,
} from '@/lib/csv/mapping';
import type { CsvPreviewSummary, DuplicateStrategy, ImportProblemRow } from '@/lib/csv/importer';

const SAMPLE_CSV = `Full Name,Work Phone,Organisation,Role,Direct Email,City,Country
Marcus Brody,+1 415 890 2104,PrimeFreight Inc.,VP Operations,m.brody@primefreight.io,San Francisco,US
Elena Rostova,+1 312 402 9981,Titan Supply Corp,Logistics Director,elena.rostova@titansupply.com,Chicago,US
David Vance,+1 206 555 0199,Apex Carrier Ltd,Dispatch Lead,d.vance@apexcarrier.com,Seattle,US
Rachel Adams,+1 214 555 0144,LoneStar Hauling,Fleet Manager,rachel@lonestarhaul.com,Dallas,US
Thomas Wright,+1 404 555 0188,Atlanta Express,VP Procurement,t.wright@atlantaexp.com,Atlanta,US`;

export const CsvImportStudio: React.FC = () => {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvContent, setCsvContent] = useState<string>('');
  const [filename, setFilename] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [parsedRowsCount, setParsedRowsCount] = useState(0);
  const [mappings, setMappings] = useState<ColumnMappingResult[]>([]);
  const [dedupStrat, setDedupStrat] = useState<DuplicateStrategy>('skip');
  const [previewSummary, setPreviewSummary] = useState<CsvPreviewSummary | null>(null);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
    invalid: number;
    dncProtected: number;
  } | null>(null);
  const [showIssuesReview, setShowIssuesReview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const getSystemFieldLabel = (field: RmSystemField): string => {
    const def = RM_FIELD_DEFINITIONS.find((d) => d.id === field);
    return def ? def.label : field;
  };

  return (
    <div className="flex flex-col w-full bg-background min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-[1400px] w-full mx-auto flex flex-col gap-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Link
                href="/leads"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
              >
                <Icon name="arrow_back" size={16} />
                <span>Back to Leads CRM</span>
              </Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2.5">
              <Icon name="upload_file" size={26} className="text-primary" />
              <span>CSV Lead Import Studio</span>
            </h1>
            <p className="text-sm text-on-surface-variant">
              Upload, map schema fields, validate E.164 phone compliance, and scrub against internal DNC registries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              type="button"
              className="px-3 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-secondary text-on-surface text-xs font-semibold border border-border transition-colors flex items-center gap-1.5"
            >
              <Icon name="description" size={14} />
              <span>Load Sample Data</span>
            </button>
          </div>
        </div>

        {/* Stepper Header */}
        <div className="grid grid-cols-4 rounded-lg bg-surface border border-border overflow-hidden text-xs uppercase font-semibold">
          {[
            { s: 1, label: '1. Upload CSV' },
            { s: 2, label: '2. Field Mapping' },
            { s: 3, label: '3. Deduplication & DNC' },
            { s: 4, label: '4. Summary' },
          ].map((item) => (
            <div
              key={item.s}
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
            </div>
          ))}
        </div>

        {errorMessage && (
          <div className="p-4 rounded-lg bg-error/15 border border-error/30 text-error text-sm flex items-center gap-2">
            <Icon name="error" size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: File Upload */}
        {step === 1 && (
          <div className="bg-surface rounded-xl border border-border p-8 flex flex-col items-center justify-center text-center gap-6">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileUpload(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-2xl border-2 border-dashed border-border hover:border-primary rounded-xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-surface-elevated transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Icon name="cloud_upload" size={36} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">
                  Drag and drop your CSV file here
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  Supports UTF-8 CSV with phone numbers in any international or local format
                </p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors"
              >
                Browse Files
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 2 && (
          <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Map CSV Columns</h3>
                <p className="text-xs text-on-surface-variant">
                  Match your CSV headers to RM Dialer contact fields. Phone is required.
                </p>
              </div>
              <div className="text-xs font-mono text-on-surface-variant">
                File: <span className="text-on-surface font-semibold">{filename}</span> ({parsedRowsCount} rows)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-on-surface-variant font-mono">
                    <th className="py-2.5 px-3">CSV Column Header</th>
                    <th className="py-2.5 px-3">Sample Data</th>
                    <th className="py-2.5 px-3">RM Dialer Field</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mappings.map((m) => (
                    <tr key={m.csvHeader} className="hover:bg-surface-elevated">
                      <td className="py-3 px-3 font-semibold text-on-surface font-mono">
                        {m.csvHeader}
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant truncate max-w-xs font-mono text-xs">
                        {m.sampleValue || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={m.systemField}
                          onChange={(e) =>
                            handleFieldChange(m.csvHeader, e.target.value as RmSystemField)
                          }
                          className="px-3 py-1.5 rounded-md bg-surface-elevated border border-border text-on-surface text-xs focus:outline-none focus:border-primary font-medium"
                        >
                          <option value="do_not_map">— Ignore this column —</option>
                          {RM_FIELD_DEFINITIONS.map((def) => (
                            <option key={def.id} value={def.id}>
                              {def.label} {def.isRequired ? '(Required)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        {m.systemField !== 'do_not_map' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                            <Icon name="check" size={14} /> Matched
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant">Ignored</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-surface-elevated text-on-surface text-sm font-semibold hover:bg-surface-secondary border border-border"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleGoToPreview}
                disabled={isProcessing}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover flex items-center gap-2"
              >
                {isProcessing ? 'Analyzing...' : 'Continue to Validation →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Deduplication */}
        {step === 3 && previewSummary && (
          <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Data Hygiene & DNC Validation</h3>
                <p className="text-xs text-on-surface-variant">
                  Review validation breakdown before writing records to database.
                </p>
              </div>
            </div>

            {/* Metric Boxes */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-surface-elevated border border-border flex flex-col">
                <span className="text-xs text-on-surface-variant uppercase font-mono">Total Rows</span>
                <span className="text-2xl font-bold text-on-surface mt-1">{previewSummary.totalRows}</span>
              </div>
              <div className="p-4 rounded-lg bg-success/10 border border-success/30 flex flex-col">
                <span className="text-xs text-success uppercase font-mono">Valid Phone Numbers</span>
                <span className="text-2xl font-bold text-success mt-1">{previewSummary.validRows}</span>
              </div>
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col">
                <span className="text-xs text-amber-600 dark:text-amber-400 uppercase font-mono">Existing Duplicates</span>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{previewSummary.duplicateCount}</span>
              </div>
              <div className="p-4 rounded-lg bg-error/10 border border-error/30 flex flex-col">
                <span className="text-xs text-error uppercase font-mono">DNC Protected</span>
                <span className="text-2xl font-bold text-error mt-1">{previewSummary.dncCount}</span>
              </div>
            </div>

            {/* Duplicate Strategy Option */}
            <div className="p-4 rounded-lg bg-surface-elevated border border-border flex flex-col gap-3">
              <h4 className="text-sm font-bold text-on-surface">Duplicate Handling Rule</h4>
              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  { id: 'skip', title: 'Skip duplicates', desc: 'Keep existing database lead untouched' },
                  { id: 'overwrite', title: 'Overwrite info', desc: 'Update details while strictly preserving DNC status' },
                  { id: 'update_missing', title: 'Fill missing fields only', desc: 'Preserve existing data, only add empty fields' },
                ].map((strat) => (
                  <label
                    key={strat.id}
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition-colors ${
                      dedupStrat === strat.id
                        ? 'border-primary bg-primary/10 text-on-surface'
                        : 'border-border text-on-surface-variant hover:bg-surface-secondary'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strat"
                      checked={dedupStrat === strat.id}
                      onChange={() => setDedupStrat(strat.id as DuplicateStrategy)}
                      className="hidden"
                    />
                    <span className="font-bold text-on-surface">{strat.title}</span>
                    <span className="text-[11px] text-on-surface-variant">{strat.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg bg-surface-elevated text-on-surface text-sm font-semibold hover:bg-surface-secondary border border-border"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleProcessImport}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary-hover flex items-center gap-2 shadow-md"
              >
                {isProcessing ? 'Importing Leads...' : `Execute Lead Import (${previewSummary.validRows} Leads) →`}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && importResult && (
          <div className="bg-surface rounded-xl border border-border p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center">
              <Icon name="check_circle" size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-on-surface">Import Completed Successfully</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Your lead batch has been ingested and queued for campaign dialer routing.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-4 w-full max-w-2xl text-center">
              <div className="p-4 rounded-lg bg-surface-elevated border border-border">
                <span className="text-xs text-on-surface-variant uppercase font-mono">New Leads</span>
                <span className="text-2xl font-bold text-success mt-1 block">{importResult.inserted}</span>
              </div>
              <div className="p-4 rounded-lg bg-surface-elevated border border-border">
                <span className="text-xs text-on-surface-variant uppercase font-mono">Updated</span>
                <span className="text-2xl font-bold text-primary mt-1 block">{importResult.updated}</span>
              </div>
              <div className="p-4 rounded-lg bg-surface-elevated border border-border">
                <span className="text-xs text-on-surface-variant uppercase font-mono">Skipped</span>
                <span className="text-2xl font-bold text-on-surface-variant mt-1 block">{importResult.skipped}</span>
              </div>
              <div className="p-4 rounded-lg bg-surface-elevated border border-border">
                <span className="text-xs text-on-surface-variant uppercase font-mono">DNC Blocked</span>
                <span className="text-2xl font-bold text-error mt-1 block">{importResult.dncProtected}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/leads"
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover shadow-md"
              >
                View Leads Table
              </Link>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCsvContent('');
                  setFilename('');
                }}
                className="px-4 py-2.5 rounded-lg bg-surface-elevated text-on-surface text-sm font-semibold border border-border hover:bg-surface-secondary"
              >
                Upload Another CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
