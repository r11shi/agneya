'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { ArrowRight, ChevronRight, Command, Menu, Plus, Search, ShieldCheck } from './icons';
import type {
  CaseList,
  CoordinationData,
  Notification,
  NotificationFeed,
  WorkspaceData,
} from '@/contracts/workspace';
import { date, indiaDateBound, post, relative, useResource } from './api';
import { useCallback } from 'react';
import { Badge, Button, ErrorNotice } from './ui';
import { CaseTable, FiltersBar, Pagination, defaultFilters, type Filters } from './case-table';
import { NewCase } from './new-case';
import { CasePage } from './case-detail';
import { CoordinationView } from './coordination-view';
import { ReportsView } from './reports-view';
import { IntakeView } from './intake-view';
import { InstitutionsView } from './registry-views';
import { InboxView, NotificationBell } from './notification-panel';
import { Sidebar, navigation } from './sidebar';
import { OverlapFeed, bureauShort, bureauTone } from './overlap-feed';
import { CommandPalette } from './command-palette';
import type { Membership } from '@/contracts/workspace';
const names: Record<string, string> = {
  overview: 'Overview',
  cases: 'Cases',
  case: 'Case',
  institutions: 'Institutions',
  coordination: 'Coordination',
  reports: 'Reports',
  intake: 'Receive & import',
  alerts: 'Inbox',
};
const flagNames: Record<string, string> = {
  overdue: 'Beyond timeline',
  overlap: 'Cross-bureau',
  review: 'Identity review',
  due_soon: 'Due soon',
};
const statusNames: Record<string, string> = {
  pending: 'Pending',
  under_process: 'Under process',
  transferred: 'Transferred',
  escalated: 'Escalated',
  disposed: 'Disposed',
};
function fromParams(params: URLSearchParams): Filters {
  return {
    ...defaultFilters,
    flag: params.get('flag') || '',
    institution_id: params.get('institution') || '',
    q: params.get('q') || '',
    status: params.get('status') || '',
    bureau: params.get('bureau') || '',
  };
}
const india = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'Asia/Kolkata' }).format(
    new Date(value),
  );
// Built from single-field parts: server and browser ICU disagree on combined
// layouts, which caused a hydration mismatch.
function longDate(value: string) {
  return `${india(value, { weekday: 'long' })}, ${india(value, { day: 'numeric' })} ${india(value, { month: 'long' })} ${india(value, { year: 'numeric' })}`;
}
function greeting(value: string) {
  const hour = Number(india(value, { hour: 'numeric', hourCycle: 'h23' }));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}
function roleLabel(m?: Membership) {
  if (!m) return 'AICTE';
  const role = m.role.replaceAll('_', ' ');
  return m.bureau ? `${m.bureau} ${role}` : m.region ? `${m.region} ${role}` : role;
}
export function filterParams(f: Filters, pageSize = 25) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v && k !== 'from' && k !== 'to') p.set(k, String(v));
  }
  if (f.from) p.set('from', indiaDateBound(f.from)!);
  if (f.to) p.set('to', indiaDateBound(f.to, true)!);
  p.set('page_size', String(pageSize));
  return p.toString();
}
export function Workspace({ initial, demo }: { initial: WorkspaceData; demo: boolean }) {
  const router = useRouter(),
    params = useSearchParams(),
    requested = params.get('view') || 'overview',
    view = names[requested] ? requested : 'overview';
  const [filters, setFilters] = useState<Filters>(() => fromParams(params)),
    [advanced, setAdvanced] = useState(false),
    [newCase, setNewCase] = useState(false),
    [caseCrumb, setCaseCrumb] = useState(''),
    [inboxKind, setInboxKind] = useState(''),
    [mobileNav, setMobileNav] = useState(false),
    [palette, setPalette] = useState(false);
  const workspace = useResource<WorkspaceData>('/api/workspace', initial, 5000),
    data = workspace.data || initial;
  const coord = useResource<CoordinationData>('/api/coordination', undefined, 5000),
    bell = useResource<NotificationFeed>('/api/notifications?limit=40', undefined, 15000),
    inbox = useResource<NotificationFeed>(
      view === 'alerts'
        ? `/api/notifications?${new URLSearchParams({ limit: '200', ...(inboxKind ? { kind: inboxKind } : {}) })}`
        : null,
      undefined,
      15000,
    );
  const caseId = view === 'case' ? params.get('case') : null;
  const cases = useResource<CaseList>(
    view === 'cases' ? `/api/cases?${filterParams(filters)}` : null,
    undefined,
    5000,
  );
  const operational = data.memberships.find((m) => m.role === 'officer' || m.role === 'supervisor'),
    home = operational?.bureau ?? '';
  const overlaps = useResource<CaseList>(
    view === 'overview' || view === 'coordination' ? '/api/cases?flag=overlap&page_size=100' : null,
    undefined,
    5000,
  );
  const queue = useResource<CaseList>(
    view === 'overview' && home
      ? `/api/cases?${new URLSearchParams({ flag: 'overdue', bureau: home, page_size: '5' })}`
      : null,
    undefined,
    5000,
  );
  const canCreate = !!operational;
  const navigate = useCallback(
    (next: string, extras: Record<string, string> = {}) => {
      setMobileNav(false);
      router.push(`/?${new URLSearchParams({ view: next, ...extras })}`);
    },
    [router],
  );
  const setSelected = useCallback((id: string) => navigate('case', { case: id }), [navigate]);
  const openInstitution = useCallback(
    (id: string) => navigate('institutions', { institution: id }),
    [navigate],
  );
  function openNotification(n: Notification) {
    if (n.case_id) setSelected(n.case_id);
    else if (n.institution_id) openInstitution(n.institution_id);
  }
  function attention(flag: string) {
    setFilters({ ...defaultFilters, flag });
    setAdvanced(false);
    navigate('cases', { flag });
  }
  function changeFilters(f: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...f, page: 'page' in f ? f.page || 1 : 1 }));
  }
  function changed() {
    void workspace.refresh();
    void coord.refresh();
    void bell.refresh();
    void inbox.refresh();
    void cases.refresh();
  }
  useEffect(() => {
    setFilters(fromParams(params));
  }, [params]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input,textarea,select,[contenteditable]');
      if (((e.metaKey || e.ctrlKey) && e.key === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault();
        setPalette((open) => !open || e.key === '/');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  async function logout() {
    try {
      await post('/api/auth/logout', {});
      window.location.assign('/login');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const institution = data.institutions.find((i) => i.id === params.get('institution'));
  const crumbs: [string, (() => void) | null][] = [['AICTE', () => navigate('overview')]];
  if (view === 'case') crumbs.push(['Cases', () => navigate('cases')], [caseCrumb || '…', null]);
  else if (view === 'institutions' && institution)
    crumbs.push(['Institutions', () => navigate('institutions')], [institution.name, null]);
  else {
    crumbs.push([names[view], view === 'cases' ? () => navigate('cases') : null]);
    if (view === 'cases') {
      const refinements = [
        flagNames[filters.flag],
        statusNames[filters.status],
        filters.bureau,
        filters.q && `“${filters.q}”`,
      ].filter(Boolean) as string[];
      if (refinements.length) crumbs.push([refinements.join(' · '), null]);
    }
  }
  const pageTitle = crumbs.at(-1)![0];
  useEffect(() => {
    document.title = `${pageTitle} · Casebridge`;
  }, [pageTitle]);
  return (
    <div className="app-shell">
      <Toaster position="bottom-right" richColors closeButton />
      {mobileNav ? (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <Sidebar
        data={data}
        view={view}
        flag={view === 'cases' ? filters.flag : ''}
        counts={{
          alerts: bell.data?.unread ?? 0,
          cases: data.stats.total,
          coordination: coord.data?.proposals.filter((p) => p.status === 'pending').length ?? 0,
        }}
        demo={demo}
        open={mobileNav}
        onNavigate={navigate}
        onSearch={() => setPalette(true)}
        onLogout={logout}
      />
      <div className="main-shell">
        <header className="topbar">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={18} />
            </button>
            <ol>
              {crumbs.map(([label, go], i) => (
                <li key={`${label}-${i}`}>
                  {i ? <ChevronRight size={12} className="crumb-sep" /> : null}
                  {go && i < crumbs.length - 1 ? (
                    <button className="crumb" onClick={go}>
                      {label}
                    </button>
                  ) : (
                    <span className="crumb current" aria-current="page">
                      {label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <div className="topbar-right">
            <button className="global-search" onClick={() => setPalette(true)}>
              <Search size={14} />
              <span>Search cases, institutions…</span>
              <kbd>
                <Command size={10} />K
              </kbd>
            </button>
            <NotificationBell
              feed={bell.data}
              error={bell.error}
              onRefresh={() => {
                void bell.refresh();
                void inbox.refresh();
              }}
              onOpenItem={openNotification}
              onViewAll={() => navigate('alerts')}
            />
          </div>
        </header>
        <main className="main-content" id="main-content">
          {workspace.error ? (
            <ErrorNotice retry={workspace.refresh}>{workspace.error}</ErrorNotice>
          ) : null}
          {view === 'overview' ? (
            <>
              <div className="page-heading compact">
                <div>
                  <div className="greeting">
                    {greeting(data.as_of)}, {data.profile.name.split(' ')[0]}
                  </div>
                  <h1>{operational ? `${home} overview` : 'AICTE-wide overview'}</h1>
                  <p className="overview-meta">
                    <span className="live-dot" />
                    Refreshed {relative(data.as_of)} · {longDate(data.as_of)} ·{' '}
                    {roleLabel(data.memberships[0])}
                  </p>
                </div>
                {canCreate ? (
                  <Button variant="primary" onClick={() => setNewCase(true)}>
                    <Plus size={16} />
                    Receive complaint
                  </Button>
                ) : null}
              </div>
              <div className="kpi-strip">
                {(
                  [
                    ['Received', data.stats.total, '', ''],
                    ['Pending', data.stats.pending, 'status', 'pending'],
                    ['Under process', data.stats.under_process, 'status', 'under_process'],
                    ['Transferred', data.stats.transferred, 'status', 'transferred'],
                    ['Escalated', data.stats.escalated, 'status', 'escalated'],
                    ['Disposed', data.stats.disposed, 'status', 'disposed'],
                    ['Beyond timeline', data.stats.overdue, 'flag', 'overdue'],
                  ] as const
                ).map(([label, value, key, filter]) => (
                  <button
                    key={label}
                    className={`kpi ${filter === 'overdue' ? 'red' : filter}`}
                    onClick={() => navigate('cases', key ? { [key]: filter } : {})}
                  >
                    <span>{label}</span>
                    <strong>{value ?? 0}</strong>
                  </button>
                ))}
              </div>
              <div className="overview-grid">
                <OverlapFeed
                  data={overlaps.data}
                  coordination={coord.data}
                  loading={overlaps.loading}
                  limit={6}
                  onSelect={setSelected}
                  onInstitution={openInstitution}
                  onViewAll={() => navigate('coordination')}
                />
                <aside className="overview-right">
                  {operational ? (
                    <section className="panel queue-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            {home} · beyond timeline{' '}
                            <Badge tone="red">{queue.data?.total ?? '—'}</Badge>
                          </h2>
                          <p>Your bureau’s cases past the recorded disposal date.</p>
                        </div>
                      </div>
                      <CaseTable
                        data={queue.data}
                        loading={queue.loading}
                        error={queue.error}
                        retry={queue.refresh}
                        onSelect={setSelected}
                        compact
                      />
                      <button
                        className="text-btn panel-foot"
                        onClick={() => navigate('cases', { flag: 'overdue', bureau: home })}
                      >
                        Open {home} queue
                        <ArrowRight size={13} />
                      </button>
                    </section>
                  ) : null}
                  <section className="panel workload-panel">
                    <div className="panel-heading">
                      <h2>Bureau workload</h2>
                      <span className="muted">Active · overdue</span>
                    </div>
                    {data.workload.map((w) => (
                      <button
                        className="workload-row"
                        key={w.bureau}
                        onClick={() => navigate('cases', { bureau: w.bureau })}
                      >
                        <div>
                          <span className={`bureau-icon ${bureauTone[w.bureau]}`}>
                            {bureauShort(w.bureau)}
                          </span>
                          <strong>{w.bureau}</strong>
                          <span>{w.active}</span>
                        </div>
                        <div className="workload-track">
                          <span
                            style={{
                              width: `${Math.round((w.active / Math.max(1, ...data.workload.map((v) => v.active))) * 100)}%`,
                            }}
                            className={bureauTone[w.bureau]}
                          />
                          <span
                            className="overdue-part"
                            style={{
                              width: `${Math.round((w.overdue / Math.max(1, ...data.workload.map((v) => v.active))) * 100)}%`,
                            }}
                          />
                        </div>
                        <small>
                          {w.overdue} beyond timeline · {w.disposed} disposed
                        </small>
                      </button>
                    ))}
                  </section>
                  {data.stats.review ? (
                    <button className="panel review-card" onClick={() => attention('review')}>
                      <ShieldCheck size={18} />
                      <span>
                        <strong>{data.stats.review} complaints need identity review</strong>
                        <small>Institution could not be confirmed. Still counted.</small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  ) : null}
                </aside>
              </div>
              <section className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Latest activity</h2>
                    <p>A shared trail of actions. Private remarks stay with the handling bureau.</p>
                  </div>
                </div>
                <div className="activity-list">
                  {data.recent_events.slice(0, 6).map((e) => (
                    <button
                      className="activity-row"
                      key={e.id}
                      onClick={() => setSelected(e.case_id)}
                    >
                      <span className={`bureau-icon ${bureauTone[e.bureau]}`}>
                        {bureauShort(e.bureau)}
                      </span>
                      <div>
                        <strong>{e.action}</strong>
                        <span>
                          {e.actor_name || 'System'} · <span className="mono">{e.case_no}</span>
                        </span>
                      </div>
                      <time>{relative(e.occurred_at)}</time>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : null}
          {view === 'cases' ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    Cases <span className="heading-count">{cases.data?.total ?? '—'}</span>
                  </h1>
                  <p>Every case has an owner, a timeline, and a traceable next action.</p>
                </div>
                {canCreate ? (
                  <Button variant="primary" onClick={() => setNewCase(true)}>
                    <Plus size={16} />
                    Receive complaint
                  </Button>
                ) : null}
              </div>
              <div className="view-tabs">
                {[
                  ['', 'All cases'],
                  ['overlap', 'Cross-bureau'],
                  ['overdue', 'Beyond timeline'],
                  ['review', 'Identity review'],
                ].map(([flag, label]) => (
                  <button
                    key={flag}
                    className={filters.flag === flag ? 'active' : ''}
                    onClick={() => changeFilters({ flag })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <section className="panel cases-panel">
                <FiltersBar
                  filters={filters}
                  onChange={changeFilters}
                  advanced={advanced}
                  setAdvanced={setAdvanced}
                />
                <CaseTable
                  data={cases.data}
                  loading={cases.loading}
                  error={cases.error}
                  retry={cases.refresh}
                  onSelect={setSelected}
                />
                <Pagination data={cases.data} onPage={(page) => changeFilters({ page })} />
              </section>
            </>
          ) : null}
          {view === 'institutions' ? (
            <InstitutionsView
              data={data}
              id={params.get('institution')}
              onNavigate={(id) => navigate('institutions', id ? { institution: id } : {})}
              onSelect={setSelected}
            />
          ) : null}
          {view === 'coordination' ? (
            <CoordinationView
              data={coord.data}
              error={coord.error}
              workspace={data}
              onRefresh={changed}
              onSelect={setSelected}
              overlaps={overlaps}
              onInstitution={openInstitution}
            />
          ) : null}
          {view === 'reports' ? <ReportsView filters={filters} onFilters={changeFilters} /> : null}
          {view === 'intake' ? (
            <IntakeView canCreate={canCreate} onNew={() => setNewCase(true)} onChange={changed} />
          ) : null}
          {view === 'alerts' ? (
            <InboxView
              feed={inbox.data}
              error={inbox.error}
              kind={inboxKind}
              onKind={setInboxKind}
              onRefresh={() => {
                void bell.refresh();
                void inbox.refresh();
              }}
              onOpenItem={async (n) => {
                if (!n.read_at)
                  await post('/api/notifications/read', { ids: [n.id] }).catch(() => {});
                void bell.refresh();
                openNotification(n);
              }}
            />
          ) : null}
          {view === 'case' && caseId ? (
            <CasePage
              key={caseId}
              id={caseId}
              workspace={data}
              coordination={coord.data}
              onSelect={setSelected}
              onInstitution={openInstitution}
              onChange={changed}
              onLoaded={setCaseCrumb}
            />
          ) : null}
          <footer className="app-footer">
            <span>
              <ShieldCheck size={12} />
              {demo ? 'Synthetic records · prototype' : 'Bureau-scoped access'}
            </span>
            <span>
              App refreshes every 5s · Source snapshot {date(data.source_updated_at, true)}
            </span>
          </footer>
        </main>
      </div>
      <CommandPalette
        open={palette}
        onOpenChange={setPalette}
        data={data}
        views={navigation}
        onNavigate={navigate}
        onCase={setSelected}
        onInstitution={openInstitution}
      />
      {canCreate && newCase ? (
        <NewCase
          data={data}
          open
          onClose={() => setNewCase(false)}
          onCreated={(id) => {
            changed();
            setSelected(id);
          }}
        />
      ) : null}
    </div>
  );
}
