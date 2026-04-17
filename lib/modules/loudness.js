/**
 * Per-file loudness normalization.
 *
 * R2 assets come from ElevenLabs with wildly different peaks — a whisper
 * and a gunshot land at different dB. We decode each asset once, compute
 * RMS, and cache a gain multiplier keyed by sound id. Subsequent plays
 * apply that multiplier so relative loudness stays sane.
 *
 * Cache persists to localStorage under Effexiq_loudness_cache_v1 so
 * subsequent sessions skip the decode cost.
 *
 * Usage:
 *   import { getReplayGain, applyGainToVolume } from '.../loudness.js';
 *   const g = await getReplayGain(id, url, audioCtx); // Promise<number>
 *   howl.volume(applyGainToVolume(0.8, id));
 */

const STORAGE_KEY = 'Effexiq_loudness_cache_v1';
const CACHE_VERSION = 1;
// Target RMS (normalized). Assets louder than this get a < 1.0 gain,
// quieter ones get > 1.0 (capped so we don't blow up noise floors).
const TARGET_RMS = 0.18;
const MIN_GAIN = 0.5;
const MAX_GAIN = 1.6;
// Don't decode anything we have no chance of analysing quickly.
const MAX_DECODE_SIZE = 6 * 1024 * 1024; // 6 MB

/** @type {Map<string, number>} */
const memCache = new Map();
/** @type {Map<string, Promise<number>>} */
const inflight = new Map();
let _loaded = false;

function loadFromStorage() {
    if (_loaded || typeof localStorage === 'undefined') return;
    _loaded = true;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.v !== CACHE_VERSION || !parsed?.gains) return;
        for (const [k, v] of Object.entries(parsed.gains)) {
            if (typeof v === 'number' && Number.isFinite(v)) memCache.set(k, v);
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
            const gains = Object.fromEntries(memCache);
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: CACHE_VERSION, gains }));
        } catch {}
    }, 2500);
}

export function getCachedGain(id) {
    loadFromStorage();
    return memCache.get(id);
}

/**
 * Compute (or fetch cached) replay gain for an asset. Returns a number
 * safe to multiply into a volume (0..1). Never throws — returns 1.0 on
 * any failure so playback is never blocked on normalization.
 */
export async function getReplayGain(id, url, audioCtx) {
    loadFromStorage();
    if (!id || !url) return 1.0;
    if (memCache.has(id)) return memCache.get(id);
    if (inflight.has(id)) return inflight.get(id);
    if (!audioCtx || typeof audioCtx.decodeAudioData !== 'function') return 1.0;

    const p = (async () => {
        try {
            const resp = await fetch(url, { cache: 'force-cache' });
            if (!resp.ok) return 1.0;
            const len = Number(resp.headers.get('content-length') || 0);
            if (len && len > MAX_DECODE_SIZE) return 1.0;
            const buf = await resp.arrayBuffer();
            if (buf.byteLength > MAX_DECODE_SIZE) return 1.0;

            // decodeAudioData detaches the buffer in some engines — clone.
            const copy = buf.slice(0);
            const audioBuf = await new Promise((res, rej) => {
                try {
                    const r = audioCtx.decodeAudioData(copy, res, rej);
                    if (r && typeof r.then === 'function') r.then(res, rej);
                } catch (e) { rej(e); }
            });
            const rms = computeRMS(audioBuf);
            if (!rms || !Number.isFinite(rms) || rms <= 0) return 1.0;
            let gain = TARGET_RMS / rms;
            gain = Math.max(MIN_GAIN, Math.min(MAX_GAIN, gain));
            memCache.set(id, gain);
            scheduleSave();
            return gain;
        } catch {
            return 1.0;
        } finally {
            inflight.delete(id);
        }
    })();
    inflight.set(id, p);
    return p;
}

function computeRMS(audioBuffer) {
    const chCount = Math.max(1, audioBuffer.numberOfChannels);
    const len = audioBuffer.length;
    if (!len) return 0;
    // Sample up to 44100 evenly-spaced points to keep analysis cheap for
    // long music files. (One second of 44.1 kHz audio is ample.)
    const samples = Math.min(len, 44100);
    const step = Math.max(1, Math.floor(len / samples));
    let sum = 0;
    let n = 0;
    for (let ch = 0; ch < chCount; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < len; i += step) {
            const v = data[i];
            sum += v * v;
            n++;
        }
    }
    return n ? Math.sqrt(sum / n) : 0;
}

/** Multiply a caller-provided volume (0..1) by the cached gain for an id. */
export function applyGainToVolume(volume, id) {
    loadFromStorage();
    const g = id ? memCache.get(id) : undefined;
    if (!g) return volume;
    return Math.max(0, Math.min(1, volume * g));
}

/** Prime the cache asynchronously — returns immediately, does not block. */
export function primeReplayGain(id, url, audioCtx) {
    // Fire and forget — result lands in cache for the next call.
    getReplayGain(id, url, audioCtx).catch(() => {});
}

/** For tests / debugging. */
export function _debug() {
    loadFromStorage();
    return { size: memCache.size, entries: [...memCache.entries()] };
}
