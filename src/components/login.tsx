'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeSlash, GitBranch, Loader2, WarningCircle } from './icons';
import { post } from './api';
// [email, person, role, what they see]
const accounts = [
  [
    'ananya.pgrc@demo.casebridge.test',
    'Ananya Rao',
    'PGRC supervisor',
    'Grievances, approvals, coordination',
  ],
  [
    'kabir.rb@demo.casebridge.test',
    'Kabir Mehta',
    'RB supervisor',
    'Regulatory action, proposals to answer',
  ],
  [
    'reader@demo.casebridge.test',
    'Devika Sen',
    'Senior management',
    'AICTE-wide view, no private text',
  ],
  ['priya.pgrc@demo.casebridge.test', 'Priya Nair', 'PGRC officer', 'Own assigned cases'],
  ['arjun.rb@demo.casebridge.test', 'Arjun Desai', 'RB officer', 'Own assigned cases'],
  [
    'meera.region@demo.casebridge.test',
    'Meera Shah',
    'Regional Office',
    'Verification and follow-up',
  ],
  ['west@demo.casebridge.test', 'West Region Reader', 'Regional reader', 'Only the West region'],
  [
    'admin@demo.casebridge.test',
    'Configuration Admin',
    'Administrator',
    'Settings, no complaint text',
  ],
] as const;
const demoPassword = 'Casebridge-demo-2026!';
const initials = (name: string) =>
  name
    .split(' ')
    .map((v) => v[0])
    .slice(0, 2)
    .join('');
export function Login({ demo }: { demo: boolean }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [caps, setCaps] = useState(false),
    [busy, setBusy] = useState<string | false>(false),
    [more, setMore] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  async function signIn(account: string, secret: string) {
    setBusy(account);
    setError('');
    try {
      await post('/api/auth/login', { email: account, password: secret });
      window.location.assign('/');
    } catch (e) {
      setError(
        e instanceof Error && /invalid|credential|password/i.test(e.message)
          ? 'That email and password don’t match an approved account.'
          : e instanceof Error
            ? e.message
            : 'Sign-in failed. Please try again.',
      );
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <div className="auth-backdrop" aria-hidden />
      <div className="auth-column">
        <a className="auth-brand" href="/login">
          <span className="brand-mark">
            <GitBranch size={16} weight="bold" />
          </span>
          casebridge
        </a>
        <section className="auth-card" aria-labelledby="auth-title">
          <h1 id="auth-title">Sign in to Casebridge</h1>
          <p className="auth-sub">
            One place to track complaint cases across AICTE bureaus and cells.
          </p>
          {demo ? (
            <>
              <div className="auth-label">
                <span>Continue as</span>
                <span className="auth-pill">Demo</span>
              </div>
              <ul className="role-list">
                {accounts.slice(0, more ? accounts.length : 3).map(([value, name, role, scope]) => (
                  <li key={value}>
                    <button
                      className="role-row"
                      disabled={!ready || !!busy}
                      aria-busy={busy === value}
                      onClick={() => void signIn(value, demoPassword)}
                    >
                      <span className="avatar">{initials(name)}</span>
                      <span className="role-text">
                        <strong>{role}</strong>
                        <small>
                          {name} · {scope}
                        </small>
                      </span>
                      {busy === value ? (
                        <Loader2 size={16} className="spin" />
                      ) : (
                        <ArrowRight size={15} className="role-arrow" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <button className="text-btn role-more" onClick={() => setMore(!more)}>
                {more ? 'Fewer roles' : `${accounts.length - 3} more roles`}
              </button>
              <div className="auth-divider">
                <span>or use email</span>
              </div>
            </>
          ) : null}
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              void signIn(email, password);
            }}
          >
            <label className="auth-field">
              <span>Official email</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@aicte-india.org"
                aria-invalid={!!error}
              />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <span className="password-wrap">
                <input
                  type={show ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
                  aria-invalid={!!error}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </span>
              {caps ? <small className="auth-hint">Caps Lock is on</small> : null}
            </label>
            {error ? (
              <p className="auth-error" role="alert">
                <WarningCircle size={15} />
                {error}
              </p>
            ) : null}
            <button className="btn primary auth-submit" type="submit" disabled={!ready || !!busy}>
              {busy && busy === email ? <Loader2 size={15} className="spin" /> : null}
              Sign in
            </button>
          </form>
          <p className="auth-foot">
            {demo
              ? `Every demo role uses the password ${demoPassword}. Records are synthetic.`
              : 'Access is limited to approved officials. Ask your administrator for a membership.'}
          </p>
        </section>
        <ul className="auth-values">
          <li>
            <strong>One view</strong>
            <span>Every institution’s cases across RB, PGRC and regional offices</span>
          </li>
          <li>
            <strong>Overlap alerts</strong>
            <span>Know when another bureau is already acting</span>
          </li>
          <li>
            <strong>On the record</strong>
            <span>Every action, owner and deadline is kept</span>
          </li>
        </ul>
        <p className="auth-legal">Casebridge by Team AGNEYA · prototype</p>
      </div>
    </main>
  );
}
