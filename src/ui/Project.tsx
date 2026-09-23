import { useState, type ReactNode } from 'react';
import { AGENTS, ASSET_KINDS, ORDER, PLATFORMS, PLAT_LABEL, TOOLS, WEB_ENGINES, engineName } from '../core/constants';
import { totalUsage, type Hub } from '../core/store';
import type { AgentId, Project as P, Task } from '../core/types';
import { A, T, ago, pct, uid, uniq } from '../core/util';
import { copyText, isDesktop } from '../platform';
import { Dot, Glyph, ImageSlot, coverOf } from './common';
import { TagPicks, launchProps, recommend, tileInfo } from './Library';

const ACTIONS: Record<AgentId, string> = { grok: 'var(--ag-grok)', codex: 'var(--ag-codex)', claude: 'var(--ag-claude)' };

function AgentButton({ agent, children, onClick }: { agent: AgentId; children: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ background: ACTIONS[agent], border: 0, color: 'var(--on-agent)', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600 }}>{children}</button>;
}

function TabIntro({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, maxWidth: '62ch' }}>{text}</p>
      {children}
    </div>
  );
}

export function Project({ hub, p }: { hub: Hub; p: P }) {
  const { ui, settings, patchUi } = hub;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const t = tileInfo(p);
  const tabs: [string, string][] = [['overview', 'Overview'], ['tasks', 'Tasks'], ['builds', 'Test builds'], ['art', 'Concept art'], ['gdd', 'GDD'], ['engines', 'Stack'], ...(settings.devMode ? [['dev', 'Dev'] as [string, string]] : []), ['activity', 'Activity'], ['usage', 'Usage']];
  const tab = tabs.some(x => x[0] === ui.tab) ? ui.tab : 'overview';

  return (
    <>
      <div className="project-head" style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', gap: 22, alignItems: 'start', marginBottom: 22 }}>
        <div style={{ position: 'relative', aspectRatio: '16/10', borderRadius: 14, overflow: 'hidden', background: 'var(--well)' }}>
          <ImageSlot src={coverOf(p)} placeholder="Cover art" onFile={f => void hub.setCoverImage(p.id, f)} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 10 }}>
            <h1 className="h1">{p.name}</h1>
            {p.folder && <span className="mono" title={p.folder.path} style={{ fontSize: 11, color: 'var(--accent)', border: '1px solid var(--accent-line)', padding: '2px 8px', borderRadius: 6 }}>📁 {p.folder.name}</span>}
          </div>
          <p style={{ margin: '6px 0 12px', color: 'var(--muted)', fontSize: 14, maxWidth: '60ch' }}>{p.tagline}</p>
          <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
            {p.engines.map(e => <span key={e} className="chip mono" style={{ background: 'var(--well)' }}>{engineName(e)}</span>)}
            {p.platforms.map(e => <span key={e} className="chip" style={{ color: 'var(--text-2)', background: 'var(--well)' }}>{PLAT_LABEL[e]}</span>)}
            {p.tags.map(e => <span key={e} className="chip" style={{ color: 'var(--text-2)' }}>{e}</span>)}
          </div>
          <div className="row wrap" style={{ gap: 14 }}>
            <div style={{ flex: 1, minWidth: 180, maxWidth: 360 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}><span>Progress</span><span className="mono">{t.done}/{t.total}</span></div>
              <div className="bar" style={{ height: 6, borderRadius: 3 }}>{t.shares.map(s => <div key={s.a} style={{ height: '100%', width: s.pct, background: AGENTS[s.a].color }} />)}</div>
            </div>
            {p.builds.map(b => (
              <button key={b.id} {...launchProps(hub, p, b)} className="row" style={{ background: 'var(--ag-codex)', border: 0, color: 'var(--on-agent)', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 600 }}>
                <span style={{ fontSize: 10 }}>▶</span> {PLAT_LABEL[b.platform]} · {b.name}
              </button>
            ))}
            {confirmRemove ? (
              <span className="row wrap" style={{ fontSize: 12 }}>Remove {p.name} from the library on all your devices? Files on disk are not touched.
                <button className="btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => hub.removeProject(p.id)}>Remove</button>
                <button className="btn-ghost" onClick={() => setConfirmRemove(false)}>Keep</button>
              </span>
            ) : <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--muted)' }} onClick={() => setConfirmRemove(true)}>Remove project</button>}
          </div>
        </div>
      </div>

      <nav className="row" style={{ gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 22, overflowX: 'auto' }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => patchUi({ tab: id })} style={{ background: 'none', border: 0, borderBottom: `2px solid ${tab === id ? 'var(--green)' : 'transparent'}`, color: tab === id ? 'inherit' : 'var(--muted)', padding: '10px 12px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</button>
        ))}
      </nav>

      {tab === 'overview' && <Overview hub={hub} p={p} />}
      {tab === 'tasks' && <Tasks hub={hub} p={p} />}
      {tab === 'builds' && <Builds hub={hub} p={p} />}
      {tab === 'art' && <ArtTab hub={hub} p={p} />}
      {tab === 'gdd' && <Gdd hub={hub} p={p} />}
      {tab === 'engines' && <Stack hub={hub} p={p} />}
      {tab === 'dev' && <Dev hub={hub} p={p} />}
      {tab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 720 }}>
          {p.activity.map(a => (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 12, alignItems: 'start', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <Glyph agent={a.agent} size={20} />
              <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)' }}>{a.text}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{ago(a.ts)}</span>
            </div>
          ))}
        </div>
      )}
      {tab === 'usage' && <UsageTab hub={hub} />}
    </>
  );
}

function Overview({ hub, p }: { hub: Hub; p: P }) {
  const upNext = p.tasks.filter(x => x.status !== 'done').sort((a, b) => (a.status === 'doing' ? 0 : 1) - (b.status === 'doing' ? 0 : 1)).slice(0, 5);
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <section className="card" style={{ padding: 18 }}>
        <h3 className="eyebrow" style={{ marginBottom: 14 }}>Up next</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upNext.map(x => (
            <button key={x.id} onClick={() => hub.cycleTask(p.id, x.id)} className="row hover-line" style={{ gap: 10, textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
              <Glyph agent={x.agent} size={22} />
              <span style={{ flex: 1 }}>{x.title}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{x.status}</span>
            </button>
          ))}
          {!upNext.length && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>All tasks done. Ask for the next milestone in chat.</p>}
        </div>
        <button onClick={() => hub.ask(`Given the open tasks on ${p.name}, what should we tackle next and who should own it?`)} style={{ marginTop: 14, width: '100%', background: 'none', border: '1px dashed var(--line-3)', color: 'var(--accent)', borderRadius: 10, padding: 9, fontSize: 12, fontWeight: 600 }}>Ask what to tackle next →</button>
      </section>
      <section className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <h3 className="eyebrow" style={{ marginBottom: 14 }}>By agent</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ORDER.map(a => {
              const mine = p.tasks.filter(x => x.agent === a), done = mine.filter(x => x.status === 'done').length;
              return (
                <div key={a}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span className="row"><Dot color={AGENTS[a].color} />{AGENTS[a].name} <span style={{ color: 'var(--muted)', fontSize: 12 }}>· {AGENTS[a].role}</span></span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{done}/{mine.length}</span>
                  </div>
                  <div className="bar" style={{ height: 4 }}><div style={{ height: '100%', width: pct(done, mine.length), background: AGENTS[a].color }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="eyebrow" style={{ marginBottom: 10 }}>Test builds</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {p.builds.map(b => (
              <div key={b.id} className="row" style={{ gap: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '8px 8px 8px 12px' }}>
                <span className="ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600 }}>{b.name}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{PLAT_LABEL[b.platform]}</span>
                <button {...launchProps(hub, p, b)} style={{ background: 'var(--ag-codex)', border: 0, color: 'var(--on-agent)', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600 }}>▶ Play</button>
              </div>
            ))}
            {!p.builds.length && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No test builds yet — ask Codex to package one.</p>}
          </div>
        </div>
      </section>
      <section className="card" style={{ padding: 18, gridColumn: '1 / -1' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 className="eyebrow">Latest concept art</h3>
          <button className="link" onClick={() => hub.patchUi({ tab: 'art' })}>See all →</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {p.art.slice(0, 4).map(a => (
            <div key={a.id} style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden', background: 'var(--well)' }}>
              <ImageSlot compact src={a.imagePath} placeholder={a.title} onFile={f => void hub.setArtImage(p.id, a.id, f)} />
            </div>
          ))}
          {!p.art.length && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No concept art yet — ask Grok.</p>}
        </div>
      </section>
    </div>
  );
}

function Tasks({ hub, p }: { hub: Hub; p: P }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const add = (a: AgentId) => {
    const title = (drafts[a] || '').trim();
    if (!title) return;
    hub.updProj(p.id, q => ({ ...q, tasks: [...q.tasks, T(a, title, 'todo', 0)], activity: [A(a, 'Task added: ' + title), ...q.activity] }));
    setDrafts(d => ({ ...d, [a]: '' }));
  };
  const row = (x: Task) => {
    const c = AGENTS[x.agent].color, done = x.status === 'done';
    return (
      <div key={x.id} className="row hover-line" style={{ gap: 8, alignItems: 'flex-start', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '10px 10px 10px 12px' }}>
        <button title="Cycle status" onClick={() => hub.cycleTask(p.id, x.id)} style={{ width: 14, height: 14, marginTop: 3, borderRadius: '50%', border: `2px solid ${x.status === 'todo' ? 'var(--dim)' : c}`, background: done ? c : 'transparent', flex: 'none', padding: 0 }} />
        <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4, color: done ? 'var(--muted)' : 'inherit', textDecoration: done ? 'line-through' : 'none' }}>{x.title}</span>
        <button className="x" onClick={() => hub.updProj(p.id, q => ({ ...q, tasks: q.tasks.filter(y => y.id !== x.id) }))}>×</button>
      </div>
    );
  };
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
      {ORDER.map(a => (
        <section key={a} className="card" style={{ borderTop: `3px solid ${AGENTS[a].color}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 300 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{AGENTS[a].name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{AGENTS[a].role}</span>
          </div>
          {p.tasks.filter(x => x.agent === a).map(row)}
          <input className="dashed-input" style={{ marginTop: 'auto' }} value={drafts[a] || ''} onChange={e => setDrafts(d => ({ ...d, [a]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') add(a); }} placeholder="Add task, Enter to save" />
        </section>
      ))}
    </div>
  );
}

function Builds({ hub, p }: { hub: Hub; p: P }) {
  const [draft, setDraft] = useState('');
  return (
    <>
      <TabIntro text={`Shortcuts and packages Codex produces show up here${isDesktop ? ' — new ones in the project folder or on your Desktop are picked up automatically' : ''}. Web builds open in the browser, desktop shortcuts launch through the native shell, Android builds install on a USB/Wi-Fi-connected device via ADB.`}>
        <AgentButton agent="codex" onClick={() => hub.ask(`Package a fresh test build of ${p.name} and put a shortcut on my desktop.`, 'codex')}>Ask Codex for a fresh build</AgentButton>
      </TabIntro>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 820 }}>
        {p.builds.map(b => (
          <div key={b.id} className="card hover-line" style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: 14 }}>
            <button {...launchProps(hub, p, b)} style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--ag-codex)', border: 0, color: 'var(--on-agent)', fontSize: 14, fontWeight: 700 }}>▶</button>
            <div style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
              <div className="mono ellipsis" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{b.path}</div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <span className="mono" style={{ fontSize: 10, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--line-3)', color: 'var(--text-2)' }}>{PLAT_LABEL[b.platform]}</span>
              <span className="hide-narrow" style={{ fontSize: 11, color: AGENTS[b.by].color, fontWeight: 600 }}>{AGENTS[b.by].name} · <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{ago(b.ts)}</span></span>
              <button className="x" style={{ fontSize: 16 }} onClick={() => hub.removeBuild(p.id, b)}>×</button>
            </div>
          </div>
        ))}
        {!p.builds.length && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No builds registered for this project yet.</p>}
        <div className="row" style={{ marginTop: 6 }}>
          <input className="dashed-input mono" style={{ flex: 1, padding: '10px 12px' }} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { hub.addBuild(p.id, draft); setDraft(''); } }} placeholder="Paste a shortcut, APK path or URL, e.g. C:\Users\you\Desktop\MyGame_Test.lnk" />
          <button className="btn" style={{ fontSize: 12 }} onClick={() => { hub.addBuild(p.id, draft); setDraft(''); }}>Add</button>
        </div>
      </div>
    </>
  );
}

function ArtTab({ hub, p }: { hub: Hub; p: P }) {
  return (
    <>
      <TabIntro text="Concept art generated by Grok lands here (and in the project's concept/ folder). Drop your own renders onto any tile to replace it.">
        <AgentButton agent="grok" onClick={() => hub.ask(`Generate three new concept art pieces for ${p.name} exploring a different mood than what we have.`, 'grok')}>Ask Grok for more art</AgentButton>
      </TabIntro>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {p.art.map(a => (
          <figure key={a.id} className="card" style={{ margin: 0, overflow: 'hidden' }}>
            <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--well)' }}><ImageSlot src={a.imagePath} placeholder={a.title} onFile={f => void hub.setArtImage(p.id, a.id, f)} /></div>
            <figcaption style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{a.prompt}</span>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ag-grok)' }}>Grok · {ago(a.ts)}</span>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn-ghost" onClick={() => { hub.updProj(p.id, q => ({ ...q, coverArt: a.id, coverImage: undefined })); hub.toast(a.imagePath ? 'Set as cover' : 'Set as cover — drop an image onto this art to show it'); }}>{p.coverArt === a.id ? '★ Cover' : 'Use as cover'}</button>
                  <button className="x" onClick={() => hub.updProj(p.id, q => ({ ...q, art: q.art.filter(x => x.id !== a.id) }))}>×</button>
                </div>
              </div>
            </figcaption>
          </figure>
        ))}
        {!p.art.length && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No concept art yet.</p>}
      </div>
    </>
  );
}

function Gdd({ hub, p }: { hub: Hub; p: P }) {
  const upd = (id: string, patch: Partial<P['gdd'][number]>) => hub.updProj(p.id, q => ({ ...q, gdd: q.gdd.map(g => (g.id === id ? { ...g, ...patch } : g)) }));
  return (
    <>
      <TabIntro text="Game design document. Edit inline, or ask an agent to draft a section.">
        <button className="btn" style={{ fontSize: 12 }} onClick={() => hub.updProj(p.id, q => ({ ...q, gdd: [...q.gdd, { id: uid(), title: 'New section', agent: 'claude', body: '' }] }))}>+ Section</button>
      </TabIntro>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {p.gdd.map(s => (
          <section key={s.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <input value={s.title} onChange={e => upd(s.id, { title: e.target.value })} style={{ background: 'none', border: 0, fontSize: 15, fontWeight: 600, padding: 0, flex: 1, minWidth: 0 }} />
              <select value={s.agent} onChange={e => upd(s.id, { agent: e.target.value as AgentId })} title="Owner" style={{ background: 'none', border: '1px solid var(--line-3)', borderRadius: 6, fontSize: 11, padding: '3px 4px', color: 'var(--text-2)' }}>
                {ORDER.map(a => <option key={a} value={a} style={{ color: '#111' }}>{AGENTS[a].name}</option>)}
              </select>
              <button className="btn-ghost" style={{ padding: '4px 8px', whiteSpace: 'nowrap' }} disabled={hub.ui.busy} onClick={() => void hub.draftSection(p.id, s.id)}>Draft with {AGENTS[s.agent].name}</button>
              <button className="x" onClick={() => hub.updProj(p.id, q => ({ ...q, gdd: q.gdd.filter(g => g.id !== s.id) }))}>×</button>
            </div>
            <textarea value={s.body} onChange={e => upd(s.id, { body: e.target.value })} placeholder="Write here…" style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.55, minHeight: 160, resize: 'vertical', color: 'var(--text-2)' }} />
          </section>
        ))}
      </div>
    </>
  );
}

function Stack({ hub, p }: { hub: Hub; p: P }) {
  const [lib, setLib] = useState('');
  const rec = recommend(p.tags);
  const linked = hub.data.assets.filter(a => a.usedBy.includes(p.id));
  const tools = TOOLS.filter(x => (x.id === 'unreal' && p.engines.includes('unreal')) || (x.id === 'unity' && p.engines.includes('unity')) || (x.id === 'godot' && p.engines.includes('godot')) || (x.id === 'web' && p.engines.some(e => WEB_ENGINES.includes(e))) || (x.id === 'adb' && p.platforms.includes('android')) || ['blender', 'imagegen', 'git'].includes(x.id));
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h3 className="eyebrow" style={{ marginBottom: 10 }}>Platforms</h3>
          <div className="row wrap" style={{ gap: 6 }}>
            {PLATFORMS.map(pl => { const on = p.platforms.includes(pl); return <button key={pl} className={'pill' + (on ? ' on' : '')} onClick={() => hub.updProj(p.id, q => ({ ...q, platforms: on ? q.platforms.filter(x => x !== pl) : [...q.platforms, pl] }))}>{PLAT_LABEL[pl]}</button>; })}
          </div>
          <h3 className="eyebrow" style={{ margin: '18px 0 10px' }}>Traits</h3>
          <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 12 }}>Toggle traits — engine suggestions update below.</p>
          <TagPicks tags={p.tags} onToggle={tg => hub.updProj(p.id, q => ({ ...q, tags: q.tags.includes(tg) ? q.tags.filter(x => x !== tg) : [...q.tags, tg] }))} />
        </section>
        <section className="card" style={{ padding: 18 }}>
          <h3 className="eyebrow" style={{ marginBottom: 10 }}>Languages</h3>
          <div className="row wrap" style={{ gap: 6, marginBottom: 18 }}>
            {p.stack.languages.map(l => <span key={l} className="chip mono" style={{ background: 'var(--well)' }}>{l}</span>)}
            {!p.stack.languages.length && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Detected when you open the project folder.</span>}
          </div>
          <h3 className="eyebrow" style={{ marginBottom: 10 }}>Libraries & plugins</h3>
          <div className="row wrap" style={{ gap: 6 }}>
            {p.stack.libraries.map(l => (
              <span key={l} className="row" style={{ gap: 6, fontSize: 12, padding: '4px 6px 4px 10px', borderRadius: 6, border: '1px solid var(--line-2)', background: 'var(--surface)' }}>{l}
                <button className="x" style={{ fontSize: 13 }} onClick={() => hub.updProj(p.id, q => ({ ...q, stack: { ...q.stack, libraries: q.stack.libraries.filter(x => x !== l) } }))}>×</button>
              </span>
            ))}
            {!p.stack.libraries.length && <span style={{ fontSize: 12, color: 'var(--muted)' }}>None detected yet — open the project folder or add below.</span>}
          </div>
          <input className="dashed-input" style={{ marginTop: 10, width: '100%' }} value={lib} onChange={e => setLib(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && lib.trim()) { const v = lib.trim(); hub.updProj(p.id, q => ({ ...q, stack: { ...q.stack, libraries: uniq([...q.stack.libraries, v]) } })); setLib(''); } }} placeholder="Add a library, Enter to save" />
          {p.stack.tools.length > 0 && (
            <>
              <h3 className="eyebrow" style={{ margin: '18px 0 10px' }}>Tools</h3>
              <div className="row wrap" style={{ gap: 6 }}>{p.stack.tools.map(l => <span key={l} className="chip" style={{ color: 'var(--text-2)' }}>{l}</span>)}</div>
            </>
          )}
        </section>
      </div>
      <section className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><h3 className="eyebrow">Assets from the library</h3><button className="link" onClick={() => hub.patchUi({ view: 'assets', pid: null })}>Open asset library →</button></div>
        <div className="row wrap" style={{ gap: 6 }}>
          {linked.map(a => (
            <span key={a.id} className="row" style={{ gap: 8, fontSize: 12, padding: '5px 6px 5px 10px', borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--surface)' }}>
              <span className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{ASSET_KINDS[a.kind]}</span>{a.name}
              <button className="x" style={{ fontSize: 13 }} onClick={() => void hub.toggleAssetLink(a, p)}>×</button>
            </span>
          ))}
          {!linked.length && <span style={{ fontSize: 12, color: 'var(--muted)' }}>No shared assets linked. Pick a project on any asset card in the library.</span>}
        </div>
      </section>
      <section className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><h3 className="eyebrow">Tools wired to this project</h3><button className="link" onClick={() => hub.patchUi({ view: 'integrations', pid: null })}>Manage integrations →</button></div>
        <div className="row wrap" style={{ gap: 6 }}>
          {tools.map(x => <span key={x.id} className="row" style={{ gap: 6, fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--surface)' }}><Dot size={6} color={x.depth === 'deep' ? 'var(--green)' : 'var(--accent)'} />{x.name}</span>)}
        </div>
      </section>
      <h3 className="eyebrow" style={{ marginBottom: 12 }}>Engines & frameworks</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {rec.map(({ e, score, reason }) => {
          const on = p.engines.includes(e.id), recd = score > 0 && p.tags.length > 0 && score >= Math.max(2, rec[0].score - 1);
          return (
            <button key={e.id} className="card hover-line" onClick={() => hub.updProj(p.id, q => ({ ...q, engines: on ? q.engines.filter(x => x !== e.id) : [...q.engines, e.id], activity: [A('claude', (on ? 'Removed engine ' : 'Added engine ') + e.name), ...q.activity] }))} style={{ textAlign: 'left', borderColor: on ? 'var(--accent)' : 'var(--line-2)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{e.name}</span>
                {(on || recd) && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5, background: on ? 'var(--accent)' : 'var(--accent-soft)', color: on ? 'var(--on-accent)' : 'var(--accent)' }}>{on ? 'IN USE' : 'SUGGESTED'}</span>}
              </div>
              <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{e.lang}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>{e.blurb}</span>
              <div className="row wrap" style={{ gap: 4 }}>{e.tags.map(tg => <span key={tg} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid var(--line-2)', color: 'var(--text-2)' }}>{tg}</span>)}</div>
              {recd && !on && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>★ Suggested — {reason}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Dev({ hub, p }: { hub: Hub; p: P }) {
  const [filter, setFilter] = useState<AgentId | null>(null);
  return (
    <>
      <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          {[null, ...ORDER].map(a => { const on = filter === a, col = a ? AGENTS[a].color : 'var(--accent)'; return <button key={a || 'all'} onClick={() => setFilter(a)} style={{ borderRadius: 999, padding: '4px 11px', fontSize: 11, fontWeight: 600, border: `1px solid ${on ? col : 'var(--line-3)'}`, background: on ? 'var(--accent-soft)' : 'transparent', color: on ? col : 'var(--muted)' }}>{a ? AGENTS[a].name : 'All'}</button>; })}
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>{p.code.length} entries</span>
        </div>
        <AgentButton agent="claude" onClick={() => hub.ask(`Show me the code for the core mechanic of ${p.name} and explain the key function.`, 'claude')}>Ask Claude to walk through the code</AgentButton>
      </div>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 13, maxWidth: '70ch' }}>Every piece of code an agent writes for this game is logged here with the file it belongs to. Fenced code in agent replies is captured automatically.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 960 }}>
        {p.code.filter(k => !filter || k.agent === filter).map(k => (
          <section key={k.id} className="card" style={{ overflow: 'hidden' }}>
            <div className="row" style={{ gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
              <Dot color={AGENTS[k.agent].color} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{k.title}</span>
              <span className="mono ellipsis" style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>{[k.file, k.lang].filter(Boolean).join(' · ')}</span>
              <span style={{ fontSize: 11, color: AGENTS[k.agent].color, fontWeight: 600 }}>{AGENTS[k.agent].name}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>{ago(k.ts)}</span>
              <button className="btn-ghost" onClick={() => void copyText(k.code).then(ok => hub.toast(ok ? 'Copied ' + k.title : 'Couldn\'t copy'))}>Copy</button>
              <button className="x" onClick={() => hub.updProj(p.id, q => ({ ...q, code: q.code.filter(x => x.id !== k.id) }))}>×</button>
            </div>
            <pre style={{ margin: 0, padding: '14px 16px', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55, color: 'var(--text-2)', background: 'var(--surface)', overflow: 'auto', whiteSpace: 'pre' }}>{k.code}</pre>
          </section>
        ))}
        {!p.code.length && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Nothing logged yet. Ask Claude for code in chat and it appears here.</p>}
      </div>
    </>
  );
}

function UsageTab({ hub }: { hub: Hub }) {
  const u = totalUsage(hub.data);
  const total = ORDER.reduce((n, a) => n + u[a].tokens, 0);
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, maxWidth: 900 }}>
        {ORDER.map(a => (
          <section key={a} className="card" style={{ padding: 18 }}>
            <div className="row" style={{ marginBottom: 14 }}><Dot size={10} color={AGENTS[a].color} /><span style={{ fontWeight: 600 }}>{AGENTS[a].name}</span></div>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-.02em' }}>${(u[a].tokens / 1000 * AGENTS[a].rate).toFixed(2)}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 14px' }}>{u[a].calls} calls · {(u[a].tokens / 1000).toFixed(1)}k tokens</div>
            <div className="bar" style={{ height: 4 }}><div style={{ height: '100%', width: pct(u[a].tokens, total), background: AGENTS[a].color }} /></div>
          </section>
        ))}
      </div>
      <p style={{ color: 'var(--dim)', fontSize: 12, marginTop: 16 }}>Token counts come from the provider when available, otherwise they're estimated from message length. Cost is a blended estimate — check each provider's console for exact billing.</p>
    </>
  );
}
