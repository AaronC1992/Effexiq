import { describe, it, expect } from 'vitest';
import { earliestStart, waitBeforeStart, cooldownFor } from '../lib/modules/duration-scheduler.js';

describe('duration-scheduler', () => {
    const now = 1_000_000;

    it('earliestStart ignores empty playing list', () => {
        expect(earliestStart([], { durationMs: 2000, now })).toBe(now);
    });

    it('earliestStart returns end-of-existing + gap when same category', () => {
        const playing = [{ id: 'a', startedAt: now, durationMs: 3000, category: 'ambient' }];
        const t = earliestStart(playing, { category: 'ambient', durationMs: 1000, now, gapMs: 500 });
        expect(t).toBe(now + 3000 + 500);
    });

    it('earliestStart ignores other-category cues', () => {
        const playing = [{ id: 'a', startedAt: now, durationMs: 5000, category: 'sfx' }];
        const t = earliestStart(playing, { category: 'ambient', durationMs: 1000, now });
        expect(t).toBe(now);
    });

    it('waitBeforeStart returns a non-negative delta', () => {
        const playing = [{ id: 'a', startedAt: now - 500, durationMs: 2000, category: 'ambient' }];
        const w = waitBeforeStart(playing, { category: 'ambient', durationMs: 1000, now, gapMs: 1000 });
        expect(w).toBeGreaterThan(0);
    });

    it('cooldownFor varies by id category', () => {
        expect(cooldownFor('distant thunder', 'ambient')).toBeGreaterThanOrEqual(6000);
        expect(cooldownFor('door slam')).toBeGreaterThanOrEqual(3000);
        expect(cooldownFor('random click')).toBeGreaterThan(0);
    });
});
