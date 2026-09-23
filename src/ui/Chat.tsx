import { useEffect, useRef } from 'react';
import { AGENTS, ORDER } from '../core/constants';
import { route } from '../core/router';
import type { Hub } from '../core/store';
import type { AgentId, Message } from '../core/types';
import { Glyph, RichText, Typing } from './common';

export function MessageView({ hub, chatKey, m, compact }: { hub: Hub; chatKey: string; m: Message; compact?: boolean }) {
  const fs = compact ? 12 : 13;
  if (m.type === 'user')
    return <div style={{ display: 'flex', justifyContent: 'flex-end' }}><div style={{ maxWidth: compact ? '86%' : '88%', background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: '14px 14px 4px 14px', padding: compact ? '9px 11px' : '10px 12px', fontSize: fs, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div></div>;
  if (m.type === 'agent') {
    const a = AGENTS[m.agent];
    return (
      <div style={{ display: 'flex', gap: compact ? 8 : 10, alignItems: 'flex-start' }}>
        <span style={{ marginTop: 2 }}><Glyph agent={m.agent} size={compact ? 22 : 26} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row wrap" style={{ gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: compact ? 11 : 12, fontWeight: 600, color: a.color }}>{a.name}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{m.route}</span>
            {!m.pending && m.route !== 'hub' && <button onClick={() => hub.toggleOverride(chatKey, m)} style={{ background: 'none', border: 0, color: 'var(--dim)', fontSize: 11, padding: 0, fontWeight: 600 }}>Reroute ▾</button>}
          </div>
          {m.showOverride && (
            <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
              {ORDER.filter(o => o !== m.agent).map(o => <button key={o} onClick={() => hub.reroute(chatKey, m, o)} style={{ border: `1px solid ${AGENTS[o].color}`, color: AGENTS[o].color, background: 'none', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600, minHeight: compact ? 32 : undefined }}>Send to {AGENTS[o].name}</button>)}
            </div>
          )}
          {m.pending && <Typing color={a.color} />}
          <RichText text={m.text} style={{ fontSize: fs, lineHeight: 1.55, color: m.error ? 'var(--danger)' : 'var(--text-2)', wordBreak: 'break-word' }} />
        </div>
      </div>
    );
  }
  if (m.type === 'handoff') {
    const from = AGENTS[m.from], to = AGENTS[m.to];
    return (
      <div style={{ marginLeft: compact ? 30 : 36, border: `1px solid ${to.color}`, borderRadius: 12, padding: compact ? 10 : 12, background: 'var(--panel)' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}><b style={{ color: from.color }}>{from.name}</b> requests help from <b style={{ color: to.color }}>{to.name}</b></div>
        <div style={{ fontSize: fs, margin: '6px 0 10px', lineHeight: 1.5 }}>{m.reason}</div>
        {m.status === 'pending' ? (
          <div className="row">
            <button onClick={() => hub.approve(chatKey, m)} style={{ background: to.color, border: 0, color: 'var(--on-agent)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, minHeight: compact ? 32 : undefined }}>Approve</button>
            <button onClick={() => hub.decline(chatKey, m)} style={{ background: 'none', border: '1px solid var(--line-3)', color: 'var(--text-2)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, minHeight: compact ? 32 : undefined }}>Decline</button>
          </div>
        ) : <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{m.status === 'approved' ? '✓ approved — handed to ' + to.name : '✕ declined'}</span>}
      </div>
    );
  }
  return (
    <div style={{ marginLeft: compact ? 30 : 36, border: '1px solid var(--line-3)', borderRadius: 12, padding: 12, background: 'var(--panel)' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Couldn't tell who this is for. Who should take it?</div>
      <div className="row wrap" style={{ gap: 6 }}>
        {ORDER.map(a => <button key={a} onClick={() => hub.choose(chatKey, m, a)} style={{ border: `1px solid ${AGENTS[a].color}`, color: AGENTS[a].color, background: 'none', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 600, minHeight: compact ? 32 : undefined }}>{AGENTS[a].name}</button>)}
      </div>
    </div>
  );
}

/** Shown in an empty chat: how routing works. */
export function ChatIntro({ compact }: { compact?: boolean }) {
  return (
    <div style={{ fontSize: compact ? 12 : 13, color: 'var(--muted)', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span>Type anything — each message goes to the right agent:</span>
      {ORDER.map(a => (
        <span key={a} className="row" style={{ gap: 8 }}><span className="dot" style={{ width: 8, height: 8, background: AGENTS[a].color }} /><b style={{ color: AGENTS[a].color }}>{AGENTS[a].name}</b> {AGENTS[a].role.toLowerCase()}</span>
      ))}
      <span>Agents need an API key (or a local CLI on desktop) — add them in ⚙ Settings → Agents.</span>
    </div>
  );
}

export function Composer({ hub, compact }: { hub: Hub; compact?: boolean }) {
  const { ui, patchUi } = hub;
  const preview = ui.forced ? { agent: ui.forced, hit: 'manual' } : route(ui.input);
  const label = !ui.input.trim() ? (ui.forced ? 'manual → ' + AGENTS[ui.forced].name : 'auto-route') : preview.agent ? '→ ' + AGENTS[preview.agent].name + (preview.hit && preview.hit !== 'manual' ? ` · "${preview.hit}"` : '') : '→ will ask you';
  return (
    <div>
      <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
        {([null, ...ORDER] as (AgentId | null)[]).map(a => {
          const on = ui.forced === a, col = a ? AGENTS[a].color : 'var(--accent)';
          return <button key={a || 'auto'} onClick={() => patchUi({ forced: a })} style={{ borderRadius: 999, padding: compact ? '6px 11px' : '3px 10px', fontSize: 11, fontWeight: 600, border: `1px solid ${on ? col : 'var(--line-3)'}`, background: on ? (a ? `color-mix(in srgb, ${col} 14%, transparent)` : 'var(--accent-soft)') : 'transparent', color: on ? col : 'var(--muted)' }}>{a ? AGENTS[a].name : 'Auto'}</button>;
        })}
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: preview.agent ? AGENTS[preview.agent].color : 'var(--muted)' }}>{label}</span>
      </div>
      <div className="row" style={{ alignItems: 'flex-end', background: 'var(--panel)', border: '1px solid var(--line-3)', borderRadius: compact ? 14 : 12, padding: compact ? '6px 6px 6px 12px' : '8px 8px 8px 12px' }}>
        <textarea value={ui.input} onChange={e => patchUi({ input: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); hub.send(); } }} rows={compact ? 1 : 2} placeholder={compact ? 'Ask any agent…' : 'Describe what you need — ideas, art, builds, or code…'} style={{ flex: 1, background: 'none', border: 0, resize: 'none', fontSize: 13, lineHeight: 1.5, padding: compact ? '8px 0' : '4px 0' }} />
        <button onClick={hub.send} disabled={ui.busy} style={{ background: 'var(--accent)', border: 0, color: 'var(--on-accent)', borderRadius: compact ? 10 : 8, width: compact ? 36 : 34, height: compact ? 36 : 34, fontWeight: 700, fontSize: 15, opacity: ui.busy ? 0.4 : 1, flex: 'none' }}>↑</button>
      </div>
    </div>
  );
}

export function ChatRail({ hub }: { hub: Hub }) {
  const { proj, chatKey, data } = hub;
  const msgs = data.messages[chatKey] || [];
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, msgs[msgs.length - 1]?.type === 'agent' && (msgs[msgs.length - 1] as { pending?: boolean }).pending]);
  return (
    <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--surface)', backdropFilter: 'var(--blur)', display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', minHeight: 0 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{proj ? proj.name + ' · chat' : 'Mosslight chat'}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{proj ? 'Scoped to this project. Auto-routed; reroute any reply.' : 'Not scoped to a project — open a tile to add tasks and art.'}</div>
      </div>
      <div style={{ overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msgs.length === 0 && <ChatIntro />}
        {msgs.map(m => <div key={m.id} className="rise"><MessageView hub={hub} chatKey={chatKey} m={m} /></div>)}
        <div ref={end} />
      </div>
      <div style={{ padding: '12px 14px 14px', borderTop: '1px solid var(--line)' }}><Composer hub={hub} /></div>
    </aside>
  );
}
