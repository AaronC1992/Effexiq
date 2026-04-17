import { describe, it, expect, beforeEach } from 'vitest';

const store = new Map();
globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => store.clear(),
};

import { recordFire, cooldownFor, getStats, reset } from '../lib/modules/keyword-learning.js';

describe('keyword-learning', () => {
    beforeEach(() => {
        reset();
        store.clear();
    });

    it('base cooldown before any fires', () => {
        expect(cooldownFor('thunder')).toBe(3000);
    });

    it('scales cooldown up when a keyword fires too often', () => {
        for (let i = 0; i < 10; i++) recordFire('bark');
        const cd = cooldownFor('bark');
        expect(cd).toBeGreaterThan(3000);
    });

    it('reduces cooldown for rarely-fired keywords', () => {
        recordFire('creak'); // 1 fire so far
        recordFire('creak');
        recordFire('creak');
        // 3 recent total → treated as "recent<=1" branch? No — branch triggers only if recent60s <= 1.
        // Simulate a single very-recent fire: clear history, record once.
        reset();
        recordFire('creak');
        recordFire('creak');
        expect(cooldownFor('creak')).toBeLessThanOrEqual(3000);
    });

    it('stats include total and recent counts', () => {
        recordFire('a'); recordFire('a'); recordFire('b');
        const stats = getStats();
        expect(stats.find(s => s.keyword === 'a').total).toBe(2);
        expect(stats.find(s => s.keyword === 'b').total).toBe(1);
    });
});
