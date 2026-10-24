'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const result = await response
    .json()
    .catch(() => ({ error: 'The server did not return a valid response.' }));
  if (response.status === 401 && path !== '/api/auth/login') {
    window.location.assign('/login');
    throw Error('Your session ended. Please sign in.');
  }
  if (response.status === 403 && path === '/api/workspace') {
    window.location.assign('/login');
    throw Error('Your workspace access has changed.');
  }
  if (!response.ok)
    throw Error(
      typeof result.error === 'string'
        ? result.error
        : (result.message ?? 'This request could not be completed.'),
    );
  return result as T;
}
export function post<T>(path: string, value: unknown) {
  return api<T>(path, { method: 'POST', body: JSON.stringify(value) });
}
export function useResource<T>(path: string | null, initial?: T, interval = 0) {
  const [data, setData] = useState<T | undefined>(initial),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!initial);
  const counter = useRef(0),
    controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!path) return;
    controller.current?.abort();
    const signal = new AbortController();
    controller.current = signal;
    const request = ++counter.current;
    try {
      const value = await api<T>(path, { signal: signal.signal });
      if (request === counter.current) {
        setData(value);
        setError('');
      }
    } catch (e) {
      if (!signal.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load data.');
    } finally {
      if (request === counter.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(initial);
    setLoading(!initial);
    setError('');
    void refresh();
    const timer = interval
      ? setInterval(() => {
          if (!document.hidden) void refresh();
        }, interval)
      : undefined;
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    window.addEventListener('online', focus);
    return () => {
      controller.current?.abort();
      ++counter.current;
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('online', focus);
    };
    // Initial data belongs only to the first matching request. Path changes clear old private records.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, refresh, interval]);
  return { data, error, loading, refresh };
}
export function date(value: string | null | undefined, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}
export function relative(value: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return mins < 1
    ? 'just now'
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : `${Math.floor(mins / 1440)}d ago`;
}
export function indiaDateBound(value: string, end = false) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00+05:30`);
  if (end) parsed.setTime(parsed.getTime() + 86400000);
  return parsed.toISOString();
}
