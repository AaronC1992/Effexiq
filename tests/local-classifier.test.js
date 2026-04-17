import { describe, it, expect } from 'vitest';
import { classifyLocal } from '../lib/modules/local-classifier.js';

describe('local-classifier', () => {
    it('returns neutral on empty input', () => {
        const d = classifyLocal('');
        expect(d.mood.primary).toBe('neutral');
        expect(d.sfx).toEqual([]);
        expect(d.scene).toBeNull();
    });

    it('detects fearful mood in a horror line', () => {
        const d = classifyLocal('She was terrified in the dark empty room');
        expect(['fearful', 'ominous']).toContain(d.mood.primary);
        expect(d.mood.intensity).toBeGreaterThan(0.3);
    });

    it('flags a door knock as an SFX event', () => {
        const d = classifyLocal('There was a sudden knock at the door');
        const ids = d.sfx.map(s => s.id);
        expect(ids).toContain('door knock');
    });

    it('caps to max 2 SFX per decision', () => {
        const d = classifyLocal('They heard a knock, a slam, a creak, a scream and a crash all at once');
        expect(d.sfx.length).toBeLessThanOrEqual(2);
    });

    it('does not propose a music change', () => {
        const d = classifyLocal('Quiet rainy morning in the forest');
        expect(d.music.id).toBeNull();
    });

    it('pulls location + weather when present', () => {
        const d = classifyLocal('They walked through the forest as the rain began');
        expect(d.worldState.location).toBe('forest');
        expect(d.worldState.weather).toBe('rain');
    });
});
