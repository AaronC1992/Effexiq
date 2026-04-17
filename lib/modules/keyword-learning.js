/**
 * Keyword learning.
 *
 * Records which keywords fire stingers and how often. Keywords that
 * fire too frequently (spam) get a longer cooldown; keywords that
 * almost never fire get their cooldown reduced so they feel responsive.
 *
 * Persists to localStorage under `Effexiq_keyword_learning_v1` so the
 * tuning survives across sessions.
 */

const STORAGE_KEY = 'Effexiq_keyword_learning_v1';
const MAX_TRACKED = 256;
const BASE_COOLDOWN_MS = 3000;
const MIN_COOLDOWN_MS  = 1200;
const MAX_COOLDOWN_MS  = 12000;
// Fires per minute above which we consider a keyword "spammy".
const SPAM_THRESHOLD = 6;

/** @type {Map<string, {fires:number[], total:number}>} */
const state = new Map();
let _loaded = false;

function load() {
    if (_loaded || typeof localStorage === 'undefined') return;
    _loaded = true;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        for (const [k, v] of Object.entries(parsed)) {
            if (v && Array.isArray(v.fires)) {
                state.set(k, { fires: v.fires.slice(-30), total: Number(v.total) || 0 });
            }
        }
    } catch {}
}

let _saveTimer = null;
function scheduleSave() {
    if (typeof localStorage === 'undefined') return;
    if (_saveTimer) return;
    _saveTimer = setTimeout(() => {
        _saveTimer = null;
        try {
            // trim to MAX_TRACKED by total-fires
            if (state.size > MAX_TRACKED) {
                const entries = [...state.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, MAX_TRACKED);
                state.clear();
                for (const [k, v] of entries) state.set(k, v);
            }
            const out = {};
            for (const [k, v] of state) out[k] = v;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
        } catch {}
    }, 3000);
}

export function recordFire(keyword) {
    load();
    if (!keyword) return;
    const k = String(keyword).toLowerCase();
    const now = Date.now();
    let rec = state.get(k);
    if (!rec) { rec = { fires: [], total: 0 }; state.set(k, rec); }
    rec.fires.push(now);
    // Keep last 30 fires
    if (rec.fires.length > 30) rec.fires.splice(0, rec.fires.length - 30);
    rec.total++;
    scheduleSave();
}

/**
 * Return the adaptive cooldown (ms) for a keyword based on its recent
 * firing rate.
 */
export function cooldownFor(keyword) {
    load();
    const k = String(keyword || '').toLowerCase();
    const rec = state.get(k);
    if (!rec || rec.fires.length < 3) return BASE_COOLDOWN_MS;

    // Fires in the last 60s.
    const cutoff = Date.now() - 60_000;
    const recent = rec.fires.filter(t => t >= cutoff).length;

    if (recent >= SPAM_THRESHOLD) {
        // Scale up linearly beyond the spam threshold.
        const over = recent - SPAM_THRESHOLD;
        return Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS + over * 1200);
    }
    if (recent <= 1) return MIN_COOLDOWN_MS;
    return BASE_COOLDOWN_MS;
}

export function getStats() {
    load();
    const out = [];
    for (const [k, v] of state) {
        out.push({ keyword: k, total: v.total, recent60s: v.fires.filter(t => t >= Date.now() - 60_000).length });
    }
    return out.sort((a, b) => b.total - a.total);
}

export function reset() {
    state.clear();
    if (typeof localStorage !== 'undefined') {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
}
