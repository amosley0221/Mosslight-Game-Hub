import { describe, expect, it } from 'vitest';
import { parseCard, toStatus } from './cards';

const REVIEWED = `---
id: 1a13frq
title: Identify shadow-casting lights at the fuel bay
owner: claude
status: reviewed
created: 2026-09-24T03:43:03.143Z
---

# Identify shadow-casting lights at the fuel bay

## Objective
Identify the fuel bay's shadow-casting lights from source.

## History
- 2026-09-24 — Codex review: all five checks pass.
`;

describe('task cards', () => {
  // An agent writing its own status word once made the hub disown the card and replace it with a
  // blank template, losing the review history. A card it can't classify must still be a card.
  it('keeps a card whose status the agents invented', () => {
    const c = parseCard(REVIEWED);
    expect(c).not.toBeNull();
    expect(c!.id).toBe('1a13frq');
    expect(c!.rawStatus).toBe('reviewed');
    expect(c!.status).toBe('doing');
    expect(c!.body).toContain('Codex review: all five checks pass.');
  });

  it('reads unknown words as work in flight, and finished ones as done', () => {
    expect(toStatus('ready for review')).toBe('doing');
    expect(toStatus('blocked')).toBe('doing');
    expect(toStatus('completed')).toBe('done');
    expect(toStatus('todo')).toBe('todo');
    expect(toStatus('')).toBeNull();
  });

  it('still refuses a file that is not a card', () => {
    expect(parseCard('# Just some notes\n')).toBeNull();
    expect(parseCard('---\ntitle: no id\nowner: claude\nstatus: todo\n---\n')).toBeNull();
  });
});
