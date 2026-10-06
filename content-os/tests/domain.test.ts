import { describe, expect, it } from 'vitest';
import { computeReadiness, effectiveDeps, planBoardMove, type StageModes, type StageStates } from '../shared/domain';

const reel: StageModes = { SCHEDULE: 'OPTIONAL' };
const quoteCard: StageModes = { RESEARCH: 'OPTIONAL', VOICE: 'NONE', EDIT: 'NONE', COVER: 'NONE', SCHEDULE: 'OPTIONAL' };

describe('readiness engine', () => {
  it('an untouched episode is an idea at 0%', () => {
    const r = computeReadiness({ modes: reel, states: {} });
    expect(r.phase).toBe('IDEA');
    expect(r.readiness).toBe(0);
    expect(r.nextStage).toBe('RESEARCH');
    expect(r.actionable).toEqual(['RESEARCH']);
  });

  it('supports parallel state: voice done while visual is in progress', () => {
    const states: StageStates = { RESEARCH: 'DONE', CONCEPT: 'DONE', SCRIPT: 'DONE', VOICE: 'DONE', VISUAL: 'IN_PROGRESS', CAPTION: 'DONE' };
    const r = computeReadiness({ modes: reel, states });
    expect(r.phase).toBe('VISUAL');
    expect(r.nextStage).toBe('VISUAL');
    expect(r.actionable).toContain('VISUAL');
    expect(r.actionable).toContain('COVER'); // cover only needs the concept
    expect(r.actionable).not.toContain('EDIT'); // edit needs voice AND visual
    expect(r.readiness).toBeGreaterThan(40);
    expect(r.readiness).toBeLessThan(80);
  });

  it('matches the spec example: everything but edit/qc/publish → edit is the blocker, ~80%', () => {
    const states: StageStates = { RESEARCH: 'DONE', CONCEPT: 'DONE', SCRIPT: 'DONE', VOICE: 'DONE', VISUAL: 'DONE', EDIT: 'IN_PROGRESS', CAPTION: 'DONE', COVER: 'DONE' };
    const r = computeReadiness({ modes: reel, states });
    expect(r.nextStage).toBe('EDIT');
    expect(r.phase).toBe('EDIT');
    expect(r.readiness).toBeGreaterThanOrEqual(75);
    expect(r.readiness).toBeLessThan(90);
  });

  it('blocked stages are reported and excluded from actionable', () => {
    const r = computeReadiness({ modes: reel, states: { RESEARCH: 'DONE', CONCEPT: 'DONE', SCRIPT: 'BLOCKED' } });
    expect(r.blocked).toBe(true);
    expect(r.blockedStages).toEqual(['SCRIPT']);
    expect(r.actionable).not.toContain('SCRIPT');
  });

  it('content types change what is required (quote card skips voice/edit)', () => {
    expect(effectiveDeps(quoteCard, 'QC').sort()).toEqual(['SCRIPT', 'VISUAL']);
    const states: StageStates = { CONCEPT: 'DONE', SCRIPT: 'DONE', VISUAL: 'DONE', QC: 'DONE', CAPTION: 'DONE' };
    const r = computeReadiness({ modes: quoteCard, states });
    expect(r.ready).toBe(true);
    expect(r.phase).toBe('READY');
  });

  it('publications override stage flags', () => {
    const r = computeReadiness({ modes: reel, states: {}, publishedCount: 1 });
    expect(r.phase).toBe('PUBLISHED');
    expect(r.readiness).toBe(100);
  });
});

describe('board moves preserve parallel progress', () => {
  it('moving forward completes earlier stages only', () => {
    const plan = planBoardMove(reel, { RESEARCH: 'DONE', CAPTION: 'DONE' }, 'EDIT');
    expect(plan).toMatchObject({ CONCEPT: 'DONE', SCRIPT: 'DONE', VOICE: 'DONE', VISUAL: 'DONE', EDIT: 'IN_PROGRESS' });
    expect(plan.CAPTION).toBeUndefined(); // already done — untouched
    expect(plan.QC).toBeUndefined(); // later stages untouched
  });

  it('moving backward reopens the target without destroying later work', () => {
    const states: StageStates = { RESEARCH: 'DONE', CONCEPT: 'DONE', SCRIPT: 'DONE', VOICE: 'DONE', VISUAL: 'DONE', EDIT: 'IN_PROGRESS', CAPTION: 'DONE' };
    const plan = planBoardMove(reel, states, 'SCRIPT');
    expect(plan).toEqual({ SCRIPT: 'IN_PROGRESS' });
    const after = computeReadiness({ modes: reel, states: { ...states, ...plan } });
    expect(after.phase).toBe('SCRIPT');
    expect({ ...states, ...plan }.VOICE).toBe('DONE');
  });

  it('every target column is where the card lands', () => {
    for (const target of ['RESEARCH', 'SCRIPT', 'VOICE', 'VISUAL', 'EDIT', 'QC', 'READY'] as const) {
      const plan = planBoardMove(reel, {}, target);
      expect(computeReadiness({ modes: reel, states: plan }).phase).toBe(target);
    }
  });
});
