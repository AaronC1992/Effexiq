/**
 * Priority / layering budget — caps the number of concurrent sounds
 * per category so we never stack 6 fire crackles on top of 4 winds.
 *
 * The engine already has a global MAX_SIMULTANEOUS_SFX; this is a
 * finer-grained per-category cap, plus a simple priority scheme so a
 * "stinger" cue can evict an "ambient" cue when the budget is full.
 *
 * Usage:
 *   const budget = new PriorityBudget({ ambient: 2, sfx: 4, stinger: 2, music: 1 });
 *   if (budget.canAdd('ambient')) { ...start sound...; const token = budget.add('ambient', id); }
 *   // when the sound ends:
 *   budget.remove(token);
 *
 *   // to evict the oldest low-priority sound in a category:
 *   const evicted = budget.evictOldest('ambient');   // returns {id,token} or null
 */

const DEFAULT_CAPS = {
    ambient: 3,
    sfx: 4,
    stinger: 2,
    music: 1,
    voice: 1,
};

const PRIORITY = { ambient: 1, sfx: 2, voice: 3, stinger: 4, music: 3 };

export class PriorityBudget {
    constructor(caps = {}) {
        this.caps = { ...DEFAULT_CAPS, ...caps };
        /** @type {Map<number, {category:string, id:string, t:number}>} */
        this.entries = new Map();
        this._nextToken = 1;
    }

    _countByCategory(cat) {
        let n = 0;
        for (const e of this.entries.values()) if (e.category === cat) n++;
        return n;
    }

    setCap(category, value) {
        if (value >= 0) this.caps[category] = value;
    }

    /** Returns true if another sound of this category can start right now. */
    canAdd(category) {
        const cap = this.caps[category] ?? Infinity;
        return this._countByCategory(category) < cap;
    }

    /** Record a sound as playing. Returns an opaque token to remove later. */
    add(category, id) {
        const token = this._nextToken++;
        this.entries.set(token, { category, id: id || '', t: Date.now() });
        return token;
    }

    remove(token) {
        if (token == null) return false;
        return this.entries.delete(token);
    }

    /**
     * Return the oldest (longest-running) entry in a category so callers
     * can fade it out to free a slot. Does NOT remove it; caller should
     * call remove(token) when the sound has actually stopped.
     */
    oldestIn(category) {
        let oldest = null;
        for (const [token, e] of this.entries) {
            if (e.category !== category) continue;
            if (!oldest || e.t < oldest.entry.t) oldest = { token, entry: e };
        }
        return oldest ? { token: oldest.token, id: oldest.entry.id } : null;
    }

    /**
     * Decide whether an incoming cue of `category` should pre-empt an
     * existing cue of `otherCategory`. Used when global simultaneous
     * count is at the cap.
     */
    static canPreempt(incomingCategory, otherCategory) {
        const a = PRIORITY[incomingCategory] ?? 0;
        const b = PRIORITY[otherCategory] ?? 0;
        return a > b;
    }

    getStats() {
        const byCat = {};
        for (const e of this.entries.values()) {
            byCat[e.category] = (byCat[e.category] || 0) + 1;
        }
        return { total: this.entries.size, byCat, caps: { ...this.caps } };
    }

    clear() {
        this.entries.clear();
    }
}
