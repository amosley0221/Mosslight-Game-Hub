import { describe, expect, it } from 'vitest';
import { parseReply, route } from './router';

describe('route keywords', () => {
  it('matches whole words, not fragments', () => {
    // "ui" used to match inside "build", sending engineering work to the design agent.
    expect(route('Reconcile the current state and write the build manifest').hit).not.toBe('ui');
    expect(route('Make it look right').hit).not.toBe('rig');
    expect(route('Design the pause menu UI').agent).toBe('codex');
  });

  it('still matches plurals and -ing', () => {
    expect(route('Fixing the collision bug in the controller').agent).toBe('claude');
    expect(route('Two concept art ideas for the diner').agent).toBe('grok');
  });

  it('asks when nothing scores', () => {
    expect(route('hello there').agent).toBeNull();
  });
});

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

  it('takes pictures out of the reply and keeps the prose', () => {
    const r = parseReply('Banding is gone on the parking court.\n- **SHOT:** F:\\Vacancy\\Art\\Reports\\ArroyoSurface56\\market-parking.png\nSHOT: F:\\Vacancy\\Art\\Reports\\ArroyoSurface56\\cedar-walk.png', 'codex', 'x');
    expect(r.shots).toEqual(['F:\\Vacancy\\Art\\Reports\\ArroyoSurface56\\market-parking.png', 'F:\\Vacancy\\Art\\Reports\\ArroyoSurface56\\cedar-walk.png']);
    expect(r.text).toBe('Banding is gone on the parking court.');
  });

  it('leaves a SHOT line that is not an image in the reply', () => {
    const r = parseReply('SHOT: I took a look at the curb line', 'codex', 'x');
    expect(r.shots).toBeUndefined();
    expect(r.text).toBe('SHOT: I took a look at the curb line');
  });

  it("ignores a handoff an agent addresses to itself", () => {
    const r = parseReply('HANDOFF: codex — mine already', 'codex', 'x');
    expect(r.handoff).toBeUndefined();
  });
});
