'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from './icons';
import type { CaseDetail, CaseRecord } from '@/contracts/workspace';
import { post, useResource } from './api';
import { Badge, Button, ErrorNotice } from './ui';
type Draft = {
  id: string;
  result: {
    decision: string;
    reason: string;
    evidence: { source: string; quote: string }[];
    draft_note: string;
  };
  accepted_at: string | null;
};
export function AiComparison({
  current,
  candidates,
  onChange,
}: {
  current: CaseDetail;
  candidates: CaseRecord[];
  onChange: () => void;
}) {
  const status = useResource<{ available: boolean }>('/api/ai'),
    [target, setTarget] = useState(candidates[0]?.id || ''),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [consent, setConsent] = useState(false);
  async function generate() {
    setBusy(true);
    setError('');
    setDraft(null);
    try {
      setDraft(
        await post<Draft>('/api/ai', { source_case_id: current.id, target_case_id: target }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!candidates.length) return null;
  return (
    <section className="ai-card">
      <h3>
        <Sparkles
          size={13}
          style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}
        />
        Optional AI comparison{' '}
        <Badge>{status.data?.available ? 'Configured' : 'Not configured'}</Badge>
      </h3>
      <p>
        Compare titles and categories only. Private narratives and files are never sent. This is an
        advisory draft, not a duplicate decision.
      </p>
      <select
        aria-label="Case to compare with AI"
        value={target}
        onChange={(e) => {
          setTarget(e.target.value);
          setDraft(null);
        }}
      >
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.case_no} · {c.bureau} · {c.title}
          </option>
        ))}
      </select>
      <label className="ai-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I
        have checked that both registry titles contain no sensitive information and may be sent to
        the configured external AI provider.
      </label>
      <Button
        onClick={generate}
        disabled={!status.data?.available || !consent || !target}
        busy={busy}
      >
        <Sparkles size={13} />
        Compare registry entries
      </Button>
      {error ? <ErrorNotice>{error}</ErrorNotice> : null}
      {draft ? (
        <div className="ai-result">
          <strong>Suggestion: {draft.result.decision} · human review required</strong>
          <p>{draft.result.reason}</p>
          {draft.result.evidence.map((e, i) => (
            <blockquote key={i}>
              {e.source}: “{e.quote}”
            </blockquote>
          ))}
          <p>{draft.result.draft_note}</p>
          <Button
            disabled={!!draft.accepted_at || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const saved = await post<Draft>('/api/ai', { action: 'accept', id: draft.id });
                setDraft(saved);
                onChange();
                toast.success('Reviewed AI draft recorded as a private note');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {draft.accepted_at ? 'Reviewed note recorded' : 'Record this reviewed note'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
