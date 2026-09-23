// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { emptyData, purgeDemo } from './seed';
import { sampleData } from '../test/fixtures';
import { merge, toDoc } from '../sync/merge';

describe('first run and demo cleanup', () => {
  it('a new install starts with an empty library', () => {
    const d = emptyData();
    expect(d.projects).toEqual([]);
    expect(d.assets).toEqual([]);
    expect(d.messages).toEqual({});
    expect(d.usageBy).toEqual({});
  });

  it('removes the old demo projects, assets, messages and usage', () => {
    const old = sampleData();
    const mine = { ...old.projects[0], id: 'my-game', name: 'My Game' };
    const d = purgeDemo({ ...old, projects: [...old.projects, mine] });
    expect(d.projects.map(p => p.id)).toEqual(['my-game']);
    expect(d.assets).toEqual([]);
    expect(d.messages.global || []).toEqual([]);
    expect(d.usageBy).toEqual({});
  });

  it('the cleanup syncs: another device that still has the demo drops it too', () => {
    const cleaned = purgeDemo(sampleData());
    const other = merge(sampleData(), toDoc(cleaned));
    expect(other.projects).toEqual([]);
    expect(other.assets).toEqual([]);
    expect(other.usageBy.demo).toBeUndefined();
  });
});
