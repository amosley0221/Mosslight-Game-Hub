import { useEffect, useState } from 'react';
import type { Hub } from '../core/store';
import type { Project } from '../core/types';
import { ago } from '../core/util';
import { currentUser, forgetUser, getGitHubToken, listRepos, setGitHubToken, type GhRepo } from '../github/api';
import { isDesktop, openExternal } from '../platform';
import { localFolder } from '../sync/device';
import { Modal, Switch } from './common';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';
const repoUrl = (p: Project) => `https://github.com/${p.repo!.owner}/${p.repo!.name}`;

/** Shared hook: is a GitHub token saved, and whose account is it? */
export function useGitHubAccount() {
  const [login, setLogin] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'none' | 'ok' | 'error'>('loading');
  const refresh = async () => {
    forgetUser();
    if (!(await getGitHubToken())) { setState('none'); setLogin(null); return; }
    try { setLogin((await currentUser()).login); setState('ok'); } catch { setState('error'); }
  };
  useEffect(() => { void refresh(); }, []);
  return { login, state, refresh };
}

/** Settings → GitHub: the token used for project repos (clone, back up, create). */
export function GitHubSettings({ hub }: { hub: Hub }) {
  const acct = useGitHubAccount();
  const [token, setToken] = useState('');
  const [editing, setEditing] = useState(false);
  const save = async (t: string) => {
    if (t) {
      try { await currentUser(t); } catch (e) { return hub.toast('GitHub didn\'t accept that token: ' + ((e as Error)?.message || e)); }
    }
    await setGitHubToken(t);
    setToken(''); setEditing(false);
    await acct.refresh();
    hub.toast(t ? 'GitHub connected' : 'GitHub token removed from this device');
  };
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>GitHub (project repos)</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: acct.state === 'ok' ? 'var(--green)' : acct.state === 'error' ? 'var(--danger)' : 'var(--muted)' }}>
            {acct.state === 'ok' ? `Connected as @${acct.login}` : acct.state === 'error' ? 'Token saved but GitHub rejected it' : acct.state === 'loading' ? 'Checking…' : 'Not connected'}
          </span>
          {acct.state !== 'none' && !editing && <button className="btn-ghost" style={{ padding: '5px 10px' }} onClick={() => setEditing(true)}>Change token</button>}
        </div>
        {(acct.state === 'none' || editing) && (
          <>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Lets Mosslight open your existing repos, back projects up, create new private repos, and let the agents read your code. Create a fine-grained token with <b>All repositories</b> and <b>Contents</b> + <b>Administration</b>: Read and write. Stored in this device's keychain.
            </p>
            <div className="row" style={{ gap: 6 }}>
              <input className="input mono" type="password" style={{ fontSize: 12, padding: '8px 10px' }} value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && token.trim()) void save(token.trim()); }} placeholder="github_pat_…" />
              <button className="btn-accent" style={{ padding: '8px 12px', fontSize: 12 }} disabled={!token.trim()} onClick={() => void save(token.trim())}>Save</button>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="link" onClick={() => void openExternal(TOKEN_URL)}>Create a token on GitHub →</button>
              {acct.state !== 'none' && <button className="link" style={{ color: 'var(--danger)' }} onClick={() => void save('')}>Remove token</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Searchable list of your GitHub repos. */
export function RepoPicker({ title, hint, onPick, onClose }: { title: string; hint: string; onPick: (r: GhRepo) => void; onClose: () => void }) {
  const [repos, setRepos] = useState<GhRepo[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { listRepos().then(setRepos).catch(e => setErr(String((e as Error)?.message || e))); }, []);
  const list = (repos || []).filter(r => !q || r.full_name.toLowerCase().includes(q.toLowerCase()) || (r.description || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal width={560} onClose={onClose} gap={12}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{hint}</p>
      <input className="input" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search your repos" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '50vh', overflow: 'auto' }}>
        {err && <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{err}</p>}
        {!repos && !err && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Loading your repos…</p>}
        {list.map(r => (
          <button key={r.full_name} onClick={() => { onPick(r); onClose(); }} className="hover-line" style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 44 }}>
            <span className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{r.full_name}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{r.private ? 'private' : 'public'}{r.pushed_at ? ' · ' + ago(Date.parse(r.pushed_at)) : ''}</span>
            </span>
            {r.description && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.description}</span>}
          </button>
        ))}
        {repos && !list.length && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>No matching repos.</p>}
      </div>
    </Modal>
  );
}

/** Project → GitHub card: link / create a repo, back up, clone here, auto-backup. */
export function RepoCard({ hub, p, compact }: { hub: Hub; p: Project; compact?: boolean }) {
  const acct = useGitHubAccount();
  const [picking, setPicking] = useState(false);
  const busy = hub.busyRepo === p.id;
  const lf = localFolder(p);
  const btn = { padding: compact ? '10px 12px' : '7px 12px', fontSize: 12, minHeight: compact ? 44 : undefined } as const;

  if (acct.state === 'none' || acct.state === 'error') {
    return (
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
        {acct.state === 'error' ? 'GitHub rejected the saved token.' : 'Connect GitHub to back this project up and let the agents read its repo.'} Add a token in <b>⚙ Settings → GitHub</b>.
      </div>
    );
  }

  if (!p.repo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>Not linked to GitHub yet. Link the repo you already have, or create a new private one{lf ? ' — this project\'s folder is pushed to it' : ''}.</p>
        <div className="row wrap">
          <button className="btn-accent" style={btn} disabled={busy} onClick={() => setPicking(true)}>Link existing repo</button>
          <button className="btn" style={btn} disabled={busy} onClick={() => void hub.createRepoFor(p.id)}>{busy ? 'Working…' : 'Create private repo'}</button>
        </div>
        {picking && <RepoPicker title="Link a GitHub repo" hint={`Pick the repo for ${p.name}.${lf ? ' Its history is kept and your local files are committed on top.' : ''}`} onPick={r => void hub.linkRepo(p.id, r.owner.login, r.name)} onClose={() => setPicking(false)} />}
      </div>
    );
  }

  const r = p.repo;
  const lastBy = r.lastBackupDevice ? hub.deviceName(r.lastBackupDevice) : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
        <button className="link mono" style={{ fontSize: 13 }} onClick={() => void openExternal(repoUrl(p))}>⎇ {r.owner}/{r.name} ↗</button>
        <span style={{ fontSize: 11, color: r.lastError ? 'var(--danger)' : 'var(--muted)' }}>
          {r.lastError ? 'Last backup failed' : r.lastBackup ? `Backed up ${ago(r.lastBackup)}${lastBy && lastBy !== 'another device' ? ' from ' + lastBy : ''}${r.lastCommit ? ' · ' + r.lastCommit : ''}` : 'Not backed up yet'}
        </span>
      </div>
      {r.lastError && <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.4 }}>{r.lastError}</div>}
      {isDesktop ? (
        lf ? (
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn-accent" style={btn} disabled={busy} onClick={() => void hub.backupNow(p.id)}>Back up now</button>
            <span className="row" style={{ gap: 8, fontSize: 12, color: 'var(--muted)' }}>
              <Switch on={!!r.auto} onClick={() => hub.setRepoAuto(p.id, !r.auto)} />
              <span>
                Auto backup (after local agent runs + every 30 min)
                <span style={{ display: 'block', fontSize: 11, color: 'var(--dim)' }}>Commits every change and pushes. It leaves {r.branch || 'main'} alone — switch to a branch first, or back up by hand.</span>
              </span>
            </span>
          </div>
        ) : (
          <div className="row wrap" style={{ gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>This computer doesn't have a copy yet.</span>
            <button className="btn-accent" style={btn} disabled={busy} onClick={() => void hub.cloneHere(p.id)}>{busy ? 'Cloning…' : 'Clone to this computer'}</button>
          </div>
        )
      ) : (
        <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>Agents on this phone read the repo directly. Backups run from the computer that has the project folder.</span>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="link" style={{ color: 'var(--muted)' }} onClick={() => hub.unlinkRepo(p.id)}>Unlink (keeps the repo on GitHub)</button>
      </div>
    </div>
  );
}
