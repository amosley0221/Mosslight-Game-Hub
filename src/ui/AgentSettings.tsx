import { useEffect, useState } from 'react';
import { AGENTS, ORDER } from '../core/constants';
import { AGENT_KEY, listModels, localClis } from '../core/agents';
import type { Hub } from '../core/store';
import type { AgentId, AgentMode } from '../core/types';
import { isDesktop } from '../platform';
import { Glyph, Switch } from './common';

const MODE_LABEL: Record<AgentMode, string> = { auto: 'Auto', local: 'Local', remote: 'API' };

/** Dropdown of the provider's models (loaded with your key), plus "Custom…" for anything else. */
function ModelPicker({ value, onChange, options, loading, onLoad, allowDefault }: {
  value: string; onChange: (v: string) => void; options: string[] | null; loading: boolean; onLoad: () => void; allowDefault?: boolean;
}) {
  const list = [...new Set([...(value ? [value] : []), ...(options || [])])];
  const [custom, setCustom] = useState(false);
  const field = { flex: 1, minWidth: 0, background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '6px 8px', fontSize: 11 } as const;
  return (
    <div className="row" style={{ gap: 6, flex: 1, minWidth: 0 }}>
      {custom ? (
        <input className="mono" autoFocus value={value} onChange={e => onChange(e.target.value)} onBlur={() => setCustom(false)} placeholder="exact model id" style={field} />
      ) : (
        <select className="mono" value={value} onChange={e => (e.target.value === '__custom' ? setCustom(true) : onChange(e.target.value))} style={field}>
          {allowDefault && <option value="">CLI default (your plan's model)</option>}
          {list.map(m => <option key={m} value={m}>{m}</option>)}
          <option value="__custom">Custom…</option>
        </select>
      )}
      <button className="btn-ghost" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }} disabled={loading} onClick={onLoad} title="Load the models your key can use">{loading ? 'Loading…' : options ? '↻' : 'Load models'}</button>
    </div>
  );
}

export function AgentSettings({ hub, keys, onAddKey }: { hub: Hub; keys: Record<string, boolean>; onAddKey: (a: AgentId) => void }) {
  const { settings, updSettings, toast } = hub;
  const [clis, setClis] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<Partial<Record<AgentId, string[]>>>({});
  const [loading, setLoading] = useState<AgentId | null>(null);
  useEffect(() => { void localClis(true).then(setClis); }, []);

  const load = async (a: AgentId) => {
    setLoading(a);
    try {
      const ids = await listModels(a);
      setModels(m => ({ ...m, [a]: ids }));
      if (!ids.length) toast('The provider returned no models for this key');
    } catch (e) {
      toast(`Couldn't load ${AGENTS[a].name} models: ${(e as Error)?.message || e}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Agents</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ORDER.map(a => {
          const canLocal = isDesktop && a !== 'grok';
          const mode: AgentMode = canLocal ? settings.mode[a] : 'remote';
          const cli = clis[a];
          const cliName = a === 'claude' ? 'Claude Code' : 'Codex CLI';
          const hasKey = keys[AGENT_KEY[a].key];
          const using = !canLocal ? (hasKey ? 'API' : 'not set up')
            : mode === 'local' ? (cli ? `${cliName}` : `${cliName} — not found`)
            : mode === 'remote' ? (hasKey ? 'API' : 'API — no key yet')
            : cli ? `${cliName} first${hasKey ? ', API as backup' : ''}` : hasKey ? `API (${cliName} not found)` : 'not set up';
          const showApi = mode !== 'local';
          const showLocal = canLocal && mode !== 'remote';
          return (
            <div key={a} style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                <div className="row" style={{ gap: 10, minWidth: 0 }}>
                  <Glyph agent={a} size={22} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{AGENTS[a].name}</div>
                    <div style={{ fontSize: 11, color: using.includes('not') ? 'var(--danger)' : 'var(--muted)' }}>Using: {using}</div>
                  </div>
                </div>
                {canLocal && (
                  <div className="row" style={{ gap: 0, border: '1px solid var(--line-3)', borderRadius: 8, overflow: 'hidden', flex: 'none' }}>
                    {(['auto', 'local', 'remote'] as AgentMode[]).map(m => (
                      <button key={m} onClick={() => updSettings(s => ({ ...s, mode: { ...s.mode, [a]: m } }))} title={m === 'auto' ? `${cliName} when installed, API otherwise` : m === 'local' ? `Only ${cliName}` : 'Only the API'} style={{ border: 0, padding: '5px 10px', fontSize: 11, fontWeight: 600, background: mode === m ? AGENTS[a].color : 'transparent', color: mode === m ? 'var(--on-agent)' : 'var(--muted)' }}>{MODE_LABEL[m]}</button>
                    ))}
                  </div>
                )}
              </div>
              {showLocal && (
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', width: 44, flex: 'none' }}>Local</span>
                  <ModelPicker allowDefault value={settings.localModels[a] || ''} onChange={v => updSettings(s => ({ ...s, localModels: { ...s.localModels, [a]: v } }))} options={models[a] || null} loading={loading === a} onLoad={() => void load(a)} />
                </div>
              )}
              {showApi && (
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', width: 44, flex: 'none' }}>API</span>
                  <ModelPicker value={settings.models[a]} onChange={v => updSettings(s => ({ ...s, models: { ...s.models, [a]: v } }))} options={models[a] || null} loading={loading === a} onLoad={() => void load(a)} />
                  <button className="btn-ghost" style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: hasKey ? 'var(--green)' : undefined }} onClick={() => onAddKey(a)}>{hasKey ? '✓ Key' : 'Add API key'}</button>
                </div>
              )}
              {a === 'grok' && (
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', width: 44, flex: 'none' }}>Images</span>
                  <ModelPicker value={settings.models.grokImage} onChange={v => updSettings(s => ({ ...s, models: { ...s.models, grokImage: v } }))} options={models.grok ? models.grok.filter(m => /image|imagine/i.test(m)) : null} loading={loading === 'grok'} onLoad={() => void load('grok')} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-approve handoffs</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>When one agent hands work to another (e.g. Codex → Claude), start it right away instead of waiting for Approve.</div>
          </div>
          <Switch on={!!settings.autoHandoff} onClick={() => updSettings(s => ({ ...s, autoHandoff: !s.autoHandoff }))} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Team lead</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Who splits a Team request into steps for everyone.</div>
          </div>
          <select value={settings.teamLead || 'codex'} onChange={e => updSettings(s => ({ ...s, teamLead: e.target.value as AgentId }))} style={{ background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
            {ORDER.map(a => <option key={a} value={a}>{AGENTS[a].name}</option>)}
          </select>
        </div>
        {isDesktop && (
          <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Let Claude Code run commands</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Local Claude Code can always edit project files. Turn this on to also let it run builds and tests without asking. (Codex runs commands inside its own sandbox.)</div>
            </div>
            <Switch on={!!settings.localCommands} onClick={() => updSettings(s => ({ ...s, localCommands: !s.localCommands }))} />
          </div>
        )}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
        {isDesktop
          ? 'Auto uses the local command-line tool when it\'s installed on this computer and falls back to the API if it\'s missing or fails. Each reply is labelled "local" or "api". "Load models" lists what your key can use.'
          : 'This device talks to the agents through their APIs. "Load models" lists what your key can use.'}
      </p>
    </div>
  );
}
