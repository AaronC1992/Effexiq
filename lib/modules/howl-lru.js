/**
 * LRU cache for Howl instances.
 *
 * Howler keeps every loaded sound in memory until `.unload()` is called.
 * On long sessions (esp. bedtime / streaming), that balloons RAM and
 * eventually causes audio dropouts. This module wraps a Map with LRU
 * eviction that calls `.stop()` + `.unload()` on the evicted Howl.
 *
 * Safety: we only evict Howls that are NOT currently playing. If a key
 * is retrieved (get) it moves to MRU; if it is paused/stopped and older
 * than all others, it gets evicted first.
 *
 * Usage:
 *   const cache = new HowlLRU(24);
 *   cache.set('urlA', howlA);
 *   const h = cache.get('urlA'); // promotes to MRU
 *   cache.deleteIfNotPlaying('urlA');
 */

const DEFAULT_MAX = 24;

export class HowlLRU {
    constructor(maxSize = DEFAULT_MAX) {
        this.maxSize = Math.max(2, maxSize | 0);
        /** @type {Map<string, any>} */
        this.map = new Map();
        this.evictions = 0;
    }

    get size() { return this.map.size; }

    get(key) {
        if (!this.map.has(key)) return undefined;
        const v = this.map.get(key);
        // promote to MRU
        this.map.delete(key);
        this.map.set(key, v);
        return v;
    }

    has(key) { return this.map.has(key); }

    /**
     * Insert a Howl. If the cache is full, the oldest non-playing Howl is
     * unloaded. If ALL entries are playing we grow temporarily rather than
     * killing a playing sound.
     */
    set(key, howl) {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, howl);
        if (this.map.size > this.maxSize) this._evictIfPossible();
        return howl;
    }

    _evictIfPossible() {
        for (const [k, h] of this.map) {
            if (!_isPlaying(h)) {
                this._unload(h);
                this.map.delete(k);
                this.evictions++;
                return k;
            }
        }
        // Everyone's playing — skip eviction this time. Cache temporarily
        // exceeds maxSize; the next insert will try again.
        return null;
    }

    _unload(h) {
        try { h?.stop?.(); } catch {}
        try { h?.unload?.(); } catch {}
    }

    /** Force-delete a key. Returns true if it was present. */
    delete(key) {
        const h = this.map.get(key);
        if (!h) return false;
        this._unload(h);
        this.map.delete(key);
        return true;
    }

    /** Delete but only if the Howl isn't currently playing. */
    deleteIfNotPlaying(key) {
        const h = this.map.get(key);
        if (!h) return false;
        if (_isPlaying(h)) return false;
        this._unload(h);
        this.map.delete(key);
        return true;
    }

    clear() {
        for (const h of this.map.values()) this._unload(h);
        this.map.clear();
    }

    getStats() {
        let playing = 0;
        for (const h of this.map.values()) if (_isPlaying(h)) playing++;
        return { size: this.map.size, max: this.maxSize, playing, evictions: this.evictions };
    }
}

function _isPlaying(h) {
    try { return !!(h && typeof h.playing === 'function' && h.playing()); }
    catch { return false; }
}
