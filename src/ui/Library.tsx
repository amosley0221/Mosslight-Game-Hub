import { useState } from 'react';
import { AGENTS, ENGINES, ORDER, PLAT_LABEL, TAGS, engineName } from '../core/constants';
import { totalUsage, type Hub } from '../core/store';
import type { Build, Project } from '../core/types';
import { pct } from '../core/util';
import { isDesktop } from '../platform';
import { Dot, ImageSlot, Modal, asset, coverOf } from './common';

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

export function Library({ hub, onNew, onSettings }: { hub: Hub; onNew: () => void; onSettings: () => void }) {
  const { data } = hub;
  const builds = data.projects.reduce((n, p) => n + p.builds.length, 0);
  return (
    <>
      <div className="row wrap" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <img src={asset('mosslight-wordmark.png')} alt="Mosslight" style={{ height: 52, width: 'auto', display: 'block' }} />
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase', margin: '6px 0 0 6px' }}>Game Hub</div>
          <p className="sub">{data.projects.length} projects · {builds} test builds ready</p>
        </div>
        <div className="row">
          {isDesktop && <button className="btn" onClick={() => void hub.openFolder()}>Open local folder</button>}
          <button className="btn-accent" onClick={onNew}>New project</button>
        </div>
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
            <button className="btn" onClick={onSettings}>Open Settings</button>
          </div>
        </section>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {data.projects.map(p => {
          const t = tileInfo(p);
          return (
            <div key={p.id} className="card hover-line rise" style={{ borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', aspectRatio: '16/10', background: 'var(--well)' }}>
                <ImageSlot src={coverOf(p)} placeholder="Drop cover art" onFile={f => void hub.setCoverImage(p.id, f)} />
                <div className="row wrap" style={{ position: 'absolute', top: 10, left: 10, right: 60, gap: 6, pointerEvents: 'none' }}>
                  {p.engines.map(e => <span key={e} className="mono" style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, background: 'var(--chip-bg)', border: '1px solid var(--line-2)', color: 'var(--chip-text)' }}>{engineName(e)}</span>)}
                  {p.platforms.map(e => <span key={e} style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, background: 'var(--chip-bg)', border: '1px solid var(--line-2)', color: 'var(--chip-text)', opacity: .85 }}>{PLAT_LABEL[e]}</span>)}
                </div>
                {p.folder && <span className="mono" style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, padding: '3px 7px', borderRadius: 6, background: 'var(--chip-bg)', border: '1px solid var(--line-2)', color: 'var(--accent)', pointerEvents: 'none' }}>local</span>}
              </div>
              <button className="tile-body" onClick={() => hub.patchUi({ view: 'project', pid: p.id, tab: 'overview' })}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', width: '100%', gap: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{t.done}/{t.total}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4 }}>{p.tagline}</span>
                <span className="mono ellipsis" style={{ fontSize: 10, color: 'var(--dim)', maxWidth: '100%' }}>{t.stackLine}</span>
                <div className="bar" style={{ height: 4, width: '100%' }}><div style={{ height: '100%', width: t.progressPct, background: 'var(--green)' }} /></div>
                <div className="row" style={{ fontSize: 12, color: 'var(--text-2)', width: '100%', minWidth: 0 }}>
                  <Dot color={t.next ? AGENTS[t.next.agent].color : 'var(--dim)'} />
                  <span className="ellipsis">{t.nextLabel}</span>
                </div>
              </button>
              {p.builds.length > 0 && (
                <div className="row wrap" style={{ gap: 6, padding: '0 16px 14px' }}>
                  {p.builds.slice(0, 2).map(b => <BuildButton key={b.id} b={b} hub={hub} p={p} />)}
                </div>
              )}
            </div>
          );
        })}
        <button onClick={onNew} style={{ minHeight: 260, border: '1px dashed var(--line-3)', borderRadius: 16, background: 'transparent', color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>+ New project</button>
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
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" style={{ background: 'none', color: 'var(--text-2)' }} onClick={onClose}>Cancel</button>
        <button className="btn-accent" style={{ padding: '9px 14px' }} onClick={() => { if (hub.createProject(nf)) onClose(); }}>Create</button>
      </div>
    </Modal>
  );
}
