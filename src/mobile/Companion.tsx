import { useEffect, useRef, useState, type ReactNode } from 'react';
import { App as CapApp } from '@capacitor/app';
import { AGENTS, PLAT_LABEL, engineName } from '../core/constants';
import type { Hub } from '../core/store';
import { ago } from '../core/util';
import type { Task } from '../core/types';
import { useImageSrc } from '../sync/images';
import { Glyph, ImageSlot, Toast, asset, coverOf } from '../ui/common';
import { ChatIntro, Composer, MessageView } from '../ui/Chat';
import { AddMenu, launchProps, tileInfo } from '../ui/Library';
import { RepoCard, RepoPicker } from '../ui/GitHub';
import { ArtTab } from '../ui/Media';
import { StoryTab } from '../ui/Story';
import { MusicTab, PlayerBar } from '../ui/Music';

const section = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 8 };

/** Landscape (or a tablet): the cover can sit beside the details instead of above them. */
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth > window.innerHeight && window.innerWidth >= 640);
  useEffect(() => {
    const check = () => setWide(window.innerWidth > window.innerHeight && window.innerWidth >= 640);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);
  return wide;
}

const MOBILE_TABS: [string, string][] = [
  ['overview', 'Overview'], ['tasks', 'Tasks'], ['builds', 'Builds'], ['story', 'Story'],
  ['art', 'Art'], ['music', 'Music'], ['chat', 'Chat'], ['repo', 'GitHub'],
];

/** Same tabs as the desktop project page, sized for a thumb. */
function TabBar({ tab, onPick }: { tab: string; onPick: (t: string) => void }) {
  return (
    <div className="row" style={{ gap: 6, overflowX: 'auto', padding: '2px 0 10px', scrollbarWidth: 'none' }}>
      {MOBILE_TABS.map(([id, label]) => {
        const on = tab === id;
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            style={{ flex: 'none', minHeight: 36, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--line-2)'}`, background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--muted)' }}
          >{label}</button>
        );
      })}
    </div>
  );
}

/** Android companion: Games list + Game detail, same data model and chat as desktop. */
export function Companion({ hub, onSettings, onNew, banner }: { hub: Hub; onSettings: () => void; onNew: () => void; banner?: ReactNode }) {
  const { data, proj, patchUi, ui } = hub;
  const scroller = useRef<HTMLDivElement>(null);
  const [chatEnd, setChatEnd] = useState<HTMLDivElement | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [fromGitHub, setFromGitHub] = useState(false);

  // Hardware back button returns to the games list.
  useEffect(() => {
    const h = CapApp.addListener('backButton', () => { if (hub.ui.view === 'project') patchUi({ view: 'library', pid: null }); else void CapApp.exitApp(); });
    return () => { void h.then(x => x.remove()); };
  }, [hub.ui.view, patchUi]);

  const [shown, setShown] = useState(12);
  // The phone keeps the whole history now; it just renders the tail until you ask for more.
  const all = proj ? data.messages[proj.id] || [] : [];
  const msgs = all.slice(-shown);
  useEffect(() => { if (ui.busy) chatEnd?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [ui.busy, msgs.length, chatEnd]);
  useEffect(() => { scroller.current?.scrollTo(0, 0); }, [proj?.id]);

  const builds = data.projects.reduce((n, p) => n + p.builds.length, 0);
  const wide = useWide();
  const cover = useImageSrc(proj ? coverOf(proj) : undefined);
  const tab = MOBILE_TABS.some(([id]) => id === ui.tab) ? ui.tab : 'overview';
  const taskRow = (x: Task) => (
    <button key={x.id} onClick={() => proj && hub.cycleTask(proj.id, x.id)} className="card row" style={{ gap: 10, textAlign: 'left', borderRadius: 12, padding: '10px 12px', fontSize: 13, minHeight: 44 }}>
      <Glyph agent={x.agent} size={20} />
      <span style={{ flex: 1, lineHeight: 1.35, textDecoration: x.status === 'done' ? 'line-through' : 'none', color: x.status === 'done' ? 'var(--muted)' : 'inherit' }}>{x.title}</span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{x.status}</span>
    </button>
  );

  return (
    <div data-theme={hub.settings.theme} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {banner}
      {!proj ? (
        <>
          <div style={{ padding: '18px 18px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <img src={asset('mosslight-wordmark.png')} alt="Mosslight" style={{ height: 34, width: 'auto', display: 'block' }} />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{data.projects.length} projects · {builds} test builds ready</div>
            </div>
            <div className="row">
            <AddMenu compact onNew={onNew} onGitHub={() => setFromGitHub(true)} />
            <button onClick={onSettings} aria-label="Settings" style={{ background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 999, width: 40, height: 40, fontSize: 16, color: 'var(--text-2)' }}>⚙</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '6px 14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.projects.map(p => {
              const t = tileInfo(p);
              return (
                <div key={p.id} className="card rise" style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', gap: 12 }}>
                    <div style={{ position: 'relative', width: 96, height: 96, alignSelf: 'start', background: 'var(--well)' }}><ImageSlot compact src={coverOf(p)} placeholder="Cover" onOpen={() => patchUi({ view: 'project', pid: p.id })} /></div>
                    <button onClick={() => patchUi({ view: 'project', pid: p.id })} style={{ padding: '12px 12px 12px 0', display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, textAlign: 'left', background: 'none', border: 0 }}>
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}><span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span><span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{t.done}/{t.total}</span></div>
                      <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.tagline}</span>
                      <div className="row wrap" style={{ gap: 4 }}>
                        {p.engines.map(e => <span key={e} className="mono" style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, background: 'var(--well)', border: '1px solid var(--line-2)' }}>{engineName(e)}</span>)}
                        {p.platforms.map(e => <span key={e} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, border: '1px solid var(--line-2)', color: 'var(--text-2)' }}>{PLAT_LABEL[e]}</span>)}
                      </div>
                    </button>
                  </div>
                  {p.builds.length > 0 && (
                    <div className="row wrap" style={{ gap: 6, padding: '0 12px 12px' }}>
                      {p.builds.slice(0, 2).map(b => (
                        <button key={b.id} className="build-btn" style={{ padding: '7px 10px', minHeight: 32 }} {...launchProps(hub, p, b)}>
                          <span style={{ fontSize: 9, color: 'var(--ag-codex)' }}>▶</span><span className="ellipsis">{b.name}</span><span className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{PLAT_LABEL[b.platform]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!data.projects.length && (
              <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Welcome to Mosslight</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>Your library is empty. Pair this phone with your computer to see your games here, or start a new project.</div>
                <button className="btn-accent" style={{ minHeight: 44 }} onClick={onSettings}>Pair with my computer</button>
                <button className="btn" style={{ minHeight: 44 }} onClick={onNew}>New project</button>
                <button className="btn" style={{ minHeight: 44 }} onClick={() => setFromGitHub(true)}>Open from GitHub</button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: wide ? 'grid' : 'block', gridTemplateColumns: wide ? 'minmax(260px, 40%) minmax(0, 1fr)' : undefined, overflow: wide ? 'hidden' : 'auto' }} ref={wide ? undefined : scroller}>
          {/* Landscape shows the whole cover beside the details; portrait keeps it as a banner. */}
          <div style={{ position: 'relative', background: 'var(--well)', flex: 'none', ...(wide ? { height: '100%', overflow: 'hidden' } : { aspectRatio: '16/10' }) }}>
            {wide && cover
              ? <img src={cover} alt={proj.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              : <ImageSlot src={coverOf(proj)} placeholder="Tap to add cover art" hint="Tap to change cover" onFile={f => void hub.setCoverImage(proj.id, f)} />}
            <button onClick={() => patchUi({ view: 'library', pid: null })} style={{ position: 'absolute', top: 12, left: 12, background: 'var(--chip-bg)', border: '1px solid var(--line-2)', color: 'var(--chip-text)', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 600, minHeight: 32 }}>← Games</button>
          </div>
          <div ref={wide ? scroller : undefined} style={{ padding: wide ? '14px 18px 24px' : '16px 18px 24px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflow: wide ? 'auto' : undefined }}>
            <div>
              <div style={{ fontSize: wide ? 22 : 24, fontWeight: 600, letterSpacing: '-.02em' }}>{proj.name}</div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>{proj.tagline}</p>
            </div>
            <div>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}><span>Progress</span><span className="mono">{tileInfo(proj).done}/{proj.tasks.length}</span></div>
              <div className="bar" style={{ height: 6, borderRadius: 3 }}>{tileInfo(proj).shares.map(s => <div key={s.a} style={{ height: '100%', width: s.pct, background: AGENTS[s.a].color }} />)}</div>
            </div>

            <TabBar tab={tab} onPick={t => patchUi({ tab: t })} />

            {tab === 'overview' && (
              <>
                {proj.summary && (
                  <section>
                    <div style={section}>Story</div>
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{proj.summary.slice(0, 600)}{proj.summary.length > 600 ? '…' : ''}</p>
                  </section>
                )}
                <section>
                  <div style={section}>Stack</div>
                  <div className="row wrap" style={{ gap: 5 }}>
                    {proj.engines.map(e => <span key={e} className="mono" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'var(--well)', border: '1px solid var(--line-2)' }}>{engineName(e)}</span>)}
                    {proj.stack.languages.map(e => <span key={e} className="mono" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line-2)', color: 'var(--text-2)' }}>{e}</span>)}
                    {proj.stack.libraries.map(e => <span key={e} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line-2)', color: 'var(--text-2)' }}>{e}</span>)}
                  </div>
                </section>
                <section>
                  <div style={section}>Up next</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {proj.tasks.filter(x => x.status !== 'done').sort((a, b) => (a.status === 'doing' ? 0 : 1) - (b.status === 'doing' ? 0 : 1)).slice(0, 5).map(taskRow)}
                    {!proj.tasks.some(x => x.status !== 'done') && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Nothing open — every task is done.</p>}
                  </div>
                </section>
                <section style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                  {confirmRemove === proj.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 13 }}>Remove <b>{proj.name}</b> from the library on all your devices? Files on your computers aren't touched.</span>
                      <div className="row">
                        <button onClick={() => { hub.removeProject(proj.id); setConfirmRemove(null); }} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 0, background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 13 }}>Remove</button>
                        <button onClick={() => setConfirmRemove(null)} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid var(--line-3)', background: 'none', fontWeight: 600, fontSize: 13 }}>Keep</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRemove(proj.id)} style={{ width: '100%', minHeight: 44, borderRadius: 12, border: '1px solid var(--line-3)', background: 'none', color: 'var(--muted)', fontWeight: 600, fontSize: 13 }}>Remove project</button>
                  )}
                </section>
              </>
            )}

            {tab === 'tasks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {proj.tasks.map(taskRow)}
                {!proj.tasks.length && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No tasks yet — ask an agent in Chat and they'll raise them.</p>}
              </div>
            )}

            {tab === 'builds' && (
              <section>
                <div style={section}>Launch on this device</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {proj.builds.map(b => (
                    <button key={b.id} {...launchProps(hub, proj, b)} className="card" style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 12, alignItems: 'center', textAlign: 'left', padding: 10, minHeight: 60 }}>
                      <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--ag-codex)', display: 'grid', placeItems: 'center', color: 'var(--on-agent)', fontSize: 13, fontWeight: 700 }}>▶</span>
                      <span style={{ minWidth: 0 }}><span className="ellipsis" style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{b.name}</span><span className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{AGENTS[b.by].name} · {ago(b.ts)}</span></span>
                      <span className="mono" style={{ fontSize: 10, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--line-3)', color: 'var(--text-2)' }}>{PLAT_LABEL[b.platform]}</span>
                    </button>
                  ))}
                  {!proj.builds.length && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No builds yet. Ask Codex for an Android build.</p>}
                </div>
                <button onClick={() => hub.ask(`Build an Android APK of ${proj.name} and publish it somewhere my phone can download it.`, 'codex')} style={{ marginTop: 8, width: '100%', background: 'none', border: '1px dashed var(--line-3)', color: 'var(--accent)', borderRadius: 12, padding: 11, fontSize: 12, fontWeight: 600, minHeight: 44 }}>Ask Codex for an Android build</button>
              </section>
            )}

            {tab === 'story' && <StoryTab hub={hub} p={proj} />}
            {tab === 'art' && <ArtTab hub={hub} p={proj} />}
            {tab === 'music' && <MusicTab hub={hub} p={proj} />}
            {tab === 'repo' && <RepoCard hub={hub} p={proj} compact />}

            {tab === 'chat' && (
              <section>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
                  {msgs.length === 0 && <ChatIntro compact />}
                  {all.length > msgs.length && <button className="btn" style={{ alignSelf: 'center' }} onClick={() => setShown(n => n + 40)}>Show earlier messages</button>}
                  {msgs.map(m => <MessageView key={m.id} hub={hub} chatKey={proj.id} m={m} compact />)}
                  <div ref={setChatEnd} />
                </div>
                <Composer hub={hub} compact />
              </section>
            )}
          </div>
        </div>
      )}
      {fromGitHub && <RepoPicker title="Open from GitHub" hint="Pick a repo — the agents can read it from this phone." onPick={r => void hub.openFromGitHub(r)} onClose={() => setFromGitHub(false)} />}
      <PlayerBar compact />
      <Toast text={ui.toast} style={{ bottom: 'calc(24px + env(safe-area-inset-bottom))', left: 16, right: 16, transform: 'none', borderRadius: 12, fontSize: 12 }} />
    </div>
  );
}
