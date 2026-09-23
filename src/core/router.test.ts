import { describe, expect, it } from 'vitest';
import { parseReply } from './router';

describe('parseReply control lines', () => {
  it('reads a plain handoff with its prompt', () => {
    const r = parseReply('Here is the layout.\nHANDOFF: claude — the grid needs a component\n<<<PROMPT\nBuild HudGrid.tsx\nPROMPT>>>', 'codex', 'x');
    expect(r.handoff).toEqual({ to: 'claude', reason: 'the grid needs a component', prompt: 'Build HudGrid.tsx' });
    expect(r.text).toBe('Here is the layout.');
  });

  // Agents bold these labels often enough that a strict parser silently loses the handoff.
  it('reads a handoff an agent wrapped in markdown', () => {
    const r = parseReply('**HANDOFF:** claude — review and confirm the permitted excerpts**', 'grok', 'x');
    expect(r.handoff?.to).toBe('claude');
    expect(r.handoff?.reason).toBe('review and confirm the permitted excerpts');
    expect(r.text).toBe('');
  });

  it('reads decorated task lines and keeps the rest of the reply', () => {
    const r = parseReply('Done.\n- **TASK:** Wire the pause menu\nTASK: [codex] Palette pass', 'claude', 'x');
    expect(r.tasks).toEqual([
      { title: 'Wire the pause menu', agent: undefined },
      { title: 'Palette pass', agent: 'codex' },
    ]);
    expect(r.text).toBe('Done.');
  });

  it('leaves a build path intact', () => {
    const r = parseReply('BUILD: City playtest | F:\\Vacancy\\Builds\\City_Playtest.lnk | desktop | windows', 'codex', 'x');
    expect(r.builds?.[0]).toMatchObject({ name: 'City playtest', path: 'F:\\Vacancy\\Builds\\City_Playtest.lnk', kind: 'desktop', platform: 'windows' });
  });

  it("ignores a handoff an agent addresses to itself", () => {
    const r = parseReply('HANDOFF: codex — mine already', 'codex', 'x');
    expect(r.handoff).toBeUndefined();
  });
});
