import { useEffect, useState } from 'react';
import { AGENTS, ENGINES, ORDER, PLAT_LABEL, TAGS, engineName } from '../core/constants';
import { totalUsage, type Hub } from '../core/store';
import type { Build, Project } from '../core/types';
import { pct } from '../core/util';
import { isDesktop } from '../platform';
import { Dot, Modal, asset, coverOf } from './common';
import { useImageSrc } from '../sync/images';
import { RepoPicker, useGitHubAccount } from './GitHub';

export function Header({ hub, onSettings }: { hub: Hub; onSettings: () => void }) {
  const { ui, data, proj, patchUi } = hub;
  const usage = totalUsage(data);
  const crumb = proj ? proj.name : ui.view === 'integrations' ? 'Integrations' : ui.view === 'assets' ? 'Asset library' : 'Library';
  return (
    <header className="header">
      <button onClick={() => patchUi({ view: 'library', pid: null })} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 0, padding: 0 }}>
        <img src={asset('mosslight-wordmark.png')} alt="Mosslight" style={{ height: 26, width: 'auto', display: 'block', marginLeft: 2 }} />
      </button>
      <span style={{ color: 'var(--dim)' }}>/</span>
      <span className="ellipsis" style={{ fontSize: 13, color: 'var(--text-2)' }}>{crumb}</span>
      <div style={{ flex: 1 }} />
      <div className="row hide-narrow">
        {ORDER.map(a => (
          <div key={a} title={AGENTS[a].role} className="row" style={{ gap: 6, padding: '4px 10px 4px 6px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--panel)', fontSize: 12, color: 'var(--text-2)' }}>
            <span className="glyph" style={{ width: 16, height: 16, background: AGENTS[a].color, fontSize: 9 }}>{AGENTS[a].glyph}</span>{AGENTS[a].name}
            <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{usage[a].calls} calls</span>
          </div>
        ))}
      </div>
      <button className="hbtn" style={{ marginLeft: 6 }} onClick={() => patchUi({ view: 'assets', pid: null })}>Assets</button>
      <button className="hbtn" onClick={() => patchUi({ view: 'integrations', pid: null })}>Integrations</button>
      <button className="hbtn" style={{ marginLeft: 6 }} onClick={() => patchUi(u => ({ chatOpen: !u.chatOpen }))}>{ui.chatOpen ? 'Hide chat' : 'Show chat'}</button>
      <button className="hbtn" title="Settings" onClick={onSettings} style={{ width: 32, height: 32, padding: 0, fontSize: 15, display: 'grid', placeItems: 'center' }}>⚙</button>
    </header>
  );
}

/** Click handler + "can this run here?" dimming for any build launch button. */
export function launchProps(hub: Hub, p: Project, b: Build) {
  const l = hub.launchable(b);
  return { onClick: () => void hub.launch(p, b), title: l.ok ? b.path : l.why, 'data-off': l.ok ? undefined : 'true' };
}

export function BuildButton({ b, hub, p }: { b: Build; hub: Hub; p: Project }) {
  return (
    <button className="build-btn" {...launchProps(hub, p, b)}>
      <span style={{ fontSize: 9 }}>▶</span><span className="ellipsis">{b.name}</span><span className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{PLAT_LABEL[b.platform] || b.kind}</span>
    </button>
  );
}

export function tileInfo(p: Project) {
  const done = p.tasks.filter(t => t.status === 'done').length;
  const next = p.tasks.find(t => t.status === 'doing') || p.tasks.find(t => t.status === 'todo');
  return {
    done, total: p.tasks.length, progressPct: pct(done, p.tasks.length),
    next, nextLabel: next ? `Next · ${AGENTS[next.agent].name}: ${next.title}` : 'All tasks done',
    shares: ORDER.map(a => ({ a, pct: pct(p.tasks.filter(t => t.agent === a && t.status === 'done').length, p.tasks.length) })),
    stackLine: [...p.engines.map(engineName), ...p.stack.libraries].slice(0, 4).join(' · '),
  };
}

/** Round + button that opens the three ways to add a project. */
export function AddMenu({ onNew, onGitHub, onFolder, compact }: { onNew: () => void; onGitHub: () => void; onFolder?: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  const pick = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); fn(); };
  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button className="fab" style={compact ? { width: 40, height: 40, fontSize: 20 } : undefined} title="Add a project" aria-label="Add a project" onClick={() => setOpen(!open)}>+</button>
      {open && (
        <div className="menu">
          <div className="menu-note">Add a project</div>
          <button onClick={pick(onNew)}>New project</button>
          <button onClick={pick(onGitHub)}>Open from GitHub</button>
          {onFolder && <button onClick={pick(onFolder)}>Open local folder</button>}
        </div>
      )}
    </div>
  );
}

/** Library tile: the game's art fills it; details rise over the art on hover. */
function Tile({ hub, p }: { hub: Hub; p: Project }) {
  const t = tileInfo(p);
  const cover = useImageSrc(coverOf(p));
  const open = () => hub.patchUi({ view: 'project', pid: p.id, tab: 'overview' });
  const featured = p.builds.find(b => b.id === p.featuredBuild) || p.builds[0];
  return (
    <div
      className="tile rise"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) void hub.setCoverImage(p.id, f); }}
    >
      {cover
        ? <img className="tile-art" src={cover} alt={p.name} draggable={false} />
        : <div className="tile-empty">Drop cover art here<br /><span style={{ fontSize: 11 }}>or add one inside the project</span></div>}
      <button className="tile-open" onClick={open} aria-label={`Open ${p.name}`} />
      <div className="tile-shade" />
      <div className="tile-chips">
        {p.engines.map(e => <span key={e} className="mono" style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, background: 'var(--chip-bg)', border: '1px solid var(--line-2)', color: 'var(--chip-text)' }}>{engineName(e)}</span>)}
        {p.platforms.map(e => <span key={e} style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, background: 'var(--chip-bg)', border: '1px solid var(--line-2)', color: 'var(--chip-text)', opacity: .85 }}>{PLAT_LABEL[e]}</span>)}
        {p.folder && <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 7px', borderRadius: 6, background: 'var(--chip-bg)', border: '1px solid var(--line-2)', color: 'var(--accent)' }}>local</span>}
      </div>
      <div className="tile-info">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 17, textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{p.name}</span>
          <span className="mono" style={{ fontSize: 11, opacity: .8 }}>{t.done}/{t.total}</span>
        </div>
        <div className="bar" style={{ height: 4, width: '100%', background: 'rgba(255,255,255,.22)' }}><div style={{ height: '100%', width: t.progressPct, background: 'var(--green)' }} /></div>
        <div className="tile-extra">
          <span style={{ fontSize: 12, lineHeight: 1.45, opacity: .85, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.summary?.trim() || p.tagline}</span>
          {t.next && <span className="row ellipsis" style={{ fontSize: 11, opacity: .85 }}><Dot color={AGENTS[t.next.agent].color} />{t.nextLabel}</span>}
          {featured && (
            <div className="row wrap" style={{ gap: 6 }}>
              <BuildButton b={featured} hub={hub} p={p} />
              {p.builds.length > 1 && <button onClick={open} className="build-btn" style={{ pointerEvents: 'auto' }}>+{p.builds.length - 1} more</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Library({ hub, onNew, onSettings }: { hub: Hub; onNew: () => void; onSettings: () => void }) {
  const { data } = hub;
  const [fromGitHub, setFromGitHub] = useState(false);
  const gh = useGitHubAccount();
  const openGitHub = () => (gh.state === 'ok' ? setFromGitHub(true) : (hub.toast('Connect GitHub in Settings first'), onSettings()));
  const builds = data.projects.reduce((n, p) => n + p.builds.length, 0);
  return (
    <>
      <div className="row wrap" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <img src={asset('mosslight-wordmark.png')} alt="Mosslight" style={{ height: 52, width: 'auto', display: 'block' }} />
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase', margin: '6px 0 0 6px' }}>Game Hub</div>
          <p className="sub">{data.projects.length} projects · {builds} test builds ready</p>
        </div>
        <AddMenu onNew={onNew} onGitHub={openGitHub} onFolder={isDesktop ? () => void hub.openFolder() : undefined} />
      </div>
      {data.projects.length === 0 && (
        <section className="card rise" style={{ padding: 22, marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Welcome to Mosslight</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
            Your library is empty. Start a <b>New project</b>{isDesktop ? <>, or <b>Open local folder</b> to import an existing Unreal, Unity, Godot or web game</> : null}.
            Then open <b>⚙ Settings</b> to turn on sync (so your other devices see the same library) and connect Grok, Claude and Codex.
          </p>
          <div className="row wrap">
            <button className="btn-accent" onClick={onNew}>New project</button>
            {isDesktop && <button className="btn" onClick={() => void hub.openFolder()}>Open local folder</button>}
            <button className="btn" onClick={openGitHub}>Open from GitHub</button>
            <button className="btn" onClick={onSettings}>Open Settings</button>
          </div>
        </section>
      )}
      {fromGitHub && <RepoPicker title="Open a project from GitHub" hint={isDesktop ? "Pick a repo — it's cloned into a folder you choose, and backups push back to it." : 'Pick a repo — the agents can read it from this phone.'} onPick={r => void hub.openFromGitHub(r)} onClose={() => setFromGitHub(false)} />}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
        {data.projects.map(p => <Tile key={p.id} hub={hub} p={p} />)}
      </div>
    </>
  );
}

export const recommend = (tags: string[]) => ENGINES.map(e => { const m = e.tags.filter(t => tags.includes(t)); return { e, score: m.length, reason: m.length ? 'fits ' + m.join(', ') : '' }; }).sort((a, b) => b.score - a.score);

export function TagPicks({ tags, onToggle }: { tags: string[]; onToggle: (t: string) => void }) {
  return <div className="row wrap" style={{ gap: 6 }}>{TAGS.map(t => <button key={t} className={'pill' + (tags.includes(t) ? ' on' : '')} onClick={() => onToggle(t)}>{t}</button>)}</div>;
}

export function NewProject({ hub, onClose }: { hub: Hub; onClose: () => void }) {
  const [nf, setNf] = useState({ name: '', tagline: '', tags: [] as string[], engines: [] as string[] });
  const gh = useGitHubAccount();
  const [github, setGithub] = useState(true);
  const [brand, setBrand] = useState(true);
  const toggle = (k: 'tags' | 'engines', v: string) => setNf(s => ({ ...s, [k]: s[k].includes(v) ? s[k].filter(x => x !== v) : [...s[k], v] }));
  const rec = recommend(nf.tags);
  return (
    <Modal width={600} onClose={onClose}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>New project</h2>
      <input autoFocus className="input" value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} placeholder="Project name" style={{ fontSize: 14, fontWeight: 600 }} />
      <input className="input" value={nf.tagline} onChange={e => setNf({ ...nf, tagline: e.target.value })} placeholder="One-line pitch (Grok can refine it later)" />
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>Traits</div>
        <TagPicks tags={nf.tags} onToggle={t => toggle('tags', t)} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>Engines <span style={{ color: 'var(--dim)', fontWeight: 500 }}>— ★ suggested for these traits, pick any number</span></div>
        <div className="row wrap" style={{ gap: 6 }}>
          {rec.map(({ e, score }) => {
            const on = nf.engines.includes(e.id), star = score > 0 && nf.tags.length > 0;
            return <button key={e.id} className={'pill' + (on ? ' on' : '')} style={{ borderRadius: 8, color: on ? undefined : star ? 'inherit' : undefined }} onClick={() => toggle('engines', e.id)}>{star ? '★ ' : ''}{e.name}</button>;
          })}
        </div>
      </div>
      <label className="row" style={{ gap: 10, fontSize: 13, cursor: gh.state === 'ok' ? 'pointer' : 'default', color: gh.state === 'ok' ? 'inherit' : 'var(--muted)' }}>
        <input type="checkbox" disabled={gh.state !== 'ok'} checked={gh.state === 'ok' && github} onChange={e => setGithub(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
        <span>
          Create a private GitHub repo{gh.state === 'ok' ? ` on @${gh.login}` : ''}
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>
            {gh.state !== 'ok' ? 'Connect GitHub in ⚙ Settings to enable this.' : isDesktop ? 'Also makes a folder in ~/Mosslight/Projects that the agents work in and backups push from.' : 'Agents can read it from any device; clone it on your computer to work locally.'}
          </span>
        </span>
      </label>
      <label className="row" style={{ gap: 10, fontSize: 13, cursor: isDesktop ? 'pointer' : 'default', color: isDesktop ? 'inherit' : 'var(--muted)' }}>
        <input type="checkbox" disabled={!isDesktop} checked={isDesktop && brand} onChange={e => setBrand(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
        <span>
          Add the Mosslight loading screen
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>
            {isDesktop ? 'Puts the studio screen (monogram, game title, progress bar, tips) in the game folder, with a task for Codex to wire it into the engine.' : 'Needs a folder on a computer — add it later from the project page.'}
          </span>
        </span>
      </label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" style={{ background: 'none', color: 'var(--text-2)' }} onClick={onClose}>Cancel</button>
        <button className="btn-accent" style={{ padding: '9px 14px' }} onClick={() => void hub.createProject({ ...nf, github: gh.state === 'ok' && github, brand: isDesktop && brand }).then(ok => { if (ok) onClose(); })}>Create</button>
      </div>
    </Modal>
  );
}
