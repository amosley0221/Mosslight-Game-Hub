import { useEffect, useState } from 'react';
import type { Hub } from '../core/store';
import type { Project, StoryEntry, StorySection } from '../core/types';
import { isDesktop, pickFolder } from '../platform';
import { useImageSrc } from '../sync/images';
import { Modal } from './common';
import { ImagePicker } from './Media';
import { GuidesTab } from './Media';

const SUGGESTED = ['Characters', 'Maps', 'Locations', 'Vehicles', 'Factions'];

function Pic({ src, alt, height = 150, fit = 'cover' }: { src: string; alt: string; height?: number; fit?: 'cover' | 'contain' }) {
  const url = useImageSrc(src);
  return <div style={{ position: 'relative', height, borderRadius: 10, overflow: 'hidden', background: 'var(--well)' }}>{url && <img src={url} alt={alt} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit }} />}</div>;
}

/** One character / map / location: pictures, a name and notes. */
function EntryView({ hub, p, section, entry, onClose }: { hub: Hub; p: Project; section: StorySection; entry: StoryEntry; onClose: () => void }) {
  const [name, setName] = useState(entry.name);
  const [body, setBody] = useState(entry.body || '');
  const [picking, setPicking] = useState(false);
  const [big, setBig] = useState<string | null>(null);
  useEffect(() => { setName(entry.name); setBody(entry.body || ''); }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => hub.updEntry(p.id, section.id, entry.id, { name: name.trim() || entry.name, body });
  const cover = entry.cover || entry.images[0];
  return (
    <Modal width={760} onClose={() => { save(); onClose(); }} gap={14}>
      <div className="row" style={{ gap: 10 }}>
        <input value={name} onChange={e => setName(e.target.value)} onBlur={save} placeholder="Name" style={{ flex: 1, background: 'none', border: 0, fontSize: 22, fontWeight: 600, padding: 0, minWidth: 0 }} />
        <button className="btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--line-3)' }} onClick={() => { hub.removeEntry(p.id, section.id, entry.id); onClose(); }}>Delete</button>
        <button className="x" style={{ fontSize: 20 }} onClick={() => { save(); onClose(); }}>×</button>
      </div>
      {cover && <Pic src={cover} alt={entry.name} height={300} fit="contain" />}
      <div className="row wrap" style={{ gap: 8 }}>
        {entry.images.map(src => (
          <div key={src} style={{ position: 'relative', width: 96 }}>
            <button onClick={() => setBig(src)} style={{ padding: 0, border: 0, background: 'none', width: '100%' }}><Pic src={src} alt="" height={70} /></button>
            <div className="row" style={{ gap: 2, marginTop: 2 }}>
              <button className="link" style={{ fontSize: 10, color: cover === src ? 'var(--accent)' : 'var(--muted)' }} onClick={() => hub.updEntry(p.id, section.id, entry.id, { cover: src })}>{cover === src ? 'main' : 'set main'}</button>
              <button className="x" style={{ marginLeft: 'auto', fontSize: 13 }} onClick={() => hub.updEntry(p.id, section.id, entry.id, { images: entry.images.filter(x => x !== src), cover: entry.cover === src ? undefined : entry.cover })}>×</button>
            </div>
          </div>
        ))}
        <button className="btn" style={{ height: 70, fontSize: 12 }} onClick={() => setPicking(true)}>+ Add pictures</button>
      </div>
      {hub.sharing && <span style={{ fontSize: 11, color: 'var(--accent)' }}>Copying to your devices… {hub.sharing.done}/{hub.sharing.total}</span>}
      <textarea value={body} onChange={e => setBody(e.target.value)} onBlur={save} rows={8} placeholder={`Who or what is this? Anything worth remembering about ${name || 'it'}.`} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.6, resize: 'vertical', color: 'var(--text-2)' }} />
      {picking && <ImagePicker p={p} title={`Pictures for ${name || 'this entry'}`} onPick={srcs => void hub.addEntryImages(p.id, section.id, entry.id, srcs)} onClose={() => setPicking(false)} />}
      {big && (
        <div className="scrim" onClick={() => setBig(null)} style={{ zIndex: 45 }}>
          <Pic src={big} alt="" height={window.innerHeight * 0.8} fit="contain" />
        </div>
      )}
    </Modal>
  );
}

function SectionView({ hub, p, s }: { hub: Hub; p: Project; s: StorySection }) {
  const [title, setTitle] = useState(s.title);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  useEffect(() => setTitle(s.title), [s.title]);
  const entry = s.entries.find(e => e.id === open);
  const add = () => {
    const n = adding.trim();
    if (!n) return;
    setOpen(hub.addEntry(p.id, s.id, n));
    setAdding('');
  };
  return (
    <section className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title.trim() && title !== s.title && hub.renameSection(p.id, s.id, title.trim())} style={{ background: 'none', border: 0, fontSize: 16, fontWeight: 600, padding: 0, minWidth: 0 }} />
        <div className="row wrap" style={{ gap: 6 }}>
          {isDesktop && (
            <button className="btn-ghost" disabled={busy} onClick={() => void run(() => hub.autoImportEntries(p.id, s.title))}>Build from project</button>
          )}
          {isDesktop && (
            <button className="btn-ghost" disabled={busy} title={`Pick a folder that holds one folder per ${s.title.replace(/s$/, '').toLowerCase()}`} onClick={() => void run(async () => {
              const dir = await pickFolder();
              if (dir) await hub.importEntries(p.id, s.title, dir);
            })}>Import from folder…</button>
          )}
          {s.entries.some(e => !e.body?.trim()) && (
            <button className="btn-ghost" disabled={busy} onClick={() => void run(() => hub.draftEntries(p.id, s.id))}>{busy ? 'Writing…' : 'Write the missing notes'}</button>
          )}
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{s.entries.length}</span>
          <button className="x" title={`Remove the ${s.title} section`} onClick={() => hub.removeSection(p.id, s.id)}>×</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {s.entries.map(e => (
          <button key={e.id} className="card hover-line" style={{ padding: 0, overflow: 'hidden', textAlign: 'left', background: 'var(--surface)' }} onClick={() => setOpen(e.id)}>
            {e.cover || e.images[0]
              ? <Pic src={e.cover || e.images[0]} alt={e.name} height={150} />
              : <div style={{ height: 150, display: 'grid', placeItems: 'center', color: 'var(--dim)', fontSize: 11 }}>No picture yet</div>}
            <div style={{ padding: '9px 11px' }}>
              <div className="ellipsis" style={{ fontWeight: 600, fontSize: 13 }}>{e.name}</div>
              {e.body && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.body}</div>}
            </div>
          </button>
        ))}
        <div style={{ border: '1px dashed var(--line-3)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, minHeight: 150 }}>
          <input value={adding} onChange={e => setAdding(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder={s.title.toLowerCase().startsWith('character') ? 'Character name' : 'Name'} style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 12 }} />
          <button className="btn" style={{ fontSize: 12, padding: '7px 10px' }} onClick={add}>Add to {s.title}</button>
        </div>
      </div>
      {entry && <EntryView hub={hub} p={p} section={s} entry={entry} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** Project → Story: the game's story, plus sections for characters, maps and anything else. */
export function StoryTab({ hub, p }: { hub: Hub; p: Project }) {
  const [draft, setDraft] = useState(p.summary || '');
  const [editing, setEditing] = useState(false);
  const [newSection, setNewSection] = useState('');
  const [drafting, setDrafting] = useState(false);
  const sections = p.story || [];
  useEffect(() => { if (!editing) setDraft(p.summary || ''); }, [p.summary, editing]);

  return (
    <>
      <section className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
          <h3 className="eyebrow">The story</h3>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn-ghost" onClick={() => { if (editing) hub.setSummary(p.id, draft); setEditing(!editing); }}>{editing ? 'Save' : p.summary ? 'Edit' : 'Write'}</button>
            <button className="btn-ghost" disabled={drafting} onClick={() => { setDrafting(true); void hub.draftSummary(p.id).finally(() => setDrafting(false)); }}>{drafting ? 'Grok is writing…' : 'Draft with Grok'}</button>
          </div>
        </div>
        {editing
          ? <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={12} placeholder="What is this game about?" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12, fontSize: 13.5, lineHeight: 1.7, resize: 'vertical', color: 'var(--text-2)' }} />
          : <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: p.summary ? 'var(--text-2)' : 'var(--muted)', whiteSpace: 'pre-wrap', maxWidth: '80ch' }}>{p.summary || 'No story yet. Write it here, paste it in, or ask Grok to draft one. Longer documents (a script, a play guide) go under Documents below.'}</p>}
      </section>

      {sections.map(s => <SectionView key={s.id} hub={hub} p={p} s={s} />)}

      <section className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 className="eyebrow" style={{ marginBottom: 10 }}>Add a section</h3>
        <div className="row wrap" style={{ gap: 6 }}>
          {SUGGESTED.filter(t => !sections.some(s => s.title.toLowerCase() === t.toLowerCase())).map(t => (
            <button key={t} className="pill" onClick={() => hub.addSection(p.id, t)}>+ {t}</button>
          ))}
          <input value={newSection} onChange={e => setNewSection(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newSection.trim()) { hub.addSection(p.id, newSection.trim()); setNewSection(''); } }} placeholder="Or name your own…" style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '6px 12px', fontSize: 12, minWidth: 170 }} />
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          Each section holds entries — a character, a map, a location — with their own pictures and notes. Pictures you add here are copied to your other devices{isDesktop ? '' : ' by the computer'}, so they show on your phone too.
        </p>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h3 className="eyebrow" style={{ marginBottom: 12 }}>Documents</h3>
        <GuidesTab hub={hub} p={p} />
      </section>
    </>
  );
}
