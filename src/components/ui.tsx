'use client';
import { Dialog } from '@base-ui/react/dialog';
import { X, Loader2, Inbox, AlertTriangle, GitBranch } from './icons';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function Button({
  children,
  className = '',
  variant = 'secondary',
  busy,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button className={`btn ${variant} ${className}`} {...props} disabled={props.disabled || busy}>
      {busy ? <Loader2 size={15} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
const labels: Record<string, string> = {
  pending: 'Pending',
  under_process: 'Under process',
  transferred: 'Transferred',
  escalated: 'Escalated',
  disposed: 'Disposed',
  pending_coordination: 'Awaiting response',
  coordinated: 'Coordinated',
  open: 'Open',
  fulfilled: 'Fulfilled',
  accepted: 'Accepted',
  declined: 'Declined',
};
export function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value}`}>
      <i />
      {labels[value] ?? value}
    </span>
  );
}
export function OverlapBadge() {
  return (
    <span
      className="overlap-badge"
      title="Active complaints at this institution are handled by multiple bureaus. This does not mean they are duplicate complaints."
    >
      <GitBranch size={12} />
      Cross-bureau
    </span>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ErrorNotice({ children, retry }: { children: ReactNode; retry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <AlertTriangle size={16} />
      <span>{children}</span>
      {retry ? <button onClick={retry}>Try again</button> : null}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className={drawer ? 'dialog drawer' : 'dialog'}>
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description ? (
                <Dialog.Description>{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  Review and update this record.
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-btn" aria-label="Close panel">
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
