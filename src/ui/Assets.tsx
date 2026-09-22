import { useRef, useState } from 'react';
import { ASSET_KINDS } from '../core/constants';
import type { Hub } from '../core/store';
import type { AssetKind } from '../core/types';
import { isDesktop } from '../platform';
import { ImageSlot } from './common';

const GLYPH: Partial<Record<AssetKind, string>> = { audio: '♪', script: '{ }', shader: '◈', font: 'Aa' };
const VISUAL: AssetKind[] = ['image', 'texture', 'model', 'animation'];

export function Assets({ hub }: { hub: Hub }) {
  const { data } = hub;
  const [filter, setFilter] = useState<AssetKind | null>(null);
  const [q, setQ] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = data.assets.filter(a => (!filter || a.kind === filter) && (!q || (a.name + ' ' + a.tags.join(' ')).toLowerCase().includes(q.toLowerCase())));
  const pick = () => input.current?.click();

  return (
    <>
      <div className="row wrap" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <div>
          <h1 className="h1">Asset library</h1>
          <p className="sub" style={{ maxWidth: '70ch' }}>Animations, models, textures, audio, scripts and shaders you upload once and any project — or any agent — can pull in. {data.assets.length} files · shared across all projects{isDesktop ? ' · stored in ~/Mosslight/Library' : ''}.</p>
        </div>
        <button className="btn-accent" onClick={pick}>Upload files</button>
      </div>
      <input ref={input} type="file" multiple hidden onChange={e => { void hub.addAssets(Array.from(e.target.files || [])); e.target.value = ''; }} />
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); void hub.addAssets(Array.from(e.dataTransfer.files || [])); }}
        onClick={pick}
        style={{ border: `1px dashed ${drag ? 'var(--accent)' : 'var(--line-3)'}`, background: drag ? 'var(--accent-soft)' : 'transparent', borderRadius: 14, padding: 22, textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 18, cursor: 'pointer', transition: 'background .15s' }}
      >Drop files here — .fbx .glb .blend .png .wav .cs .gd .hlsl … — or click to browse. Kind is detected from the file; duplicates are skipped.</div>
      <div className="row wrap" style={{ gap: 10, marginBottom: 16 }}>
        {([null, ...Object.keys(ASSET_KINDS)] as (AssetKind | null)[]).map(k => (
          <button key={k || 'all'} className={'pill' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
            {k ? ASSET_KINDS[k] : 'All'} <span className="mono" style={{ fontSize: 10, opacity: .7 }}>{k ? data.assets.filter(a => a.kind === k).length : data.assets.length}</span>
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or tag" style={{ marginLeft: 'auto', background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '8px 12px', fontSize: 13, minWidth: 200 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {list.map(a => (
          <section key={a.id} className="card hover-line" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ aspectRatio: '16/9', background: 'var(--well)', display: 'grid', placeItems: 'center', position: 'relative' }}>
              {VISUAL.includes(a.kind) ? <ImageSlot compact src={a.preview} placeholder={ASSET_KINDS[a.kind] + ' preview'} onFile={f => void hub.setAssetPreview(a.id, f)} /> : <span className="mono" style={{ fontSize: 26, color: 'var(--muted)' }}>{GLYPH[a.kind] || '▤'}</span>}
              <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5, background: 'var(--chip-bg)', color: 'var(--chip-text)', border: '1px solid var(--line-2)', pointerEvents: 'none' }}>{ASSET_KINDS[a.kind]}</span>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="ellipsis" title={a.path || a.name} style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{a.size}</span>
              </div>
              <input
                defaultValue={a.tags.join(', ')}
                placeholder="Add tags, comma separated"
                onBlur={e => { const tags = e.target.value.split(',').map(s => s.trim()).filter(Boolean); hub.setData(d => ({ ...d, assets: d.assets.map(x => (x.id === a.id ? { ...x, tags } : x)) })); }}
                style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 0, padding: 0 }}
              />
              <span style={{ fontSize: 11, color: a.usedBy.length ? 'var(--green)' : 'var(--muted)', fontWeight: 600 }}>{a.usedBy.length ? 'Used in ' + a.usedBy.map(id => data.projects.find(p => p.id === id)?.name || id).join(', ') : 'Not used yet'}</span>
              <div className="row wrap" style={{ gap: 4, marginTop: 'auto', paddingTop: 4 }}>
                {data.projects.map(p => {
                  const on = a.usedBy.includes(p.id);
                  return <button key={p.id} onClick={() => void hub.toggleAssetLink(a, p)} title={on ? 'Unlink from ' + p.name : p.folder?.path ? 'Copy into ' + p.name : 'Link to ' + p.name} style={{ borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--line-2)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--text-2)' }}>{p.name}</button>;
                })}
                <button className="x" style={{ marginLeft: 'auto' }} title="Remove from library index (file stays on disk)" onClick={() => hub.removeAsset(a.id)}>×</button>
              </div>
            </div>
          </section>
        ))}
        {!data.assets.length && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Nothing here yet — drop your first files above.</p>}
      </div>
    </>
  );
}
