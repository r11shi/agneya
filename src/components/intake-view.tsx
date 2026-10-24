'use client';
import { useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  FileInput,
  FileSpreadsheet,
  Plus,
  UploadCloud,
} from './icons';
import { Badge, Button, ErrorNotice } from './ui';
import { post } from './api';
import { downloadCsv } from './reports-view';
type Outcome = {
  row: number;
  outcome: string;
  case_no?: string;
  source_ref?: string;
  error?: string;
};
export function IntakeView({
  canCreate,
  onNew,
  onChange,
}: {
  canCreate: boolean;
  onNew: () => void;
  onChange: () => void;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([]),
    [filename, setFilename] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const input = useRef<HTMLInputElement>(null),
    batch = useRef(crypto.randomUUID());
  function choose(file?: File) {
    if (!file) return;
    setError('');
    setRows([]);
    setOutcomes([]);
    if (file.size > 500000) {
      setError('Use a CSV smaller than 500 KB, up to 100 rows.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a .csv file.');
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (result) => {
        if (result.errors.length) {
          setError(`CSV error: ${result.errors[0].message}`);
          return;
        }
        if (result.data.length > 100 || !result.data.length) {
          setError('Use between 1 and 100 data rows.');
          return;
        }
        setRows(result.data);
        setFilename(file.name);
        batch.current = crypto.randomUUID();
      },
      error: () => setError('The CSV could not be read.'),
    });
  }
  async function upload() {
    setBusy(true);
    setError('');
    try {
      const result = await post<{ outcomes: Outcome[] }>('/api/imports', {
        rows,
        idempotencyKey: batch.current,
      });
      setOutcomes(result.outcomes);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function sample() {
    downloadCsv('casebridge-intake-template.csv', [
      {
        source_ref: 'TRAINING-REF-001',
        institution_name: 'SIT Pune',
        permanent_id: 'DEMO-AICTE-0001',
        city: 'Pune',
        title: 'Fee refund pending after withdrawal',
        description:
          'Synthetic example only. Please review the refund records for this training case.',
        category: 'Fee & refund',
        bureau: 'PGRC',
        received_at: new Date(Date.now() - 86400000).toISOString(),
        deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
        next_action: 'Review supporting records',
      },
    ]);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="greeting">Start with a trustworthy record</span>
          <h1>Receive & import</h1>
          <p>
            Keep original receipt dates and source references. Review uncertain identity before
            linking it.
          </p>
        </div>
      </div>
      <div className="intake-options">
        <section className="panel intake-card">
          <span className="intake-icon">
            <Plus size={22} />
          </span>
          <h2>Receive one complaint</h2>
          <p>
            Record the institution, concern, handling bureau, next action and expected disposal
            date.
          </p>
          <Button variant="primary" onClick={onNew} disabled={!canCreate}>
            Receive complaint
            <ArrowRight size={14} />
          </Button>
        </section>
        <section className="panel intake-card">
          <span className="intake-icon green">
            <FileSpreadsheet size={22} />
          </span>
          <h2>Import from a source CSV</h2>
          <p>Up to 100 rows per batch. Stable source references make repeat imports safe.</p>
          <Button onClick={sample}>
            <ArrowDownToLine size={14} />
            Download template
          </Button>
        </section>
      </div>
      <section className="panel import-panel">
        <div className="panel-heading">
          <div>
            <h2>CSV intake</h2>
            <p>Simulated source integration. No live AICTE system is connected.</p>
          </div>
          <Badge>500 KB · 100 rows</Badge>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          ref={input}
          className="sr-only"
          aria-label="Choose intake CSV"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <button
          className="upload-zone"
          disabled={!canCreate || busy}
          onClick={() => input.current?.click()}
        >
          <UploadCloud size={27} />
          <strong>{filename || 'Choose a CSV to review'}</strong>
          <span>
            {rows.length
              ? `${rows.length} rows parsed · choose another file`
              : 'Use the template headers and timezone-explicit ISO dates.'}
          </span>
        </button>
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        {rows.length && !outcomes.length ? (
          <div className="import-review">
            <div className="inline-info">
              Each row is independently validated. Unresolved institutions remain valid cases.
              Invalid rows are reported separately. Keep private complaint details in the
              description field.
            </div>
            <div className="table-scroll">
              <table className="directory-table">
                <thead>
                  <tr>
                    <th>Source ref</th>
                    <th>Institution</th>
                    <th>Case title</th>
                    <th>Bureau</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{r.source_ref || 'Missing'}</td>
                      <td>{r.institution_name || 'Missing'}</td>
                      <td>{r.title || 'Missing'}</td>
                      <td>{r.bureau || 'Missing'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-footer">
              <span className="muted">
                Previewing {Math.min(rows.length, 5)} of {rows.length} rows
              </span>
              <Button variant="primary" busy={busy} onClick={upload}>
                Validate & import {rows.length} rows
              </Button>
            </div>
          </div>
        ) : null}
        {outcomes.length ? (
          <div className="import-results">
            <div className="import-result-heading">
              <h2>
                <Check size={18} />
                Import completed
              </h2>
              <Button onClick={() => downloadCsv('casebridge-import-results.csv', outcomes)}>
                <ArrowDownToLine size={14} />
                Save row results
              </Button>
            </div>
            <div className="outcome-summary">
              {['accepted', 'identity_review', 'duplicate', 'source_conflict', 'rejected'].map(
                (v) => (
                  <span key={v}>
                    <strong>{outcomes.filter((o) => o.outcome === v).length}</strong>
                    {v.replaceAll('_', ' ')}
                  </span>
                ),
              )}
            </div>
            <div className="table-scroll">
              <table className="directory-table">
                <thead>
                  <tr>
                    <th>CSV row</th>
                    <th>Source / case</th>
                    <th>Result</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((o) => (
                    <tr key={o.row}>
                      <td>{o.row}</td>
                      <td className="mono">{o.case_no || o.source_ref || '—'}</td>
                      <td>
                        <Badge
                          tone={
                            o.outcome === 'rejected' || o.outcome === 'source_conflict'
                              ? 'red'
                              : o.outcome === 'identity_review'
                                ? 'amber'
                                : 'green'
                          }
                        >
                          {o.outcome.replaceAll('_', ' ')}
                        </Badge>
                      </td>
                      <td>
                        {o.error ||
                          (o.outcome === 'source_conflict'
                            ? 'Source revision recorded for review; canonical case not overwritten.'
                            : o.outcome === 'identity_review'
                              ? 'Case received; institution identity needs review.'
                              : '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="source-footnote">
              Save this row report before leaving. Rejected input rows are not complaint cases;
              source conflicts are retained server-side.
            </p>
          </div>
        ) : null}
      </section>
      <section className="workflow-guide">
        <h2>The case journey</h2>
        <div>
          {[
            [
              '01',
              'Identify',
              'Use a Permanent ID or reviewed alias. Abstain when details conflict.',
            ],
            ['02', 'Own', 'Assign a handling bureau and officer. Preserve the received date.'],
            ['03', 'Coordinate', 'Surface cross-bureau work. Review related issues and requests.'],
            [
              '04',
              'Act & track',
              'Record action, next step and deadline. Dispose through a supervisor.',
            ],
          ].map(([n, title, description]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
