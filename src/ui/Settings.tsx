import { useEffect, useState } from 'react';
import { DEPTH, ORDER, TOOLS } from '../core/constants';
import { AGENT_KEY } from '../core/agents';
import type { Hub } from '../core/store';
import type { AgentId } from '../core/types';
import { detectTools, getSecret, isDesktop, openExternal, platform, setSecret, type ToolStatus } from '../platform';
import { currentVersion, releasesUrl } from '../platform/updates';
import { Modal, RichText, Switch, useUpdate } from './common';
import { SyncSettings } from './SyncSettings';
import { AgentSettings } from './AgentSettings';

/** Paste-an-API-key dialog. Keys go to the OS keychain (desktop) / app-private storage (Android). */
export function KeyModal({ name, label, url, onClose, onSaved }: { name: string; label: string; url?: string; onClose: () => void; onSaved?: (has: boolean) => void }) {
  const [v, setV] = useState('');
  const [has, setHas] = useState(false);
  useEffect(() => { void getSecret(name).then(s => setHas(!!s)); }, [name]);
  const save = async (value: string) => { await setSecret(name, value); onSaved?.(!!value); onClose(); };
  return (
    <Modal width={460} onClose={onClose} gap={14}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{label}</h2>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{has ? 'A key is saved. Paste a new one to replace it.' : 'Paste your key.'} It's stored in {platform === 'desktop' ? 'your system keychain' : 'this app\'s private storage'} and only sent to the provider.
        {url && <> Get one at <a href={url} onClick={e => { e.preventDefault(); void openExternal(url); }}>{url.replace(/^https:\/\//, '')}</a>.</>}</p>
      <input autoFocus type="password" className="input mono" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && v.trim()) void save(v.trim()); }} placeholder="sk-…" />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {has && <button className="btn" style={{ marginRight: 'auto', color: 'var(--danger)', background: 'none' }} onClick={() => void save('')}>Remove key</button>}
        <button className="btn" style={{ background: 'none' }} onClick={onClose}>Cancel</button>
        <button className="btn-accent" disabled={!v.trim()} onClick={() => void save(v.trim())}>Save</button>
      </div>
    </Modal>
  );
}

function useKeyStatus(names: string[]) {
  const [has, setHas] = useState<Record<string, boolean>>({});
  const refresh = () => { void Promise.all(names.map(async n => [n, !!(await getSecret(n))] as const)).then(r => setHas(Object.fromEntries(r))); };
  useEffect(refresh, [names.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return { has, refresh };
}

export function Integrations({ hub }: { hub: Hub }) {
  const { settings, updSettings, toast } = hub;
  const [detected, setDetected] = useState<Record<string, ToolStatus>>({});
  const [keyFor, setKeyFor] = useState<(typeof TOOLS)[number] | null>(null);
  const keyNames = TOOLS.filter(t => t.keyName).map(t => t.keyName!);
  const keys = useKeyStatus(keyNames);
  useEffect(() => { void detectTools().then(setDetected).catch(() => setDetected({})); }, []);
  const rows = TOOLS.map(t => {
    const installed = t.keyName ? !!keys.has[t.keyName] : !!detected[t.id]?.installed;
    const connected = t.keyName ? installed : installed && settings.tools[t.id] !== false;
    const status = connected ? (t.keyName ? 'Key added' : 'Connected') : installed ? 'Detected · off' : t.depth === 'api' ? 'Needs API key' : isDesktop ? 'Not installed' : 'Desktop only';
    return { t, installed, connected, status, path: detected[t.id]?.path };
  });
  return (
    <>
      <div className="row wrap" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <h1 className="h1">Integrations</h1>
          <p className="sub" style={{ maxWidth: '70ch' }}>Every engine and tool the hub can drive. <span style={{ color: 'var(--green)', fontWeight: 600 }}>Deep</span> tools open, build and run from here; <span style={{ color: 'var(--accent)', fontWeight: 600 }}>API</span> tools are called by agents and drop results into the project; <b>Launch</b> tools open with the right file and the hub watches for exports.</p>
        </div>
        <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{rows.filter(r => r.connected).length} of {TOOLS.length} connected</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {rows.map(({ t, installed, connected, status, path }) => {
          const depthColor = t.depth === 'deep' ? 'var(--green)' : t.depth === 'api' ? 'var(--accent)' : 'var(--muted)';
          return (
            <section key={t.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{t.name}</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.cat}</div></div>
                <span title={DEPTH[t.depth].hint} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: `1px solid ${depthColor}`, color: depthColor, whiteSpace: 'nowrap' }}>{DEPTH[t.depth].label}</span>
              </div>
              <div className="row wrap" style={{ gap: 4 }}>{t.caps.map(c => <span key={c} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--well)', border: '1px solid var(--line-2)', color: 'var(--text-2)' }}>{c}</span>)}</div>
              <div className="mono ellipsis" title={path || t.how} style={{ fontSize: 10, color: 'var(--dim)' }}>{path || t.how}</div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                <span className="row" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: connected ? 'var(--green)' : 'var(--muted)' }}><span className="dot" style={{ width: 7, height: 7, background: connected ? 'var(--green)' : 'var(--muted)' }} />{status}</span>
                {t.keyName ? <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8 }} onClick={() => setKeyFor(t)}>{connected ? 'Change key' : 'Add key'}</button>
                  : installed ? <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8 }} onClick={() => { updSettings(s => ({ ...s, tools: { ...s.tools, [t.id]: !connected } })); toast((connected ? 'Disconnected ' : 'Connected ') + t.name); }}>{connected ? 'Disconnect' : 'Connect'}</button>
                  : null}
              </div>
            </section>
          );
        })}
      </div>
      {keyFor && <KeyModal name={keyFor.keyName!} label={keyFor.name + ' API key'} onClose={() => setKeyFor(null)} onSaved={has => { keys.refresh(); toast((has ? 'Saved key for ' : 'Removed key for ') + keyFor.name); }} />}
    </>
  );
}

export function Settings({ hub, onClose }: { hub: Hub; onClose: () => void }) {
  const { settings, updSettings } = hub;
  const [keyFor, setKeyFor] = useState<AgentId | null>(null);
  const [version, setVersion] = useState('');
  const keys = useKeyStatus(ORDER.map(a => AGENT_KEY[a].key));
  const upd = useUpdate();
  const [notes, setNotes] = useState(false);
  useEffect(() => { void currentVersion().then(setVersion); }, []);
  const mobile = platform === 'android';

  return (
    <Modal width={560} onClose={onClose} gap={22}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Settings</h2>
        <button className="x" style={{ fontSize: 18, color: 'var(--muted)' }} onClick={onClose}>×</button>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Appearance</div>
        <div className="row" style={{ gap: 6 }}>
          {(['light', 'dark'] as const).map(t => <button key={t} className={'pill' + (settings.theme === t ? ' on' : '')} style={{ flex: 1, borderRadius: 10, padding: 10, fontSize: 13 }} onClick={() => updSettings(s => ({ ...s, theme: t }))}>{t === 'light' ? 'Light' : 'Dark'}</button>)}
        </div>
      </div>
      {!mobile && (
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Developer mode</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Shows the Dev tab with every piece of code written per game.</div>
          </div>
          <Switch on={settings.devMode} onClick={() => updSettings(s => ({ ...s, devMode: !s.devMode }))} />
        </div>
      )}
      <AgentSettings hub={hub} keys={keys.has} onAddKey={setKeyFor} />
      <SyncSettings hub={hub} />
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Updates</div>
        <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12, background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '10px 12px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Mosslight {version}</div>
            <div style={{ fontSize: 12, color: upd.update ? 'var(--accent)' : 'var(--muted)', marginTop: 2 }}>{upd.update ? `Version ${upd.update.version} is ready` : upd.status || 'Updates install over this version — no uninstall needed.'}</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => void openExternal(releasesUrl)}>Release notes</button>
            {upd.update ? <button className="btn-accent" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => { upd.setStatus('Updating…'); void upd.update!.install(); }}>Update now</button>
              : <button className="btn-accent" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => void upd.check(true)}>Check now</button>}
          </div>
        </div>
        {upd.update?.notes && <button className="link" style={{ marginTop: 8 }} onClick={() => setNotes(!notes)}>{notes ? 'Hide' : 'Show'} what's new in {upd.update.version}</button>}
        {notes && upd.update && <RichText text={upd.update.notes} style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }} />}
      </div>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12, background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '10px 12px' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{mobile ? 'Desktop app' : 'Android companion'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{mobile ? 'Windows and macOS builds are on the releases page.' : 'Install the APK from the releases page, then use Pair a phone above.'}</div>
        </div>
        <button className="btn-accent" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => void openExternal(releasesUrl)}>Download</button>
      </div>
      {keyFor && <KeyModal name={AGENT_KEY[keyFor].key} label={AGENT_KEY[keyFor].label} url={AGENT_KEY[keyFor].url} onClose={() => setKeyFor(null)} onSaved={() => keys.refresh()} />}
    </Modal>
  );
}
