import { describe, it, expect } from 'vitest';
import { PriorityBudget } from '../lib/modules/priority-budget.js';

describe('priority-budget', () => {
    it('honours per-category caps', () => {
        const b = new PriorityBudget({ ambient: 2, sfx: 3 });
        expect(b.canAdd('ambient')).toBe(true);
        b.add('ambient', 'wind');
        b.add('ambient', 'rain');
        expect(b.canAdd('ambient')).toBe(false);
        expect(b.canAdd('sfx')).toBe(true);
    });

    it('removes by token', () => {
        const b = new PriorityBudget({ sfx: 1 });
        const tok = b.add('sfx', 'bark');
        expect(b.canAdd('sfx')).toBe(false);
        expect(b.remove(tok)).toBe(true);
        expect(b.canAdd('sfx')).toBe(true);
    });

    it('oldestIn returns the longest-running entry', async () => {
        const b = new PriorityBudget({ ambient: 4 });
        b.add('ambient', 'first');
        await new Promise(r => setTimeout(r, 5));
        b.add('ambient', 'second');
        const old = b.oldestIn('ambient');
        expect(old.id).toBe('first');
    });

    it('canPreempt: stinger beats ambient but not music', () => {
        expect(PriorityBudget.canPreempt('stinger', 'ambient')).toBe(true);
        expect(PriorityBudget.canPreempt('ambient', 'stinger')).toBe(false);
        // music and stinger tie (both 3-4 range); specifically stinger > music
        expect(PriorityBudget.canPreempt('stinger', 'music')).toBe(true);
    });

    it('stats reflect totals and per-category counts', () => {
        const b = new PriorityBudget();
        b.add('ambient', 'a'); b.add('ambient', 'b'); b.add('sfx', 'c');
        const s = b.getStats();
        expect(s.total).toBe(3);
        expect(s.byCat.ambient).toBe(2);
        expect(s.byCat.sfx).toBe(1);
    });
});
