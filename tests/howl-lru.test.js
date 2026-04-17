import { describe, it, expect, vi } from 'vitest';
import { HowlLRU } from '../lib/modules/howl-lru.js';

function mockHowl({ playing = false } = {}) {
    return {
        stop: vi.fn(),
        unload: vi.fn(),
        playing: () => playing,
    };
}

describe('howl-lru', () => {
    it('stores and retrieves Howls', () => {
        const c = new HowlLRU(3);
        const h = mockHowl();
        c.set('a', h);
        expect(c.get('a')).toBe(h);
    });

    it('evicts the least recently used non-playing Howl', () => {
        const c = new HowlLRU(2);
        const a = mockHowl();
        const b = mockHowl();
        const d = mockHowl();
        c.set('a', a);
        c.set('b', b);
        c.get('a');        // promote a
        c.set('c', d);     // should evict b
        expect(c.has('b')).toBe(false);
        expect(b.unload).toHaveBeenCalled();
        expect(c.has('a')).toBe(true);
        expect(c.has('c')).toBe(true);
    });

    it('skips eviction when the LRU is currently playing', () => {
        const c = new HowlLRU(1);
        const playing = mockHowl({ playing: true });
        const next = mockHowl();
        c.set('a', playing);
        c.set('b', next);           // can't evict a — it's playing
        expect(c.has('a')).toBe(true);
        expect(c.has('b')).toBe(true);
        expect(playing.unload).not.toHaveBeenCalled();
    });

    it('deleteIfNotPlaying respects the playing state', () => {
        const c = new HowlLRU(2);
        const p = mockHowl({ playing: true });
        c.set('p', p);
        expect(c.deleteIfNotPlaying('p')).toBe(false);
        expect(c.has('p')).toBe(true);
    });
});
