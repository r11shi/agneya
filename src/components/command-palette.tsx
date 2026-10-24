'use client';
import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowRight, Building2, Files, Search } from './icons';
import type { CaseList, InstitutionMatch, WorkspaceData } from '@/contracts/workspace';
import { useResource } from './api';
import { Status } from './ui';
type Item = {
  key: string;
  group: string;
  label: string;
  detail?: string;
  run: () => void;
  status?: string;
  icon?: React.ReactNode;
};
// One search for cases, institutions and navigation. Opens with ⌘K / Ctrl+K and
// "/" with no animation: it is used too often to make people wait.
export function CommandPalette({
  open,
  onOpenChange,
  data,
  views,
  onNavigate,
  onCase,
  onInstitution,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: WorkspaceData;
  views: readonly (readonly [string, string, React.ComponentType<{ size?: number }>])[];
  onNavigate: (view: string, extras?: Record<string, string>) => void;
  onCase: (id: string) => void;
  onInstitution: (id: string) => void;
}) {
  const [q, setQ] = useState(''),
    [debounced, setDebounced] = useState(''),
    [active, setActive] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 140);
    return () => clearTimeout(t);
  }, [q]);
  const cases = useResource<CaseList>(
    open && debounced.length > 1
      ? `/api/cases?${new URLSearchParams({ q: debounced, page_size: '6' })}`
      : null,
  );
  const suggested = useResource<{ matches: InstitutionMatch[] }>(
    open && debounced.length > 1
      ? `/api/institutions/match?${new URLSearchParams({ q: debounced })}`
      : null,
  );
  const items = useMemo<Item[]>(() => {
    const close = (fn: () => void) => () => {
      onOpenChange(false);
      fn();
    };
    const lower = q.trim().toLowerCase();
    const institutions = lower
      ? [
          ...data.institutions.filter(
            (i) => i.permanent_id.toLowerCase() === lower || i.name.toLowerCase().includes(lower),
          ),
          ...(suggested.data?.matches ?? []).map((m) => m.institution),
        ]
          .filter((v, i, all) => all.findIndex((x) => x.id === v.id) === i)
          .slice(0, 5)
      : [];
    return [
      ...(debounced === q.trim() && cases.data?.rows ? cases.data.rows : []).map((c) => ({
        key: `case-${c.id}`,
        group: 'Cases',
        label: `${c.case_no} · ${c.title}`,
        detail: `${c.institution_name ?? c.source_institution} · ${c.bureau}`,
        status: c.status,
        icon: <Files size={16} />,
        run: close(() => onCase(c.id)),
      })),
      ...institutions.map((i) => ({
        key: `inst-${i.id}`,
        group: 'Institutions',
        label: i.name,
        detail: `${i.permanent_id} · ${i.city}, ${i.region}`,
        icon: <Building2 size={16} />,
        run: close(() => onInstitution(i.id)),
      })),
      ...views
        .filter(([, label]) => !lower || label.toLowerCase().includes(lower))
        .map(([key, label, Icon]) => ({
          key: `view-${key}`,
          group: 'Go to',
          label,
          icon: <Icon size={16} />,
          run: close(() => onNavigate(key)),
        })),
      ...(lower
        ? [
            {
              key: 'search-all',
              group: 'Search',
              label: `Search all cases for “${q.trim()}”`,
              icon: <Search size={16} />,
              run: close(() => onNavigate('cases', { q: q.trim() })),
            },
          ]
        : []),
    ];
  }, [
    q,
    debounced,
    cases.data,
    data.institutions,
    views,
    onNavigate,
    onCase,
    onInstitution,
    onOpenChange,
  ]);
  const current = Math.min(active, Math.max(items.length - 1, 0));
  function key(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      setActive(next);
      document.getElementById(`cmd-${next}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && items[current]) {
      e.preventDefault();
      items[current].run();
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setQ('');
          setActive(0);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="cmd-backdrop" />
        <Dialog.Popup className="cmd" aria-label="Search the workspace">
          <Dialog.Title className="sr-only">Search the workspace</Dialog.Title>
          <div className="cmd-input">
            <Search size={18} />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={key}
              placeholder="Search case ID, institution, Permanent ID or a page…"
              aria-label="Search"
              role="combobox"
              aria-expanded
              aria-controls="cmd-list"
              aria-activedescendant={items[current] ? `cmd-${current}` : undefined}
            />
            <kbd>Esc</kbd>
          </div>
          <div className="cmd-list" id="cmd-list" role="listbox">
            {items.length ? (
              items.map((item, i) => (
                <div key={item.key}>
                  {i === 0 || items[i - 1].group !== item.group ? (
                    <div className="cmd-group">{item.group}</div>
                  ) : null}
                  <button
                    id={`cmd-${i}`}
                    role="option"
                    aria-selected={i === current}
                    className={`cmd-item ${i === current ? 'active' : ''}`}
                    onMouseMove={() => setActive(i)}
                    onClick={item.run}
                  >
                    <span className="cmd-icon">{item.icon}</span>
                    <span className="cmd-text">
                      <strong>{item.label}</strong>
                      {item.detail ? <small>{item.detail}</small> : null}
                    </span>
                    {item.status ? <Status value={item.status} /> : null}
                    {i === current ? <ArrowRight size={14} /> : null}
                  </button>
                </div>
              ))
            ) : (
              <p className="cmd-empty">{cases.loading ? 'Searching…' : 'No matches.'}</p>
            )}
          </div>
          <div className="cmd-footer">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> to move
            </span>
            <span>
              <kbd>↵</kbd> to open
            </span>
            <span className="muted">Matches institution abbreviations like “SIT Pune”</span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
