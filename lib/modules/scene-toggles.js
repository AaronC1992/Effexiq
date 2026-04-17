/**
 * Scene toggles — horror "restrained" mode + combat drum bed slot.
 *
 * horrorRestrained:
 *   When on (saved to localStorage), horror-mode stingers run at 60%
 *   volume and with a 2.5x longer cooldown, and screechy SFX get
 *   filtered out entirely. Used by narrators who find horror mode
 *   too loud / jump-scary by default.
 *
 * combatDrumBed:
 *   A named drum loop slot that can be armed for combat scenes in
 *   DnD mode. When `isActive()` is true, callers should layer the
 *   configured loop under the music bus at the configured volume.
 */

const HORROR_KEY = 'Effexiq_horror_restrained_v1';
const COMBAT_KEY = 'Effexiq_combat_drum_bed_v1';

function safeParse(raw, fallback) {
    try { return JSON.parse(raw ?? 'null') ?? fallback; } catch { return fallback; }
}
function safeWrite(key, val) {
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(val));
    } catch {}
}

// ── Horror restrained ────────────────────────────────────────
export function isHorrorRestrained() {
    if (typeof localStorage === 'undefined') return false;
    return !!safeParse(localStorage.getItem(HORROR_KEY), false);
}
export function setHorrorRestrained(on) {
    safeWrite(HORROR_KEY, !!on);
}

// Sound IDs / patterns that are screechy enough to skip entirely when restrained.
const SCREECHY = /(scream|screech|shriek|static|feedback|air.horn|buzzer)/i;

/**
 * Apply restrained-mode tweaks to a decision object before it's
 * handed to the playback pipeline. Safe to call even when restrained
 * mode is off — returns the input unchanged.
 */
export function applyHorrorRestraint(decision) {
    if (!decision || !isHorrorRestrained()) return decision;
    const copy = { ...decision };
    if (Array.isArray(copy.sfx)) {
        copy.sfx = copy.sfx
            .filter(s => !SCREECHY.test(s?.id || ''))
            .map(s => ({ ...s, volume: Math.min(s.volume ?? 0.7, 0.55) }));
    }
    if (copy.music && typeof copy.music.volume === 'number') {
        copy.music = { ...copy.music, volume: Math.min(copy.music.volume, 0.65) };
    }
    copy._restrained = true;
    return copy;
}

/** Suggested cooldown multiplier for horror stingers when restrained. */
export function horrorCooldownMultiplier() {
    return isHorrorRestrained() ? 2.5 : 1.0;
}

// ── Combat drum bed ──────────────────────────────────────────
export function getCombatDrumBedConfig() {
    return safeParse(
        typeof localStorage !== 'undefined' ? localStorage.getItem(COMBAT_KEY) : null,
        { enabled: false, soundId: null, volume: 0.35 }
    );
}

export function setCombatDrumBedConfig(cfg) {
    const existing = getCombatDrumBedConfig();
    const next = { ...existing, ...(cfg || {}) };
    if (typeof next.volume === 'number') next.volume = Math.max(0, Math.min(1, next.volume));
    safeWrite(COMBAT_KEY, next);
    return next;
}

/** Should the combat drum bed be audible right now? */
export function shouldPlayCombatBed({ mode, mood, tension } = {}) {
    const cfg = getCombatDrumBedConfig();
    if (!cfg.enabled || !cfg.soundId) return false;
    if (mode !== 'dnd' && mode !== 'auto') return false;
    const heat = typeof tension === 'number' ? tension : 0.5;
    const combatMood = ['tense', 'angry', 'fearful', 'excited'].includes(String(mood || ''));
    return combatMood && heat >= 0.55;
}
