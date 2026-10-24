'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowRight,
  Building2,
  ChevronRight,
  Clock3,
  FileText,
  GitBranch,
  History,
  LockKeyhole,
  MessageSquarePlus,
  Paperclip,
  Printer,
  ShieldCheck,
} from './icons';
import { bureauShort, bureauTone } from './overlap-feed';
import type {
  CaseDetail as Detail,
  WorkspaceData,
  CoordinationData,
  WorkRequest,
} from '@/contracts/workspace';
import { bureaus } from '@/contracts/cases';
import { date, post, relative, useResource } from './api';
import { Badge, Button, Empty, ErrorNotice, Field, Modal, OverlapBadge, Status } from './ui';
import { EvidencePanel } from './evidence-panel';
import { AiComparison } from './ai-comparison';
type Props = {
  id: string;
  workspace: WorkspaceData;
  coordination?: CoordinationData;
  onSelect: (id: string) => void;
  onInstitution: (id: string) => void;
  onChange: () => void;
  onLoaded: (caseNo: string) => void;
};
export function span(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}
// Full-page case record, laid out like a helpdesk ticket: activity in the
// centre, ownership and deadline facts at the side.
export function CasePage({
  id,
  workspace,
  coordination,
  onSelect,
  onInstitution,
  onChange,
  onLoaded,
}: Props) {
  const { data: c, error, refresh } = useResource<Detail>(`/api/cases/${id}`, undefined, 5000);
  const [tab, setTab] = useState('activity'),
    [action, setAction] = useState<{ name: string; version: number } | null>(null);
  const [requestOpen, setRequestOpen] = useState(false),
    [linkBusy, setLinkBusy] = useState(false);
  useEffect(() => {
    if (c) onLoaded(c.case_no);
  }, [c, onLoaded]);
  const mine =
    c &&
    workspace.memberships.some(
      (m) => (m.role === 'officer' || m.role === 'supervisor') && m.bureau === c.bureau,
    );
  const supervisor =
    c && workspace.memberships.some((m) => m.role === 'supervisor' && m.bureau === c.bureau);
  const identityReviewer = workspace.memberships.some(
    (m) => m.role === 'admin' || m.role === 'supervisor',
  );
  function changed() {
    void refresh();
    onChange();
  }
  async function reviewLink(target: string, relationship: string) {
    if (!c) return;
    setLinkBusy(true);
    try {
      await post('/api/coordination', {
        action: 'link',
        case_id: c.id,
        target_case_id: target,
        relationship,
        expected_version: c.version,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success('Relationship recorded. Institution awareness is unchanged.');
      changed();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLinkBusy(false);
    }
  }
  if (error)
    return (
      <div className="case-page">
        <ErrorNotice retry={refresh}>{error}</ErrorNotice>
      </div>
    );
  if (!c)
    return (
      <div className="case-page" aria-busy>
        <div className="skeleton-block tall" />
        <div className="case-grid">
          <div className="skeleton-block huge" />
          <div className="skeleton-block huge" />
        </div>
      </div>
    );
  const events = [...c.events].sort(
    (a, b) =>
      +new Date(a.occurred_at) - +new Date(b.occurred_at) || a.case_version - b.case_version,
  );
  const requests = coordination?.requests.filter((r) => r.case_id === c.id) ?? [];
  const now = Date.now();
  const openFor =
    (c.status === 'disposed' ? +new Date(c.last_action_at) : now) - +new Date(c.received_at);
  const toDeadline = +new Date(c.expected_disposal_at) - now;
  const activeElsewhere = c.institution_cases.filter((x) => x.status !== 'disposed');
  return (
    <div className="case-page">
      <div className="print-only print-header">
        Casebridge · Case record · printed {date(new Date().toISOString(), true)} · Synthetic
        demonstration data
      </div>
      <header className="case-head">
        <div className="case-head-main">
          <div className="case-head-tags">
            <span className="mono case-no">{c.case_no}</span>
            <Status value={c.status} />
            <span className={`bureau-icon ${bureauTone[c.bureau]}`}>{bureauShort(c.bureau)}</span>
            {c.has_overlap ? <OverlapBadge /> : null}
            {c.identity_state === 'review' ? <Badge tone="amber">Identity review</Badge> : null}
          </div>
          <h1>{c.title}</h1>
          <p className="case-head-meta">
            {c.institution_id ? (
              <button className="text-link" onClick={() => onInstitution(c.institution_id!)}>
                {c.institution_name}
              </button>
            ) : (
              <span>{c.source_institution}</span>
            )}
            <span>·</span>
            <span>{c.category}</span>
            <span>·</span>
            <span>Received {date(c.received_at)}</span>
          </p>
        </div>
        <div className="case-head-actions no-print">
          <Button onClick={() => window.print()} title="Print or save as PDF">
            <Printer size={15} />
            Print
          </Button>
          {c.identity_state === 'review' && identityReviewer ? (
            <Button onClick={() => setAction({ name: 'resolve_identity', version: c.version })}>
              <ShieldCheck size={15} />
              Review institution
            </Button>
          ) : null}
          {mine ? (
            <Button
              variant="primary"
              onClick={() =>
                setAction({
                  name: c.status === 'disposed' ? 'add_note' : supervisor ? 'transfer' : 'start',
                  version: c.version,
                })
              }
            >
              <MessageSquarePlus size={15} />
              Record action
            </Button>
          ) : null}
        </div>
      </header>
      <TimelineStrip
        events={events}
        received={c.received_at}
        deadline={c.expected_disposal_at}
        open={c.status !== 'disposed'}
      />
      <div className="case-grid">
        <section className="panel case-main">
          <div className="detail-tabs profile-tabs no-print" role="tablist">
            {(
              [
                ['activity', 'Activity', History, events.length],
                ['coordination', 'Coordination', GitBranch, requests.length || null],
                ['files', 'Files', Paperclip, null],
              ] as const
            ).map(([key, label, Icon, count]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? 'active' : ''}
                onClick={() => setTab(key)}
              >
                <Icon size={15} />
                {label}
                {count ? <Badge>{count}</Badge> : null}
              </button>
            ))}
          </div>
          {tab === 'activity' ? (
            <div className="case-activity">
              {c.overdue ? (
                <div className="inline-warning">
                  <Clock3 size={15} />
                  Beyond the recorded disposal date by {span(-toDeadline)}. Transfers do not reset
                  the clock.
                </div>
              ) : null}
              <div className="next-callout">
                <span className="eyebrow">Next action required</span>
                <p>{c.next_action}</p>
              </div>
              <article className="complaint-card">
                <div className="complaint-card-head">
                  <LockKeyhole size={14} />
                  <strong>Complaint as received</strong>
                  <span className="muted">{c.source_institution}</span>
                </div>
                {c.can_read_content ? (
                  <p className="complaint-text">{c.description}</p>
                ) : (
                  <p className="restricted-text">
                    Private to {c.bureau}. Shared registry access does not grant access to the
                    complaint text.
                  </p>
                )}
              </article>
              <ol className="feed">
                {events.map((e) => (
                  <li key={e.id} className={`feed-item ${bureauTone[e.bureau]}`}>
                    <span className="feed-avatar" aria-hidden>
                      {(e.actor_name ?? 'S')
                        .split(' ')
                        .map((v) => v[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <div className="feed-body">
                      <div className="feed-line">
                        <strong>{e.actor_name || 'System'}</strong>
                        <span className="muted">{e.action.toLowerCase()}</span>
                        <span className={`bureau-icon ${bureauTone[e.bureau]}`}>
                          {bureauShort(e.bureau)}
                        </span>
                        {e.from_status && e.from_status !== e.to_status ? (
                          <span className="feed-transition">
                            <Status value={e.from_status} />
                            <ArrowRight size={12} />
                            <Status value={e.to_status || ''} />
                          </span>
                        ) : null}
                        <time title={date(e.occurred_at, true)}>{relative(e.occurred_at)}</time>
                      </div>
                      {e.remarks ? <p className="feed-remark">{e.remarks}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
              {mine ? <NoteComposer item={c} onSaved={changed} /> : null}
            </div>
          ) : null}
          {tab === 'coordination' ? (
            <div className="case-activity">
              {mine && c.status !== 'disposed' && c.institution_id ? (
                <div className="coordination-cta">
                  <div>
                    <strong>Need records from the institution?</strong>
                    <p className="muted">
                      Check recorded requests in other bureaus before asking again.
                    </p>
                  </div>
                  <Button onClick={() => setRequestOpen(true)}>
                    <FileText size={14} />
                    Check a document request
                  </Button>
                </div>
              ) : null}
              <h3 className="sub-title">Recorded work for this case</h3>
              {requests.length ? (
                requests.map((r) => (
                  <div className="request-mini" key={r.id}>
                    <div>
                      <strong>{r.document}</strong>
                      <small>
                        {r.purpose} · {r.period}
                      </small>
                    </div>
                    <Status value={r.status} />
                    {r.status === 'open' && mine ? (
                      <button
                        className="text-btn"
                        onClick={async () => {
                          try {
                            await post('/api/coordination', {
                              action: 'fulfill',
                              case_id: c.id,
                              id: r.id,
                              expected_version: c.version,
                              idempotencyKey: crypto.randomUUID(),
                            });
                            toast.success('Request marked fulfilled');
                            changed();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        Mark fulfilled
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="muted">No structured document requests recorded for this case.</p>
              )}
              <h3 className="sub-title">
                Other cases at this institution{' '}
                <span className="muted">{c.institution_cases.length}</span>
              </h3>
              {c.institution_cases.length ? (
                c.institution_cases.map((other) => {
                  const link = coordination?.links.find(
                    (l) =>
                      (l.source_case_id === c.id && l.target_case_id === other.id) ||
                      (l.target_case_id === c.id && l.source_case_id === other.id),
                  );
                  return (
                    <div className="related-case" key={other.id}>
                      <div className="case-line">
                        <span className="mono">{other.case_no}</span>
                        <span className={`bureau-icon ${bureauTone[other.bureau]}`}>
                          {bureauShort(other.bureau)}
                        </span>
                        <Status value={other.status} />
                      </div>
                      <button className="row-link" onClick={() => onSelect(other.id)}>
                        {other.title}
                      </button>
                      <div className="relationship-actions">
                        {link ? (
                          <Badge tone={link.relationship === 'related' ? 'blue' : 'muted'}>
                            Reviewed: {link.relationship}
                          </Badge>
                        ) : (
                          <span className="muted">Issue relationship not reviewed</span>
                        )}
                        {mine ? (
                          <>
                            <button
                              disabled={linkBusy}
                              className="text-btn"
                              onClick={() => reviewLink(other.id, 'related')}
                            >
                              Related issue
                            </button>
                            <button
                              disabled={linkBusy}
                              className="text-btn muted"
                              onClick={() => reviewLink(other.id, 'unrelated')}
                            >
                              Different issue
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty title="No other recorded cases">
                  Institution attention updates when more cases are received.
                </Empty>
              )}
              {c.can_read_content ? (
                <AiComparison current={c} candidates={c.institution_cases} onChange={changed} />
              ) : null}
            </div>
          ) : null}
          {tab === 'files' ? (
            <div className="case-activity">
              <EvidencePanel item={c} onChange={changed} />
            </div>
          ) : null}
        </section>
        <aside className="case-side">
          <section className="panel side-card">
            <h3>Details</h3>
            <dl className="side-list">
              <dt>Bureau</dt>
              <dd>{c.bureau}</dd>
              <dt>Officer</dt>
              <dd>{c.officer_name || 'Unassigned'}</dd>
              <dt>Received</dt>
              <dd>{date(c.received_at, true)}</dd>
              <dt>Expected disposal</dt>
              <dd className={c.overdue ? 'text-danger' : ''}>
                {date(c.expected_disposal_at, true)}
              </dd>
              <dt>Original deadline</dt>
              <dd>{date(c.original_deadline, true)}</dd>
              <dt>Last action</dt>
              <dd>
                {c.last_action}
                <small className="muted block">{date(c.last_action_at, true)}</small>
              </dd>
            </dl>
          </section>
          <section className="summary-grid">
            <div className="summary-card">
              <span>Open for</span>
              <strong>{span(openFor)}</strong>
            </div>
            <div className={`summary-card ${c.overdue ? 'red' : ''}`}>
              <span>
                {c.status === 'disposed' ? 'Disposed' : toDeadline < 0 ? 'Overdue by' : 'Due in'}
              </span>
              <strong>{c.status === 'disposed' ? '✓' : span(Math.abs(toDeadline))}</strong>
            </div>
            <div className="summary-card">
              <span>Actions</span>
              <strong>{events.length}</strong>
            </div>
            <div className="summary-card">
              <span>Transfers</span>
              <strong>{events.filter((e) => e.action === 'Transferred').length}</strong>
            </div>
          </section>
          <section className="panel side-card">
            <h3>Institution</h3>
            {c.institution_id ? (
              <>
                <button
                  className="side-institution"
                  onClick={() => onInstitution(c.institution_id!)}
                >
                  <span className="institution-mark">
                    <Building2 size={15} />
                  </span>
                  <span>
                    <strong>{c.institution_name}</strong>
                    <small className="mono">{c.permanent_id}</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
                <p className="muted small-text side-note">
                  {activeElsewhere.length
                    ? `${activeElsewhere.length} other active case${activeElsewhere.length === 1 ? '' : 's'} at this institution.`
                    : 'No other active cases at this institution.'}
                </p>
                {activeElsewhere.slice(0, 4).map((x) => (
                  <button key={x.id} className="side-case" onClick={() => onSelect(x.id)}>
                    <span className={`bureau-icon ${bureauTone[x.bureau]}`}>
                      {bureauShort(x.bureau)}
                    </span>
                    <span className="side-case-title">{x.title}</span>
                    <Status value={x.status} />
                  </button>
                ))}
              </>
            ) : (
              <p className="muted small-text">
                Not yet linked to a directory entry. As received: “{c.source_institution}”.
              </p>
            )}
          </section>
          <p className="record-footer">
            Version {c.version} · Source snapshot {date(c.source_updated_at, true)}
          </p>
        </aside>
      </div>
      {action ? (
        <ActionForm
          item={c}
          workspace={workspace}
          initial={action}
          supervisor={!!supervisor}
          onClose={() => setAction(null)}
          onSaved={() => {
            setAction(null);
            changed();
          }}
        />
      ) : null}
      {requestOpen ? (
        <RequestForm
          item={c}
          onClose={() => setRequestOpen(false)}
          onSaved={() => {
            setRequestOpen(false);
            changed();
          }}
        />
      ) : null}
    </div>
  );
}
// Received → each recorded action → disposal (or now). Segment widths use a
// square-root scale so a long wait stands out without hiding short steps.
function TimelineStrip({
  events,
  received,
  deadline,
  open,
}: {
  events: Detail['events'];
  received: string;
  deadline: string;
  open: boolean;
}) {
  const points = [
    { t: +new Date(received), label: 'Received', bureau: events[0]?.bureau ?? '' },
    ...events
      .slice(1)
      .map((e) => ({ t: +new Date(e.occurred_at), label: e.action, bureau: e.bureau })),
    ...(open ? [{ t: Date.now(), label: 'Now', bureau: events.at(-1)?.bureau ?? '' }] : []),
  ];
  const segments = points.slice(1).map((p, i) => ({
    ms: Math.max(0, p.t - points[i].t),
    bureau: p.bureau,
    late: p.t > +new Date(deadline),
    live: open && i === points.length - 2,
  }));
  const longest = segments.reduce((m, s, i) => (s.ms > segments[m].ms ? i : m), 0);
  const end = points.at(-1)!;
  return (
    <section className="panel strip" aria-label="Case timeline">
      <div className="strip-track">
        {segments.map((s, i) => (
          <div
            key={i}
            className={`strip-seg ${bureauTone[s.bureau] ?? ''} ${i === longest && segments.length > 1 ? 'longest' : ''} ${s.late ? 'late' : ''} ${s.live ? 'live' : ''}`}
            style={{ flexGrow: Math.max(1, Math.sqrt(s.ms / 3600000)) }}
            title={`${points[i + 1].label} · ${span(s.ms)}`}
          >
            <span className="strip-dur">{span(s.ms)}</span>
            <i />
          </div>
        ))}
      </div>
      <div className="strip-labels">
        <span>
          <strong>Received</strong>
          {date(received, true)}
        </span>
        <span className="strip-deadline">
          <strong>Due</strong>
          {date(deadline)}
        </span>
        <span>
          <strong>{end.label === 'Now' ? 'Now' : end.label}</strong>
          {date(new Date(end.t).toISOString(), true)}
        </span>
      </div>
      <div className="strip-legend">
        <span>
          <i className="blue" />
          PGRC
        </span>
        <span>
          <i className="violet" />
          RB
        </span>
        <span>
          <i className="green" />
          Regional Office
        </span>
        <span>
          <i className="red" />
          Longest wait
        </span>
        <span>
          <i className="hatch" />
          After deadline
        </span>
      </div>
    </section>
  );
}
function NoteComposer({ item, onSaved }: { item: Detail; onSaved: () => void }) {
  const [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(() => crypto.randomUUID());
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      await post(`/api/cases/${item.id}/commands`, {
        action: 'add_note',
        reason: text.trim(),
        expectedVersion: item.version,
        idempotencyKey: key,
      });
      setText('');
      setKey(crypto.randomUUID());
      toast.success('Note added');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="composer no-print" onSubmit={submit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
        }}
        placeholder="Add a private note for your bureau…"
        rows={2}
        maxLength={2000}
        aria-label="Add a private note"
      />
      <div className="composer-foot">
        <span className="muted">Visible to {item.bureau} only · ⌘↵ to send</span>
        <Button variant="primary" type="submit" busy={busy} disabled={text.trim().length < 3}>
          Add note
        </Button>
      </div>
    </form>
  );
}
export function ActionForm({
  item,
  workspace,
  initial,
  supervisor,
  onClose,
  onSaved,
}: {
  item: Detail;
  workspace: WorkspaceData;
  initial: { name: string; version: number };
  supervisor: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [action, setAction] = useState(initial.name),
    [bureau, setBureau] = useState(item.bureau),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const options =
    initial.name === 'resolve_identity'
      ? [['resolve_identity', 'Resolve institution identity']]
      : [
          ['add_note', 'Add a private note'],
          ...(item.status !== 'disposed'
            ? [
                ['start', 'Start / resume processing'],
                ...(supervisor
                  ? [
                      ['assign', 'Assign an officer'],
                      ['transfer', 'Transfer to another bureau'],
                      ['escalate', 'Escalate case'],
                      ['amend_deadline', 'Amend deadline'],
                      ['dispose', 'Dispose case'],
                    ]
                  : []),
              ]
            : []),
        ];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await post(`/api/cases/${item.id}/commands`, {
        action,
        reason: fields.reason,
        next_action: fields.next_action || undefined,
        officer_id: fields.officer_id || undefined,
        institution_id: fields.institution_id || undefined,
        bureau: action === 'transfer' ? bureau : undefined,
        deadline: fields.deadline
          ? new Date(`${fields.deadline}T23:59:59+05:30`).toISOString()
          : undefined,
        expectedVersion: initial.version,
        idempotencyKey: key,
      });
      toast.success('Action recorded');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Record an action"
      description={`${item.case_no} · Version ${initial.version}`}
    >
      <form onSubmit={submit} className="form-body">
        <Field label="Action">
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {options.map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {action === 'transfer' ? (
          <Field label="Receiving bureau">
            <select value={bureau} onChange={(e) => setBureau(e.target.value)} required>
              <option value="">Select bureau</option>
              {bureaus
                .filter((b) => b !== item.bureau)
                .map((b) => (
                  <option key={b}>{b}</option>
                ))}
            </select>
          </Field>
        ) : null}
        {action === 'assign' || action === 'transfer' ? (
          <Field label="Assigned officer">
            <select name="officer_id" key={bureau} required defaultValue="">
              <option value="">Select an active officer</option>
              {workspace.officers
                .filter((o) => o.bureau === (action === 'assign' ? item.bureau : bureau))
                .map((o) => (
                  <option key={`${o.id}:${o.role}`} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </Field>
        ) : null}
        {action === 'resolve_identity' ? (
          <Field label="Reviewed institution">
            <select name="institution_id" required defaultValue="">
              <option value="">Choose after checking the source</option>
              {workspace.institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {i.city} · {i.permanent_id}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {action === 'amend_deadline' ? (
          <Field label="New expected disposal date">
            <input name="deadline" type="date" required />
          </Field>
        ) : null}
        {action === 'dispose' ? (
          <div className="inline-warning">
            Disposal is terminal in this prototype. Record the decision and reason carefully.
          </div>
        ) : null}
        <Field label="Reason / private remarks">
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={2000}
            rows={4}
            placeholder="Record what was done and why…"
          />
        </Field>
        {action !== 'dispose' && action !== 'resolve_identity' ? (
          <Field label="Next action (optional)">
            <input name="next_action" minLength={3} maxLength={500} />
          </Field>
        ) : null}
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        <div className="inline-info">
          Original receipt date and original deadline are preserved.
        </div>
        <div className="form-footer">
          <Button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={action === 'dispose' ? 'danger' : 'primary'} type="submit" busy={busy}>
            Save action
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function RequestForm({
  item,
  onClose,
  onSaved,
}: {
  item: Detail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ document: '', purpose: '', period: '' }),
    [preview, setPreview] = useState<{
      fingerprint: string;
      case_version: number;
      matches: WorkRequest[];
      limit: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [decision, setDecision] = useState(''),
    [target, setTarget] = useState('');
  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const p = await post<NonNullable<typeof preview>>('/api/coordination/preview', {
        case_id: item.id,
        ...form,
      });
      setPreview(p);
      setDecision(p.matches.length ? 'coordinate' : 'separate');
      setTarget(p.matches[0]?.id || '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!preview) return;
    setBusy(true);
    setError('');
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await post('/api/coordination', {
        action: 'request',
        case_id: item.id,
        ...form,
        fingerprint: preview.fingerprint,
        expected_version: preview.case_version,
        decision,
        target_request_id: decision === 'coordinate' ? target : undefined,
        reason: fields.reason || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success(
        decision === 'coordinate'
          ? 'Proposal sent to the receiving bureau'
          : 'Document request recorded',
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Check before requesting"
      description="Find comparable recorded work before starting another request."
    >
      <div className="form-body">
        {!preview ? (
          <form onSubmit={check}>
            <div className="inline-info">
              Use document types and purpose labels only. Do not enter private complaint details
              here.
            </div>
            {[
              ['document', 'Document type', 'e.g. Fee refund register'],
              ['purpose', 'Purpose', 'e.g. Verify refund transactions'],
              ['period', 'Period / scope', 'e.g. Academic year 2026–27'],
            ].map(([key, label, placeholder]) => (
              <Field label={label} key={key}>
                <input
                  required
                  minLength={3}
                  maxLength={key === 'purpose' ? 200 : 100}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                />
              </Field>
            ))}
            <div className="form-footer">
              <Button type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" busy={busy} type="submit">
                Check recorded requests
                <ArrowRight size={14} />
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={save}>
            <div className={preview.matches.length ? 'match-result' : 'match-result clear'}>
              <GitBranch size={20} />
              <div>
                <strong>
                  {preview.matches.length
                    ? 'Potential repeated work found'
                    : 'No exact recorded match found'}
                </strong>
                <p>
                  {form.document} · {form.purpose} · {form.period}
                </p>
              </div>
            </div>
            {preview.matches.map((r) => (
              <div className="match-card" key={r.id}>
                <strong>
                  {r.bureau} · {r.case_no}
                </strong>
                <p>{r.document}</p>
                <small>
                  {r.purpose} · {r.period}
                </small>
              </div>
            ))}
            <p className="muted small-text">{preview.limit}</p>
            {preview.matches.length ? (
              <>
                <Field label="How should we proceed?">
                  <select value={decision} onChange={(e) => setDecision(e.target.value)}>
                    <option value="coordinate">Propose coordination</option>
                    <option value="separate">Proceed separately with a reason</option>
                  </select>
                </Field>
                {decision === 'coordinate' ? (
                  <Field label="Coordinate with">
                    <select value={target} onChange={(e) => setTarget(e.target.value)}>
                      {preview.matches.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.bureau} · {r.case_no}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
              </>
            ) : null}
            <Field
              label={
                decision === 'separate' && preview.matches.length
                  ? 'Why is a separate request needed?'
                  : 'Coordination note / reason (optional)'
              }
              hint="Visible as coordination metadata. Use non-sensitive wording."
            >
              <textarea
                name="reason"
                rows={3}
                maxLength={2000}
                required={decision === 'separate' && preview.matches.length > 0}
                minLength={3}
              />
            </Field>
            <div className="inline-info">
              {decision === 'coordinate'
                ? 'The receiving bureau must accept. Case ownership, deadlines and file permissions stay unchanged.'
                : 'This records the work only. No email or official correspondence is sent.'}
            </div>
            <div className="form-footer">
              <Button type="button" onClick={() => setPreview(null)} disabled={busy}>
                Back
              </Button>
              <Button variant="primary" busy={busy} type="submit">
                {decision === 'coordinate' ? 'Propose coordination' : 'Record request'}
              </Button>
            </div>
          </form>
        )}
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
      </div>
    </Modal>
  );
}
