'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Building2, Info } from './icons';
import { bureaus, categories } from '@/contracts/cases';
import type { InstitutionMatch, WorkspaceData } from '@/contracts/workspace';
import { Button, Field, ErrorNotice, Modal } from './ui';
import { post, useResource } from './api';
export function NewCase({
  data,
  open,
  onClose,
  onCreated,
}: {
  data: WorkspaceData;
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const myBureaus = [
    ...new Set(
      data.memberships
        .filter((m) => m.role === 'officer' || m.role === 'supervisor')
        .map((m) => m.bureau),
    ),
  ];
  const [institutionId, setInstitutionId] = useState(''),
    [bureau, setBureau] = useState(myBureaus[0] || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const [source, setSource] = useState({ name: '', permanentId: '', city: '' });
  const institution = data.institutions.find((i) => i.id === institutionId);
  const [matchPath, setMatchPath] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const q = source.name.trim();
      setMatchPath(
        q.length > 1 || source.permanentId.trim()
          ? `/api/institutions/match?${new URLSearchParams({ q, ...(source.permanentId.trim() ? { permanent_id: source.permanentId.trim() } : {}), ...(source.city.trim() ? { city: source.city.trim() } : {}) })}`
          : null,
      );
    }, 200);
    return () => clearTimeout(t);
  }, [source]);
  const matches = useResource<{ matches: InstitutionMatch[] }>(matchPath).data?.matches ?? [];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = {
        institution_name: institution?.name || values.institution_name,
        permanent_id: institution?.permanent_id || values.permanent_id || undefined,
        city: institution?.city || values.city || undefined,
        title: values.title,
        description: values.description,
        category: values.category,
        bureau,
        received_at: new Date(`${values.received_date}T00:00:00+05:30`).toISOString(),
        deadline: new Date(`${values.deadline_date}T23:59:59+05:30`).toISOString(),
        next_action: values.next_action,
      };
      const signature = JSON.stringify(payload);
      if (pending.current?.signature !== signature)
        pending.current = { signature, key: crypto.randomUUID() };
      const result = await post<{ id: string; identity_state: string }>('/api/cases', {
        payload,
        idempotencyKey: pending.current.key,
      });
      pending.current = null;
      toast.success(
        result.identity_state === 'review'
          ? 'Case received · institution review needed'
          : 'Case received successfully',
      );
      onCreated(result.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Case could not be received.');
    } finally {
      setBusy(false);
    }
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const future = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() + 14 * 86400000),
  );
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Receive a complaint"
      description="Create a case with a clear owner and next action."
    >
      <form onSubmit={submit} className="form-body">
        <div className="form-section-label">
          <Building2 size={14} />
          Institution
        </div>
        {institution ? (
          <div className="institution-confirm">
            <span className="institution-mark">
              <Building2 size={16} />
            </span>
            <div>
              <strong>{institution.name}</strong>
              <small>
                {institution.permanent_id} · {institution.city}, {institution.region} · confirmed by
                you
              </small>
            </div>
            <button type="button" className="text-btn" onClick={() => setInstitutionId('')}>
              Change
            </button>
          </div>
        ) : (
          <>
            <Field label="Institution name as written in the complaint">
              <input
                name="institution_name"
                required
                minLength={2}
                maxLength={200}
                value={source.name}
                onChange={(e) => setSource({ ...source, name: e.target.value })}
                placeholder="e.g. SIT Pune, Sahyadri Inst. of Tech."
                autoComplete="off"
              />
            </Field>
            <div className="form-grid">
              <Field label="Permanent ID (if provided)">
                <input
                  name="permanent_id"
                  maxLength={40}
                  value={source.permanentId}
                  onChange={(e) => setSource({ ...source, permanentId: e.target.value })}
                />
              </Field>
              <Field label="City (if provided)">
                <input
                  name="city"
                  maxLength={100}
                  value={source.city}
                  onChange={(e) => setSource({ ...source, city: e.target.value })}
                />
              </Field>
            </div>
            {matches.length ? (
              <div className="match-suggestions" aria-live="polite">
                <span className="eyebrow">Possible directory matches · confirm one</span>
                {matches.map((m) => (
                  <button
                    type="button"
                    key={m.institution.id}
                    className="match-suggestion"
                    onClick={() => setInstitutionId(m.institution.id)}
                  >
                    <span className="match-score" style={{ ['--score' as string]: m.score }}>
                      {Math.round(m.score * 100)}%
                    </span>
                    <span>
                      <strong>{m.institution.name}</strong>
                      <small>
                        {m.institution.permanent_id} · {m.institution.city} ·{' '}
                        {m.reasons.join(' · ')}
                      </small>
                    </span>
                    <span className="match-use">Use</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="inline-info">
              <Info size={14} />
              Suggestions are advisory. Without a confirmed match, the case goes to identity review
              and is still counted.
            </div>
          </>
        )}
        <div className="form-section-label">Complaint details</div>
        <Field
          label="Case title"
          hint="Use a brief, non-sensitive title. This appears in the shared registry."
        >
          <input
            name="title"
            required
            minLength={3}
            maxLength={160}
            placeholder="e.g. Fee refund pending after withdrawal"
          />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <select name="category">
              {categories.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Handling bureau">
            <select value={bureau} onChange={(e) => setBureau(e.target.value)} required>
              {bureaus
                .filter((b) => myBureaus.includes(b))
                .map((v) => (
                  <option key={v}>{v}</option>
                ))}
            </select>
          </Field>
        </div>
        <Field
          label="Private complaint details"
          hint="Visible only to officials in the handling bureau."
        >
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={20000}
            rows={4}
            placeholder="Describe the concern and supporting information…"
          />
        </Field>
        <div className="form-grid">
          <Field label="Date received">
            <input type="date" name="received_date" required defaultValue={today} max={today} />
          </Field>
          <Field
            label="Expected disposal date"
            hint="Prototype policy: officials set the deadline; no automatic regulatory SLA."
          >
            <input type="date" name="deadline_date" required defaultValue={future} />
          </Field>
        </div>
        <Field label="Next action required">
          <input
            name="next_action"
            required
            minLength={3}
            maxLength={500}
            placeholder="e.g. Review submitted fee receipts"
          />
        </Field>
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        <div className="form-footer">
          <Button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} type="submit">
            Receive complaint
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
