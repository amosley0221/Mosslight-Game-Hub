import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AGENTS } from '../core/constants';
import type { AgentId, Project } from '../core/types';
import { useImageSrc } from '../sync/images';
import { checkForUpdate, type UpdateInfo } from '../platform/updates';
import { anyRunning } from '../core/runs';

export const asset = (name: string) => `./assets/${name}`;

export function Glyph({ agent, size = 22 }: { agent: AgentId; size?: number }) {
  const a = AGENTS[agent];
  return <span className="glyph" style={{ width: size, height: size, background: a.color, fontSize: Math.round(size * 0.42) }}>{a.glyph}</span>;
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="dot" style={{ width: size, height: size, background: color }} />;
}

export function Switch({ on, color = 'var(--accent)', onClick }: { on: boolean; color?: string; onClick: () => void }) {
  return (
    <button className="switch" onClick={onClick} style={{ background: on ? color : 'var(--line-3)' }} aria-pressed={on}>
      <span style={{ left: on ? 18 : 2 }} />
    </button>
  );
}

export function Typing({ color }: { color: string }) {
  return <div className="typing"><span style={{ background: color }} /><span style={{ background: color }} /><span style={{ background: color }} /></div>;
}

/**
 * Drop-or-browse image slot. Shows the image when set.
 * With `onOpen`, a click opens that instead of the file picker (library tiles open the project);
 * dropping an image still replaces it.
 */
export function ImageSlot({ src, placeholder, onFile, onOpen, compact, hint }: { src?: string; placeholder: string; onFile?: (f: File) => void; onOpen?: () => void; compact?: boolean; hint?: string }) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = useImageSrc(src);
  const pick = (f?: File | null) => { if (f && onFile && f.type.startsWith('image/')) onFile(f); };
  return (
    <div
      className={'slot' + (url ? '' : ' empty') + (drag ? ' drag' : '')}
      onClick={e => { if (onOpen) { e.stopPropagation(); onOpen(); } else if (onFile) { e.stopPropagation(); input.current?.click(); } }}
      onDragOver={e => { if (onFile) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      style={onFile ? undefined : { cursor: 'default' }}
    >
      {url ? <><img src={url} alt={placeholder} draggable={false} />{hint && <span className="slot-hint">{hint}</span>}</> : (
        <div style={{ padding: 8 }}>
          <svg width={compact ? 18 : 24} height={compact ? 18 : 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ opacity: .7 }}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
          <div style={{ fontWeight: 600, marginTop: 4 }}>{placeholder}</div>
          {onFile && !onOpen && !compact && <div style={{ fontSize: 11, marginTop: 2 }}>or <u>browse files</u></div>}
        </div>
      )}
      {onFile && <input ref={input} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />}
    </div>
  );
}

export const coverOf = (p: Project) => p.coverImage || p.art.find(a => a.id === p.coverArt)?.imagePath;

export function Modal({ width, onClose, children, gap = 16 }: { width: number; onClose: () => void; children: ReactNode; gap?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: `min(${width}px, 100%)`, gap }}>{children}</div>
    </div>
  );
}

export function Toast({ text, style }: { text: string | null; style?: CSSProperties }) {
  return text ? <div className="toast" style={style}>{text}</div> : null;
}

export function Splash() {
  const [fade, setFade] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const a = window.setTimeout(() => setFade(true), 1900);
    const b = window.setTimeout(() => setGone(true), 2600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (gone) return null;
  const skip = () => { setFade(true); window.setTimeout(() => setGone(true), 600); };
  return (
    <div onClick={skip} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--text)', opacity: fade ? 0 : 1, transition: 'opacity .6s ease', pointerEvents: fade ? 'none' : 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, animation: 'rise .8s ease' }}>
        <img src={asset('mosslight-logo.png')} alt="Mosslight" style={{ height: 'min(46vh, 380px)', width: 'auto', display: 'block', filter: 'drop-shadow(0 30px 60px rgba(0,0,0,.45))' }} />
        <img src={asset('mosslight-wordmark-full.png')} alt="Mosslight Studios" style={{ height: 'min(14vh, 120px)', maxWidth: '86vw', width: 'auto', display: 'block', objectFit: 'contain' }} />
        <div className="typing" style={{ marginTop: 8 }}><span style={{ background: 'var(--accent)' }} /><span style={{ background: 'var(--accent)' }} /><span style={{ background: 'var(--accent)' }} /></div>
      </div>
    </div>
  );
}

/** Checks GitHub releases on launch; offers an in-place update. */
export function useUpdate() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [status, setStatus] = useState<string>('');
  const check = async (manual = false) => {
    try {
      setStatus(manual ? 'Checking…' : '');
      const u = await checkForUpdate();
      setUpdate(u);
      setStatus(u ? '' : manual ? 'You\'re on the latest version' : '');
    } catch (e) {
      setStatus(manual ? 'Couldn\'t check for updates: ' + ((e as Error)?.message || String(e)) : '');
    }
  };
  useEffect(() => { void check(); }, []);
  return { update, status, setStatus, check };
}

export function UpdateBanner({ u, onDismiss, onNotes }: { u: UpdateInfo; onDismiss: () => void; onNotes: () => void }) {
  const [pct, setPct] = useState<number | null>(null);
  return (
    <div className="banner">
      <b>Mosslight {u.version} is available.</b>
      <button className="link" onClick={onNotes}>What's new</button>
      <span style={{ flex: 1 }} />
      {pct !== null ? <span className="mono" style={{ fontSize: 12 }}>Updating… {pct}%</span> : (
        <>
          <button
            className="btn-accent"
            style={{ padding: '6px 12px', fontSize: 12 }}
            // Updating restarts the app, which kills anything an agent is running.
            onClick={() => {
              if (anyRunning() && !window.confirm('An agent is working right now. Updating restarts Mosslight and stops it — files it already wrote are kept, the reply is lost.\n\nUpdate anyway?')) return;
              setPct(0);
              void u.install(setPct).catch(() => setPct(null));
            }}
          >Update now</button>
          <button className="x" onClick={onDismiss} title="Later">×</button>
        </>
      )}
    </div>
  );
}

/** Tiny safe renderer: paragraphs + fenced code, no HTML injection. */
export function RichText({ text, style }: { text: string; style?: CSSProperties }) {
  const parts = text.split(/```[\w+#.-]*[^\n]*\n([\s\S]*?)```/g);
  return (
    <div className="md" style={style}>
      {parts.map((p, i) => (i % 2 ? <pre key={i}>{p.replace(/\s+$/, '')}</pre> : p.trim() ? <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{p.trim()}</p> : null))}
    </div>
  );
}
