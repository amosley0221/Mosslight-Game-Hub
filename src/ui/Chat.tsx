import { useEffect, useRef, useState } from 'react';
import { AGENTS, ORDER } from '../core/constants';
import { route } from '../core/router';
import type { Hub } from '../core/store';
import type { AgentId, Attachment, Message, PlanStep } from '../core/types';
import { attachmentBytes } from '../core/attachments';
import { fmtSize } from '../core/util';
import { deviceId } from '../sync/device';
import { Glyph, RichText, Typing } from './common';

type AgentMsg = Extract<Message, { type: 'agent' }>;
type HandoffMsg = Extract<Message, { type: 'handoff' }>;
type PlanMsg = Extract<Message, { type: 'plan' }>;

const fmtDuration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

/** Ticking "1m 12s" while a run is live. */
function Elapsed({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick(n => n + 1), 1000); return () => window.clearInterval(t); }, []);
  return <>{fmtDuration(Date.now() - since)}</>;
}

const ATT_ICON: Record<Attachment['kind'], string> = { image: '🖼', audio: '🎵', archive: '🗜', pdf: '📕', text: '📄', other: '📎' };

/** Opens an attachment in a new tab — it works the same whether it came from disk or sync. */
async function openAttachment(a: Attachment) {
  const b = await attachmentBytes(a);
  if (!b) return;
  const url = URL.createObjectURL(new Blob([b.bytes as BlobPart], { type: b.mime }));
  window.open(url, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** One attached file: a thumbnail for images, a labelled chip for everything else. */
function AttachChip({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  const box = { position: 'relative' as const, border: '1px solid var(--line-2)', borderRadius: 10, background: 'var(--panel)', overflow: 'hidden' };
  const x = onRemove && (
    <button onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove" style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 999, border: 0, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, lineHeight: '18px', padding: 0 }}>×</button>
  );
  if (a.kind === 'image' && a.thumb)
    return <div style={{ ...box, width: 72, height: 72 }} title={a.name} onClick={() => void openAttachment(a)}><img src={a.thumb} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} />{x}</div>;
  return (
    <div className="row" style={{ ...box, gap: 7, padding: '7px 22px 7px 9px', maxWidth: 200, cursor: 'pointer' }} title={a.name} onClick={() => void openAttachment(a)}>
      <span style={{ fontSize: 14 }}>{ATT_ICON[a.kind]}</span>
      <span style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtSize(a.size)}</div>
      </span>
      {x}
    </div>
  );
}

function AttachmentList({ list, onRemove }: { list: Attachment[]; onRemove?: (id: string) => void }) {
  return <div className="row wrap" style={{ gap: 6 }}>{list.map(a => <AttachChip key={a.id} a={a} onRemove={onRemove && (() => onRemove(a.id))} />)}</div>;
}

const pillBtn = (color: string, filled: boolean, compact?: boolean) => ({
  background: filled ? color : 'none', border: filled ? 0 : `1px solid ${color}`, color: filled ? 'var(--on-agent)' : color,
  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, minHeight: compact ? 36 : undefined,
});

/** Live activity for a run: steps as they happen, a timer, and Stop. */
function RunProgress({ hub, chatKey, m, compact }: { hub: Hub; chatKey: string; m: AgentMsg; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const a = AGENTS[m.agent];
  const steps = m.steps || [];
  const mine = !m.runDevice || m.runDevice === deviceId;
  if (m.pending) {
    const shown = steps.slice(-4);
    return (
      <div style={{ margin: '2px 0 6px', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line-2)', background: 'var(--surface)' }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span className="row" style={{ gap: 8, fontSize: 11, color: 'var(--muted)' }}>
            {m.queued ? <>Waiting for {a.name} to finish an earlier request…</> : <><Typing color={a.color} /> Working{m.startedAt ? <> · <Elapsed since={m.startedAt} /></> : null}{!mine ? ' · on another device' : ''}</>}
          </span>
          {mine && <button onClick={() => hub.stopRun(chatKey, m)} style={{ background: 'none', border: '1px solid var(--line-3)', color: 'var(--text-2)', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600, minHeight: compact ? 32 : undefined }}>{m.queued ? 'Cancel' : 'Stop'}</button>}
        </div>
        {shown.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
            {steps.length > shown.length && <span className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>… {steps.length - shown.length} earlier steps</span>}
            {shown.map((s, i) => (
              <span key={i} className="mono ellipsis" style={{ fontSize: 10.5, color: i === shown.length - 1 ? 'var(--text-2)' : 'var(--muted)' }}>{i === shown.length - 1 ? '▸ ' : '✓ '}{s}</span>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (!steps.length && !m.startedAt) return null;
  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={() => setOpen(!open)} className="mono" style={{ background: 'none', border: 0, padding: 0, fontSize: 10.5, color: 'var(--muted)' }}>
        {m.stopped ? 'Stopped' : 'Worked'}{m.startedAt && m.finishedAt ? ` for ${fmtDuration(m.finishedAt - m.startedAt)}` : ''}{steps.length ? ` · ${steps.length} step${steps.length === 1 ? '' : 's'} ${open ? '▴' : '▾'}` : ''}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, paddingLeft: 8, borderLeft: '2px solid var(--line-2)' }}>
          {steps.map((s, i) => <span key={i} className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', wordBreak: 'break-word' }}>{s}</span>)}
        </div>
      )}
    </div>
  );
}

/** "Codex suggests Claude takes this" — with the ready-to-run prompt, editable before approving. */
function HandoffCard({ hub, chatKey, m, compact }: { hub: Hub; chatKey: string; m: HandoffMsg; compact?: boolean }) {
  const from = AGENTS[m.from], to = AGENTS[m.to];
  const [open, setOpen] = useState(m.status === 'pending');
  const [draft, setDraft] = useState(m.prompt || '');
  const [editing, setEditing] = useState(false);
  const fs = compact ? 12 : 13;
  return (
    <div style={{ marginLeft: compact ? 30 : 36, border: `1px solid ${to.color}`, borderRadius: 12, padding: compact ? 10 : 12, background: 'var(--panel)' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}><b style={{ color: from.color }}>{from.name}</b> suggests <b style={{ color: to.color }}>{to.name}</b> takes this</div>
      <div style={{ fontSize: fs, margin: '6px 0 8px', lineHeight: 1.5 }}>{m.reason}</div>
      {m.prompt && (
        <div style={{ marginBottom: 10 }}>
          <button className="link" style={{ fontSize: 11, color: to.color }} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'} Prompt for {to.name}</button>
          {open && (editing && m.status === 'pending' ? (
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={8} style={{ marginTop: 6, width: '100%', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 8, padding: 10, fontSize: 12, fontFamily: 'var(--mono)', lineHeight: 1.5, resize: 'vertical', color: 'var(--text-2)' }} />
          ) : (
            <pre style={{ margin: '6px 0 0', maxHeight: 240, overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 8, padding: 10, fontSize: 11.5, fontFamily: 'var(--mono)', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text-2)' }}>{m.status === 'pending' ? draft : m.prompt}</pre>
          ))}
        </div>
      )}
      {m.status === 'pending' ? (
        <div className="row wrap">
          <button onClick={() => hub.approve(chatKey, m, m.prompt ? draft : undefined)} style={pillBtn(to.color, true, compact)}>Approve & run</button>
          {m.prompt && <button onClick={() => { setEditing(!editing); setOpen(true); }} style={{ ...pillBtn('var(--text-2)', false, compact), borderColor: 'var(--line-3)' }}>{editing ? 'Done editing' : 'Edit prompt'}</button>}
          <button onClick={() => hub.decline(chatKey, m)} style={{ ...pillBtn('var(--text-2)', false, compact), borderColor: 'var(--line-3)' }}>Decline</button>
        </div>
      ) : <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{m.status === 'approved' ? `✓ ${m.auto ? 'auto-approved' : 'approved'} — ${to.name} is on it` : '✕ declined'}</span>}
    </div>
  );
}

const STEP_ICON: Record<NonNullable<PlanStep['status']>, string> = { waiting: '○', running: '◐', done: '●', failed: '✕', skipped: '–' };

/** Team plan: review/edit the steps once, then they run (in parallel where possible). */
function PlanCard({ hub, chatKey, m, compact }: { hub: Hub; chatKey: string; m: PlanMsg; compact?: boolean }) {
  const lead = AGENTS[m.lead];
  const [steps, setSteps] = useState<PlanStep[]>(m.steps);
  const [openStep, setOpenStep] = useState<number | null>(null);
  useEffect(() => { if (m.status !== 'pending') setSteps(m.steps); else if (!steps.length) setSteps(m.steps); }, [m.steps, m.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = m.status === 'pending' ? steps : m.steps;
  const remove = (i: number) => setSteps(s => s.filter((_, j) => j !== i).map(x => ({ ...x, after: x.after.filter(a => a !== i).map(a => (a > i ? a - 1 : a)) })));
  return (
    <div style={{ marginLeft: compact ? 0 : 36, border: `1px solid ${lead.color}`, borderRadius: 12, padding: compact ? 10 : 12, background: 'var(--panel)' }}>
      <div className="row" style={{ gap: 8, fontSize: 12, color: 'var(--muted)' }}>
        <Glyph agent={m.lead} size={18} /> <span><b style={{ color: lead.color }}>Team plan</b> by {lead.name}</span>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 10 }}>{m.status}</span>
      </div>
      {m.status === 'drafting' && <div className="row" style={{ gap: 8, fontSize: 12, color: 'var(--muted)', marginTop: 8 }}><Typing color={lead.color} /> {lead.name} is splitting the work…</div>}
      {m.status === 'failed' && m.error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{m.error}</div>}
      {m.summary && <div style={{ fontSize: compact ? 12 : 13, margin: '8px 0', lineHeight: 1.5 }}>{m.summary}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {shown.map((s, i) => (
          <div key={i} style={{ border: '1px solid var(--line-2)', borderRadius: 8, padding: '6px 8px', background: 'var(--surface)' }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="mono" style={{ fontSize: 12, color: s.status === 'failed' ? 'var(--danger)' : AGENTS[s.agent].color, width: 12 }}>{STEP_ICON[s.status || 'waiting']}</span>
              <Glyph agent={s.agent} size={18} />
              <button onClick={() => setOpenStep(openStep === i ? null : i)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, padding: 0, fontSize: 12 }} className="ellipsis">
                <b>{i + 1}.</b> {s.title}{s.after.length ? <span style={{ color: 'var(--dim)' }}> · after {s.after.map(a => a + 1).join(', ')}</span> : null}
              </button>
              {m.status === 'pending' && steps.length > 1 && <button className="x" onClick={() => remove(i)} title="Drop this step">×</button>}
            </div>
            {openStep === i && (m.status === 'pending'
              ? <textarea value={s.prompt} onChange={e => setSteps(st => st.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} rows={6} style={{ marginTop: 6, width: '100%', background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 6, padding: 8, fontSize: 11.5, fontFamily: 'var(--mono)', lineHeight: 1.5, resize: 'vertical', color: 'var(--text-2)' }} />
              : <pre style={{ margin: '6px 0 0', fontSize: 11, fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', color: 'var(--muted)', maxHeight: 200, overflow: 'auto' }}>{s.prompt}</pre>)}
          </div>
        ))}
      </div>
      {m.status === 'pending' && (
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button onClick={() => void hub.runPlan(chatKey, m.id, steps)} style={pillBtn(lead.color, true, compact)}>Run plan</button>
          <button onClick={() => hub.declinePlan(chatKey, m.id)} style={{ ...pillBtn('var(--text-2)', false, compact), borderColor: 'var(--line-3)' }}>Decline</button>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Tap a step to read or edit its prompt.</span>
        </div>
      )}
    </div>
  );
}

export function MessageView({ hub, chatKey, m, compact }: { hub: Hub; chatKey: string; m: Message; compact?: boolean }) {
  const fs = compact ? 12 : 13;
  if (m.type === 'user')
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ maxWidth: compact ? '86%' : '88%', display: 'grid', gap: 6, justifyItems: 'end' }}>
          {!!m.attachments?.length && <AttachmentList list={m.attachments} />}
          <div style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: '14px 14px 4px 14px', padding: compact ? '9px 11px' : '10px 12px', fontSize: fs, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
        </div>
      </div>
    );
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
          <RunProgress hub={hub} chatKey={chatKey} m={m} compact={compact} />
          {m.text && <RichText text={m.text} style={{ fontSize: fs, lineHeight: 1.55, color: m.error ? 'var(--danger)' : 'var(--text-2)', wordBreak: 'break-word' }} />}
        </div>
      </div>
    );
  }
  if (m.type === 'handoff') return <HandoffCard hub={hub} chatKey={chatKey} m={m} compact={compact} />;
  if (m.type === 'plan') return <PlanCard hub={hub} chatKey={chatKey} m={m} compact={compact} />;
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
      <span>Agents suggest handoffs to each other with a ready-made prompt — approve it and the next agent starts. Pick <b>Team</b> to have a lead agent split a bigger request across all three.</span>
      <span>Agents need an API key (or a local CLI on desktop) — add them in ⚙ Settings → Agents.</span>
    </div>
  );
}

export function Composer({ hub, compact }: { hub: Hub; compact?: boolean }) {
  const { ui, patchUi, settings } = hub;
  const lead = settings.teamLead || 'codex';
  const team = ui.forced === 'team';
  const forcedAgent: AgentId | null = ui.forced && ui.forced !== 'team' ? ui.forced : null;
  const preview: { agent: AgentId | null; hit?: string } = team ? { agent: lead, hit: 'team' } : forcedAgent ? { agent: forcedAgent, hit: 'manual' } : route(ui.input);
  const label = team ? `team → ${AGENTS[lead].name} plans, you approve`
    : !ui.input.trim() ? (forcedAgent ? 'manual → ' + AGENTS[forcedAgent].name : 'auto-route')
    : preview.agent ? '→ ' + AGENTS[preview.agent].name + (preview.hit && preview.hit !== 'manual' ? ` · "${preview.hit}"` : '') : '→ will ask you';
  const picks: (AgentId | 'team' | null)[] = [null, 'team', ...ORDER];
  const fileInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const canSend = !!ui.input.trim() || !!ui.attachments.length;
  const take = (fl: FileList | null) => { const f = Array.from(fl || []); if (f.length) void hub.attachFiles(f); };
  return (
    <div
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); setOver(false); take(e.dataTransfer.files); } }}
    >
      <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
        {picks.map(a => {
          const on = ui.forced === a;
          const col = a === 'team' ? 'var(--green)' : a ? AGENTS[a].color : 'var(--accent)';
          return <button key={a || 'auto'} onClick={() => patchUi({ forced: a })} title={a === 'team' ? `${AGENTS[lead].name} splits the request into steps for each agent; you approve once` : undefined} style={{ borderRadius: 999, padding: compact ? '6px 11px' : '3px 10px', fontSize: 11, fontWeight: 600, border: `1px solid ${on ? col : 'var(--line-3)'}`, background: on ? `color-mix(in srgb, ${col} 14%, transparent)` : 'transparent', color: on ? col : 'var(--muted)' }}>{a === 'team' ? 'Team' : a ? AGENTS[a].name : 'Auto'}</button>;
        })}
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: preview.agent ? AGENTS[preview.agent].color : 'var(--muted)' }}>{label}</span>
      </div>
      {(!!ui.attachments.length || ui.attaching) && (
        <div style={{ marginBottom: 8 }}>
          <AttachmentList list={ui.attachments} onRemove={hub.removeAttachment} />
          {ui.attaching && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{ui.attaching}</div>}
        </div>
      )}
      <div className="row" style={{ alignItems: 'flex-end', background: 'var(--panel)', border: `1px solid ${over ? 'var(--accent)' : 'var(--line-3)'}`, borderRadius: compact ? 14 : 12, padding: compact ? '6px 6px 6px 8px' : '8px 8px 8px 8px' }}>
        <input ref={fileInput} type="file" multiple onChange={e => { take(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
        <button onClick={() => fileInput.current?.click()} title="Attach files — screenshots, mp3s, zips, PDFs" style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 16, width: compact ? 34 : 30, height: compact ? 36 : 32, flex: 'none' }}>📎</button>
        <textarea value={ui.input} onChange={e => patchUi({ input: e.target.value })} onPaste={e => { const f = Array.from(e.clipboardData.files); if (f.length) { e.preventDefault(); void hub.attachFiles(f); } }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); hub.send(); } }} rows={compact ? 1 : 2} placeholder={over ? 'Drop files to attach…' : team ? 'Describe the feature — the team splits it up…' : compact ? 'Ask any agent…' : 'Describe what you need — ideas, art, builds, or code…'} style={{ flex: 1, background: 'none', border: 0, resize: 'none', fontSize: 13, lineHeight: 1.5, padding: compact ? '8px 0' : '4px 0' }} />
        <button onClick={hub.send} disabled={!canSend} title={ui.busy ? 'Agents are working — new messages queue per agent' : 'Send'} style={{ background: 'var(--accent)', border: 0, color: 'var(--on-accent)', borderRadius: compact ? 10 : 8, width: compact ? 36 : 34, height: compact ? 36 : 34, fontWeight: 700, fontSize: 15, opacity: canSend ? 1 : 0.4, flex: 'none' }}>↑</button>
      </div>
    </div>
  );
}

export function ChatRail({ hub }: { hub: Hub }) {
  const { proj, chatKey, data } = hub;
  const msgs = data.messages[chatKey] || [];
  const end = useRef<HTMLDivElement>(null);
  const last = msgs[msgs.length - 1] as AgentMsg | undefined;
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, last?.text?.length, last?.steps?.length]);
  return (
    <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--surface)', backdropFilter: 'var(--blur)', display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', minHeight: 0 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{proj ? proj.name + ' · chat' : 'Mosslight chat'}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{proj ? 'Scoped to this project. Agents work in parallel; handoffs wait for your OK.' : 'Not scoped to a project — open a tile to add tasks and art.'}</div>
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
