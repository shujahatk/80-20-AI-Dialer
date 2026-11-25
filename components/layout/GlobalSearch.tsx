'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/api/client';

interface SearchHit {
  id: string;
  label: string;
  detail: string;
  href: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await authenticatedFetch(`/api/leads?search=${encodeURIComponent(query.trim())}&limit=5`);
        const json = await res.json();
        const rows = Array.isArray(json.data) ? json.data : [];
        setHits(
          rows.map((lead: { id: string; name?: string; full_name?: string; company?: string; company_name?: string; phone?: string; phone_e164?: string }) => ({
            id: lead.id,
            label: lead.name || lead.full_name || 'Lead',
            detail: [lead.company || lead.company_name, lead.phone || lead.phone_e164].filter(Boolean).join(' · '),
            href: `/leads?search=${encodeURIComponent(query.trim())}`,
          }))
        );
      } catch {
        setHits([]);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    setOpen(false);
    router.push(q ? `/leads?search=${encodeURIComponent(q)}` : '/leads');
  };

  const destinations = [
    { href: '/workstation', label: 'Workstation' },
    { href: '/leads', label: 'Leads' },
    { href: '/campaigns', label: 'Campaigns' },
    { href: '/calls', label: 'Calls & recordings' },
    { href: '/analytics', label: 'Analytics' },
  ];

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit}>
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-muted">
          <Search className="h-4 w-4" />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 180)}
          placeholder="Search leads, campaigns, or calls..."
          className="h-8 w-full rounded-lg border border-border bg-muted/50 py-0 pl-9 pr-12 text-[13px] leading-5 text-on-surface placeholder:text-on-surface-muted transition-colors duration-fast focus:border-primary focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Search workspace"
        />
        <kbd className="pointer-events-none absolute inset-y-0 right-2 hidden items-center text-[10px] font-medium text-on-surface-muted sm:flex">
          ⌘K
        </kbd>
      </form>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg rm-panel">
          <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
            Jump to
          </div>
          {destinations.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 text-[13px] text-on-surface hover:bg-surface-elevated"
              onMouseDown={(event) => event.preventDefault()}
            >
              {item.label}
            </Link>
          ))}
          {hits.length > 0 && (
            <>
              <div className="border-t border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                Matching leads
              </div>
              {hits.map((hit) => (
                <Link
                  key={hit.id}
                  href={hit.href}
                  className="block px-3 py-2 hover:bg-surface-elevated"
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <div className="text-[13px] font-medium text-on-surface">{hit.label}</div>
                  <div className="font-mono text-[11px] text-on-surface-variant">{hit.detail}</div>
                </Link>
              ))}
            </>
          )}
          {query.trim().length >= 2 && hits.length === 0 && (
            <div className="px-3 py-3 text-[12px] text-on-surface-variant">No matching leads. Press Enter to search the registry.</div>
          )}
        </div>
      )}
    </div>
  );
}
