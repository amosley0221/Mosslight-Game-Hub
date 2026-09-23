import { useCallback, useEffect, useRef, useState } from 'react';
import { canPlay, fmtTime, next, pause, play, prev, resume, seek, stop, usePlayer } from '../core/player';
import type { Hub } from '../core/store';
import type { MusicTrack, Project } from '../core/types';
import { ago, baseName, fmtSize, now, uid } from '../core/util';
import { findFiles, isDesktop, launchPath, pickFiles } from '../platform';
import { deviceId, localFolder } from '../sync/device';

const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
const niceName = (n: string) => n.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

/** Project → Music: the game's soundtrack, playable here and on the phone. */
export function MusicTab({ hub, p }: { hub: Hub; p: Project }) {
  const [scanning, setScanning] = useState(false);
  const player = usePlayer();
  const lf = localFolder(p);
  const tracks = p.music || [];

  // Audio in the project folder is registered automatically, so every device sees the list.
  const scan = useCallback(async () => {
    if (!lf?.path || !isDesktop) return;
    setScanning(true);
    try {
      const found = await findFiles(lf.path, AUDIO_EXTS, 300);
      const known = new Set(tracks.map(t => t.path));
      const add = found.filter(f => !known.has(f.path)).map(f => ({ id: uid(), name: niceName(f.name), path: f.path, device: deviceId, folder: f.folder, size: f.size, ts: f.modified || now() }));
      if (add.length) hub.updProj(p.id, q => ({ ...q, music: [...(q.music || []), ...add.filter(a => !(q.music || []).some(m => m.path === a.path))] }));
    } catch { /* folder not readable */ } finally { setScanning(false); }
  }, [lf?.path, p.id, hub, tracks]);

  const mounted = useRef(false);
  useEffect(() => { if (!mounted.current) { mounted.current = true; void scan(); } }, [scan]);

  const addFiles = async () => {
    const paths = (await pickFiles()).filter(x => AUDIO_EXTS.includes((x.split('.').pop() || '').toLowerCase()));
    if (!paths.length) return;
    hub.updProj(p.id, q => ({ ...q, music: [...(q.music || []), ...paths.filter(x => !(q.music || []).some(m => m.path === x)).map(x => ({ id: uid(), name: niceName(baseName(x)), path: x, device: deviceId, ts: now() }))] }));
  };

  const rename = (t: MusicTrack, name: string) => hub.updProj(p.id, q => ({ ...q, music: (q.music || []).map(m => (m.id === t.id ? { ...m, name } : m)) }));

  return (
    <>
      <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, maxWidth: '62ch' }}>
          The game's music. Audio in the project folder is picked up automatically{isDesktop ? '' : ' by the computer'}; share a track to play it on your phone. The agents can see this list and use these files when you ask them to put a track in the game.
        </p>
        {isDesktop && (
          <div className="row wrap">
            {lf?.path && <button className="btn" style={{ fontSize: 12, padding: '7px 12px' }} disabled={scanning} onClick={() => void scan()}>{scanning ? 'Scanning…' : 'Rescan folder'}</button>}
            <button className="btn-accent" onClick={() => void addFiles()}>Add songs</button>
          </div>
        )}
      </div>
      {!tracks.length && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No music yet.{isDesktop ? ' Use “Add songs”, or drop audio into the project folder.' : ' Add songs from the desktop app.'}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 820 }}>
        {tracks.map((t, i) => {
          const playable = canPlay(t);
          const current = player.track?.id === t.id;
          const mine = !t.device || t.device === deviceId;
          return (
            <div key={t.id} className="card hover-line" style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: 12, borderColor: current ? 'var(--accent)' : undefined }}>
              <button
                onClick={() => (current && player.playing ? pause() : current ? resume() : void play(t, tracks.filter(canPlay)))}
                disabled={!playable}
                title={playable ? (current && player.playing ? 'Pause' : 'Play') : `Only on ${hub.deviceName(t.device)} — share it to play here`}
                style={{ width: 44, height: 44, borderRadius: 12, background: playable ? 'var(--accent)' : 'var(--line-2)', border: 0, color: playable ? 'var(--on-accent)' : 'var(--muted)', fontSize: 15, fontWeight: 700 }}
              >{current && player.playing ? '❚❚' : '▶'}</button>
              <div style={{ minWidth: 0 }}>
                <input
                  defaultValue={t.name}
                  onBlur={e => e.target.value.trim() && e.target.value !== t.name && rename(t, e.target.value.trim())}
                  style={{ width: '100%', background: 'none', border: 0, padding: 0, fontSize: 14, fontWeight: 600, color: 'inherit' }}
                />
                <div className="mono ellipsis" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                  {i + 1}. {t.folder ? t.folder + ' · ' : ''}{t.size ? fmtSize(t.size) + ' · ' : ''}{ago(t.ts)}{t.ref ? ' · on all your devices' : mine ? '' : ` · on ${hub.deviceName(t.device)}`}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {isDesktop && mine && (t.ref
                  ? <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ Shared</span>
                  : <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} disabled={!!hub.sharing} onClick={() => void hub.shareTrack(p.id, t)}>{hub.sharing ? 'Sharing…' : 'Share to my devices'}</button>)}
                {isDesktop && mine && <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => void launchPath(t.path).catch(() => {})}>Open</button>}
                <button className="x" title="Remove from the list" onClick={() => { if (player.track?.id === t.id) stop(); hub.updProj(p.id, q => ({ ...q, music: (q.music || []).filter(m => m.id !== t.id) })); }}>×</button>
              </div>
            </div>
          );
        })}
      </div>
      {tracks.length > 0 && (
        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
          Ask an agent something like <i>“use {tracks[0].name} as the main menu theme”</i> — they can see these tracks and their file paths.
        </p>
      )}
    </>
  );
}

/** Slim player bar, shown wherever the app is while a track is playing. */
export function PlayerBar({ compact }: { compact?: boolean }) {
  const s = usePlayer();
  if (!s.track) return null;
  return (
    <div style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', backdropFilter: 'var(--blur)', padding: compact ? '8px 12px' : '8px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={() => (s.playing ? pause() : resume())} style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--accent)', border: 0, color: 'var(--on-accent)', fontSize: 13, fontWeight: 700, flex: 'none' }}>{s.playing ? '❚❚' : '▶'}</button>
      {s.queue.length > 1 && !compact && (
        <>
          <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={prev}>‹‹</button>
          <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={next}>››</button>
        </>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="ellipsis" style={{ fontSize: 12, fontWeight: 600 }}>{s.track.name}{s.error ? <span style={{ color: 'var(--danger)', fontWeight: 500 }}> — {s.error}</span> : null}</div>
        <div className="row" style={{ gap: 8 }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtTime(s.time)}</span>
          <input type="range" min={0} max={s.duration || 0} step={0.5} value={s.time} onChange={e => seek(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)', height: 4 }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtTime(s.duration)}</span>
        </div>
      </div>
      <button className="x" title="Close the player" onClick={stop}>×</button>
    </div>
  );
}
