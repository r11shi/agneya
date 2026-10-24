'use client';
import { useEffect, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import {
  BarChart3,
  BookOpen,
  Building2,
  CaretDown,
  ChevronsUpDown,
  Command,
  FileInput,
  Files,
  GitBranch,
  Inbox,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
} from './icons';
import type { WorkspaceData } from '@/contracts/workspace';
export const navigation = [
  ['overview', 'Overview', LayoutDashboard],
  ['alerts', 'Inbox', Inbox],
  ['cases', 'Cases', Files],
  ['institutions', 'Institutions', Building2],
  ['coordination', 'Coordination', GitBranch],
  ['reports', 'Reports', BarChart3],
  ['intake', 'Receive & import', FileInput],
] as const;
const groups = [
  ['Home', ['overview', 'alerts']],
  ['Work', ['cases', 'institutions', 'coordination']],
  ['Insights', ['reports']],
  ['Data', ['intake']],
] as const;
type Counts = { alerts: number; cases: number; coordination: number };
function useRemembered(key: string) {
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => {
    try {
      setClosed(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch {}
  }, [key]);
  function toggle(name: string) {
    setClosed((current) => {
      const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  return [closed, toggle] as const;
}
// Plane-style sidebar: a few labelled groups, counts only where they need
// action, and saved views for the three attention lists.
export function Sidebar({
  data,
  view,
  flag,
  counts,
  demo,
  open,
  onNavigate,
  onSearch,
  onLogout,
}: {
  data: WorkspaceData;
  view: string;
  flag: string;
  counts: Counts;
  demo: boolean;
  open: boolean;
  onNavigate: (view: string, extras?: Record<string, string>) => void;
  onSearch: () => void;
  onLogout: () => void;
}) {
  const [closed, toggle] = useRemembered('casebridge.sidebar.closed');
  const byKey = Object.fromEntries(navigation.map((n) => [n[0], n]));
  const membership = data.memberships[0];
  const initials = data.profile.name
    .split(' ')
    .map((v) => v[0])
    .slice(0, 2)
    .join('');
  const views = [
    ['overdue', 'Beyond timeline', 'red', data.stats.overdue],
    ['overlap', 'Cross-bureau', 'amber', data.stats.overlap_institutions],
    ['review', 'Identity review', 'gray', data.stats.review],
  ] as const;
  return (
    <aside className={`sidebar ${open ? 'mobile-open' : ''}`}>
      <div className="side-top">
        <a className="brand" href="/" aria-label="Casebridge home">
          <span className="brand-mark">
            <GitBranch size={16} weight="bold" />
          </span>
          casebridge
        </a>
      </div>
      <div className="workspace-switcher" title="AICTE complaint coordination">
        <span className="workspace-logo">A</span>
        <div>
          <strong>AICTE</strong>
          <span>Complaint coordination</span>
        </div>
        <ChevronsUpDown size={14} />
      </div>
      <button className="side-search" onClick={onSearch}>
        <Search size={15} />
        <span>Search</span>
        <kbd>
          <Command size={10} />K
        </kbd>
      </button>
      <nav className="side-nav" aria-label="Main navigation">
        {groups.map(([name, keys]) => (
          <div className="side-group" key={name}>
            <button
              className="side-group-label"
              aria-expanded={!closed.includes(name)}
              onClick={() => toggle(name)}
            >
              {name}
              <CaretDown size={11} />
            </button>
            <div className={`side-group-items ${closed.includes(name) ? 'closed' : ''}`}>
              <div>
                {keys.map((key) => {
                  const [, label, Icon] = byKey[key];
                  const active = view === key || (key === 'cases' && view === 'case');
                  const count = counts[key as keyof Counts];
                  return (
                    <button
                      key={key}
                      className={`nav-item ${active && !(key === 'cases' && flag) ? 'active' : ''}`}
                      onClick={() => onNavigate(key)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={17} />
                      <span>{label}</span>
                      {count ? (
                        <span className={`nav-count ${key === 'cases' ? '' : 'strong'}`}>
                          {count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        <div className="side-group">
          <button
            className="side-group-label"
            aria-expanded={!closed.includes('Views')}
            onClick={() => toggle('Views')}
          >
            Views
            <CaretDown size={11} />
          </button>
          <div className={`side-group-items ${closed.includes('Views') ? 'closed' : ''}`}>
            <div>
              {views.map(([value, label, tone, count]) => (
                <button
                  key={value}
                  className={`nav-item ${view === 'cases' && flag === value ? 'active' : ''}`}
                  onClick={() => onNavigate('cases', { flag: value })}
                >
                  <span className={`nav-status-dot ${tone}`} />
                  <span>{label}</span>
                  <span className="nav-count">{count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>
      <div className="sidebar-bottom">
        <Popover.Root>
          <Popover.Trigger className="user-menu">
            <span className="avatar">{initials}</span>
            <span className="user-text">
              <strong>{data.profile.name}</strong>
              <span>
                {membership?.bureau || membership?.region || 'AICTE'} ·{' '}
                {membership?.role.replaceAll('_', ' ')}
              </span>
            </span>
            <ChevronsUpDown size={14} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner
              side="top"
              align="start"
              sideOffset={6}
              className="popover-positioner"
            >
              <Popover.Popup className="popover menu-popover">
                <div className="menu-profile">
                  <strong>{data.profile.name}</strong>
                  <span>{data.profile.email}</span>
                </div>
                <div className="menu-note">
                  <ShieldCheck size={14} />
                  {demo
                    ? 'Synthetic demo workspace — no real complaint data'
                    : 'Private complaint content is bureau-scoped'}
                </div>
                <button className="menu-item" onClick={() => onNavigate('alerts')}>
                  <Inbox size={15} />
                  Inbox & e-mail alerts
                </button>
                <button className="menu-item" onClick={() => onNavigate('intake')}>
                  <BookOpen size={15} />
                  How the workflow works
                </button>
                <button className="menu-item danger" onClick={onLogout}>
                  <LogOut size={15} />
                  Sign out
                </button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </aside>
  );
}
