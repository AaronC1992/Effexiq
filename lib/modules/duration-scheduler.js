/**
 * Duration-aware cue scheduler.
 *
 * Today the engine schedules stingers on a fixed cadence. Result: a
 * long "distant thunder" is interrupted by the next stinger before it
 * finishes. This module schedules the next cue based on the current
 * cue's duration plus a cooldown, so we never double-book the bus.
 *
 * It is stateless by design — you hand it the current timeline and
 * the next candidate, and it returns the earliest ok-to-start time.
 */

const DEFAULT_GAP_MS = 1500;
const MIN_COOLDOWN_MS = 800;

/**
 * @typedef {Object} PlayingCue
 * @property {string} id        Sound id
 * @property {number} startedAt epoch ms
 * @property {number} durationMs
 * @property {string} [category]
 */

/**
 * Find the earliest time at which a cue of `durationMs` can start
 * without overlapping existing cues of the same category.
 *
 * @param {PlayingCue[]} playing
 * @param {{ category?:string, durationMs:number, now?:number, gapMs?:number }} next
 * @returns {number} epoch ms
 */
export function earliestStart(playing, next) {
    const now = next.now ?? Date.now();
    const gap = next.gapMs ?? DEFAULT_GAP_MS;
    let t = now;
    for (const p of (playing || [])) {
        if (next.category && p.category && p.category !== next.category) continue;
        const endAt = (p.startedAt || 0) + (p.durationMs || 0) + gap;
        if (endAt > t) t = endAt;
    }
    return t;
}

/**
 * Return how long (ms) a caller should wait before firing a cue, or 0
 * if it can fire immediately.
 */
export function waitBeforeStart(playing, next) {
    const earliest = earliestStart(playing, next);
    return Math.max(0, earliest - (next.now ?? Date.now()));
}

/**
 * Decide the cooldown for a given cue id after it finishes. Shorter
 * for rare/surprise cues, longer for beds/loops so they don't machine-gun.
 */
export function cooldownFor(soundId, category) {
    const id = String(soundId || '').toLowerCase();
    if (category === 'ambient' || /wind|rain|fire|crickets|thunder/.test(id)) return 6000;
    if (category === 'stinger') return 2500;
    if (/knock|slam|creak|scream|boom|crash/.test(id)) return 3000;
    return MIN_COOLDOWN_MS;
}
