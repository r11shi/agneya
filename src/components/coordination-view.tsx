'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Check, X } from './icons';
import type { CaseList, CoordinationData, Proposal, WorkspaceData } from '@/contracts/workspace';
import { OverlapFeed } from './overlap-feed';
import { Badge, Button, Empty, ErrorNotice, Field, Modal, Status } from './ui';
import { date, post } from './api';
export function CoordinationView({
  data,
  error,
  workspace,
  onRefresh,
  onSelect,
  overlaps,
  onInstitution,
}: {
  overlaps: { data?: CaseList; loading: boolean };
  onInstitution: (id: string) => void;
  data?: CoordinationData;
  error: string;
  workspace: WorkspaceData;
  onRefresh: () => void;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState('pending'),
    [response, setResponse] = useState<{ item: Proposal; decision: string } | null>(null),
    [busy, setBusy] = useState(false),
    [responseError, setResponseError] = useState('');
  const proposals = data?.proposals.filter((p) => filter === 'all' || p.status === filter) || [];
  async function respond(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!response) return;
    setBusy(true);
    setResponseError('');
    const form = new FormData(e.currentTarget);
    try {
      await post('/api/coordination', {
        action: 'respond',
        id: response.item.id,
        decision: response.decision,
        reason: form.get('reason'),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success(`Coordination ${response.decision}`);
      setResponse(null);
      onRefresh();
    } catch (e) {
      setResponseError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading compact">
        <div>
          <h1>Coordination</h1>
          <p>
            Institutions handled by more than one bureau, and proposals to share recorded work.
            Cases are never merged; each keeps its own ID, owner and deadline.
          </p>
        </div>
      </div>
      <div className="view-tabs">
        {[
          ['pending', 'Awaiting response'],
          ['accepted', 'Accepted'],
          ['declined', 'Declined'],
          ['all', 'All proposals'],
        ].map(([v, l]) => (
          <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
            {l}
            {v === 'pending' ? (
              <Badge>{data?.proposals.filter((p) => p.status === 'pending').length || 0}</Badge>
            ) : null}
          </button>
        ))}
      </div>
      {error ? <ErrorNotice retry={onRefresh}>{error}</ErrorNotice> : null}
      <div className="proposal-list">
        {proposals.length ? (
          proposals.map((p) => {
            const mayRespond =
              p.status === 'pending' &&
              workspace.memberships.some(
                (m) => m.role === 'supervisor' && m.bureau === p.target_bureau,
              );
            return (
              <article className="panel proposal" key={p.id}>
                <div className="proposal-header">
                  <span className="eyebrow">{p.institution_name}</span>
                  <Status value={p.status} />
                </div>
                <h2>{p.document}</h2>
                <p>
                  {p.purpose} <span className="muted">· {p.period}</span>
                </p>
                <div className="proposal-route">
                  <button onClick={() => onSelect(p.source_case_id)}>
                    <span className="bureau-icon blue">{p.source_bureau}</span>
                    <span>{p.source_case_no}</span>
                  </button>
                  <ArrowRight size={16} />
                  <button onClick={() => onSelect(p.target_case_id)}>
                    <span className="bureau-icon violet">{p.target_bureau}</span>
                    <span>{p.target_case_no}</span>
                  </button>
                </div>
                <div className="proposal-footer">
                  <small>Proposed {date(p.proposed_at, true)}</small>
                  {mayRespond ? (
                    <div>
                      <Button
                        onClick={() => {
                          setResponse({ item: p, decision: 'declined' });
                          setResponseError('');
                        }}
                      >
                        <X size={13} />
                        Decline
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => {
                          setResponse({ item: p, decision: 'accepted' });
                          setResponseError('');
                        }}
                      >
                        <Check size={13} />
                        Accept coordination
                      </Button>
                    </div>
                  ) : (
                    <span className="muted">
                      {p.status === 'pending'
                        ? `Waiting for ${p.target_bureau} supervisor`
                        : p.response_reason || 'Response recorded'}
                    </span>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <section className="panel">
            <Empty
              title={
                filter === 'pending'
                  ? 'No proposals awaiting response'
                  : 'No proposals in this view'
              }
            >
              Open a case → Coordination → Check a document request. A matching request can become a
              proposal to another bureau.
            </Empty>
          </section>
        )}
      </div>
      <div className="section-gap">
        <OverlapFeed
          data={overlaps.data}
          coordination={data}
          loading={overlaps.loading}
          onSelect={onSelect}
          onInstitution={onInstitution}
        />
      </div>
      <section className="panel recorded-work">
        <div className="panel-heading">
          <div>
            <h2>Recorded document requests</h2>
            <p>
              Only recorded work is checked. No email or official correspondence is sent by this
              prototype.
            </p>
          </div>
          <Badge>{data?.requests.length || 0}</Badge>
        </div>
        {data?.requests.length ? (
          <div className="table-scroll">
            <table className="directory-table">
              <thead>
                <tr>
                  <th>Document / purpose</th>
                  <th>Case</th>
                  <th>Bureau</th>
                  <th>Period</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.document}</strong>
                      <small className="cell-subtitle">{r.purpose}</small>
                    </td>
                    <td>
                      <button className="text-btn mono" onClick={() => onSelect(r.case_id)}>
                        {r.case_no}
                      </button>
                    </td>
                    <td>{r.bureau}</td>
                    <td>{r.period}</td>
                    <td>
                      <Status value={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No structured requests yet">
            Record document, purpose and period to make future work comparable.
          </Empty>
        )}
      </section>
      {response ? (
        <Modal
          open
          onClose={() => {
            if (!busy) setResponse(null);
          }}
          title={response.decision === 'accepted' ? 'Accept coordination' : 'Decline coordination'}
          description={`${response.item.target_bureau} · ${response.item.document}`}
        >
          <form className="form-body" onSubmit={respond}>
            <div className="inline-info">
              This records the bureau’s agreement only. It does not merge cases, transfer ownership,
              grant file access or change a deadline.
            </div>
            <Field label="Response and reason">
              <textarea name="reason" required minLength={3} maxLength={2000} rows={4} />
            </Field>
            {responseError ? <ErrorNotice>{responseError}</ErrorNotice> : null}
            <div className="form-footer">
              <Button type="button" onClick={() => setResponse(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" busy={busy}>
                Record response
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
