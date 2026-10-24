'use client';
import { useState } from 'react';
import { Building2, ChevronRight, GitBranch, History, Files, Printer, Search } from './icons';
import { bureauShort, bureauTone } from './overlap-feed';
import type {
  CaseList,
  Institution,
  InstitutionTimeline,
  WorkspaceData,
} from '@/contracts/workspace';
import { date, useResource } from './api';
import { Badge, Button, Empty, ErrorNotice, Status } from './ui';
import { CaseTable, Pagination } from './case-table';
export function InstitutionsView({
  data,
  id,
  onNavigate,
  onSelect,
}: {
  data: WorkspaceData;
  id: string | null;
  onNavigate: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1);
  const institution = data.institutions.find((i) => i.id === id);
  const cases = useResource<CaseList>(
    id ? `/api/cases?institution_id=${id}&page=${page}&page_size=100` : null,
    undefined,
    5000,
  );
  const rows = data.institutions.filter((i) =>
    `${i.name} ${i.permanent_id} ${i.city}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="print-only print-header">
        Casebridge · Institution record · printed {date(new Date().toISOString(), true)} · Synthetic
        demonstration data
      </div>
      <div className="page-heading compact">
        <div>
          <h1>{institution ? institution.name : 'Institution directory'}</h1>
          <p>
            {institution ? (
              <>
                <span className="mono">{institution.permanent_id}</span> · {institution.city} ·{' '}
                {institution.region} region
              </>
            ) : (
              'A single profile and complaint history for every resolved institution.'
            )}
          </p>
        </div>
        {institution ? (
          <Button className="no-print" onClick={() => window.print()} title="Print or save as PDF">
            <Printer size={15} />
            Print
          </Button>
        ) : (
          <Badge>{data.institutions.length} institutions</Badge>
        )}
      </div>
      {institution ? (
        <InstitutionProfile
          institution={institution}
          cases={cases}
          setPage={setPage}
          onSelect={onSelect}
        />
      ) : (
        <section className="panel">
          <div className="filters">
            <div className="search-field">
              <Search size={15} />
              <input
                aria-label="Search institutions"
                placeholder="Search name, Permanent ID or city…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          {!rows.length ? (
            <Empty title="No matching institutions">Try another name, Permanent ID or city.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="directory-table">
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Permanent ID</th>
                    <th>Region</th>
                    <th>Source snapshot</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="directory-name">
                          <span className="institution-mark">
                            <Building2 size={17} />
                          </span>
                          <div>
                            <button
                              className="row-link"
                              onClick={() => {
                                setPage(1);
                                onNavigate(i.id);
                              }}
                            >
                              {i.name}
                            </button>
                            <small>{i.city}</small>
                          </div>
                        </div>
                      </td>
                      <td className="mono muted">{i.permanent_id}</td>
                      <td>{i.region}</td>
                      <td className="muted">{date(i.source_updated_at)}</td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={() => {
                            setPage(1);
                            onNavigate(i.id);
                          }}
                          aria-label={`Open ${i.name}`}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
function InstitutionProfile({
  institution,
  cases,
  setPage,
  onSelect,
}: {
  institution: Institution;
  cases: ReturnType<typeof useResource<CaseList>>;
  setPage: (page: number) => void;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<'timeline' | 'cases'>('timeline');
  const timeline = useResource<InstitutionTimeline>(
    `/api/institutions/${institution.id}/timeline`,
    undefined,
    10000,
  );
  const rows = cases.data?.rows ?? [];
  const bureaus = [...new Set(rows.map((c) => c.bureau))].sort();
  const activeBureaus = new Set(rows.filter((c) => c.status !== 'disposed').map((c) => c.bureau));
  const received = [...new Set(rows.map((c) => c.source_institution))];
  const days = new Map<string, InstitutionTimeline['events']>();
  for (const e of timeline.data?.events ?? []) {
    const d = date(e.occurred_at);
    days.set(d, [...(days.get(d) ?? []), e]);
  }
  return (
    <div className="profile-layout">
      <section className="panel profile-main">
        <div className="detail-tabs profile-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'timeline'}
            className={tab === 'timeline' ? 'active' : ''}
            onClick={() => setTab('timeline')}
          >
            <History size={15} />
            Cross-bureau timeline
          </button>
          <button
            role="tab"
            aria-selected={tab === 'cases'}
            className={tab === 'cases' ? 'active' : ''}
            onClick={() => setTab('cases')}
          >
            <Files size={15} />
            Cases <Badge>{cases.data?.total ?? '—'}</Badge>
          </button>
        </div>
        {tab === 'timeline' ? (
          timeline.error ? (
            <ErrorNotice retry={timeline.refresh}>{timeline.error}</ErrorNotice>
          ) : !timeline.data ? (
            <div className="table-skeleton">
              <div />
              <div />
              <div />
            </div>
          ) : !timeline.data.events.length ? (
            <Empty title="No recorded actions yet" />
          ) : (
            <ol className="inst-timeline">
              {[...days.entries()].map(([day, events]) => (
                <li key={day}>
                  <div className="inst-day">{day}</div>
                  <ol>
                    {events.map((e) => (
                      <li key={e.id} className={`inst-event ${bureauTone[e.bureau]}`}>
                        <span className="inst-dot" aria-hidden />
                        <div className="inst-event-body">
                          <div className="inst-event-line">
                            <span className={`bureau-icon ${bureauTone[e.bureau]}`}>
                              {bureauShort(e.bureau)}
                            </span>
                            <strong>{e.action}</strong>
                            {e.to_status && e.from_status !== e.to_status ? (
                              <Status value={e.to_status} />
                            ) : null}
                            <time>
                              {new Intl.DateTimeFormat('en-IN', {
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZone: 'Asia/Kolkata',
                              }).format(new Date(e.occurred_at))}
                            </time>
                          </div>
                          <button className="inst-event-case" onClick={() => onSelect(e.case_id)}>
                            <span className="mono">{e.case_no}</span> {e.title}
                          </button>
                          <small>{e.actor_name ?? 'System'}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          )
        ) : (
          <>
            <CaseTable
              data={cases.data}
              loading={cases.loading}
              error={cases.error}
              retry={cases.refresh}
              onSelect={onSelect}
            />
            <Pagination data={cases.data} onPage={setPage} />
          </>
        )}
      </section>
      <aside className="profile-side">
        <section className="panel side-card">
          <h3>Institution profile</h3>
          <dl className="side-list">
            <dt>Permanent ID</dt>
            <dd className="mono">{institution.permanent_id}</dd>
            <dt>Address</dt>
            <dd>{institution.address}</dd>
            <dt>Region</dt>
            <dd>{institution.region}</dd>
            <dt>Directory snapshot</dt>
            <dd>{date(institution.source_updated_at, true)}</dd>
          </dl>
        </section>
        <section className="panel side-card">
          <h3>Handled by</h3>
          {bureaus.map((b) => {
            const mine = rows.filter((c) => c.bureau === b);
            const active = mine.filter((c) => c.status !== 'disposed').length;
            return (
              <div className="side-bureau" key={b}>
                <span className={`bureau-icon ${bureauTone[b]}`}>{bureauShort(b)}</span>
                <span>{b}</span>
                <span className="muted">
                  {active} active · {mine.length - active} disposed
                </span>
              </div>
            );
          })}
          {activeBureaus.size > 1 ? (
            <div className="side-alert">
              <GitBranch size={15} />
              <span>
                Active in {activeBureaus.size} bureaus. Coordinate before the next action; cases
                stay separate.
              </span>
            </div>
          ) : null}
        </section>
        {received.length ? (
          <section className="panel side-card">
            <h3>Names as received</h3>
            <p className="muted small-text">
              Complaints wrote this institution differently. All are linked to one Permanent ID.
            </p>
            <ul className="received-names">
              {received.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
