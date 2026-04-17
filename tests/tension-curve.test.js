import { describe, it, expect } from 'vitest';
import { TensionCurve } from '../lib/modules/tension-curve.js';

describe('tension-curve', () => {
    it('starts at a reasonable middle value', () => {
        const t = new TensionCurve();
        expect(t.value).toBeGreaterThan(0.2);
        expect(t.value).toBeLessThan(0.6);
    });

    it('bumps up on events and caps at 1', () => {
        const t = new TensionCurve();
        for (let i = 0; i < 20; i++) t.bumpEvent();
        expect(t.value).toBeLessThanOrEqual(1);
        expect(t.value).toBeGreaterThan(0.9);
    });

    it('decays toward baseline over time', () => {
        const t = new TensionCurve();
        t.setMood('calm', 0.3);     // baseline ~0.14
        for (let i = 0; i < 10; i++) t.bumpEvent();
        const peak = t.value;
        // Fast-forward by mutating _lastUpdate (no waiting in tests)
        t._lastUpdate = Date.now() - 30_000;
        const later = t.sample();
        expect(later).toBeLessThan(peak);
    });

    it('reverbWet increases with tension', () => {
        const t = new TensionCurve();
        t.setMood('calm');
        const calm = t.reverbWet();
        const t2 = new TensionCurve();
        t2.setMood('fearful', 0.9);
        for (let i = 0; i < 5; i++) t2.bumpEvent();
        const peak = t2.reverbWet();
        expect(peak).toBeGreaterThan(calm);
    });

    it('musicDuck pulls music volume down at peak', () => {
        const t = new TensionCurve();
        for (let i = 0; i < 15; i++) t.bumpEvent();
        expect(t.musicDuck()).toBeLessThan(0.8);
        expect(t.musicDuck()).toBeGreaterThan(0.55);
    });
});
