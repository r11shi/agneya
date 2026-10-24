'use client';
import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { toast } from 'sonner';
import {
  ArrowsLeftRight,
  Bell,
  Checks,
  Clock3,
  EnvelopeSimple,
  GitBranch,
  Inbox,
  Lightning,
  WarningCircle,
} from './icons';
import type { Notification, NotificationFeed } from '@/contracts/workspace';
import { date, post, relative } from './api';
import { Empty, ErrorNotice } from './ui';
export const kindMeta: Record<
  Notification['kind'],
  { label: string; tone: string; Icon: React.ComponentType<{ size?: number; weight?: 'bold' }> }
> = {
  overlap: { label: 'Overlap', tone: 'amber', Icon: GitBranch },
  overdue: { label: 'Beyond timeline', tone: 'red', Icon: WarningCircle },
  due_soon: { label: 'Due soon', tone: 'amber', Icon: Clock3 },
  pending: { label: 'Pending 7+ days', tone: 'gray', Icon: Clock3 },
  escalated: { label: 'Escalated', tone: 'amber', Icon: Lightning },
  coordination: { label: 'Coordination', tone: 'blue', Icon: ArrowsLeftRight },
  transfer: { label: 'Transfer', tone: 'violet', Icon: ArrowsLeftRight },
};
export const kindGroups = [
  ['', 'All'],
  ['overlap', 'Overlap'],
  ['overdue,due_soon,pending,escalated', 'Deadlines'],
  ['coordination', 'Coordination'],
  ['transfer', 'Transfers'],
] as const;
export async function markRead(ids: string[] | 'all') {
  await post('/api/notifications/read', ids === 'all' ? { all: true } : { ids });
}
function NotificationRow({ n, onOpen }: { n: Notification; onOpen: (n: Notification) => void }) {
  const meta = kindMeta[n.kind];
  return (
    <button className={`notice ${n.read_at ? '' : 'unread'}`} onClick={() => onOpen(n)}>
      <span className={`notice-icon ${meta.tone}`}>
        <meta.Icon size={15} weight="bold" />
      </span>
      <span className="notice-text">
        <strong>{n.title}</strong>
        <small>{n.body}</small>
        <small className="notice-meta">
          {meta.label} · <time title={date(n.created_at, true)}>{relative(n.created_at)}</time>
          {n.emailed ? ' · e-mailed' : ''}
        </small>
      </span>
      {n.read_at ? null : <i className="notice-dot" aria-label="Unread" />}
    </button>
  );
}
function split(items: Notification[]) {
  const today = new Date().toDateString();
  return [
    ['Today', items.filter((i) => new Date(i.created_at).toDateString() === today)],
    ['Earlier', items.filter((i) => new Date(i.created_at).toDateString() !== today)],
  ] as const;
}
// Bell popover: the latest notifications with an unread count, scaled from
// its trigger. Opening is a click; nothing waits on the animation.
export function NotificationBell({
  feed,
  error,
  onRefresh,
  onOpenItem,
  onViewAll,
}: {
  feed?: NotificationFeed;
  error: string;
  onRefresh: () => void;
  onOpenItem: (n: Notification) => void;
  onViewAll: () => void;
}) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<'unread' | 'all'>('unread');
  const unread = feed?.unread ?? 0;
  const items = (feed?.items ?? []).filter((i) => tab === 'all' || !i.read_at).slice(0, 12);
  async function openItem(n: Notification) {
    setOpen(false);
    onOpenItem(n);
    if (!n.read_at) {
      await markRead([n.id]).catch(() => {});
      onRefresh();
    }
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="icon-btn notification-btn"
        aria-label={`Notifications, ${unread} unread`}
      >
        <Bell size={18} />
        {unread ? <span className="bell-count">{unread > 9 ? '9+' : unread}</span> : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="popover-positioner">
          <Popover.Popup className="popover notif-popover">
            <div className="notif-head">
              <Popover.Title className="notif-title">Notifications</Popover.Title>
              <button
                className="text-btn"
                disabled={!unread}
                onClick={async () => {
                  await markRead('all');
                  onRefresh();
                }}
              >
                <Checks size={14} />
                Mark all read
              </button>
            </div>
            <div className="segmented" role="tablist">
              {(
                [
                  ['unread', `Unread`, unread],
                  ['all', 'All', null],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  className={tab === key ? 'active' : ''}
                  onClick={() => setTab(key)}
                >
                  {label}
                  {count ? <span className="seg-count">{count}</span> : null}
                </button>
              ))}
            </div>
            {feed && Object.keys(feed.by_kind).length ? (
              <div className="notif-kinds">
                {Object.entries(feed.by_kind).map(([k, n]) => (
                  <span key={k} className={`chip ${kindMeta[k as Notification['kind']].tone}`}>
                    {kindMeta[k as Notification['kind']].label} {n}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="notif-list">
              {error ? (
                <ErrorNotice retry={onRefresh}>{error}</ErrorNotice>
              ) : !feed ? (
                <div className="skeleton-block" />
              ) : items.length ? (
                split(items).map(([label, group]) =>
                  group.length ? (
                    <div key={label}>
                      <div className="notif-group">{label}</div>
                      {group.map((n) => (
                        <NotificationRow key={n.id} n={n} onOpen={openItem} />
                      ))}
                    </div>
                  ) : null,
                )
              ) : (
                <div className="notif-empty">
                  <Inbox size={22} />
                  <strong>
                    {tab === 'unread' ? 'You’re all caught up' : 'No notifications yet'}
                  </strong>
                  <span>Overlap, deadline and coordination alerts appear here.</span>
                </div>
              )}
            </div>
            <div className="notif-foot">
              <span className="muted">
                <EnvelopeSimple size={13} /> E-mail {feed?.email_alerts ? 'on' : 'off'}
              </span>
              <button
                className="text-btn"
                onClick={() => {
                  setOpen(false);
                  onViewAll();
                }}
              >
                Open inbox
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function InboxView({
  feed,
  error,
  kind,
  onKind,
  onRefresh,
  onOpenItem,
}: {
  feed?: NotificationFeed;
  error: string;
  kind: string;
  onKind: (kind: string) => void;
  onRefresh: () => void;
  onOpenItem: (n: Notification) => void;
}) {
  const [onlyUnread, setOnlyUnread] = useState(false),
    [savingPref, setSavingPref] = useState(false);
  const items = (feed?.items ?? []).filter((i) => !onlyUnread || !i.read_at);
  const count = (group: string) =>
    group
      ? group.split(',').reduce((n, k) => n + (feed?.by_kind[k as Notification['kind']] ?? 0), 0)
      : (feed?.unread ?? 0);
  return (
    <>
      <div className="page-heading compact">
        <div>
          <h1>Inbox</h1>
          <p>
            Overlap, deadline, coordination and transfer alerts for you. Reading an alert never
            changes a case.
          </p>
        </div>
        <div className="heading-actions">
          <label className="switch">
            <input
              type="checkbox"
              checked={!!feed?.email_alerts}
              disabled={!feed || savingPref}
              onChange={async (e) => {
                setSavingPref(true);
                try {
                  await post('/api/notifications/settings', { email_alerts: e.target.checked });
                  toast.success(e.target.checked ? 'E-mail alerts on' : 'E-mail alerts off');
                  onRefresh();
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setSavingPref(false);
                }
              }}
            />
            <span className="switch-track" aria-hidden />
            E-mail digest
          </label>
          <button
            className="btn"
            disabled={!feed?.unread}
            onClick={async () => {
              await markRead('all');
              onRefresh();
            }}
          >
            <Checks size={15} />
            Mark all read
          </button>
        </div>
      </div>
      <div className="view-tabs">
        {kindGroups.map(([value, label]) => (
          <button
            key={label}
            className={kind === value ? 'active' : ''}
            onClick={() => onKind(value)}
          >
            {label}
            {count(value) ? <span className="tab-count">{count(value)}</span> : null}
          </button>
        ))}
        <label className="tab-toggle">
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(e) => setOnlyUnread(e.target.checked)}
          />
          Unread only
        </label>
      </div>
      {error ? <ErrorNotice retry={onRefresh}>{error}</ErrorNotice> : null}
      <section className="panel inbox-panel">
        {!feed ? (
          <div className="skeleton-block" />
        ) : items.length ? (
          split(items).map(([label, group]) =>
            group.length ? (
              <div key={label}>
                <div className="notif-group">{label}</div>
                {group.map((n) => (
                  <NotificationRow key={n.id} n={n} onOpen={onOpenItem} />
                ))}
              </div>
            ) : null,
          )
        ) : (
          <Empty title={onlyUnread ? 'You’re all caught up' : 'Nothing here yet'}>
            Alerts appear when an institution becomes active in a second bureau, a deadline
            approaches or passes, or another bureau proposes coordination.
          </Empty>
        )}
      </section>
      <p className="source-footnote">
        Deadline scan runs every minute. E-mail is a digest of new alerts per person, sent only
        while they are unread. Prototype reminders: due within 3 days; pending for 7 days.
      </p>
    </>
  );
}
