/**
 * Effexiq extras — small, self-contained features that don't warrant their
 * own module each but benefit from isolation from the monolithic engine.
 *
 * Everything here is additive: nothing in this file modifies existing
 * engine behaviour unless explicitly called from the engine.
 *
 *   - installKeyboardShortcuts(engine)  Space/M/S/1–9
 *   - clientEventLog                    ring buffer + CSV export for bug reports
 *   - exportPreset / importPreset       GM-shareable JSON of mode + world + custom sounds
 *   - captionBus                        mirror newSpeech into #captionsFeed
 *   - obsSceneModeMap                   OBS scene name → Effexiq mode
 *   - vibrateStinger                    safe navigator.vibrate wrapper
 *   - applyColorblindPreference         toggles a body class based on a saved pref
 *   - applyPreloadNetworkBudget         shrinks preload sets on slow connections
 */

// -----------------------------------------------------------------------------
// Client event log (for user bug reports)
// -----------------------------------------------------------------------------

const EVENT_LOG_CAP = 500;
const eventLog = [];

export function logEvent(action, ms, extra) {
    const entry = { ts: Date.now(), action, ms: ms ?? null, extra: extra ?? null };
    eventLog.push(entry);
    if (eventLog.length > EVENT_LOG_CAP) eventLog.splice(0, eventLog.length - EVENT_LOG_CAP);
    return entry;
}

export function getEventLog() {
    return eventLog.slice();
}

export function downloadEventLogCSV(filename = 'effexiq-events.csv') {
    if (typeof document === 'undefined') return;
    const header = 'timestamp,iso,action,ms,extra\n';
    const rows = eventLog.map(e => {
        const iso = new Date(e.ts).toISOString();
        const extra = e.extra == null ? '' : JSON.stringify(e.extra).replace(/"/g, '""');
        const action = String(e.action || '').replace(/"/g, '""');
        return `${e.ts},"${iso}","${action}",${e.ms ?? ''},"${extra}"`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// -----------------------------------------------------------------------------
// Keyboard shortcuts
// Space = start/stop listening, M = mute music, S = stop all audio,
// 1–9    = trigger ControlBoard slot 1–9.
// -----------------------------------------------------------------------------

let _shortcutsHandler = null;

export function installKeyboardShortcuts(engine) {
    if (!engine || typeof window === 'undefined') return;
    if (_shortcutsHandler) uninstallKeyboardShortcuts();

    _shortcutsHandler = (e) => {
        // Ignore when user is typing in any input / contenteditable.
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const k = e.key;
        if (k === ' ' || k === 'Spacebar') {
            e.preventDefault();
            // Toggle auto-detect listening if available.
            const btn = document.getElementById('toggleDetectionBtn');
            if (btn) btn.click();
            logEvent('shortcut:space');
        } else if (k === 'm' || k === 'M') {
            e.preventDefault();
            try {
                if (engine.musicGainNode) {
                    const g = engine.musicGainNode.gain;
                    const now = engine.audioContext?.currentTime ?? 0;
                    const muted = (engine._musicMuted = !engine._musicMuted);
                    g.cancelScheduledValues(now);
                    g.linearRampToValueAtTime(muted ? 0 : (engine.musicLevel ?? 0.5), now + 0.15);
                }
            } catch {}
            logEvent('shortcut:mute');
        } else if (k === 's' || k === 'S') {
            e.preventDefault();
            try { engine.stopAllAudio?.(); } catch {}
            logEvent('shortcut:stop');
        } else if (k >= '1' && k <= '9') {
            const slot = Number(k);
            const btn = document.querySelector(`[data-control-slot="${slot}"]`) || document.getElementById(`controlSlot${slot}`);
            if (btn) {
                e.preventDefault();
                btn.click();
                logEvent('shortcut:slot', null, { slot });
            }
        }
    };

    window.addEventListener('keydown', _shortcutsHandler);
}

export function uninstallKeyboardShortcuts() {
    if (_shortcutsHandler && typeof window !== 'undefined') {
        window.removeEventListener('keydown', _shortcutsHandler);
    }
    _shortcutsHandler = null;
}

// -----------------------------------------------------------------------------
// Preset export / import — shareable GM session bundle
// -----------------------------------------------------------------------------

const PRESET_VERSION = 1;

export function exportPreset(engine) {
    if (!engine) return null;
    const preset = {
        v: PRESET_VERSION,
        ts: Date.now(),
        mode: engine.currentMode || 'auto',
        worldState: engine._worldState || null,
        creatorMode: !!engine.creatorMode,
        singApplauseEnabled: !!engine.singApplauseEnabled,
        singStageFeelEnabled: !!engine.singStageFeelEnabled,
        customSounds: safeParse(localStorage.getItem('Effexiq_custom_sounds'), []),
        keywordOverrides: safeParse(localStorage.getItem('Effexiq_keyword_overrides'), {}),
        controlBoard: safeParse(localStorage.getItem('Effexiq_control_board'), null),
    };
    return preset;
}

export function downloadPreset(engine, filename = 'effexiq-preset.json') {
    const preset = exportPreset(engine);
    if (!preset) return;
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importPreset(engine, preset) {
    if (!engine || !preset || preset.v !== PRESET_VERSION) return false;
    try {
        if (preset.mode && typeof engine.setMode === 'function') engine.setMode(preset.mode);
        if (preset.worldState) engine._worldState = { ...engine._worldState, ...preset.worldState };
        if (typeof preset.creatorMode === 'boolean') {
            engine.creatorMode = preset.creatorMode;
            localStorage.setItem('Effexiq_creator_mode', JSON.stringify(preset.creatorMode));
        }
        if (preset.customSounds) localStorage.setItem('Effexiq_custom_sounds', JSON.stringify(preset.customSounds));
        if (preset.keywordOverrides) localStorage.setItem('Effexiq_keyword_overrides', JSON.stringify(preset.keywordOverrides));
        if (preset.controlBoard) localStorage.setItem('Effexiq_control_board', JSON.stringify(preset.controlBoard));
        return true;
    } catch (e) {
        console.warn('[preset] import failed:', e);
        return false;
    }
}

function safeParse(raw, fallback) {
    try { return JSON.parse(raw ?? 'null') ?? fallback; } catch { return fallback; }
}

// -----------------------------------------------------------------------------
// Captions bus — mirror newSpeech into a DOM node
// -----------------------------------------------------------------------------

const MAX_CAPTIONS = 80;

export function appendCaption(text) {
    const feed = typeof document !== 'undefined' && document.getElementById('captionsFeed');
    if (!feed) return;
    const line = document.createElement('div');
    line.className = 'caption-line';
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.innerHTML = `<span class="caption-ts">${ts}</span> <span class="caption-text"></span>`;
    line.querySelector('.caption-text').textContent = String(text || '');
    feed.appendChild(line);
    while (feed.childElementCount > MAX_CAPTIONS) feed.removeChild(feed.firstChild);
    feed.scrollTop = feed.scrollHeight;
}

// -----------------------------------------------------------------------------
// OBS scene ↔ mode map — persisted in localStorage so users can edit
// -----------------------------------------------------------------------------

const OBS_MAP_KEY = 'Effexiq_obs_scene_mode_map_v1';

export function getObsSceneMap() {
    return safeParse(
        typeof localStorage !== 'undefined' ? localStorage.getItem(OBS_MAP_KEY) : null,
        {
            // sensible defaults; user can override.
            'Starting Soon': 'sing',
            'DnD':          'dnd',
            'Horror':       'horror',
            'Bedtime':      'bedtime',
            'Gaming':       'creator',
            'BRB':          'bedtime',
        }
    );
}

export function setObsSceneMap(map) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(OBS_MAP_KEY, JSON.stringify(map || {}));
}

export function obsSceneToMode(sceneName) {
    const map = getObsSceneMap();
    if (!sceneName) return null;
    if (map[sceneName]) return map[sceneName];
    // case-insensitive fallback
    const lc = sceneName.toLowerCase();
    for (const [k, v] of Object.entries(map)) {
        if (k.toLowerCase() === lc) return v;
    }
    return null;
}

// -----------------------------------------------------------------------------
// Mobile haptics
// -----------------------------------------------------------------------------

export function vibrateStinger(pattern = [40, 30, 60]) {
    try {
        if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
        navigator.vibrate(pattern);
    } catch {}
}

// -----------------------------------------------------------------------------
// Colorblind visualizer preference
// -----------------------------------------------------------------------------

const COLORBLIND_KEY = 'Effexiq_colorblind_vis';

export function applyColorblindPreference() {
    if (typeof document === 'undefined') return;
    const on = safeParse(localStorage.getItem(COLORBLIND_KEY), false);
    document.body.classList.toggle('cb-visualizer', !!on);
}

export function setColorblindPreference(on) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(COLORBLIND_KEY, JSON.stringify(!!on));
    applyColorblindPreference();
}

// -----------------------------------------------------------------------------
// Preload budget by network — cap heavy preload sets on slow connections.
// Returns the trimmed array; callers keep using their own preload pipeline.
// -----------------------------------------------------------------------------

export function applyPreloadNetworkBudget(preloadList) {
    if (!Array.isArray(preloadList) || typeof navigator === 'undefined') return preloadList;
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return preloadList;
    const t = (c.effectiveType || '').toLowerCase();
    if (c.saveData || t === '2g' || t === 'slow-2g') return preloadList.slice(0, 2);
    if (t === '3g') return preloadList.slice(0, 4);
    return preloadList;
}

// -----------------------------------------------------------------------------
// Bedtime auto fade-out timer
// -----------------------------------------------------------------------------

let _bedtimeTimer = null;
let _bedtimeFadeTimer = null;

export function scheduleBedtimeFadeOut(engine, minutes) {
    cancelBedtimeFadeOut();
    if (!engine || !minutes || minutes <= 0) return;
    const totalMs = minutes * 60 * 1000;
    const fadeStartMs = Math.max(0, totalMs - 60_000); // fade starts in the final 60s
    _bedtimeFadeTimer = setTimeout(() => {
        try {
            const ctx = engine.audioContext;
            if (engine.masterGainNode && ctx) {
                const now = ctx.currentTime;
                const g = engine.masterGainNode.gain;
                g.cancelScheduledValues(now);
                g.setValueAtTime(g.value, now);
                g.linearRampToValueAtTime(0.0001, now + 60);
            }
        } catch {}
    }, fadeStartMs);
    _bedtimeTimer = setTimeout(() => {
        try { engine.stopAllAudio?.(); } catch {}
        // Restore master gain for the next session.
        try {
            const ctx = engine.audioContext;
            if (engine.masterGainNode && ctx) {
                engine.masterGainNode.gain.setValueAtTime(1, ctx.currentTime);
            }
        } catch {}
        _bedtimeTimer = null;
        _bedtimeFadeTimer = null;
        logEvent('bedtime:fired');
    }, totalMs);
    logEvent('bedtime:scheduled', null, { minutes });
}

export function cancelBedtimeFadeOut() {
    if (_bedtimeTimer) { clearTimeout(_bedtimeTimer); _bedtimeTimer = null; }
    if (_bedtimeFadeTimer) { clearTimeout(_bedtimeFadeTimer); _bedtimeFadeTimer = null; }
}
