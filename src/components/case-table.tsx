'use client';
import {
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  SlidersHorizontal,
  X,
} from './icons';
import type { CaseList, CaseRecord } from '@/contracts/workspace';
import { bureaus, categories, statuses } from '@/contracts/cases';
import { Button, Empty, ErrorNotice, OverlapBadge, Status } from './ui';
import { date } from './api';
export type Filters = {
  q: string;
  bureau: string;
  region: string;
  category: string;
  status: string;
  from: string;
  to: string;
  flag: string;
  institution_id: string;
  page: number;
};
export const defaultFilters: Filters = {
  q: '',
  bureau: '',
  region: '',
  category: '',
  status: '',
  from: '',
  to: '',
  flag: '',
  institution_id: '',
  page: 1,
};
export function FiltersBar({
  filters,
  onChange,
  advanced,
  setAdvanced,
}: {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
}) {
  const count = Object.entries(filters).filter(([k, v]) => k !== 'q' && k !== 'page' && v).length;
  return (
    <div className="filters-wrap">
      <div className="filters">
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label="Search cases"
            placeholder="Search institution, ID or case…"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
          />
          {filters.q ? (
            <button
              className="icon-btn small"
              aria-label="Clear search"
              onClick={() => onChange({ q: '' })}
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
        <select
          aria-label="Bureau filter"
          value={filters.bureau}
          onChange={(e) => onChange({ bureau: e.target.value })}
        >
          <option value="">All bureaus</option>
          {bureaus.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Status filter"
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {statuses.map((v) => (
            <option value={v} key={v}>
              {v.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <Button className={advanced ? 'selected' : ''} onClick={() => setAdvanced(!advanced)}>
          <SlidersHorizontal size={14} />
          Filters{count ? <span className="count-pill">{count}</span> : null}
        </Button>
        {count ? (
          <button
            className="text-btn"
            onClick={() => onChange({ ...defaultFilters, q: filters.q })}
          >
            Reset
          </button>
        ) : null}
      </div>
      {advanced ? (
        <div className="advanced-filters">
          <label>
            Region
            <select value={filters.region} onChange={(e) => onChange({ region: e.target.value })}>
              <option value="">All regions</option>
              {['Central', 'East', 'North', 'South', 'West'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={filters.category}
              onChange={(e) => onChange({ category: e.target.value })}
            >
              <option value="">All categories</option>
              {categories.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Attention
            <select value={filters.flag} onChange={(e) => onChange({ flag: e.target.value })}>
              <option value="">Any</option>
              <option value="overlap">Cross-bureau</option>
              <option value="overdue">Overdue</option>
              <option value="due_soon">Due in 3 days</option>
              <option value="review">Identity review</option>
            </select>
          </label>
          <label>
            Received from
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ from: e.target.value })}
            />
          </label>
          <label>
            Received through
            <input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ to: e.target.value })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
export function CaseTable({
  data,
  onSelect,
  compact = false,
  loading = false,
  error = '',
  retry,
}: {
  data?: CaseList;
  onSelect: (id: string) => void;
  compact?: boolean;
  loading?: boolean;
  error?: string;
  retry?: () => void;
}) {
  if (error) return <ErrorNotice retry={retry}>{error}</ErrorNotice>;
  if (!data && loading)
    return (
      <div className="table-skeleton" aria-label="Loading cases">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} />
        ))}
      </div>
    );
  if (!data?.rows.length)
    return (
      <Empty title="No cases match this view">
        Try a different filter or receive a new complaint.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table className={`case-table ${compact ? 'compact' : ''}`}>
        <thead>
          <tr>
            <th>
              Case / institution <ArrowDown size={12} />
            </th>
            <th>Status</th>
            <th>Bureau</th>
            {!compact ? <th>Officer</th> : null}
            <th>Due date</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((c) => (
            <CaseRow key={c.id} item={c} onSelect={onSelect} compact={compact} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
function CaseRow({
  item: c,
  onSelect,
  compact,
}: {
  item: CaseRecord;
  onSelect: (id: string) => void;
  compact: boolean;
}) {
  const name = c.institution_name || c.source_institution;
  return (
    <tr>
      <td>
        <div className="case-cell">
          <div className="case-line">
            <span className="mono case-number">{c.case_no}</span>
            {c.has_overlap ? <OverlapBadge /> : null}
            {c.identity_state === 'review' ? (
              <span className="review-dot" title="Institution identity requires human review" />
            ) : null}
          </div>
          <button
            className="row-link"
            onClick={() => onSelect(c.id)}
            title={`${c.title} · ${name}`}
          >
            {c.title}
          </button>
          <div className="cell-subtitle">
            {name}
            {c.region ? ` · ${c.region}` : ' · Identity review'}
          </div>
        </div>
      </td>
      <td>
        <Status value={c.status} />
      </td>
      <td>
        <span
          className={`bureau-icon ${c.bureau === 'RB' ? 'violet' : c.bureau === 'PGRC' ? 'blue' : 'green'}`}
        >
          {c.bureau === 'Regional Office' ? 'RO' : c.bureau}
        </span>
      </td>
      {!compact ? (
        <td>
          <div className="person-cell">
            <span className="avatar tiny">
              {c.officer_name
                ?.split(' ')
                .map((v) => v[0])
                .join('')
                .slice(0, 2) || '—'}
            </span>
            <span>{c.officer_name || 'Unassigned'}</span>
          </div>
        </td>
      ) : null}
      <td>
        <span className={`due-date ${c.overdue ? 'late' : ''}`}>
          <Clock3 size={12} />
          {date(c.expected_disposal_at)}
        </span>
        {c.overdue ? (
          <span className="due-note">Overdue</span>
        ) : c.due_soon ? (
          <span className="due-note soon">Due soon</span>
        ) : null}
      </td>
    </tr>
  );
}
export function Pagination({ data, onPage }: { data?: CaseList; onPage: (page: number) => void }) {
  if (!data) return null;
  const pages = Math.ceil(data.total / data.page_size);
  return (
    <div className="pagination">
      <span>
        {data.total
          ? `${(data.page - 1) * data.page_size + 1}–${Math.min(data.page * data.page_size, data.total)} of ${data.total} cases`
          : '0 cases'}
      </span>
      <div>
        <Button
          aria-label="Previous page"
          disabled={data.page <= 1}
          onClick={() => onPage(data.page - 1)}
        >
          <ChevronLeft size={15} />
        </Button>
        <span>
          Page {data.page} of {pages || 1}
        </span>
        <Button
          aria-label="Next page"
          disabled={data.page >= pages}
          onClick={() => onPage(data.page + 1)}
        >
          <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}
