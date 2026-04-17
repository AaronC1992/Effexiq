import { describe, it, expect, beforeEach } from 'vitest';

// vitest's default node env has no localStorage — polyfill a minimal one.
const store = new Map();
globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => store.clear(),
};

import {
    isHorrorRestrained,
    setHorrorRestrained,
    applyHorrorRestraint,
    horrorCooldownMultiplier,
    getCombatDrumBedConfig,
    setCombatDrumBedConfig,
    shouldPlayCombatBed,
} from '../lib/modules/scene-toggles.js';

describe('scene-toggles', () => {
    beforeEach(() => store.clear());

    it('horror restrained is off by default', () => {
        expect(isHorrorRestrained()).toBe(false);
        expect(horrorCooldownMultiplier()).toBe(1);
    });

    it('toggle persists via localStorage', () => {
        setHorrorRestrained(true);
        expect(isHorrorRestrained()).toBe(true);
        expect(horrorCooldownMultiplier()).toBeGreaterThan(1);
    });

    it('applyHorrorRestraint caps volumes and filters screechy SFX', () => {
        setHorrorRestrained(true);
        const decision = {
            music: { id: 'dark bed', volume: 0.9 },
            sfx: [
                { id: 'scream far', volume: 0.9 },
                { id: 'door creak', volume: 0.8 },
            ],
        };
        const out = applyHorrorRestraint(decision);
        expect(out._restrained).toBe(true);
        expect(out.music.volume).toBeLessThanOrEqual(0.65);
        expect(out.sfx.find(s => s.id === 'scream far')).toBeUndefined();
        expect(out.sfx.find(s => s.id === 'door creak').volume).toBeLessThanOrEqual(0.55);
    });

    it('applyHorrorRestraint is a no-op when off', () => {
        const d = { sfx: [{ id: 'scream', volume: 0.9 }] };
        const out = applyHorrorRestraint(d);
        expect(out).toBe(d);
    });

    it('combat drum bed config round-trips', () => {
        const saved = setCombatDrumBedConfig({ enabled: true, soundId: 'drum bed 1', volume: 0.4 });
        expect(saved.enabled).toBe(true);
        expect(getCombatDrumBedConfig().soundId).toBe('drum bed 1');
    });

    it('shouldPlayCombatBed requires dnd mode + combat mood + heat', () => {
        setCombatDrumBedConfig({ enabled: true, soundId: 'drum' });
        expect(shouldPlayCombatBed({ mode: 'bedtime', mood: 'tense', tension: 0.8 })).toBe(false);
        expect(shouldPlayCombatBed({ mode: 'dnd', mood: 'calm', tension: 0.8 })).toBe(false);
        expect(shouldPlayCombatBed({ mode: 'dnd', mood: 'tense', tension: 0.2 })).toBe(false);
        expect(shouldPlayCombatBed({ mode: 'dnd', mood: 'tense', tension: 0.8 })).toBe(true);
    });
});
