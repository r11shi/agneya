'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, LockKeyhole, Upload } from './icons';
import type { CaseDetail } from '@/contracts/workspace';
import { api, date, post, useResource } from './api';
import { Badge, Button, Empty, ErrorNotice } from './ui';
type Evidence = { id: string; filename: string; bytes: number; state: string; created_at: string };
export function EvidencePanel({ item, onChange }: { item: CaseDetail; onChange: () => void }) {
  const files = useResource<Evidence[]>(
      item.can_read_content ? `/api/cases/${item.id}/evidence` : null,
    ),
    input = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Choose a file up to 5 MB.');
      return;
    }
    setBusy(true);
    setError('');
    const form = new FormData();
    form.set('file', file);
    form.set('version', String(item.version));
    form.set('key', crypto.randomUUID());
    try {
      await api(`/api/cases/${item.id}/evidence`, { method: 'POST', body: form });
      toast.success('Supporting document attached');
      void files.refresh();
      onChange();
    } catch (e) {
      setError((e as Error).message);
      void files.refresh();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  if (!item.can_read_content)
    return (
      <div className="restricted">
        <LockKeyhole size={18} />
        Files belong to the handling bureau. Coordination does not grant file access.
      </div>
    );
  return (
    <>
      <h3>Supporting documents</h3>
      <p className="evidence-note">
        Private attachments · PDF, PNG, JPG or UTF-8 text · up to 5 MB. Downloads recheck your
        current bureau access and file integrity.
      </p>
      {files.error ? <ErrorNotice retry={files.refresh}>{files.error}</ErrorNotice> : null}
      {files.data?.length ? (
        files.data.map((file) => (
          <div className="file-row" key={file.id}>
            <FileText size={18} className="muted" />
            <div>
              <strong>{file.filename}</strong>
              <small>
                {Math.ceil(file.bytes / 1024)} KB · {date(file.created_at, true)}
              </small>
            </div>
            <Badge tone={file.state === 'ready' ? 'green' : 'amber'}>{file.state}</Badge>
            {file.state === 'ready' ? (
              <a
                className="icon-btn"
                href={`/api/cases/${item.id}/evidence/${file.id}`}
                download
                aria-label={`Download ${file.filename}`}
              >
                <Download size={15} />
              </a>
            ) : (
              <button
                className="text-btn"
                onClick={async () => {
                  try {
                    await post(`/api/cases/${item.id}/evidence/${file.id}`, {});
                    void files.refresh();
                    onChange();
                    toast.success('Document finalized');
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Retry finalize
              </button>
            )}
          </div>
        ))
      ) : (
        <Empty title="No supporting documents yet">
          Attach the records needed for the next action.
        </Empty>
      )}
      {item.status !== 'disposed' ? (
        <div className="file-upload">
          <input
            ref={input}
            type="file"
            className="sr-only"
            accept="application/pdf,image/png,image/jpeg,text/plain"
            aria-label="Choose supporting document"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <Button onClick={() => input.current?.click()} busy={busy}>
            <Upload size={14} />
            Attach document
          </Button>
        </div>
      ) : null}
      {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    </>
  );
}
