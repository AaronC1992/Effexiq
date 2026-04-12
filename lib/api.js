// ===== Effexiq API SERVICE =====
// Centralized API calls to backend or fallback to client-side logic

// Lightweight debug logger: attach to window to avoid duplicate top-level declarations
(function(){
    try {
        if (typeof window !== 'undefined' && typeof window.debugLog !== 'function') {
            window.debugLog = function(...args) {
                try {
                    const enabled = !!(window.CONFIG && window.CONFIG.DEBUG_MODE);
                    if (enabled) console.log(...args);
                } catch (_) {}
            };
        }
    } catch (_) {}
})();

// Simple in-memory caches and backoff helpers (per page load)
let __soundsCache = null; // { sounds: [...] }
let __soundsCacheTime = 0;
const __SOUNDS_TTL = 60_000; // 60s
let __backendCooldownUntil = 0; // timestamp ms

// Small helper: fetch JSON with timeout and consistent error handling
async function apiFetchJson(path, init = {}, timeoutMs = 15000) {
    const base = getBackendUrl();
    const url = `${base}${path.startsWith('/') ? path : '/' + path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let resp;
    try {
        resp = await fetch(url, {
            cache: 'no-cache',
            ...init,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeout);
    }
    if (!resp.ok) {
        // Attempt to read error payload but ignore failures
        let detail = '';
        try { detail = (await resp.json()).error || ''; } catch (_) {}
        throw new Error(`HTTP ${resp.status}${detail ? ` - ${detail}` : ''}`);
    }
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
        throw new Error('Invalid JSON response');
    }
    return resp.json();
}

/**
 * Get the backend URL based on environment
 * @returns {string} Backend base URL
 */
function getBackendUrl() {
    // In production, API routes live on the same origin (Next.js /api/*)
    if (typeof window !== 'undefined' && window.Effexiq_BACKEND_URL) {
        return window.Effexiq_BACKEND_URL;
    }
    
    // Same-origin: Next.js API routes handle everything
    return '';
}

/**
 * Fetch sound catalog from backend or fallback to local saved-sounds.json
 * @returns {Promise<Array>} Array of sound objects
 */
async function fetchSounds() {
    // Serve from cache when fresh
    const now = Date.now();
    if (__soundsCache && (now - __soundsCacheTime) < __SOUNDS_TTL) {
        return [...__soundsCache];
    }

    // Local-first: load sounds from saved-sounds.json (absolute path so it works at any route)
    try {
        const _ac = new AbortController(); const _to = setTimeout(() => _ac.abort(), 5000);
        const resp = await fetch('/saved-sounds.json', { cache: 'no-cache', signal: _ac.signal });
        clearTimeout(_to);
        if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data?.files)) {
                window.debugLog(`[Effexiq] Loaded ${data.files.length} sounds from local saved-sounds.json`);
                __soundsCache = data.files.map(f => ({
                    id: f.file || f.name,
                    type: f.type === 'music' ? 'music' : 'sfx',
                    name: f.name,
                    src: f.file,
                    tags: f.keywords || [],
                    loop: f.type === 'music'
                }));
                __soundsCacheTime = Date.now();
                return [...__soundsCache];
            }
        }
    } catch (localErr) {
        console.error('Failed to load local saved-sounds.json:', localErr);
    }

    // Return empty array if all fails
    return [];
}

/**
 * Analyze transcript via the Effexiq backend (requires active subscription token)
 * @param {Object} payload - { transcript, mode, context }
 * @returns {Promise<Object>} AI decision object
 */
async function analyzeTranscript(payload) {
    const { transcript, mode, context } = payload;

    if (!transcript || !transcript.trim()) {
        throw new Error('Transcript is required');
    }

    return await apiFetchJson('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, mode, context }),
    }, 30000);
}

// Expose to window for game.js (now that api.js is a module)
if (typeof window !== 'undefined') {
    window.getBackendUrl = getBackendUrl;
    window.fetchSounds = fetchSounds;
    window.analyzeTranscript = analyzeTranscript;
}
