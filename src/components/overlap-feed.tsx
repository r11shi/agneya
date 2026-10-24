'use client';
import { useState } from 'react';
import { ArrowRight, ChevronRight as CaretRight, Clock3, GitBranch, History } from './icons';
import type { CaseList, CaseRecord, CoordinationData } from '@/contracts/workspace';
import { date, relative } from './api';
import { Status } from './ui';
export const bureauTone: Record<string, string> = {
  PGRC: 'blue',
  RB: 'violet',
  'Regional Office': 'green',
};
export const bureauShort = (b: string) => (b === 'Regional Office' ? 'RO' : b);
export const bureauName: Record<string, string> = {
  PGRC: 'Public Grievance Redressal Cell',
  RB: 'Regulation Bureau',
  'Regional Office': 'Regional Office',
};
type Group = {
  id: string;
  name: string;
  permanent_id: string | null;
  region: string | null;
  lanes: [string, CaseRecord[]][];
  overdue: number;
  latest: string;
};
// Institution-level awareness: any institution whose active cases sit in more
// than one bureau. This is not a duplicate finding; officials decide.
export function groupOverlaps(rows: CaseRecord[]): Group[] {
  const map = new Map<string, CaseRecord[]>();
  for (const c of rows) {
    if (!c.institution_id || c.status === 'disposed') continue;
    map.set(c.institution_id, [...(map.get(c.institution_id) ?? []), c]);
  }
  return [...map.values()]
    .map((cases) => {
      const lanes = new Map<string, CaseRecord[]>();
      for (const c of cases) lanes.set(c.bureau, [...(lanes.get(c.bureau) ?? []), c]);
      return {
        id: cases[0].institution_id!,
        name: cases[0].institution_name ?? cases[0].source_institution,
        permanent_id: cases[0].permanent_id,
        region: cases[0].region,
        lanes: [...lanes.entries()].sort(([a], [b]) => a.localeCompare(b)),
        overdue: cases.filter((c) => c.overdue).length,
        latest: cases
          .map((c) => c.last_action_at)
          .sort()
          .at(-1)!,
      };
    })
    .filter((g) => g.lanes.length > 1)
    .sort(
      (a, b) =>
        b.lanes.length - a.lanes.length ||
        b.overdue - a.overdue ||
        b.latest.localeCompare(a.latest),
    );
}
export function OverlapFeed({
  data,
  coordination,
  loading,
  limit,
  onSelect,
  onInstitution,
  onViewAll,
}: {
  data?: CaseList;
  coordination?: CoordinationData;
  loading: boolean;
  limit?: number;
  onSelect: (id: string) => void;
  onInstitution: (id: string) => void;
  onViewAll?: () => void;
}) {
  const groups = groupOverlaps(data?.rows ?? []);
  const shown = limit ? groups.slice(0, limit) : groups;
  const pendingFor = (name: string) =>
    coordination?.proposals.filter((p) => p.status === 'pending' && p.institution_name === name)
      .length ?? 0;
  return (
    <section className="overlap-feed" aria-labelledby="overlap-title">
      <header className="overlap-feed-head">
        <span className="overlap-feed-icon">
          <GitBranch size={18} weight="bold" />
        </span>
        <div>
          <h2 id="overlap-title">Potential overlapping cases — coordination required</h2>
          <p>
            {loading && !data
              ? 'Checking active cases across bureaus…'
              : `${groups.length} institutions have active cases in more than one bureau. Same institution does not mean duplicate complaint.`}
          </p>
        </div>
        {onViewAll && groups.length > shown.length ? (
          <button className="text-btn" onClick={onViewAll}>
            View all {groups.length}
            <ArrowRight size={13} />
          </button>
        ) : null}
      </header>
      {loading && !data ? (
        <div className="overlap-skeleton" aria-hidden>
          <div />
          <div />
        </div>
      ) : !groups.length ? (
        <p className="overlap-empty">No institution currently has active cases in two bureaus.</p>
      ) : (
        <ol className="overlap-list">
          {shown.map((g, i) => (
            <OverlapRow
              key={g.id}
              group={g}
              pending={pendingFor(g.name)}
              defaultOpen={i === 0 && !!limit}
              onSelect={onSelect}
              onInstitution={onInstitution}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
function OverlapRow({
  group: g,
  pending,
  defaultOpen,
  onSelect,
  onInstitution,
}: {
  group: Group;
  pending: number;
  defaultOpen: boolean;
  onSelect: (id: string) => void;
  onInstitution: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const active = g.lanes.reduce((n, [, cases]) => n + cases.length, 0);
  return (
    <li className={`overlap-row ${open ? 'open' : ''}`}>
      <div className="overlap-row-head">
        <button
          className="overlap-toggle"
          aria-expanded={open}
          aria-controls={`lanes-${g.id}`}
          onClick={() => setOpen(!open)}
        >
          <CaretRight size={13} className="caret" />
          <span className="overlap-row-name">
            <strong>{g.name}</strong>
            <small>
              <span className="mono">{g.permanent_id}</span> · {g.region} · updated{' '}
              {relative(g.latest)}
            </small>
          </span>
        </button>
        <span className="overlap-row-bureaus">
          {g.lanes.map(([bureau, cases]) => (
            <span key={bureau} className={`bureau-icon ${bureauTone[bureau]}`} title={bureau}>
              {bureauShort(bureau)} {cases.length}
            </span>
          ))}
        </span>
        <span className="overlap-row-flags">
          {g.overdue ? (
            <span className="chip red">
              <Clock3 size={12} />
              {g.overdue} late
            </span>
          ) : null}
          {pending ? <span className="chip amber">{pending} proposal</span> : null}
        </span>
        <span className="overlap-row-count" title="Active cases">
          {active}
        </span>
        <button className="btn small ghost" onClick={() => onInstitution(g.id)}>
          <History size={14} />
          Timeline
        </button>
      </div>
      <div className="disclosure" id={`lanes-${g.id}`} aria-hidden={!open}>
        <div>
          <div className="lanes" style={{ ['--lanes' as string]: g.lanes.length }}>
            {g.lanes.map(([bureau, cases]) => (
              <div className={`lane ${bureauTone[bureau]}`} key={bureau}>
                <div className="lane-head">
                  <span className={`bureau-icon ${bureauTone[bureau]}`}>{bureauShort(bureau)}</span>
                  <span className="bureau-name">{bureauName[bureau] ?? bureau}</span>
                  <span className="lane-count">{cases.length}</span>
                </div>
                {cases.slice(0, 2).map((c) => (
                  <button
                    key={c.id}
                    className="lane-case"
                    tabIndex={open ? 0 : -1}
                    onClick={() => onSelect(c.id)}
                  >
                    <span className="lane-case-top">
                      <span className="mono">{c.case_no}</span>
                      <Status value={c.status} />
                    </span>
                    <strong>{c.title}</strong>
                    <small>
                      {c.last_action} · {c.officer_name ?? 'Unassigned'}
                    </small>
                    <small className={c.overdue ? 'text-danger' : ''}>
                      Due {date(c.expected_disposal_at)}
                      {c.overdue ? ' · overdue' : ''}
                    </small>
                  </button>
                ))}
                {cases.length > 2 ? (
                  <button
                    className="lane-more"
                    tabIndex={open ? 0 : -1}
                    onClick={() => onInstitution(g.id)}
                  >
                    +{cases.length - 2} more in {bureauShort(bureau)}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}
