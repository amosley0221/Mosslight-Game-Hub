import { describe, expect, it } from 'vitest';
import { groupProcs, type Proc } from './runs';

const p = (pid: number, ppid: number, name: string, parent = '', window = ''): Proc =>
  ({ pid, ppid, parent, name, window, mb: 10, started: '' });

describe('grouping engine processes', () => {
  // One Unity Hub and one batch build were shown as thirteen abandoned sessions, each offering
  // to end something — including the build that was working.
  it('collapses a Unity Hub and a batch build into two entries', () => {
    const list = [
      p(27456, 1, 'Unity Hub.exe'),                       // launcher has exited
      p(3188, 27456, 'Unity Hub.exe', 'Unity Hub.exe'),
      p(35676, 27456, 'Unity Hub.exe', 'Unity Hub.exe'),
      p(19604, 27456, 'Unity.Licensing.Client.exe', 'Unity Hub.exe'),
      p(9800, 4242, 'Unity.exe', 'bash.exe'),             // the build, started by an agent
      p(56308, 9800, 'Unity.exe', 'Unity.exe'),
      p(27292, 9800, 'UnityPackageManager.exe', 'Unity.exe'),
      p(2660, 56308, 'UnityCrashHandler64.exe', 'Unity.exe'), // grandchild
    ];
    const g = groupProcs(list);
    expect(g.map(x => x.root.pid).sort((a, b) => a - b)).toEqual([9800, 27456]);
    expect(g.find(x => x.root.pid === 27456)!.count).toBe(4);
    // The grandchild belongs to the application, not to its own parent.
    expect(g.find(x => x.root.pid === 9800)!.count).toBe(4);
  });

  it('keeps a genuinely parentless process as its own entry', () => {
    const g = groupProcs([p(3264, 1, 'UnrealEditor.exe')]);
    expect(g).toHaveLength(1);
    expect(g[0].kids).toEqual([]);
    expect(g[0].root.parent).toBe('');
  });
});
