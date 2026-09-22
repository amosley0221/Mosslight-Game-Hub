import type { Activity, AgentId, Task, TaskStatus } from './types';

export const uid = () => Math.random().toString(36).slice(2, 9);
export const now = () => Date.now();
export const H = 3600e3, D = 86400e3;

export const ago = (t: number) => {
  const s = Math.max(0, (now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
};

export const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) + '%' : '0%');
export const T = (agent: AgentId, title: string, status: TaskStatus, dt: number): Task => ({ id: uid(), agent, title, status, ts: now() - dt });
export const A = (agent: AgentId, text: string, dt = 0): Activity => ({ id: uid(), agent, text, ts: now() - dt });

export const fmtSize = (n: number) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');
export const uniq = <X,>(xs: X[]) => Array.from(new Set(xs));
export const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;

/** Semver-ish compare: returns >0 when a is newer than b. */
export const cmpVersion = (a: string, b: string) => {
  const pa = a.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};
