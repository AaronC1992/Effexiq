// ===== Effexiq - INTELLIGENT AUDIO COMPANION =====
// Author: Expert AI Team
// Version: 3.0.0 - Production release with AI analysis pipeline, Stop Audio fix, and catalog ID validation

// ===== IMPORT MODULES =====
import { Howl } from 'howler';
import { CONFIG } from '../lib/config.js';
import { LRUCache, MemoryMonitor, CacheManager } from '../lib/modules/memory-manager.js';
import PerformanceMonitor from '../lib/modules/performance-monitor.js';
import { CircuitBreaker, RetryHandler, OfflineDetector, setupGlobalErrorHandlers } from '../lib/modules/error-handler.js';
import { initAccessibility, announceToScreenReader } from '../lib/modules/accessibility.js';
import { buildTriggerMap, ruleBasedDecision, tfidfMatch } from '../lib/modules/trigger-system.js';
import { computeNormalizationGain as computeNormGain, calculateVolume as calcVolume, getSfxBucket as sfxBucket, getDuckParams as duckParamsCalc, shuffleArray as shuffle } from '../lib/modules/sound-engine.js';
import { MODE_CONTEXTS, MODE_RULES, MODE_STINGERS, MODE_PRELOAD_SETS, GENERIC_PRELOAD_SET } from '../lib/modules/ai-director.js';

// Expose CONFIG globally for modules that read window.CONFIG (e.g., api.js debugLog)
try { window.CONFIG = CONFIG; } catch (_) {}

// Debug logger - only logs when DEBUG_MODE is true
const debugLog = (...args) => {
    if (CONFIG.DEBUG_MODE) {
        console.log(...args);
    }
};

// Sanitize strings before inserting into innerHTML
const escapeHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// Global performance monitor
const performanceMonitor = new PerformanceMonitor();

// Global memory monitor
const memoryMonitor = new MemoryMonitor();

// Global cache manager
const cacheManager = new CacheManager();

// Circuit breakers for API calls
const backendCircuit = new CircuitBreaker('backend', CONFIG.NETWORK.CIRCUIT_BREAKER_THRESHOLD);
const openaiCircuit = new CircuitBreaker('openai', CONFIG.NETWORK.CIRCUIT_BREAKER_THRESHOLD);

// Retry handler
const retryHandler = new RetryHandler();

const storage = {
    get(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage unavailable:', e.message);
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('localStorage write failed:', e.message);
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('localStorage remove failed:', e.message);
        }
    }
};

// ===== SUBSCRIPTION TOKEN MANAGEMENT =====
function getAccessToken() {
    try { return localStorage.getItem('Effexiq_token') || null; } catch (_) { return null; }
}

function setAccessToken(token) {
    try {
        if (token) { localStorage.setItem('Effexiq_token', token); }
        else { localStorage.removeItem('Effexiq_token'); }
    } catch (_) {}
}

// ===== HELPER FUNCTIONS =====
// Legacy OpenAI key (no longer used for AI analysis — kept only for Freesound/Pixabay compatibility)
function getOpenAIKey() {
    return null; // OpenAI key now managed on the backend — users subscribe instead
}

function setOpenAIKey(key) {} // no-op

function getFreesoundKey() {
    return storage.get('freesound_api_key') || null;
}

function setFreesoundKey(key) {
    if (key) {
        storage.set('freesound_api_key', key);
    } else {
        storage.remove('freesound_api_key');
    }
}

function getPixabayKey() {
    return storage.get('pixabay_api_key') || null;
}

function setPixabayKey(key) {
    if (key) {
        storage.set('pixabay_api_key', key);
    } else {
        storage.remove('pixabay_api_key');
    }
}

// Speech recognition feature detection
function isSpeechRecognitionAvailable() {
    return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
}

class Effexiq {
    constructor() {
        // Backend Configuration
        this.backendUrl = this.getBackendUrl();
        this.soundCatalog = []; // Loaded from backend /sounds endpoint
        this.backendAvailable = false; // Track if backend is reachable
        
        // Music Context Management
        this.currentMusicContext = null; // Track current music mood/scene
        this.musicRotationQueue = []; // Queue of related tracks for rotation
        this.musicRotationIndex = 0; // Current position in rotation
        this.lastMusicChange = 0; // Timestamp of last music change
        this.musicChangeThreshold = 30000; // Minimum 30s between music changes
        
        // Access token for AI backend (subscription-based)
        this.accessToken = getAccessToken();
        this.freesoundApiKey = getFreesoundKey();
        this.pixabayApiKey = getPixabayKey();
        
        // Refresh token on visibility change (in case user subscribed in another tab)
        this._visibilityHandler = () => {
            if (!document.hidden) {
                this.accessToken = getAccessToken();
                this.freesoundApiKey = getFreesoundKey();
            }
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
        this.currentMode = 'auto'; // Always use auto mode
        this.isListening = false;
        this.minVolume = 0.2;
        this.maxVolume = 0.7;
        this.analysisVersion = 0; // increment on mode changes to ignore stale AI results
        this.storyContext = ''; // User-provided story context for better AI understanding
        this.mutedCategories = new Set();
        try { this.disabledSounds = new Set(JSON.parse(localStorage.getItem('Effexiq_disabled_sounds') || '[]')); } catch { this.disabledSounds = new Set(); }
        // Mood & sentiment tracking
        this.moodHistory = []; // Last N mood readings { primary, intensity, timestamp }
        this.currentMood = { primary: 'neutral', intensity: 0.5 };
        this.sessionContext = localStorage.getItem('Effexiq_session_context') || '';
        // Dramatic beat detection
        this.lastSpeechTime = 0;
        this.dramaticPhrases = /^(and then|suddenly|just then|at that moment|but then|without warning|in an instant|from the shadows|out of nowhere)/i;
        // Custom recorded sounds
        try {
            const raw = JSON.parse(localStorage.getItem('Effexiq_custom_sounds') || '[]');
            this.customSounds = Array.isArray(raw) ? raw.filter(s => s && typeof s.name === 'string') : [];
        } catch { this.customSounds = []; }
        // Sound history for playback feedback
        this.soundHistory = [];
    // Playback preferences
    try { this.musicEnabled = JSON.parse(localStorage.getItem('Effexiq_music_enabled') ?? 'true'); } catch { this.musicEnabled = true; }
    try { this.sfxEnabled = JSON.parse(localStorage.getItem('Effexiq_sfx_enabled') ?? 'true'); } catch { this.sfxEnabled = true; }
    // Mixer levels (user-controlled)
    this.musicLevel = parseFloat(localStorage.getItem('Effexiq_music_level') ?? '0.5'); // default 50%
    this.sfxLevel = parseFloat(localStorage.getItem('Effexiq_sfx_level') ?? '0.9');   // default 90%
    this.ambientDurationMultiplier = parseFloat(localStorage.getItem('Effexiq_ambient_duration') ?? '1.0'); // 0.5x to 3x
    try { this.ambienceEnabled = JSON.parse(localStorage.getItem('Effexiq_ambience_enabled') ?? 'true'); } catch { this.ambienceEnabled = true; }
    this.voiceIntensity = 0.5; // mic loudness ratio: ~0.4 quiet → ~1.5 shouting
    this._micAnalyser = null;  // AnalyserNode connected to mic (measurement only, no echo)
    this._startupSoundPlayed = false;
    this.currentMusicBase = 0.5; // last intensity-derived music gain (pre-user)
    // Mood & performance
    this.moodBias = parseFloat(localStorage.getItem('Effexiq_mood_bias') ?? '0.5'); // 0..1
    try { this.lowLatencyMode = JSON.parse(localStorage.getItem('Effexiq_low_latency') ?? 'false'); } catch { this.lowLatencyMode = false; }
    this.preloadConcurrency = this.getPreloadConcurrency();
    this.keywordCooldownMs = parseInt(localStorage.getItem('Effexiq_keyword_cooldown_ms') ?? '3000');
    // Scene presets — lazy-init from defaults if not yet saved
    try { this.scenePresets = JSON.parse(localStorage.getItem('Effexiq_scene_presets') ?? 'null') || null; } catch { this.scenePresets = null; }
    // Control board listen mode (set after setupControlBoard)
    this.cbListenMode = false;
        
        // Speech Recognition
        this.recognition = null;
        this.transcriptBuffer = [];
    this.lastAnalysisTime = 0;
    // Analyze interval with adaptive rate limiting
    this.analysisInterval = this.lowLatencyMode ? 3000 : 5000; // Faster in low-latency mode
    this.baseAnalysisInterval = this.analysisInterval; // Store base for reset after backoff
    this.analysisTimer = null;
    this.analysisInProgress = false;
    this.currentInterim = '';
        
        // Audio System
        this.audioContext = null;
        this.currentMusic = null;
        this.currentMusicSource = null;
        this.musicGainNode = null;
        this.masterGainNode = null;
        // SFX bus
        this.sfxBusGain = null;
        this.sfxCompressor = null;
        this.activeSounds = new Map();
        this.activeBuffers = new Map(); // Store decoded audio buffers (temporary preload cache)
        this.bufferCache = new Map(); // Long-lived buffer cache with LRU eviction
        this.maxBufferCacheSize = 100; // Keep 100 decoded buffers (~50-100MB RAM)
        this.durationCache = new Map(); // Sound ID -> duration in seconds (lazy-populated)
        this.instantKeywordBuffers = new Map(); // Pre-decoded buffers for instant triggers
        this.sfxNormGains = new Map(); // url -> normalization gain
        this.soundQueue = [];
        this.maxSimultaneousSounds = CONFIG.AUDIO.MAX_SIMULTANEOUS_SFX;
        this.duckingInProgress = false;
        this.duckParams = { attack: 0.05, hold: 0.15, release: 0.35, floor: 0.25 };
        this.stingerTimer = null;
        
        // Ambient bed layering: persistent ambient track under music
        this.ambientBed = null; // Current ambient Howl instance
        this.ambientBedId = null; // Current ambient catalog ID
        this.ambientBedGain = 0.2; // Ambient bed volume (subtle layer)
        this.lastAmbientChange = 0;
        
        // Scene Memory / Auto-Chapters
        this.sceneChapters = []; // Array of { mood, description, timestamp, sounds[] }
        this.currentChapterMood = null;
        this.chapterStartTime = null;
        this.sessionStartTime = Date.now();
        
        // Procedural Ambient Sequences
        this.proceduralLayers = new Map(); // layerName -> { howl, catalogId, volume }
        this.maxProceduralLayers = 3;
        this.proceduralTimer = null;
        this.lastProceduralUpdate = 0;

        // User-defined phrase triggers (persisted to localStorage)
        try {
            this._customPhraseEntries = JSON.parse(localStorage.getItem('Effexiq_custom_phrases') || '[]');
        } catch (_) {
            this._customPhraseEntries = [];
        }

        // Silence-triggered analysis (fires ~1.2s after speech goes quiet)
        this._silenceAnalysisTimer = null;
        // Pending-analysis queue (holds transcript if analysis in-progress)
        this._pendingAnalysisTranscript = null;

        // Scene state machine
        this.sceneState = 'exploration'; // exploration | combat | dialogue | rest | travel
        this._sceneStateConfidence = 0;

        // Rolling scene memory summary (one-liner built every 3 analyses)
        this.rollingSceneSummary = '';
        this._analysisCountSinceLastSummary = 0;

        // Scene-break anchor windowing
        this._sceneBreakRegex = /\b(meanwhile|suddenly|hours later|the next morning|as they arrived|later that day|the following|next day|that evening|a moment later|days passed|weeks passed|in the distance|across the room|back at|returning to|far away|on the other side)\b/i;
        
        // Preload state
        this.preloadInProgress = false;
        this.preloadVersion = 0; // bump to cancel previous preloads on mode change
        // Expanded per-mode preload sets (15-20 common, CC0-friendly queries)
        this.modePreloadSets = MODE_PRELOAD_SETS;
        this.genericPreloadSet = GENERIC_PRELOAD_SET;
        
        // Visualizer
        this.analyser = null;
        this.visualizerAnimationId = null;
        
    // Cache / recent playback tracking
    this.soundCache = new Map();
    this.recentlyPlayed = new Set(); // track recent URLs to reduce repeats
    // SFX anti-repeat
        this.sfxCooldownMs = 3500; // minimum gap between same-category SFX
        this.sfxCooldowns = new Map(); // bucket -> nextAllowedTime
        // Saved sounds (local quick-access library)
        this.savedSounds = { files: [] };
        // Instant trigger keywords for immediate sound effects
    // AI prediction (auto analysis + auto-playback); default ON
    this.predictionEnabled = JSON.parse(localStorage.getItem('Effexiq_prediction_enabled') ?? 'true');
    // Story preferences
    this.autoStartStoryListening = JSON.parse(localStorage.getItem('Effexiq_auto_start_story_listening') ?? 'false');
            this.instantKeywords = {};
            this.instantKeywordCooldowns = new Map(); // keyword -> last trigger time
            // Will be populated by buildTriggerMap() after saved sounds load

        // Session stats
        this.sessionStats = { sounds: 0, triggers: 0, transitions: 0, keywords: 0, analyses: 0 };
        // Demo mode state
        this.demoRunning = false;
        this.demoTimeouts = [];
        // Failure cache for 404 sounds
        this.soundFailureCache = new Map();
        // Periodic cache cleanup (every 5 minutes)
        this._cacheCleanupInterval = setInterval(() => this._cleanupCaches(), 300000);
        
        // Web Worker for off-thread JSON parsing
        this._jsonWorker = this._createJsonWorker();
        
        // Initialize
        this.init();
    }
    
    init() {
        this.checkSubscription();
        this.setupEventListeners();
        this.initializeAudioContext();
        this.initializeSpeechRecognition();
        this.setupVisualizer();
        this.updateApiStatusIndicators();
        this.setupActivityFeed();
        this.setupDemoMode();
        this.setupHubNavigation();
        this.setupControlBoard();
        this.setupStoryCreator();
        this.setupDndAutoDetect();
        this.populateStoriesSection();

        // Show dashboard on startup so users don't see a blank screen
        this.navigateToSection('dashboardPanel');
        

        
        // Load sound catalog from backend
        this.loadSoundCatalog().catch(e => console.warn('Backend catalog unavailable:', e.message));
        // Load local saved sounds (legacy/fallback)
        this.loadSavedSounds().catch(e => console.warn('Saved sounds load failed:', e.message));
        // Load built-in stories
        this.loadStories().catch(e => console.warn('Stories load failed:', e.message));
        
        // Preload instant keyword buffers after a short delay (non-blocking)
        setTimeout(() => this.preloadInstantKeywords().catch(e => console.warn('Preload keywords failed:', e.message)), 2000);
        // Pre-warm CDN cache for common sounds
        setTimeout(() => this.prewarmCDN().catch(e => console.warn('CDN prewarm failed:', e.message)), 3000);
    }
    
    getBackendUrl() {
        // Use centralized backend URL from api.js
        return getBackendUrl();
    }
    
    // Build candidate URL list (primary CDN + local fallback)
    // Callers MUST pass already-encoded URLs (via encodeURI)
    buildSrcCandidates(u) {
        const list = [];
        const cdnBase = (typeof window !== 'undefined' && window.__R2_PUBLIC_URL) || '';
        if (cdnBase && !/^https?:\/\//i.test(u) && !u.startsWith(cdnBase)) {
            // CDN is primary source for relative paths (skip if already prefixed)
            list.push(`${cdnBase.replace(/\/$/, '')}/${u.replace(/^\//, '')}`);
        }
        list.push(u); // local fallback
        try {
            if (/^https?:\/\//i.test(u)) {
                const m = u.match(/\/(?:cueai-media\/)?(music|sfx|ambience)\/(.+)$/i);
                if (m) {
                    const localPath = `/media/${m[1]}/${m[2]}`;
                    const backend = this.getBackendUrl().replace(/\/$/,'');
                    list.push(`${backend}${localPath}`);
                }
            } else {
                const backend = this.getBackendUrl().replace(/\/$/,'');
                if (backend) list.push(`${backend}${u.startsWith('/') ? u : '/' + u}`);
            }
        } catch (_) {}
        return list;
    }
    
    async loadSoundCatalog() {
        try {
            // Use centralized API service (from api.js)
            this.soundCatalog = await fetchSounds();
            if (this.soundCatalog.length > 0) {
                debugLog(`✓ Loaded ${this.soundCatalog.length} sounds`);
                // Update indicators now that audio sources are available
                this.updateApiStatusIndicators();
                // Optional: verify first few catalog URLs in debug mode
                try {
                    if (window.CONFIG && window.CONFIG.DEBUG_MODE) {
                        setTimeout(() => { this.verifyCatalog(10).catch(()=>{}); }, 500);
                    }
                } catch(_) {}
            } else {
                console.warn('No sounds loaded from catalog');
            }
        } catch (err) {
            console.error('Failed to load sound catalog:', err.message);
            this.soundCatalog = [];
        }
    }

    // Quick HEAD verifier for first N catalog URLs (debug only)
    async verifyCatalog(headCount = 10) {
        const list = Array.isArray(this.soundCatalog) ? this.soundCatalog.slice(0, headCount) : [];
        for (const s of list) {
            const url = s?.src;
            if (!url) continue;
            try {
                const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
                if (res.ok) {
                    console.log(`[CATALOG:OK] ${url}`);
                } else {
                    console.warn(`[CATALOG:${res.status}] ${url}`);
                }
            } catch (e) {
                console.warn(`[CATALOG:ERR] ${url} -> ${e.message}`);
            }
        }
    }

    async loadSavedSounds() {
        try {
            const resp = await fetch('saved-sounds.json', { cache: 'no-cache' });
            if (!resp.ok) return;
            const data = await resp.json();
            if (Array.isArray(data?.files)) {
                this.savedSounds.files = data.files.map(f => ({
                    type: (f.type === 'music' ? 'music' : 'sfx'),
                    name: String(f.name || '').toLowerCase(),
                    file: String(f.file || ''),
                    keywords: Array.isArray(f.keywords) ? f.keywords.map(k=>String(k||'').toLowerCase()) : []
                }));
                const host = location.hostname || '';
                const isLocal = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
                const isPages = /github\.io$/i.test(host);
                debugLog(`Loaded saved sounds: ${this.savedSounds.files.length}`);
                
                // Build expanded trigger map from the loaded catalog
                this.instantKeywords = buildTriggerMap(this.savedSounds);
                debugLog(`Built trigger map: ${Object.keys(this.instantKeywords).length} keywords`);
            }
        } catch(e) { console.warn('[Effexiq] loadSavedSounds failed:', e.message); }
    }

    // ===== API KEY MANAGEMENT =====

    // ===== STORIES =====
    async loadStories() {
        try {
            const resp = await fetch('stories.json', { cache: 'no-cache' });
            if (!resp.ok) return;
            const data = await resp.json();
            this.stories = {};
            for (const s of (data.stories || [])) {
                this.stories[s.id] = { id: s.id, title: s.title, text: s.text, demo: s.demo || false, theme: s.theme || '', description: s.description || '' };
            }
        } catch (_) {}
    }

    showStoryOverlay(storyId) {
        if (!this.stories || !this.stories[storyId]) return;
        this.currentStory = this.stories[storyId];
        this.storyActive = true;
        this.storyIndex = 0;
        this._storyCueFired = new Set(); // Reset per-keyword dedup for new story
        // Clear any active story SFX timers from previous story
        if (this._activeStorySfx) {
            for (const entry of this._activeStorySfx.values()) { if (entry.timer) clearTimeout(entry.timer); }
            this._activeStorySfx.clear();
        }
        const contentEl = document.getElementById('storyContent');
        const titleEl = document.getElementById('storyTitle');
        if (titleEl) titleEl.textContent = this.currentStory.title;
        // Tokenize text into words and separators
        const tokens = this.tokenizeStory(this.currentStory.text);
        this.storyTokens = tokens;
        this.storyNorm = tokens.map(t => this.normalizeWord(t));
        // Render spans
        if (contentEl) {
            const frag = document.createDocumentFragment();
            tokens.forEach((tok, i) => {
                if (/^\s+$/.test(tok)) {
                    frag.appendChild(document.createTextNode(tok));
                } else {
                    const span = document.createElement('span');
                    span.textContent = tok;
                    span.className = 'story-word';
                    span.dataset.index = String(i);
                    frag.appendChild(span);
                }
            });
            contentEl.innerHTML = '';
            contentEl.appendChild(frag);
            contentEl.scrollTop = 0;
            contentEl.focus({ preventScroll: true });
        }
        // Prefetch initial sounds from first chunk
        this.prefetchStoryWindow();
        // Show overlay
        const overlay = document.getElementById('storyOverlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    hideStoryOverlay() {
        this.storyActive = false;
        this.currentStory = null;
        this._stuckCount = 0;
        this.storyTokens = [];
        this.storyNorm = [];
        const overlay = document.getElementById('storyOverlay');
        if (overlay) overlay.classList.add('hidden');
        // Always clear per-story SFX timers on close (not just in demo mode)
        if (this._activeStorySfx) {
            for (const entry of this._activeStorySfx.values()) {
                if (entry.timer) clearTimeout(entry.timer);
            }
            this._activeStorySfx.clear();
        }
        // If demo was running, clean up demo state
        if (this.demoRunning) {
            this.stopAutoRead();
            this.demoRunning = false;
            this.demoCueCache = {};
            this.demoTimeouts.forEach(t => clearTimeout(t));
            this.demoTimeouts = [];
            this.stopAllAudio();
            const controlsPanel = document.getElementById('demoControls');
            if (controlsPanel) controlsPanel.classList.add('hidden');
            if (this.isListening) this.stopListening();
            const btn = document.getElementById('demoBtn');
            if (btn) { btn.textContent = 'Demo Mode'; btn.disabled = false; btn.classList.remove('demo-active'); }
        }
    }

    tokenizeStory(text) {
        // Split into word-like tokens; keep punctuation and line breaks as separate tokens for display
        const parts = text.split(/(\s+|[^\w']+)/g).filter(p => p !== undefined && p !== '');
        return parts;
    }

    normalizeWord(tok) {
        return String(tok).toLowerCase().replace(/[^a-z0-9']+/g, '');
    }

    advanceStoryWithTranscript(text) {
        if (!this.storyActive || !text) return;
        const spoken = text.toLowerCase().replace(/[^a-z0-9'\s]+/g, ' ').split(/\s+/).filter(Boolean);
        if (spoken.length === 0) return;
        
        // Track consecutive failures to detect when stuck
        if (!this._stuckCount) this._stuckCount = 0;
        
        let i = this.storyIndex;
        let progressed = 0;
        
        // Flexible sequential match — try each spoken word against current story
        // position, but if it doesn't match, look ahead in the story
        let spokenIdx = 0;
        while (spokenIdx < spoken.length && i < this.storyNorm.length) {
            // Skip empty story tokens
            while (i < this.storyNorm.length && this.storyNorm[i] === '') i++;
            if (i >= this.storyNorm.length) break;
            
            if (this.eqLoose(this.storyNorm[i], spoken[spokenIdx])) {
                this.maybeTriggerStorySfx(spoken[spokenIdx]);
                i++; progressed++; spokenIdx++;
            } else {
                // Check if this spoken word matches positions ahead in the story
                // Use wider skip when we've been stuck for multiple attempts
                let found = false;
                const skipLimit = Math.min(this._stuckCount >= 3 ? 8 : 5, this.storyNorm.length - i);
                for (let skip = 1; skip <= skipLimit; skip++) {
                    const ahead = i + skip;
                    if (ahead < this.storyNorm.length && this.storyNorm[ahead] !== '' && this.eqLoose(this.storyNorm[ahead], spoken[spokenIdx])) {
                        // Jump forward — fire cue sounds for skipped words
                        for (let s = i; s <= ahead; s++) {
                            const w = this.storyNorm[s];
                            if (w) this.maybeTriggerStorySfx(w);
                        }
                        i = ahead + 1; progressed += skip + 1; spokenIdx++;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    // Spoken word didn't match nearby — skip it
                    spokenIdx++;
                }
            }
        }
        
        // If no progress, increment stuck counter; reset on progress (cap prevents unbounded growth)
        if (progressed === 0 && spoken.length >= 2) {
            this._stuckCount = Math.min((this._stuckCount || 0) + 1, 10);
        } else if (progressed > 0) {
            this._stuckCount = 0;
        }
        
        // If stuck for 3+ attempts, try recovery to jump to where user is
        if (progressed === 0 && spoken.length >= 3 && this._stuckCount >= 3) {
            const recovered = this.attemptStoryRecovery(spoken);
            if (recovered > this.storyIndex) {
                debugLog(`Story recovery: jumped from ${this.storyIndex} to ${recovered}`);
                for (let s = this.storyIndex; s < recovered; s++) {
                    const w = this.storyNorm[s];
                    if (w) this.maybeTriggerStorySfx(w);
                }
                i = recovered;
                this._stuckCount = 0;
            }
        }
        
        if (i > this.storyIndex) {
            this.storyIndex = i;
            this.updateStoryHighlight();
            this.prefetchStoryWindow();
        }
    }
    
    attemptStoryRecovery(spoken) {
        // Scan ahead in story to find where the user actually is
        // Only jump if we find a strong consecutive match
        const lookahead = 120;
        const minConsecutive = 3; // need 3 words in a row to confirm position
        const window = this.storyNorm.slice(this.storyIndex, this.storyIndex + lookahead);
        
        // Filter out common words that would cause false matches
        const commonWords = new Set(['the','and','a','an','to','of','in','on','at','with','it','is','was','her','his','he','she','as','that','this']);
        
        // Try to find a run of 3+ consecutive spoken words matching the story
        for (let startIdx = 0; startIdx < window.length; startIdx++) {
            if (window[startIdx] === '') continue;
            
            let consecutive = 0;
            let si = 0; // spoken index
            let lastK = startIdx;
            
            for (let k = startIdx; k < window.length && si < spoken.length; k++) {
                if (window[k] === '') continue;
                
                if (this.eqLoose(window[k], spoken[si])) {
                    // Don't count very common words toward the consecutive run
                    if (!commonWords.has(spoken[si])) {
                        consecutive++;
                    }
                    lastK = k;
                    si++;
                    if (consecutive >= minConsecutive) {
                        // Strong match — return position after last matched word
                        return this.storyIndex + lastK + 1;
                    }
                } else {
                    // Reset — require consecutive matches
                    break;
                }
            }
        }
        
        return this.storyIndex; // no recovery found
    }

    eqLoose(a, b) {
        if (!a || !b) return a === b;
        if (a === b) return true;
        // Normalize possessives
        const base = (s) => s.replace(/'(s)?$/, '');
        // Strip common suffixes
        const strip = (s) => {
            let r = s;
            r = r.replace(/(ing|ed|ly|er|est)$/,'');
            r = r.replace(/(es|s)$/,'');
            return r;
        };
        const a1 = strip(base(a));
        const b1 = strip(base(b));
        if (a1 && b1 && a1 === b1) return true;
        const irregular = { wolves:'wolf', children:'child', men:'man', women:'woman', geese:'goose', mice:'mouse', feet:'foot', teeth:'tooth' };
        if (irregular[a] && irregular[a] === b) return true;
        if (irregular[b] && irregular[b] === a) return true;
        return false;
    }

    updateStoryHighlight() {
        const contentEl = document.getElementById('storyContent');
        if (!contentEl) return;
        const children = contentEl.querySelectorAll('.story-word');
        for (let k = 0; k < children.length; k++) {
            const el = children[k];
            const idx = parseInt(el.dataset.index || '0', 10);
            el.classList.toggle('highlight', idx < this.storyIndex);
            el.classList.toggle('active', idx === this.storyIndex);
        }
        // Smooth scroll to active word
        const active = contentEl.querySelector('.story-word.active');
        if (active) {
            active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Update progress bar
        const totalWords = this.storyNorm ? this.storyNorm.filter(t => t.trim()).length : 1;
        const pct = totalWords > 0 ? Math.round((this.storyIndex / totalWords) * 100) : 0;
        const fill = document.getElementById('storyProgressFill');
        const text = document.getElementById('storyProgressText');
        if (fill) fill.style.width = `${Math.min(pct, 100)}%`;
        if (text) text.textContent = `${Math.min(pct, 100)}%`;
    }

    async startAutoRead(demoStartBtn, demoAutoBtn, demoStopBtn, demoStatus) {
        this._autoReading = true;
        this._autoReadTimer = null;

        // Build list of word indices (non-whitespace tokens) starting from current position
        const wordIndices = [];
        for (let i = this.storyIndex; i < this.storyTokens.length; i++) {
            if (this.storyNorm[i] && this.storyNorm[i].trim()) {
                wordIndices.push(i);
            }
        }

        if (wordIndices.length === 0) {
            this.stopAutoRead();
            return;
        }

        // Build the text from current position
        const textFromHere = this.storyTokens.slice(this.storyIndex).join('');

        // Try AI TTS first (OpenAI via backend)
        const backendUrl = typeof getBackendUrl === 'function' ? getBackendUrl() : '';
        if (backendUrl) {
            try {
                if (demoStatus) demoStatus.textContent = 'Generating AI narration...';
                const ttsUrl = `${backendUrl}/api/tts`;

                // ElevenLabs TTS has ~5000 char limit — split if needed
                const chunks = this._splitTextForTTS(textFromHere, 5000);
                const audioBlobs = [];

                this._ttsAbortCtrl = new AbortController();
                for (const chunk of chunks) {
                    const ttsHeaders = { 'Content-Type': 'application/json' };
                    const tok = getAccessToken();
                    if (tok) ttsHeaders['Authorization'] = `Bearer ${tok}`;
                    const resp = await fetch(ttsUrl, {
                        method: 'POST',
                        headers: ttsHeaders,
                        body: JSON.stringify({ text: chunk, voice: 'fable' }),
                        signal: this._ttsAbortCtrl.signal
                    });
                    if (!resp.ok) throw new Error(`TTS ${resp.status}`);
                    audioBlobs.push(await resp.blob());
                }

                // Combine blobs into a single audio blob
                const fullBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(fullBlob);

                this._autoReadAudio = new Audio(audioUrl);
                this._autoReadAudioUrl = audioUrl;

                // Wait for metadata to get duration
                await new Promise((resolve, reject) => {
                    this._autoReadAudio.addEventListener('loadedmetadata', resolve, { once: true });
                    this._autoReadAudio.addEventListener('error', reject, { once: true });
                    this._autoReadAudio.load();
                });

                const duration = this._autoReadAudio.duration;
                if (!duration || !isFinite(duration)) throw new Error('Invalid audio duration');

                // Build word timing estimates based on proportional character positions
                const wordTimings = this._buildWordTimings(wordIndices, duration);

                if (demoStatus) demoStatus.textContent = 'AI narration playing...';
                this.logActivity('AI TTS narration started', 'info');

                // Sync highlights with audio playback
                let lastWordIdx = 0;
                this._autoReadAudio.addEventListener('timeupdate', () => {
                    if (!this._autoReading || !this._autoReadAudio) return;
                    const currentTime = this._autoReadAudio.currentTime;

                    while (lastWordIdx < wordTimings.length && wordTimings[lastWordIdx].time <= currentTime) {
                        const targetIdx = wordTimings[lastWordIdx].storyIdx;
                        for (let j = this.storyIndex; j <= targetIdx; j++) {
                            const w = this.storyNorm[j];
                            if (w) this.maybeTriggerStorySfx(w);
                        }
                        this.storyIndex = targetIdx + 1;
                        this.updateStoryHighlight();
                        lastWordIdx++;
                    }
                });

                this._autoReadAudio.addEventListener('ended', () => {
                    if (!this._autoReading) return;
                    for (let j = this.storyIndex; j < this.storyTokens.length; j++) {
                        const w = this.storyNorm[j];
                        if (w) this.maybeTriggerStorySfx(w);
                    }
                    this.storyIndex = this.storyTokens.length;
                    this.updateStoryHighlight();
                    this._autoReading = false;
                    if (demoStatus) demoStatus.textContent = 'Story complete! Press Stop to end.';
                    this.logActivity('AI TTS narration finished', 'info');
                });

                this._autoReadAudio.play();
                return; // Success — AI TTS is running
            } catch (err) {
                debugLog('AI TTS failed, falling back to browser TTS:', err.message);
                this._cleanupAutoReadAudio();
            }
        }

        // Fallback: browser SpeechSynthesis
        if (demoStatus) demoStatus.textContent = 'Auto reading...';
        this._browserTTSFallback(textFromHere, wordIndices, demoStartBtn, demoAutoBtn, demoStopBtn, demoStatus);
    }

    _splitTextForTTS(text, maxLen) {
        if (text.length <= maxLen) return [text];
        const chunks = [];
        let remaining = text;
        while (remaining.length > 0) {
            if (remaining.length <= maxLen) {
                chunks.push(remaining);
                break;
            }
            // Find a sentence break near the limit
            let splitAt = remaining.lastIndexOf('. ', maxLen);
            if (splitAt < maxLen * 0.5) splitAt = remaining.lastIndexOf(' ', maxLen);
            if (splitAt < maxLen * 0.3) splitAt = maxLen;
            chunks.push(remaining.slice(0, splitAt + 1));
            remaining = remaining.slice(splitAt + 1);
        }
        return chunks;
    }

    _buildWordTimings(wordIndices, duration) {
        // Estimate each word's time based on its character position in the text
        const totalChars = this.storyTokens.slice(this.storyIndex).join('').length;
        if (totalChars === 0) return [];

        const timings = [];
        for (const idx of wordIndices) {
            // Count chars from storyIndex to this word's position
            let charPos = 0;
            for (let t = this.storyIndex; t < idx; t++) {
                charPos += (this.storyTokens[t] || '').length;
            }
            const time = (charPos / totalChars) * duration;
            timings.push({ storyIdx: idx, time });
        }
        return timings;
    }

    _cleanupAutoReadAudio() {
        if (this._autoReadAudio) {
            this._autoReadAudio.pause();
            this._autoReadAudio.src = '';
            this._autoReadAudio = null;
        }
        if (this._autoReadAudioUrl) {
            URL.revokeObjectURL(this._autoReadAudioUrl);
            this._autoReadAudioUrl = null;
        }
    }

    _browserTTSFallback(textFromHere, wordIndices, demoStartBtn, demoAutoBtn, demoStopBtn, demoStatus) {
        // Ensure AudioContext is resumed so sounds can play alongside TTS
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(textFromHere);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;

            let wordCount = 0;
            let boundaryFired = false;

            // Timer-based sync: runs in parallel as a fallback for mobile
            // where onboundary events may not fire reliably
            const wordsPerMs = 370; // ~160 wpm — mobile TTS voices speak slower than desktop
            let timerPos = 0;
            this._browserTTSSyncTimer = null;

            const advanceByTimer = () => {
                if (!this._autoReading || boundaryFired) {
                    // If boundary events started working, or autoRead was stopped, clear the timer
                    if (this._browserTTSSyncTimer) { clearInterval(this._browserTTSSyncTimer); this._browserTTSSyncTimer = null; }
                    return;
                }
                if (timerPos < wordIndices.length) {
                    const targetIdx = wordIndices[timerPos];
                    for (let j = this.storyIndex; j <= targetIdx; j++) {
                        const w = this.storyNorm[j];
                        if (w) this.maybeTriggerStorySfx(w);
                    }
                    this.storyIndex = targetIdx + 1;
                    this.updateStoryHighlight();
                    timerPos++;
                }
            };

            // Start the timer fallback after a short delay to give onboundary a chance
            const watchdog = setTimeout(() => {
                if (!boundaryFired && this._autoReading) {
                    debugLog('TTS onboundary not firing — using timer sync');
                    this._browserTTSSyncTimer = setInterval(advanceByTimer, wordsPerMs);
                }
            }, 1500);

            utterance.onboundary = (event) => {
                if (!this._autoReading) return;
                if (event.name === 'word') {
                    boundaryFired = true;
                    // Stop timer fallback if it was started
                    if (this._browserTTSSyncTimer) { clearInterval(this._browserTTSSyncTimer); this._browserTTSSyncTimer = null; }
                    clearTimeout(watchdog);

                    if (wordCount < wordIndices.length) {
                        const targetIdx = wordIndices[wordCount];
                        for (let j = this.storyIndex; j <= targetIdx; j++) {
                            const w = this.storyNorm[j];
                            if (w) this.maybeTriggerStorySfx(w);
                        }
                        this.storyIndex = targetIdx + 1;
                        this.updateStoryHighlight();
                    }
                    wordCount++;
                }
            };

            utterance.onend = () => {
                clearTimeout(watchdog);
                if (this._browserTTSSyncTimer) { clearInterval(this._browserTTSSyncTimer); this._browserTTSSyncTimer = null; }
                if (!this._autoReading) return;
                for (let j = this.storyIndex; j < this.storyTokens.length; j++) {
                    const w = this.storyNorm[j];
                    if (w) this.maybeTriggerStorySfx(w);
                }
                this.storyIndex = this.storyTokens.length;
                this.updateStoryHighlight();
                this._autoReading = false;
                if (demoStatus) demoStatus.textContent = 'Story complete! Press Stop to end.';
                this.logActivity('Auto read finished', 'info');
            };

            utterance.onerror = () => {
                clearTimeout(watchdog);
                if (this._browserTTSSyncTimer) { clearInterval(this._browserTTSSyncTimer); this._browserTTSSyncTimer = null; }
                this._autoReadFallback(wordIndices, demoStartBtn, demoAutoBtn, demoStopBtn, demoStatus);
            };

            this._autoReadUtterance = utterance;
            try {
                speechSynthesis.speak(utterance);
            } catch (e) {
                debugLog('speechSynthesis.speak failed:', e.message);
                this._autoReadFallback(wordIndices, demoStartBtn, demoAutoBtn, demoStopBtn, demoStatus);
            }
        } else {
            this._autoReadFallback(wordIndices, demoStartBtn, demoAutoBtn, demoStopBtn, demoStatus);
        }
    }

    _autoReadFallback(wordIndices, demoStartBtn, demoAutoBtn, demoStopBtn, demoStatus) {
        // Timer-based word advancement (~250ms per word)
        let pos = 0;
        const advance = () => {
            if (!this._autoReading || pos >= wordIndices.length) {
                this._autoReading = false;
                if (demoStatus) demoStatus.textContent = 'Story complete! Press Stop to end.';
                this.logActivity('Auto read finished', 'info');
                return;
            }
            const targetIdx = wordIndices[pos];
            for (let j = this.storyIndex; j <= targetIdx; j++) {
                const w = this.storyNorm[j];
                if (w) this.maybeTriggerStorySfx(w);
            }
            this.storyIndex = targetIdx + 1;
            this.updateStoryHighlight();
            pos++;
            this._autoReadTimer = setTimeout(advance, 250);
        };
        advance();
    }

    stopAutoRead() {
        this._autoReading = false;
        // Abort any in-flight TTS fetch requests
        if (this._ttsAbortCtrl) {
            this._ttsAbortCtrl.abort();
            this._ttsAbortCtrl = null;
        }
        // Stop AI TTS audio if playing
        this._cleanupAutoReadAudio();
        // Stop browser TTS
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
        }
        this._autoReadUtterance = null;
        if (this._autoReadTimer) {
            clearTimeout(this._autoReadTimer);
            this._autoReadTimer = null;
        }
        // Clear TTS word-sync interval in case speechSynthesis.cancel() doesn't fire onerror
        if (this._browserTTSSyncTimer) {
            clearInterval(this._browserTTSSyncTimer);
            this._browserTTSSyncTimer = null;
        }
    }

    // Map common keywords in stories to SFX searches
    getStoryCueMap() {
        return {
            // Environment
            'wind': 'wind howling',
            'howled': 'wind howling',
            'rain': 'light rain shower',
            'storm': 'thunder',
            'thunder': 'thunder rumble',
            'thundering': 'thunder rumble',
            'lightning': 'quick lightning strike',
            // Animals & Creatures
            'owl': 'owl hoot',
            'hooted': 'owl hoot',
            'wolf': 'wolf howl',
            'rat': 'rat squeak',
            'bird': 'bird whistling chirping',
            'birds': 'bird whistling chirping',
            'sang': 'bird whistling chirping',
            'chirped': 'bird whistling chirping',
            'horse': 'horse galloping',
            'horses': 'horse galloping',
            'dragon': 'dragon growl',
            'roar': 'dragon growl',
            // Movement & Actions
            'footsteps': 'footsteps walk',
            'step': 'footsteps',
            'steps': 'footsteps walk',
            'crept': 'footsteps slow',
            'door': 'door creak',
            'creaked': 'door creak',
            'knocked': 'door knock',
            'knock': 'door knock',
            // Combat
            'sword': 'draw sword',
            'swords': 'swords fighting',
            'arrow': 'arrow whoosh fly',
            'arrows': 'arrow whoosh fly',
            'shield': 'shield block sword',
            'strike': 'sword strike',
            'clashed': 'sword clash metal',
            'clash': 'sword clash metal',
            'armor': 'armor clank footsteps',
            'armored': 'armor clank footsteps',
            // Fire & Light — each maps to its specific sound
            'fire': 'campfire ambient gentle',
            'crackled': 'campfire ambient gentle',
            'flames': 'wildfire inferno',
            'flame': 'candle flame flicker',
            'embers': 'embers dying glow',
            'campfire': 'campfire ambient gentle',
            'fireplace': 'campfire ambient gentle',
            'hearth': 'campfire ambient gentle',
            'bonfire': 'bonfire large roaring',
            'wildfire': 'wildfire inferno',
            'inferno': 'wildfire inferno',
            'kindled': 'match strike ignite',
            'kindle': 'match strike ignite',
            'lighter': 'lighter click ignite',
            'zippo': 'lighter click ignite',
            // Magic & Spells
            'magic': 'magic wand',
            'spell': 'magic spell',
            'wizard': 'magic spell cast',
            'arcane': 'arcane magic',
            'crystal': 'magic shimmer sparkle',
            'healing': 'healing magic',
            'chanted': 'magic spell',
            'incantation': 'dark magic',
            'rune': 'ancient rune activate',
            'runes': 'ancient rune activate',
            'curse': 'dark curse cast',
            'cursed': 'dark curse cast',
            'hex': 'dark curse cast',
            'holy': 'holy divine chime',
            'divine': 'holy divine chime',
            'sacred': 'holy divine chime',
            'brew': 'potion bubbling brew',
            'brewing': 'potion bubbling brew',
            'cauldron': 'potion bubbling brew',
            // Water
            'dripped': 'water drip',
            'trickled': 'stream water trickle gentle',
            'stream': 'stream water trickle gentle',
            'brook': 'stream water trickle gentle',
            'babbling': 'stream water trickle gentle',
            // Impact & Destruction
            'glass': 'glass shatter',
            'shattered': 'glass shatter',
            'exploded': 'explosion',
            'trembled': 'ground rumble',
            'collapsed': 'impact heavy',
            // Vocal — demographic-specific scream routing
            'growl': 'creature growl',
            'scream': 'female scream terror',
            'screamed': 'female scream terror',
            'shrieked': 'girl shriek terror',
            'shriek': 'girl shriek terror',
            'screeched': 'girl shriek terror',
            'wailed': 'woman wailing grief',
            'wail': 'woman wailing grief',
            'sobbed': 'woman wailing grief',
            'whimpered': 'woman wailing grief',
            'bellowed': 'man bellow rage',
            'yelled': 'man bellow rage',
            'roared': 'man bellow rage',
            'shouted': 'warrior charge shout',
            'cried': 'child scream fear',
            'baby': 'baby cry scream',
            'infant': 'baby cry scream',
            'heartbeat': 'heartbeat',
            'silence': 'silence ambience room',
            // Celebration
            'bell': 'church bell toll',
            'bells': 'church bells chime',
            'tolled': 'church bell toll',
            'trumpet': 'medieval horn',
            'horn': 'medieval horn',
            'horns': 'medieval horn',
            'music': 'victory fanfare triumph',
            'celebrated': 'crowd cheering',
            'clock': 'clock chime',
            'midnight': 'clock chime',
            'coach': 'footsteps wood stairs',
            'crowd': 'crowd cheering',
            'applause': 'applause crowd',
            'clapping': 'applause crowd',
            // Nautical / Pirate
            'cannon': 'cannon blast',
            'cannons': 'cannon blast',
            'fuse': 'cannon fuse sizzle',
            'waves': 'ocean waves',
            'ship': 'pirate ship',
            'sailed': 'sailing ship',
            'anchor': 'anchor chain drop',
            'harbor': 'ocean harbor ambience',
            // Extra atmosphere
            'shadow': 'eerie dark ambience',
            'shadows': 'eerie dark ambience',
            'candle': 'candle flame flicker',
            'candles': 'candle flame flicker',
            'match': 'match strike ignite',
            'chimed': 'clock chime',
            'boards': 'footsteps wood stairs',
            'slammed': 'door slam',
            'whispered': 'breath whisper static',
            // Chains & Prison
            'chains': 'chains rattling',
            'shackled': 'chains rattling',
            'prison': 'chains rattling',
            // Villain
            'laughed': 'evil laugh',
            'giggled': 'princess laugh gentle',
            'laughter': 'princess laugh gentle',
            'cackle': 'maniacal cackle',
            'cackled': 'maniacal cackle',
            'cackling': 'maniacal cackle',
            // Treasure & Items
            'treasure': 'treasure chest open',
            'chest': 'treasure chest open',
            'torch': 'torch wall ignite',
            'torches': 'torch wall ignite',
            'torchlight': 'torch wall ignite',
            'tome': 'ancient book open',
            'grimoire': 'ancient book open',
            'book': 'ancient book open',
            'potion': 'potion cork pop',
            'vial': 'potion cork pop',
            'elixir': 'potion cork pop',
            'coin': 'coin bag jingle',
            'coins': 'coin bag jingle',
            'gold': 'coin bag jingle',
            'rope': 'rope snap tension',
            'extinguished': 'torch extinguish',
            'lamp': 'oil lamp lantern light',
            'lantern': 'oil lamp lantern light',
            'lockpick': 'lockpick clicking',
            'lock': 'lockpick clicking',
            // Creatures
            'goblin': 'goblin chittering',
            'goblins': 'goblin chittering',
            'snake': 'snake hiss',
            'serpent': 'snake hiss',
            'viper': 'snake hiss',
            'bat': 'bat screech',
            'bats': 'bat screech',
            'vampire': 'bat screech',
            'bear': 'bear growl roar',
            'eagle': 'eagle screech',
            'hawk': 'eagle screech',
            'wolves': 'wolf pack howling',
            'raven': 'raven caw',
            'crow': 'crow flock scatter',
            'crows': 'crow flock scatter',
            'pig': 'pig squeal farm',
            'hooves': 'horse galloping',
            'hoofbeats': 'horse galloping',
            'neigh': 'horse scared whinny',
            'neighing': 'horse scared whinny',
            // Combat extended
            'dagger': 'dagger unsheath',
            'knife': 'dagger unsheath',
            'blade': 'dagger unsheath',
            'axe': 'axe chop impact',
            'chopped': 'axe chop impact',
            'hacked': 'axe chop impact',
            'whip': 'whip crack',
            'brawl': 'crowd brawl fight',
            'grunted': 'grunt pain male',
            'groaned': 'wood stair groan creak',
            'dying': 'death rattle',
            'pierced': 'arrow hitting body',
            'impaled': 'arrow hitting body',
            'bones': 'bone crack',
            'skeleton': 'bone crack',
            'shielded': 'shield bash impact',
            // Magic extended
            'portal': 'magic portal open',
            'rift': 'magic portal open',
            'fizzled': 'spell fizzle fail',
            'dispelled': 'dispel magic',
            'counterspell': 'dispel magic',
            'frost': 'ice magic shatter',
            'frozen': 'ice magic shatter',
            'ice': 'ice magic shatter',
            'vanished': 'invisibility vanish',
            'disappeared': 'invisibility vanish',
            'invisible': 'invisibility vanish',
            'gust': 'wind gust spell',
            // Dark & Occult
            'demon': 'demonic voice growl',
            'demonic': 'demonic voice growl',
            'ritual': 'cult ritual chanting',
            'cult': 'cult ritual chanting',
            'summoning': 'dark summoning energy',
            'summoned': 'dark summoning energy',
            'undead': 'necromancer raise dead',
            'zombie': 'necromancer raise dead',
            'possessed': 'possessed whisper',
            'blood': 'blood drip silence',
            // Dungeon traps
            'trap': 'dungeon trap spring',
            'trapped': 'dungeon trap spring',
            'portcullis': 'portcullis drop',
            'gate': 'iron gate creak rusty open',
            'lever': 'lever pull mechanism',
            'drawbridge': 'drawbridge chains',
            // Environments
            'tavern': 'tavern ambience',
            'inn': 'tavern ambience',
            'feast': 'medieval feast hall',
            'banquet': 'medieval feast hall',
            'swamp': 'swamp ambience',
            'marsh': 'swamp ambience',
            'jungle': 'jungle ambience',
            'cathedral': 'cathedral interior',
            'church': 'cathedral interior',
            'monastery': 'monastery bells',
            'graveyard': 'graveyard night',
            'cemetery': 'graveyard night',
            'saloon': 'saloon ambience',
            'sewer': 'sewer drip ambience',
            'sewers': 'sewer drip ambience',
            'cave': 'cave echo drip',
            'cavern': 'cave echo drip',
            'dungeon': 'dungeon stone ambience',
            'forest': 'forest ambience daytime',
            'woods': 'forest ambience daytime',
            'woodland': 'forest ambience daytime',
            'mountain': 'mountain wind ambience',
            'village': 'village morning ambience',
            'market': 'market crowd busy',
            'marketplace': 'market crowd busy',
            'blacksmith': 'blacksmith forge',
            'forge': 'blacksmith forge',
            'anvil': 'blacksmith forge',
            'library': 'library quiet',
            'underwater': 'underwater pressure',
            'submerged': 'underwater pressure',
            // Weather extended
            'breeze': 'gentle breeze meadow',
            'blizzard': 'blizzard howling',
            'snowstorm': 'blizzard howling',
            'winter': 'winter wind snow',
            'snow': 'winter wind snow',
            'avalanche': 'avalanche rumble',
            'sandstorm': 'desert sandstorm',
            'desert': 'desert night ambience',
            'waterfall': 'waterfall rushing',
            'foghorn': 'foghorn harbor',
            'snapped': 'branch snap forest',
            'earthquake': 'earthquake rumble',
            // Victory / defeat
            'victory': 'victory fanfare',
            'triumph': 'victory fanfare',
            'defeated': 'defeat sting',
            'discovered': 'discovery sting',
            'revealed': 'discovery sting',
            'gasp': 'crowd gasp',
            'gasped': 'crowd gasp',
            // Social
            'mob': 'angry mob crowd',
            'riot': 'angry mob crowd',
            'funeral': 'funeral procession',
            'mourning': 'funeral procession',
            'soldiers': 'soldier march troop',
            'troops': 'soldier march troop',
            'army': 'soldier march troop',
            'merchant': 'merchant greeting',
            'trader': 'merchant greeting',
            'prayed': 'crowd prayer chant',
            'prayer': 'crowd prayer chant',
            // Gallows
            'gallows': 'gallows rope creak',
            'hanged': 'gallows rope creak',
            'execution': 'gallows rope creak',
            'passage': 'secret door click',
            // Sci-fi
            'laser': 'laser blaster shot',
            'blaster': 'laser blaster shot',
            'spaceship': 'spaceship engine hum',
            'spacecraft': 'spaceship engine hum',
            'warp': 'warp jump engage',
            'hyperspace': 'warp jump engage',
            'alien': 'alien creature screech',
            'computer': 'computer terminal beep',
            'robot': 'robot servo walk',
            'mech': 'robot servo walk',
            'alarm': 'sci-fi alarm siren',
            // Western
            'gunshot': 'gunshot ricochet',
            'revolver': 'gunshot ricochet',
            'pistol': 'gunshot ricochet',
            'tumbleweed': 'tumbleweed desert',
            'spurs': 'spur jingle walk',

            // ═══════ NEW – Stealth / movement ═══════
            'stealth': 'stealth sneaking music',
            'sneaking': 'stealth sneaking music',
            'sneaked': 'stealth sneaking music',
            'bridge': 'bridge wood creaking',
            'wagon': 'wagon cart cobblestone',
            'cart': 'wagon cart cobblestone',
            'rowing': 'rowing oars water',
            'rowed': 'rowing oars water',
            'oars': 'rowing oars water',
            'splash': 'splash water dive',
            'splashed': 'splash water dive',
            'plunged': 'splash water dive',
            'dived': 'splash water dive',

            // ═══════ NEW – Combat & weapons extended ═══════
            'crossbow': 'crossbow shot bolt',
            'mace': 'mace heavy impact',
            'volley': 'arrow volley battle',
            'cavalry': 'cavalry charge hooves',
            'horsemen': 'cavalry charge hooves',
            'catapult': 'catapult launch boulder',
            'trebuchet': 'catapult launch boulder',
            'battering': 'battering ram impact',
            'flail': 'flail morningstar swing',
            'bowstring': 'bowstring draw tension',
            'warhorn': 'war horn battle signal',
            'broadside': 'ship cannon broadside',
            'dragonfire': 'dragonfire breath blast',
            'armor': 'armor removing clank',

            // ═══════ NEW – Creatures extended ═══════
            'insect': 'insect buzzing swarm',
            'buzzing': 'insect buzzing swarm',
            'bee': 'insect buzzing swarm',
            'wasp': 'insect buzzing swarm',
            'frog': 'frog croaking pond',
            'toad': 'frog croaking pond',
            'hawk': 'hawk falcon dive screech',
            'falcon': 'hawk falcon dive screech',
            'whale': 'whale song deep ocean',
            'seagull': 'seagull calls coastal',
            'gull': 'seagull calls coastal',
            'elephant': 'elephant trumpet call',
            'monkey': 'monkey screech jungle',
            'ape': 'monkey screech jungle',
            'deer': 'deer stag bellow',
            'stag': 'deer stag bellow',
            'elk': 'deer stag bellow',
            'cricket': 'cricket chorus night',

            // ═══════ NEW – Magic extended ═══════
            'resurrection': 'resurrection divine magic',
            'revived': 'resurrection divine magic',
            'resurrected': 'resurrection divine magic',
            'shapeshifted': 'transformation shapeshifting',
            'transformed': 'transformation shapeshifting',
            'werewolf': 'transformation shapeshifting',
            'telekinesis': 'telekinesis force hum',
            'enchantment': 'enchantment sparkle apply',
            'enchanted': 'enchanted garden music',
            'ward': 'ward barrier activate',
            'barrier': 'ward barrier activate',
            'scroll': 'scroll unfurling open',

            // ═══════ NEW – Dark / occult extended ═══════
            'soul': 'soul drain dark magic',
            'drained': 'soul drain dark magic',

            // ═══════ NEW – Weather & environment extended ═══════
            'volcano': 'volcano eruption rumble',
            'volcanic': 'volcano eruption rumble',
            'eruption': 'volcano eruption rumble',
            'lava': 'lava bubbling flow',
            'magma': 'lava bubbling flow',
            'downpour': 'heavy rain downpour',
            'monsoon': 'heavy rain downpour',
            'hail': 'hail storm pelting',
            'rockslide': 'rockslide avalanche',
            'landslide': 'rockslide avalanche',
            'quicksand': 'quicksand sinking',

            // ═══════ NEW – Water extended ═══════
            'brook': 'bubbling brook gentle',
            'stream': 'bubbling brook gentle',
            'creek': 'bubbling brook gentle',

            // ═══════ NEW – Nautical extended ═══════
            'shanty': 'sea shanty sailing music',
            'sail': 'sail canvas unfurling',
            'unfurled': 'sail canvas unfurling',

            // ═══════ NEW – Dungeon & mechanical ═══════
            'pickaxe': 'pickaxe mining stone',
            'mining': 'pickaxe mining stone',
            'boulder': 'boulder rolling trap',
            'barrel': 'barrel rolling cellar',
            'dart': 'trap dart spring',
            'rusty': 'rusty hinge squeak',

            // ═══════ NEW – Items & interactions ═══════
            'dice': 'dice rolling table',
            'gambled': 'dice rolling table',
            'coin': 'coin toss flip',
            'quill': 'quill writing parchment',
            'wrote': 'quill writing parchment',
            'toast': 'glass clink toast',
            'cheers': 'glass clink toast',
            'toasted': 'glass clink toast',
            'cooking': 'cooking fire sizzle',
            'sizzled': 'cooking fire sizzle',
            'chopping': 'wood chopping axe',
            'lumberjack': 'wood chopping axe',
            'mirror': 'mirror shatter cursed',

            // ═══════ NEW – Vocal & social extended ═══════
            'children': 'child laughing playing',
            'kids': 'child laughing playing',
            'murmur': 'crowd quiet murmur',
            'murmured': 'crowd quiet murmur',
            'drinking': 'eating drinking gulp',
            'gulped': 'eating drinking gulp',
            'ale': 'eating drinking gulp',
            'tankard': 'eating drinking gulp',
            'snoring': 'snoring sleeping',
            'snored': 'snoring sleeping',
            'coughing': 'coughing choking',
            'coughed': 'coughing choking',

            // ═══════ NEW – Atmosphere & music cues ═══════
            'temple': 'ancient temple mystical music',
            'lair': 'dragon lair ominous music',
            'bayou': 'swamp bayou music',
            'tundra': 'frozen tundra music',
            'arctic': 'frozen tundra music',
            'throne': 'royal court throne music',
            'royal': 'royal court throne music',
            'coronation': 'royal court throne music',
            'bazaar': 'marketplace bazaar music',
            'romantic': 'romantic serenade music',
            'kissed': 'romantic serenade music',
            'serenade': 'romantic serenade music',
            'dawn': 'dawn sunrise music',
            'sunrise': 'dawn sunrise music',
            'chimes': 'gentle breeze wind chimes',
            'caravan': 'desert caravan music',
            'tribal': 'tribal jungle drums music',
            'cosmic': 'space cosmic ambient music',
            'galaxy': 'space cosmic ambient music',
            'shanties': 'sea shanty sailing music',
            'jig': 'drunken tavern jig music',
            'drunk': 'drunken tavern jig music',
            'drunken': 'drunken tavern jig music',
            'bandit': 'bandit ambush music',
            'bandits': 'bandit ambush music',
            'outlaw': 'bandit ambush music',
        };
    }

    // Cue words that should play as looping ambient rather than one-shot SFX
    static _ambientCueWords = new Set([
        'rain', 'storm', 'wind', 'howled', 'thunder', 'thundering', 'lightning',
        'fire', 'flames', 'flame', 'campfire', 'fireplace', 'hearth', 'bonfire', 'wildfire', 'inferno',
        'crackled',
        'tavern', 'inn', 'swamp', 'marsh', 'jungle', 'cathedral', 'church', 'graveyard', 'cemetery',
        'saloon', 'sewer', 'sewers', 'cave', 'cavern', 'blizzard', 'snowstorm',
        'underwater', 'submerged', 'spaceship', 'spacecraft', 'market', 'marketplace',
        'forest', 'woods', 'woodland', 'mountain', 'dungeon', 'village',
        'winter', 'snow', 'desert', 'harbor', 'feast', 'banquet', 'breeze',
        // NEW — additional ambient loops
        'lava', 'volcano', 'volcanic', 'brook', 'stream', 'creek', 'cricket',
        'insect', 'buzzing', 'frog', 'toad', 'downpour', 'monsoon',
        'temple', 'lair', 'bayou', 'tundra', 'arctic', 'throne', 'royal', 'bazaar',
        'rowing', 'rowed', 'cooking', 'chimes',
    ]);

    // Scene categories for story cues -- used to fade out stale SFX on scene change
    getStoryCueCategory(word) {
        const categories = {
            combat:      ['sword','swords','arrow','arrows','shield','strike','clashed','clash','cannon','cannons','shouted','dagger','knife','blade','axe','chopped','hacked','whip','brawl','pierced','impaled','shielded','gunshot','revolver','pistol','laser','blaster','armor','armored','crossbow','mace','volley','cavalry','horsemen','catapult','trebuchet','battering','flail','bowstring','warhorn','broadside','dragonfire'],
            weather:     ['wind','howled','rain','storm','thunder','thundering','lightning','blizzard','snowstorm','avalanche','sandstorm','waterfall','foghorn','snapped','volcano','volcanic','eruption','downpour','monsoon','hail','rockslide','landslide'],
            fire:        ['fire','crackled','flames','flame','embers','candle','candles','match','torch','torches','extinguished','campfire','fireplace','hearth','bonfire','wildfire','inferno','lighter','zippo','kindled','kindle','lamp','lantern','lava','magma','cooking','sizzled'],
            creature:    ['dragon','growl','wolf','owl','hooted','rat','horse','horses','goblin','goblins','snake','serpent','viper','bat','bats','vampire','bear','eagle','hawk','wolves','raven','crow','crows','pig','neigh','neighing','alien','demon','demonic','insect','buzzing','bee','wasp','frog','toad','falcon','whale','seagull','gull','elephant','monkey','ape','deer','stag','elk','cricket','werewolf'],
            movement:    ['footsteps','step','steps','crept','door','creaked','knocked','knock','boards','slammed','portcullis','gate','lever','drawbridge','trap','trapped','lockpick','lock','passage','spurs','stealth','sneaking','sneaked','bridge','wagon','cart','splash','splashed','rowing','rowed','oars','plunged','dived'],
            magic:       ['magic','spell','wizard','arcane','crystal','healing','chanted','incantation','portal','rift','fizzled','dispelled','counterspell','frost','frozen','ice','vanished','disappeared','invisible','gust','summoning','summoned','rune','runes','brew','brewing','cauldron','resurrection','revived','resurrected','shapeshifted','transformed','telekinesis','enchantment','enchanted','ward','barrier','scroll'],
            water:       ['dripped','waves','waterfall','underwater','submerged','sewer','sewers','swamp','marsh','brook','stream','creek','quicksand'],
            celebration: ['bell','bells','music','celebrated','clock','midnight','crowd','applause','clapping','chimed','coach','victory','triumph','discovered','revealed','treasure','chest','gasp','gasped','holy','divine','sacred','dice','gambled','coin','toast','cheers','toasted'],
            nautical:    ['ship','sailed','anchor','foghorn','harbor','seagull','gull','sail','unfurled','shanty','shanties'],
            atmosphere:  ['shadow','shadows','whispered','heartbeat','silence','tavern','inn','jungle','cathedral','church','graveyard','cemetery','saloon','cave','cavern','library','market','marketplace','spaceship','spacecraft','funeral','mourning','gallows','hanged','execution','prayer','prayed','forest','woods','woodland','mountain','dungeon','village','winter','snow','desert','feast','banquet','monastery','breeze','temple','lair','bayou','tundra','arctic','throne','royal','coronation','bazaar','romantic','kissed','serenade','dawn','sunrise','chimes','caravan','tribal','cosmic','galaxy','jig','drunk','drunken','bandit','bandits','outlaw','quill','wrote'],
            impact:      ['glass','shattered','exploded','trembled','collapsed','earthquake','avalanche','bones','skeleton','brawl','mob','riot','mirror','boulder'],
            vocal:       ['scream','screamed','shrieked','shriek','screeched','wailed','wail','sobbed','whimpered','bellowed','yelled','roared','gasp','gasped','laughed','cackled','cackling','cackle','grunted','groaned','dying','baby','infant','cried','children','kids','murmur','murmured','drinking','gulped','ale','tankard','snoring','snored','coughing','coughed'],
            occult:      ['demon','demonic','ritual','cult','possessed','blood','undead','zombie','chains','shackled','prison','summoning','summoned','curse','cursed','hex','soul','drained'],
            dungeon:     ['trap','trapped','portcullis','gate','lever','drawbridge','lockpick','lock','cave','cavern','sewer','sewers','chains','prison','gallows','pickaxe','mining','barrel','dart','rusty'],
            scifi:       ['laser','blaster','spaceship','spacecraft','warp','hyperspace','alien','computer','robot','mech','alarm'],
            western:     ['gunshot','revolver','pistol','spurs','tumbleweed','saloon'],
            social:      ['mob','riot','soldiers','troops','army','merchant','trader','funeral','mourning','prayed','prayer'],
        };
        for (const [cat, words] of Object.entries(categories)) {
            if (words.includes(word)) return cat;
        }
        return 'other';
    }

    // Max duration (seconds) before auto-fadeout per category
    _storySfxMaxDuration(category) {
        switch (category) {
            case 'combat':     return 20;
            case 'weather':    return 60;
            case 'fire':       return 45;
            case 'creature':   return 15;
            case 'celebration': return 30;
            case 'nautical':   return 30;
            case 'water':      return 45;
            case 'atmosphere': return 60;
            case 'dungeon':    return 30;
            case 'occult':     return 20;
            case 'scifi':      return 20;
            case 'western':    return 15;
            case 'social':     return 25;
            default:           return 12;
        }
    }

    // Fade out a tracked story SFX entry over fadeMs
    _fadeOutStorySfx(entry, fadeMs = 800) {
        if (!entry || entry._fadingOut) return;
        entry._fadingOut = true;
        if (entry.timer) clearTimeout(entry.timer);
        const snd = this.activeSounds.get(entry.id);
        if (!snd) { this._activeStorySfx.delete(entry.id); return; }
        try {
            if (snd.gainNode) {
                // Web Audio path: ramp gain to 0
                snd.gainNode.gain.setValueAtTime(snd.gainNode.gain.value, this.audioContext.currentTime);
                snd.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + fadeMs / 1000);
                setTimeout(() => {
                    try { snd.source && snd.source.stop(); } catch(_){}
                    this.activeSounds.delete(entry.id);
                    this._activeStorySfx.delete(entry.id);
                }, fadeMs + 50);
            } else if (snd._howl) {
                // Howler path
                snd._howl.fade(snd._howl.volume(), 0, fadeMs);
                setTimeout(() => {
                    try { snd._howl.stop(); snd._howl.unload(); } catch(_){}
                    this.activeSounds.delete(entry.id);
                    this._activeStorySfx.delete(entry.id);
                }, fadeMs + 50);
            }
        } catch(_) {
            this.activeSounds.delete(entry.id);
            this._activeStorySfx.delete(entry.id);
        }
    }

    // Fade out story SFX whose category conflicts with a new scene
    // Ambient sounds (weather, atmosphere, fire, water) coexist — only faded by non-ambient categories
    _fadeOutStaleStorySfx(newCategory) {
        if (!this._activeStorySfx) return;
        const ambientCategories = new Set(['weather', 'atmosphere', 'fire', 'water']);
        const newIsAmbient = ambientCategories.has(newCategory);
        for (const [id, entry] of this._activeStorySfx) {
            if (entry._fadingOut) continue;
            if (entry.category === newCategory) continue; // same category, keep
            const entryIsAmbient = ambientCategories.has(entry.category);
            // Ambient categories coexist — don't fade ambient sounds unless a non-ambient takes over
            if (entryIsAmbient) continue;
            // Non-ambient sounds get faded when category changes
            this._fadeOutStorySfx(entry);
        }
    }

    prefetchStoryWindow() {
        if (!this.sfxEnabled) return;
        const cueMap = this.getStoryCueMap();
        const windowTokens = this.storyNorm.slice(this.storyIndex, this.storyIndex + 80);
        const seen = new Set();
        for (const w of windowTokens) {
            if (!w) continue;
            const key = w in cueMap ? w : null;
            if (key && !seen.has(key)) {
                seen.add(key);
                const q = cueMap[key];
                // Warm cache similarly to predictivePrefetch
                const cacheKey = `sfx:${q}`;
                if (this.soundCache.has(cacheKey)) continue;
                this.searchAudio(q, 'sfx').then(async (url) => {
                    if (!url) return;
                    if (!this.activeBuffers.has(url)) {
                        try {
                            const resp = await fetch(url); const ab = await resp.arrayBuffer();
                            const buf = await this.audioContext.decodeAudioData(ab); this.activeBuffers.set(url, buf);
                        } catch(_) {}
                    }
                });
            }
        }
    }

    maybeTriggerStorySfx(word) {
        if (!this.sfxEnabled) return;
        // Per-cue-word cooldown: each keyword only triggers once (reset on new story)
        if (!this._storyCueFired) this._storyCueFired = new Set();
        if (this._storyCueFired.has(word)) return;

        const cueMap = this.getStoryCueMap();
        if (!(word in cueMap)) return;
        this._storyCueFired.add(word);

        // Determine scene category for this cue
        const category = this.getStoryCueCategory(word);
        if (!this._activeStorySfx) this._activeStorySfx = new Map();

        // Fade out any active story SFX from a different scene
        this._fadeOutStaleStorySfx(category);

        // Ambient cue words loop continuously until a scene change fades them
        const isAmbient = Effexiq._ambientCueWords.has(word);
        // Skip ambient sounds entirely if ambience is disabled
        if (isAmbient && !this.ambienceEnabled) return;
        const baseVol = isAmbient ? 0.45 : 0.7;
        // Scale non-ambient cues by voice intensity so a loud "BOO!" = louder sound
        const vol = isAmbient ? baseVol : Math.min(1.0, baseVol * Math.max(0.5, this.voiceIntensity));
        // Apply user's ambient duration multiplier to non-looping SFX timers
        const baseDur = this._storySfxMaxDuration(category) * 1000;
        const maxDur = isAmbient ? null : baseDur * this.ambientDurationMultiplier;

        // In demo mode, use pre-resolved URLs + buffer cache for instant playback
        if (this.demoRunning && this.demoCueCache && this.demoCueCache[word]) {
            const url = this.demoCueCache[word];
            const buf = this.getFromBufferCache(url);
            if (buf) {
                this.playBufferDirect(url, buf, vol, isAmbient);
                const id = this._findLatestActiveSoundId();
                if (id) {
                    const timer = maxDur
                        ? setTimeout(() => this._fadeOutStorySfx(this._activeStorySfx.get(id)), maxDur)
                        : null;
                    this._activeStorySfx.set(id, { id, category, timer, _fadingOut: false });
                }
                return;
            }
        }
        const q = cueMap[word];
        if (q) {
            const searchAndPlay = async () => {
                const soundUrl = await this.searchAudio(q, 'sfx');
                if (!soundUrl) return;
                await this.playAudio(soundUrl, {
                    type: 'sfx', name: q,
                    volume: this.calculateVolume(vol),
                    loop: isAmbient
                });
                const id = this._findLatestActiveSoundId();
                if (id) {
                    const timer = maxDur
                        ? setTimeout(() => this._fadeOutStorySfx(this._activeStorySfx.get(id)), maxDur)
                        : null;
                    this._activeStorySfx.set(id, { id, category, timer, _fadingOut: false });
                }
            };
            searchAndPlay().catch(e => debugLog('Story SFX trigger failed:', e.message));
        }
    }

    // Find the most recently added active sound ID (by startTime)
    _findLatestActiveSoundId() {
        let latestId = null, latestTime = 0;
        for (const [id, snd] of this.activeSounds) {
            if (snd.type === 'sfx' && snd.startTime && snd.startTime > latestTime) {
                latestTime = snd.startTime;
                latestId = id;
            }
        }
        return latestId;
    }

    // ===== INSTANT KEYWORD PRELOADING =====
    async preloadInstantKeywords() {
        if (this._preloadKeywordsInProgress) return;
        this._preloadKeywordsInProgress = true;
        try {
        if (!this.audioContext) {
            debugLog('Skipping instant keyword preload (no audio context)');
            return;
        }
        if (Object.keys(this.instantKeywords).length === 0) {
            debugLog('Skipping instant keyword preload (trigger map not built yet)');
            return;
        }

        debugLog('Preloading instant keyword buffers...');
        
        // Get priority keywords from the trigger map (those with direct file paths)
        // Group by unique file to avoid decoding the same file twice
        const fileToKeywords = new Map();
        for (const [keyword, config] of Object.entries(this.instantKeywords)) {
            if (config.file && !fileToKeywords.has(config.file)) {
                fileToKeywords.set(config.file, { keyword, config });
            }
        }
        
        // Prioritize combat, creature, and common trigger sounds
        const priorityCategories = ['combat', 'creature', 'explosion', 'animal', 'weather', 'door'];
        const sorted = [...fileToKeywords.entries()].sort((a, b) => {
            const catA = priorityCategories.indexOf(a[1].config.category || '');
            const catB = priorityCategories.indexOf(b[1].config.category || '');
            return (catA === -1 ? 99 : catA) - (catB === -1 ? 99 : catB);
        });
        // Cap at 30 unique files to preload (keeps memory reasonable)
        const toPreload = sorted.slice(0, 30);
        
        let loaded = 0;
        this.updatePreloadProgress(0, toPreload.length);
        const tasks = toPreload.map(([file, { keyword, config }]) => async () => {
            try {
                const url = encodeURI(file);
                const srcs = this.buildSrcCandidates(url);
                let resp = null;
                for (const src of srcs) {
                    try { resp = await fetch(src); if (resp.ok) break; } catch(_) { resp = null; }
                }
                if (!resp || !resp.ok) { loaded++; this.updatePreloadProgress(loaded, toPreload.length); return; }
                const ab = await resp.arrayBuffer();
                const buffer = await this.audioContext.decodeAudioData(ab);
                
                // Map all keywords that point to this file 
                for (const [kw, kConfig] of Object.entries(this.instantKeywords)) {
                    if (kConfig.file === file) {
                        this.instantKeywordBuffers.set(kw, { buffer, url, volume: kConfig.volume });
                    }
                }
                this.addToBufferCache(url, buffer);
                loaded++;
                this.updatePreloadProgress(loaded, toPreload.length);
            } catch (e) {
                debugLog(`Failed to preload ${keyword}:`, e.message);
                loaded++;
                this.updatePreloadProgress(loaded, toPreload.length);
            }
        });
        
        await this.runWithConcurrency(tasks, 3);
        
        if (loaded > 0) {
            debugLog(`Preloaded ${loaded}/${toPreload.length} instant keyword buffers`);
            this.updateStatus(`Ready! ${loaded} instant sounds preloaded`);
        }
        } finally {
            this._preloadKeywordsInProgress = false;
        }
    }

    // ===== CDN PRE-WARMING =====
    async prewarmCDN() {
        if (!this.soundCatalog || this.soundCatalog.length === 0) {
            debugLog('Skipping CDN pre-warm (no catalog loaded yet)');
            return;
        }
        // Skip in local-only mode — files are served directly
        if (!this.backendAvailable) {
            return;
        }

        debugLog('Pre-warming CDN cache...');
        
        // Top most common sounds across all modes
        const topSoundIds = [
            'sword_clash', 'door_creak', 'footsteps', 'thunder',
            'wind_whoosh', 'fire_crackling', 'crowd_tavern', 'dog_bark',
            'door_knock', /* 'owl_hoot' removed (404) */ 'crickets', 'monster_roar',
            'magic_whoosh', 'heartbeat'
        ];
        
        topSoundIds.forEach(id => {
            const sound = this.soundCatalog.find(s => s.id === id);
            if (sound) {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = this.getFullSoundUrl(sound.src);
                link.as = 'audio';
                link.crossOrigin = 'anonymous';
                document.head.appendChild(link);
            }
        });
        
        debugLog(`✓ Pre-warming CDN for ${topSoundIds.length} common sounds`);
    }

    getFullSoundUrl(src) {
        if (src.startsWith('http://') || src.startsWith('https://')) {
            return src; // Already absolute
        }
        return `${this.backendUrl}${src}`;
    }

    // ===== BUFFER CACHE WITH LRU EVICTION =====
    addToBufferCache(url, buffer) {
        if (this.bufferCache.has(url)) {
            // Refresh position: remove and re-add at end so it is treated as recently used
            this.bufferCache.delete(url);
        } else if (this.bufferCache.size >= this.maxBufferCacheSize) {
            // Evict least-recently-used (first/oldest key in insertion-order Map)
            const firstKey = this.bufferCache.keys().next().value;
            this.bufferCache.delete(firstKey);
        }
        this.bufferCache.set(url, buffer);
    }

    getFromBufferCache(url) {
        if (!this.bufferCache.has(url)) return undefined;
        const buffer = this.bufferCache.get(url);
        // Refresh: move to end so hot entries are not evicted while cold ones linger
        this.bufferCache.delete(url);
        this.bufferCache.set(url, buffer);
        return buffer;
    }

    async checkSubscription() {
        const modal = document.getElementById('subscribeModal');
        const appContainer = document.getElementById('appContainer');
        const noKeyBanner = document.getElementById('noKeyBanner');

        // Always show the app container immediately
        if (appContainer) {
            appContainer.classList.remove('hidden');
            appContainer.style.display = 'block';
        }

        // Firefox detection
        if (!isSpeechRecognitionAvailable()) {
            document.getElementById('firefoxWarning')?.classList.remove('hidden');
        }

        // Try backend connection silently
        const backendUrl = this.getBackendUrl();
        const sameOrigin = backendUrl.replace(/\/$/, '') === location.origin.replace(/\/$/, '');
        if (backendUrl && !sameOrigin) {
            try {
                const _ac = new AbortController(); const _to = setTimeout(() => _ac.abort(), 3000);
                const resp = await fetch(`${backendUrl}/health`, { cache: 'no-cache', signal: _ac.signal });
                clearTimeout(_to);
                if (resp.ok) {
                    this.backendAvailable = true;
                    try { this.backendHealth = await resp.json(); } catch (_) { this.backendHealth = null; }
                    debugLog('[Effexiq] Backend connected');
                }
            } catch (_) {
                this.backendAvailable = false;
                debugLog('[Effexiq] Backend not reachable');
            }
        }

        // Check for Stripe session_id in URL (post-checkout redirect)
        const urlParams = new URLSearchParams(location.search);
        const sessionId = urlParams.get('session_id');
        if (sessionId) {
            history.replaceState(null, '', location.pathname); // clean URL
            try {
                this.updateStatus('Activating subscription...');
                const resp = await fetch(`${backendUrl}/activate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId }),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    setAccessToken(data.token);
                    this.accessToken = data.token;
                    this.updateStatus('Subscription activated! Welcome to Effexiq.');
                    this.logActivity('Subscription activated', 'success');
                } else {
                    const err = await resp.json().catch(() => ({}));
                    this.updateStatus(`Activation failed: ${err.error || 'Please try again.'}`);
                }
            } catch (err) {
                this.updateStatus('Activation failed — check your connection.');
            }
        }

        this.accessToken = getAccessToken();

        // Free access - skip paywall, enable AI features directly
        if (modal) modal.classList.add('hidden');
        if (noKeyBanner) noKeyBanner.classList.add('hidden');
        this.backendAvailable = true;
        this.updateStatus('Ready - AI features active');
        this.updateApiStatusIndicators();
        this._updateSubscriptionStatus();
    }

    /** Update subscription status text in Settings */
    _updateSubscriptionStatus() {
        const el = document.getElementById('subscriptionStatus');
        if (!el) return;
        if (this.accessToken) {
            try {
                // JWT payloads use base64url (- and _ chars, no padding) — must normalise before atob()
                const b64 = this.accessToken.split('.')[1]
                    .replace(/-/g, '+').replace(/_/g, '/')
                    .padEnd(Math.ceil(this.accessToken.split('.')[1].length / 4) * 4, '=');
                const payload = JSON.parse(atob(b64));
                const exp = new Date(payload.exp * 1000);
                const daysLeft = Math.ceil((exp - Date.now()) / 86400000);
                el.textContent = `Active — token expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
                el.style.color = daysLeft <= 5 ? 'orange' : '';
            } catch (_) {
                el.textContent = 'Active subscription';
            }
        } else {
            el.textContent = 'No active subscription. Subscribe to unlock AI features.';
        }
    }

    async startCheckout() {
        const backendUrl = this.getBackendUrl();
        try {
            this.updateStatus('Redirecting to checkout...');
            const origin = location.origin;
            const base = location.pathname.replace(/\/[^/]*$/, '/');
            const resp = await fetch(`${backendUrl}/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    successUrl: `${origin}${base}?session_id={CHECKOUT_SESSION_ID}`,
                    cancelUrl: `${origin}${base}`,
                }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const { url } = await resp.json();
            window.location.href = url;
        } catch (err) {
            this.updateStatus(`Checkout error: ${err.message}`);
        }
    }

    async saveToken() {
        const input = document.getElementById('accessTokenInput');
        if (!input) return;
        const token = input.value.trim();
        if (!token || token.split('.').length !== 3) {
            this.updateStatus('Invalid token format — paste the full token you received');
            return;
        }
        setAccessToken(token);
        this.accessToken = token;
        input.value = '';
        document.getElementById('subscribeModal')?.classList.add('hidden');
        document.getElementById('noKeyBanner')?.classList.add('hidden');
        this.updateStatus('Token activated! AI features are now active.');
        this.updateApiStatusIndicators();
        this._updateSubscriptionStatus();
    }

    async refreshToken() {
        const backendUrl = this.getBackendUrl();
        if (!this.accessToken) {
            this.updateStatus('No token to refresh — please subscribe first.');
            return;
        }
        try {
            this.updateStatus('Refreshing access token...');
            const resp = await fetch(`${backendUrl}/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                this.updateStatus(`Refresh failed: ${err.error || 'Subscription may be inactive.'}`);
                return;
            }
            const data = await resp.json();
            setAccessToken(data.token);
            this.accessToken = data.token;
            this.updateStatus('Access token refreshed successfully.');
            this._updateSubscriptionStatus();
        } catch (err) {
            this.updateStatus(`Refresh error: ${err.message}`);
        }
    }
    
    showFreesoundSetup() {
        document.getElementById('freesoundModal')?.classList.remove('hidden');
    }
    
    hideFreesoundSetup() {
        document.getElementById('freesoundModal')?.classList.add('hidden');
    }

    showTutorial() {
        document.getElementById('tutorialModal').classList.remove('hidden');
    }
    
    showFeedback() {
        document.getElementById('feedbackModal').classList.remove('hidden');
    }
    
    hideFeedback() {
        document.getElementById('feedbackModal').classList.add('hidden');
    }
    
    sendFeedbackEmail() {
        const type = (document.getElementById('feedbackType')?.value || 'Feedback').trim();
        const subjectInput = (document.getElementById('feedbackSubject')?.value || '').trim();
        const message = (document.getElementById('feedbackText')?.value || '').trim();
        const subject = subjectInput || `${type} - Effexiq`;
        
        // Gather minimal context
        const versionText = document.querySelector('.version')?.textContent || 'v1.x';
        const ctx = [
            `Mode: ${this.currentMode}`,
            `Music: ${this.musicEnabled ? 'on' : 'off'}, SFX: ${this.sfxEnabled ? 'on' : 'off'}`,
            `Mood: ${Math.round(this.moodBias*100)}%`,
            `URL: ${location.href}`,
            `App: ${versionText}`,
            `UA: ${navigator.userAgent}`
        ].join('\n');
        
    const body = `${type}\n\n${message}\n\n---\nContext\n${ctx}`;
    const mailto = `mailto:aaroncue92@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('aaroncue92@gmail.com')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        // Try open default mail client
        try {
            const a = document.createElement('a');
            a.href = mailto;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            this.updateStatus('Opening your email app...');
        } catch (e) {
            this.updateStatus('Could not open email app. Copying email content...');
            try { navigator.clipboard.writeText(`${subject}\n\n${body}`); } catch(_) {}
            alert('If your email app did not open, please paste the copied text into an email to: aaroncue92@gmail.com');
        }
        
        this.hideFeedback();
    }

    openFeedbackInGmail() {
        const type = (document.getElementById('feedbackType')?.value || 'Feedback').trim();
        const subjectInput = (document.getElementById('feedbackSubject')?.value || '').trim();
        const message = (document.getElementById('feedbackText')?.value || '').trim();
        const subject = subjectInput || `${type} - Effexiq`;
        const versionText = document.querySelector('.version')?.textContent || 'v1.x';
        const ctx = [
            `Mode: ${this.currentMode}`,
            `Music: ${this.musicEnabled ? 'on' : 'off'}, SFX: ${this.sfxEnabled ? 'on' : 'off'}`,
            `Mood: ${Math.round(this.moodBias*100)}%`,
            `URL: ${location.href}`,
            `App: ${versionText}`,
            `UA: ${navigator.userAgent}`
        ].join('\n');
        const body = `${type}\n\n${message}\n\n---\nContext\n${ctx}`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('aaroncue92@gmail.com')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        try {
            window.open(gmailUrl, '_blank', 'noopener');
            this.updateStatus('Opening Gmail compose...');
        } catch (_) {
            this.updateStatus('Could not open Gmail. Copying content...');
            try { navigator.clipboard.writeText(`${subject}\n\n${body}`); } catch(_){ }
        }
        this.hideFeedback();
    }

    copyFeedbackDetails() {
        const type = (document.getElementById('feedbackType')?.value || 'Feedback').trim();
        const subjectInput = (document.getElementById('feedbackSubject')?.value || '').trim();
        const message = (document.getElementById('feedbackText')?.value || '').trim();
        const subject = subjectInput || `${type} - Effexiq`;
        const versionText = document.querySelector('.version')?.textContent || 'v1.x';
        const ctx = [
            `Mode: ${this.currentMode}`,
            `Music: ${this.musicEnabled ? 'on' : 'off'}, SFX: ${this.sfxEnabled ? 'on' : 'off'}`,
            `Mood: ${Math.round(this.moodBias*100)}%`,
            `URL: ${location.href}`,
            `App: ${versionText}`,
            `UA: ${navigator.userAgent}`
        ].join('\n');
        const body = `${subject}\n\n${message}\n\n---\nContext\n${ctx}`;
        try {
            navigator.clipboard.writeText(body);
            this.updateStatus('Feedback details copied to clipboard');
            alert('Copied! Paste this into your email to: aaroncue92@gmail.com');
        } catch (_) {
            this.updateStatus('Copy failed.');
        }
    }

    hideTutorial() {
        document.getElementById('tutorialModal').classList.add('hidden');
    }
    
    async refreshApp() {
        try {
            // Confirm before stopping — so cancelling does not disrupt the active session
            if (!confirm('This will refresh the app and clear the cache to get the latest version. Continue?')) {
                return;
            }

            // User confirmed — now stop all audio and listening
            this.stopListening();
            this.stopAllAudio();
            
            this.updateStatus('ðŸ”„ Refreshing app and clearing cache...');
            
            // Unregister service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                debugLog('Service workers unregistered');
            }
            
            // Clear all caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                debugLog('Caches cleared');
            }
            
            // Force reload from server (bypass cache)
            if (this._autosaveInterval) { clearInterval(this._autosaveInterval); this._autosaveInterval = null; }
            window.location.reload(true);
        } catch (err) {
            console.error('Refresh error:', err);
            this.updateStatus('⚠️ Refresh failed. Try closing and reopening the app.', 'error');
        }
    }
    
    saveAudioKeys() {
        const freesoundInput = document.getElementById('freesoundKeyInput');
        const pixabayInput = document.getElementById('pixabayKeyInput');
        const freesoundKey = freesoundInput?.value.trim() ?? '';
        const pixabayKey = pixabayInput?.value.trim() ?? '';
        
        let saved = false;
        
        if (freesoundKey.length > 10) {
            this.freesoundApiKey = freesoundKey;
            setFreesoundKey(freesoundKey); // Use centralized setter
            saved = true;
        }
        
        if (pixabayKey.length > 10) {
            this.pixabayApiKey = pixabayKey;
            setPixabayKey(pixabayKey);
            saved = true;
        }
        
        if (saved) {
            this.hideFreesoundSetup();
            this.updateApiStatusIndicators();
            const sources = [];
            if (pixabayKey) sources.push('Pixabay');
            if (freesoundKey) sources.push('Freesound');
            this.updateStatus(`Audio sources enabled: ${sources.join(' + ')}`);
            alert(`Audio Keys Saved!\n\nEnabled: ${sources.join(', ')}\n\nYou will now hear high-quality sounds when Effexiq analyzes your speech.`);
        } else {
            alert('Please enter at least one valid API key (10+ characters).');
        }
    }
    
    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Subscribe / Token management
        document.getElementById('subscribeBtn')?.addEventListener('click', () => this.startCheckout());
        document.getElementById('subscribeBtn2')?.addEventListener('click', () => this.startCheckout());
        document.getElementById('saveTokenBtn')?.addEventListener('click', () => this.saveToken());
        document.getElementById('refreshTokenBtn')?.addEventListener('click', () => this.refreshToken());
        document.getElementById('enterTokenBtn')?.addEventListener('click', () => {
            document.getElementById('enterTokenForm')?.classList.toggle('hidden');
        });
        document.getElementById('manageSubscriptionBtn')?.addEventListener('click', () => {
            document.getElementById('settingsSection') && this.navigateTo?.('settingsSection');
            document.getElementById('subscriptionMenuContent')?.classList.remove('hidden');
        });
        
        // Legacy mode buttons (if still present)
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectMode(e.target.dataset.mode));
        });
        
        // Volume Controls
        const minVolumeEl = document.getElementById('minVolume');
        if (minVolumeEl) minVolumeEl.addEventListener('input', (e) => {
            this.minVolume = e.target.value / 100;
            const minVolumeValue = document.getElementById('minVolumeValue');
            if (minVolumeValue) minVolumeValue.textContent = e.target.value;
        });
        
        const maxVolumeEl = document.getElementById('maxVolume');
        if (maxVolumeEl) maxVolumeEl.addEventListener('input', (e) => {
            this.maxVolume = e.target.value / 100;
            const maxVolumeValue = document.getElementById('maxVolumeValue');
            if (maxVolumeValue) maxVolumeValue.textContent = e.target.value;
        });

        // Mixer Controls
        const musicLevelSlider = document.getElementById('musicLevel');
        const sfxLevelSlider = document.getElementById('sfxLevel');
        if (musicLevelSlider) {
            musicLevelSlider.value = Math.round(this.musicLevel * 100);
            const musicLevelValue = document.getElementById('musicLevelValue');
            if (musicLevelValue) musicLevelValue.textContent = musicLevelSlider.value;
            musicLevelSlider.addEventListener('input', (e) => {
                this.musicLevel = e.target.value / 100;
                localStorage.setItem('Effexiq_music_level', String(this.musicLevel));
                if (musicLevelValue) musicLevelValue.textContent = e.target.value;
                // Apply to current music (Howler or legacy Web Audio)
                if (this.currentMusic && this.currentMusic._howl) {
                    const target = Math.max(0, Math.min(1, this.currentMusic.volume * this.musicLevel));
                    this.currentMusic._howl.volume(target);
                } else if (this.musicGainNode) {
                    const target = this.getMusicTargetGain();
                    try {
                        this.musicGainNode.gain.setValueAtTime(target, this.audioContext.currentTime);
                    } catch (_) {}
                }
                this.updateSoundsList();
            });
        }
        if (sfxLevelSlider) {
            sfxLevelSlider.value = Math.round(this.sfxLevel * 100);
            const sfxLevelValue = document.getElementById('sfxLevelValue');
            if (sfxLevelValue) sfxLevelValue.textContent = sfxLevelSlider.value;
            sfxLevelSlider.addEventListener('input', (e) => {
                this.sfxLevel = e.target.value / 100;
                localStorage.setItem('Effexiq_sfx_level', String(this.sfxLevel));
                if (sfxLevelValue) sfxLevelValue.textContent = e.target.value;
                // Update all active SFX (Howler or legacy)
                this.activeSounds.forEach((soundObj) => {
                    if (soundObj._howl && typeof soundObj.originalVolume === 'number') {
                        const newVol = Math.max(0, Math.min(1, soundObj.originalVolume * this.sfxLevel));
                        soundObj._howl.volume(newVol);
                    } else if (soundObj.gainNode && typeof soundObj.originalVolume === 'number') {
                        soundObj.gainNode.gain.setValueAtTime(
                            Math.max(0, Math.min(1, soundObj.originalVolume * this.sfxLevel)),
                            this.audioContext.currentTime
                        );
                    } else if (soundObj instanceof HTMLAudioElement && typeof soundObj.originalVolume === 'number') {
                        soundObj.volume = Math.max(0, Math.min(1, soundObj.originalVolume * this.sfxLevel));
                    }
                });
                this.updateSoundsList();
            });
        }

        // Test Sound button in mixer
        const testSoundBtn = document.getElementById('testSoundBtn');
        if (testSoundBtn) {
            testSoundBtn.addEventListener('click', () => {
                const vol = this.sfxLevel || 0.9;
                // Play a short test tone using Web Audio
                try {
                    const ctx = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
                    if (!this.audioContext) this.audioContext = ctx;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = 440;
                    gain.gain.value = vol * 0.3;
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                    osc.stop(ctx.currentTime + 0.5);
                } catch (_) {}
            });
        }

        // Mood slider & Low latency toggle
        const moodSlider = document.getElementById('moodBias');
        const moodValue = document.getElementById('moodBiasValue');
        if (moodSlider) {
            moodSlider.value = Math.round(this.moodBias * 100);
            if (moodValue) moodValue.textContent = moodSlider.value;
            moodSlider.addEventListener('input', (e) => {
                this.moodBias = e.target.value / 100;
                localStorage.setItem('Effexiq_mood_bias', String(this.moodBias));
                if (moodValue) moodValue.textContent = e.target.value;
            });
        }
        const lowLatencyToggle = document.getElementById('lowLatencyMode');
        if (lowLatencyToggle) {
            lowLatencyToggle.checked = !!this.lowLatencyMode;
            lowLatencyToggle.addEventListener('change', (e) => {
                this.lowLatencyMode = e.target.checked;
                localStorage.setItem('Effexiq_low_latency', JSON.stringify(this.lowLatencyMode));
                this.preloadConcurrency = this.getPreloadConcurrency();
                
                // Update analysis interval for low latency mode
                this.baseAnalysisInterval = this.lowLatencyMode ? 3000 : 5000;
                this.analysisInterval = this.baseAnalysisInterval;
                
                this.updateStatus(`Low Latency Mode ${this.lowLatencyMode ? 'enabled (3s analysis)' : 'disabled (5s analysis)'}`);
            });
        }
        // Low Latency tooltip interactions (hover via CSS; add touch/keyboard support)
        const ttLabel = document.getElementById('lowLatencyTooltip');
        const ttHelp = document.getElementById('lowLatencyHelp');
        const showTip = () => ttLabel && ttLabel.classList.add('show');
        const hideTip = () => ttLabel && ttLabel.classList.remove('show');
        if (ttHelp) {
            ttHelp.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (ttLabel.classList.contains('show')) {
                    hideTip();
                } else {
                    showTip();
                    setTimeout(() => document.addEventListener('click', hideTip, { once: true }), 0);
                }
            });
        }
        
        // Trigger keyword cooldown slider
        const cooldownSlider = document.getElementById('keywordCooldown');
        const cooldownValue = document.getElementById('keywordCooldownValue');
        if (cooldownSlider) {
            // Slider range is 1–30 (seconds); keywordCooldownMs stores milliseconds
            cooldownSlider.value = Math.round(this.keywordCooldownMs / 1000);
            if (cooldownValue) cooldownValue.textContent = (this.keywordCooldownMs / 1000).toFixed(1) + 's';
            cooldownSlider.addEventListener('input', (e) => {
                this.keywordCooldownMs = parseInt(e.target.value) * 1000;
                localStorage.setItem('Effexiq_keyword_cooldown_ms', String(this.keywordCooldownMs));
                if (cooldownValue) cooldownValue.textContent = (this.keywordCooldownMs / 1000).toFixed(1) + 's';
            });
        }

        // Scene presets settings
        this._renderScenePresetsSettings();
        const addPresetBtn = document.getElementById('addScenePresetBtn');
        if (addPresetBtn) addPresetBtn.addEventListener('click', () => this._addScenePreset());

        // Custom phrase triggers UI
        this._renderCustomPhrasesList();
        const addCustomPhraseBtn = document.getElementById('addCustomPhraseBtn');
        if (addCustomPhraseBtn) {
            addCustomPhraseBtn.addEventListener('click', () => {
                const phraseInput = document.getElementById('customPhraseInput');
                const queryInput = document.getElementById('customPhraseQuery');
                const volumeInput = document.getElementById('customPhraseVolume');
                const phrase = (phraseInput?.value || '').trim();
                const query = (queryInput?.value || '').trim();
                const volume = parseFloat(volumeInput?.value || '0.8');
                if (!phrase || !query) { alert('Enter both a phrase and a sound query.'); return; }
                this.addCustomPhrase([phrase], query, volume);
                if (phraseInput) phraseInput.value = '';
                if (queryInput) queryInput.value = '';
                if (volumeInput) volumeInput.value = '0.8';
                this._renderCustomPhrasesList();
            });
        }
        const customPhrasesToggle = document.getElementById('customPhrasesToggle');
        if (customPhrasesToggle) {
            customPhrasesToggle.addEventListener('click', () => {
                const content = document.getElementById('customPhrasesContent');
                if (content) content.classList.toggle('hidden');
            });
        }

        // Control Buttons
        const testMicBtnEl = document.getElementById('testMicBtn');
        if (testMicBtnEl) testMicBtnEl.addEventListener('click', () => this.testMicrophone());
        document.getElementById('startBtn').addEventListener('click', () => {
            const btn = document.getElementById('startBtn');
            if (btn.disabled) return;
            btn.disabled = true;
            setTimeout(() => { btn.disabled = false; }, 1000);
            this.startListening();
        });
        document.getElementById('stopBtn').addEventListener('click', () => this.stopListening());
        const stopAudioBtn = document.getElementById('stopAudioBtn');
        if (stopAudioBtn) {
            stopAudioBtn.addEventListener('click', () => {
                // In demo mode, also stop the auto-read loop and story cues
                if (this.demoRunning) {
                    this.stopAutoRead();
                    this.storyActive = false;
                    if (this.analysisTimer) { clearInterval(this.analysisTimer); this.analysisTimer = null; }
                }
                // Always cancel the analysis pipeline (stopAllAudio now handles this,
                // but belt-and-suspenders: reset lastAnalysisTime so next auto-analysis
                // fires fresh rather than immediately after the grace window)
                this.lastAnalysisTime = Date.now();
                this.stopAllAudio();
            });
        }

        // Mute category toggles (legacy pill buttons)
        document.querySelectorAll('.mute-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.cat;
                if (this.mutedCategories.has(cat)) {
                    this.mutedCategories.delete(cat);
                    btn.classList.add('active');
                } else {
                    this.mutedCategories.add(cat);
                    btn.classList.remove('active');
                }
            });
        });

        // Audio Controls — toggles and sliders on the Auto Detect screen
        this._setupAudioControls();

        // Story Context Modal Buttons
        const startWithContextBtn = document.getElementById('startWithContext');
        const skipContextBtn = document.getElementById('skipContext');
        if (startWithContextBtn) {
            startWithContextBtn.addEventListener('click', () => {
                const contextInput = document.getElementById('storyContextInput');
                this.storyContext = contextInput ? contextInput.value.trim() : '';
                this.hideStoryContextModal();
                this.startListeningWithContext().catch(e => debugLog('Listen start failed:', e.message));
            });
        }
        if (skipContextBtn) {
            skipContextBtn.addEventListener('click', () => {
                this.storyContext = '';
                this.hideStoryContextModal();
                this.startListeningWithContext().catch(e => debugLog('Listen start failed:', e.message));
            });
        }
        
        // Playback toggles
    const toggleMusic = document.getElementById('toggleMusic');
    const toggleSfx = document.getElementById('toggleSfx');
    const togglePrediction = document.getElementById('togglePrediction');
        if (toggleMusic) {
            toggleMusic.checked = !!this.musicEnabled;
            toggleMusic.addEventListener('change', (e) => {
                this.musicEnabled = e.target.checked;
                localStorage.setItem('Effexiq_music_enabled', JSON.stringify(this.musicEnabled));
                this.updateStatus(`Music ${this.musicEnabled ? 'enabled' : 'disabled'}`);
                if (!this.musicEnabled && this.currentMusic) {
                    this.fadeOutAudio(this.currentMusic);
                    this.currentMusic = null;
                    if (this.currentMusicSource) {
                        try { this.currentMusicSource.disconnect(); } catch (e) {}
                        this.currentMusicSource = null;
                    }
                    this.updateSoundsList();
                }
            });
        }
        if (toggleSfx) {
            toggleSfx.checked = !!this.sfxEnabled;
            toggleSfx.addEventListener('change', (e) => {
                this.sfxEnabled = e.target.checked;
                localStorage.setItem('Effexiq_sfx_enabled', JSON.stringify(this.sfxEnabled));
                this.updateStatus(`Sound effects ${this.sfxEnabled ? 'enabled' : 'disabled'}`);
                if (!this.sfxEnabled && this.activeSounds.size > 0) {
                    this.activeSounds.forEach((soundObj) => {
                        try { if (soundObj.source) soundObj.source.stop(); } catch (err) {}
                    });
                    this.activeSounds.clear();
                    this.updateSoundsList();
                }
            });
        }
        // AI Predictions toggle
        if (togglePrediction) {
            togglePrediction.checked = !!this.predictionEnabled; // default ON unless previously disabled
            togglePrediction.addEventListener('change', (e) => {
                this.predictionEnabled = e.target.checked;
                localStorage.setItem('Effexiq_prediction_enabled', JSON.stringify(this.predictionEnabled));
                this.updateStatus(`AI predictions ${this.predictionEnabled ? 'enabled' : 'disabled'}`);
                // Manage timers while listening
                if (!this.predictionEnabled) {
                    if (this.analysisTimer) { clearInterval(this.analysisTimer); this.analysisTimer = null; }
                    if (this.stingerTimer) { clearTimeout(this.stingerTimer); this.stingerTimer = null; }
                } else {
                    if (this.isListening && !this.analysisTimer) {
                        this.lastAnalysisTime = 0;
                        this.analysisTimer = setInterval(() => this.maybeAnalyzeLive(), 1000);
                    }
                    if (this.isListening && this.currentMusic && !this.currentMusic.paused) {
                        this.scheduleNextStinger();
                    }
                }
            });
        }
        
        // Freesound Setup (modal removed in v2.2.0 — guard all)
        const setupFreesoundBtn = document.getElementById('setupFreesound');
        if (setupFreesoundBtn) setupFreesoundBtn.addEventListener('click', () => this.showFreesoundSetup());
        const saveAudioKeysBtn = document.getElementById('saveAudioKeys');
        if (saveAudioKeysBtn) saveAudioKeysBtn.addEventListener('click', () => this.saveAudioKeys());
        const cancelFreesoundBtn = document.getElementById('cancelFreesound');
        if (cancelFreesoundBtn) cancelFreesoundBtn.addEventListener('click', () => this.hideFreesoundSetup());

        // App Refresh Button
        const refreshAppBtn = document.getElementById('refreshAppBtn');
        if (refreshAppBtn) {
            refreshAppBtn.addEventListener('click', () => this.refreshApp());
        }

    // Tutorial
        const tutorialBtn = document.getElementById('tutorialBtn');
        if (tutorialBtn) tutorialBtn.addEventListener('click', () => this.showTutorial());
        const closeTutorial = document.getElementById('closeTutorial');
        if (closeTutorial) closeTutorial.addEventListener('click', () => this.hideTutorial());
        const closeTutorialBtn = document.getElementById('closeTutorialBtn');
        if (closeTutorialBtn) closeTutorialBtn.addEventListener('click', () => this.hideTutorial());

    // Feedback modal
    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) feedbackBtn.addEventListener('click', () => this.showFeedback());
    const sendFeedbackBtn = document.getElementById('sendFeedbackBtn');
    if (sendFeedbackBtn) sendFeedbackBtn.addEventListener('click', () => this.sendFeedbackEmail());
    const openGmailBtn = document.getElementById('openGmailBtn');
    if (openGmailBtn) openGmailBtn.addEventListener('click', () => this.openFeedbackInGmail());
    const copyFeedbackBtn = document.getElementById('copyFeedbackBtn');
    if (copyFeedbackBtn) copyFeedbackBtn.addEventListener('click', () => this.copyFeedbackDetails());
    const cancelFeedback = document.getElementById('cancelFeedback');
    if (cancelFeedback) cancelFeedback.addEventListener('click', () => this.hideFeedback());

        // Stories UI
        const startStoryBtn = document.getElementById('startStoryBtn');
        const storiesDropdown = document.getElementById('storiesDropdown');
        const closeStory = document.getElementById('closeStory');
        if (startStoryBtn && storiesDropdown) {
            startStoryBtn.addEventListener('click', () => {
                const id = storiesDropdown.value;
                if (!id) { this.updateStatus('Please choose a story first'); return; }
                // Ensure stories manifest loaded
                if (!this.stories) {
                    this.loadStories().finally(() => this.startStoryFlow(id));
                } else {
                    this.startStoryFlow(id);
                }
            });
        }
        if (closeStory) {
            closeStory.addEventListener('click', () => this.hideStoryOverlay());
        }
        // Auto-start story listening toggle
        const autoStartStoryToggle = document.getElementById('autoStartStoryListening');
        if (autoStartStoryToggle) {
            autoStartStoryToggle.checked = !!this.autoStartStoryListening;
            autoStartStoryToggle.addEventListener('change', (e) => {
                this.autoStartStoryListening = e.target.checked;
                localStorage.setItem('Effexiq_auto_start_story_listening', JSON.stringify(this.autoStartStoryListening));
            });
        }
        // ESC to close story overlay
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.storyActive) {
                this.hideStoryOverlay();
            }
        });

        // Sound Library
        this.setupSoundLibrary();

        // Custom Sound Recording
        this.setupRecordSound();
    }

    startStoryFlow(id, mode) {
        // Always use auto mode
        this.startStoryFlowAsync(id, 'auto').catch(e => console.warn('Story flow failed:', e.message));
    }

    // ===== SOUND LIBRARY =====
    setupSoundLibrary() {
        const searchInput = document.getElementById('soundLibSearch');
        const filterBtns = document.querySelectorAll('.sound-lib-filter');
        const listEl = document.getElementById('soundLibList');
        const customListEl = document.getElementById('customSoundsList');
        if (!searchInput || !listEl) return;

        this._soundLibFilter = 'all';
        this._soundLibQuery = '';
        this._previewHowl = null;

        searchInput.addEventListener('input', (e) => {
            this._soundLibQuery = e.target.value.toLowerCase().trim();
            this.renderSoundLibrary();
        });

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._soundLibFilter = btn.dataset.filter;
                this.renderSoundLibrary();
            });
        });

        // Render on section show (observe visibility) — disconnect previous if re-called
        if (this._soundLibObserver) this._soundLibObserver.disconnect();
        this._soundLibObserver = new MutationObserver(() => {
            const section = document.getElementById('soundLibrarySection');
            if (section && !section.classList.contains('hidden')) {
                this.renderSoundLibrary();
                this.renderCustomSounds();
            }
        });
        const section = document.getElementById('soundLibrarySection');
        if (section) this._soundLibObserver.observe(section, { attributes: true, attributeFilter: ['class'] });
    }

    renderSoundLibrary() {
        const listEl = document.getElementById('soundLibList');
        const countEl = document.getElementById('soundLibCount');
        const disabledCountEl = document.getElementById('soundLibDisabledCount');
        if (!listEl) return;

        let items = [...this.soundCatalog];
        // Filter by type
        if (this._soundLibFilter === 'disabled') {
            items = items.filter(s => this.disabledSounds.has(s.id));
        } else if (this._soundLibFilter !== 'all') {
            items = items.filter(s => s.type === this._soundLibFilter);
        }
        // Search filter
        if (this._soundLibQuery) {
            items = items.filter(s => {
                const haystack = [s.id, ...(s.tags || [])].join(' ').toLowerCase();
                return haystack.includes(this._soundLibQuery);
            });
        }

        if (countEl) countEl.textContent = `${items.length} sounds`;
        if (disabledCountEl) disabledCountEl.textContent = `${this.disabledSounds.size} disabled`;

        listEl.innerHTML = items.map(s => {
            const isDisabled = this.disabledSounds.has(s.id);
            const typeClass = s.type === 'sfx' ? 'type-sfx' : s.type === 'ambience' ? 'type-ambience' : '';
            const dur = this.durationCache.get(s.id);
            const durStr = dur ? `${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, '0')}` : '';
            const safeId = escapeHtml(s.id);
            const safeSrc = escapeHtml(s.src);
            const safeType = escapeHtml(s.type);
            const safeTags = (s.tags || []).map(t => escapeHtml(t)).join(', ');
            return `<div class="sound-lib-item${isDisabled ? ' disabled' : ''}" data-id="${safeId}">
                <button class="sound-lib-preview" data-src="${safeSrc}" data-id="${safeId}" title="Preview">&#9654;</button>
                <div class="sound-lib-info">
                    <div class="sound-lib-name">${safeId}${durStr ? ` <span class="sound-lib-duration">${durStr}</span>` : ''}</div>
                    <div class="sound-lib-tags">${safeTags}</div>
                </div>
                <span class="sound-lib-type ${typeClass}">${safeType}</span>
                <button class="sound-lib-toggle${isDisabled ? ' off' : ''}" data-id="${safeId}" title="${isDisabled ? 'Enable' : 'Disable'}"></button>
            </div>`;
        }).join('');

        // Bind preview + toggle events via delegation
        listEl.onclick = (e) => {
            const previewBtn = e.target.closest('.sound-lib-preview');
            if (previewBtn) {
                e.stopPropagation();
                this.previewSound(previewBtn.dataset.src, previewBtn);
                return;
            }
            const toggleBtn = e.target.closest('.sound-lib-toggle');
            if (toggleBtn) {
                e.stopPropagation();
                this.toggleSoundDisabled(toggleBtn.dataset.id);
                return;
            }
        };
    }

    previewSound(src, btn) {
        // If this button is already playing, stop it
        if (btn.classList.contains('playing')) {
            if (this._previewHowl) { this._previewHowl.stop(); this._previewHowl.unload(); this._previewHowl = null; }
            btn.classList.remove('playing');
            btn.innerHTML = '&#9654;';
            this._previewLoading = false;
            return;
        }
        // Stop any other preview
        if (this._previewHowl) {
            this._previewHowl.stop();
            this._previewHowl.unload();
            this._previewHowl = null;
        }
        document.querySelectorAll('.sound-lib-preview.playing').forEach(b => { b.classList.remove('playing'); b.innerHTML = '&#9654;'; });
        if (this._previewLoading) return;
        this._previewLoading = true;

        const srcs = this.buildSrcCandidates(src);
        btn.classList.add('playing');
        btn.innerHTML = '&#9632;';
        this._previewHowl = new Howl({
            src: srcs,
            volume: 0.5,
            onplay: () => { this._previewLoading = false; },
            onend: () => {
                btn.classList.remove('playing');
                btn.innerHTML = '&#9654;';
                this._previewHowl = null;
            },
            onloaderror: () => {
                btn.classList.remove('playing');
                btn.innerHTML = '&#9654;';
                this._previewHowl = null;
                this._previewLoading = false;
            }
        });
        this._previewHowl.play();
    }

    toggleSoundDisabled(id) {
        if (this.disabledSounds.has(id)) {
            this.disabledSounds.delete(id);
        } else {
            this.disabledSounds.add(id);
        }
        localStorage.setItem('Effexiq_disabled_sounds', JSON.stringify([...this.disabledSounds]));
        this.renderSoundLibrary();
    }

    renderCustomSounds() {
        const listEl = document.getElementById('customSoundsList');
        if (!listEl) return;
        if (!this.customSounds.length) {
            listEl.innerHTML = '<div class="info-text">No custom sounds yet. Record one above.</div>';
            return;
        }
        listEl.innerHTML = this.customSounds.map((s, i) => {
            const safeName = escapeHtml(s.name || 'Untitled');
            const safeTags = (s.tags || []).map(t => escapeHtml(t)).join(', ');
            return `<div class="sound-lib-item" data-idx="${i}">
                <button class="sound-lib-preview custom-preview" data-idx="${i}" title="Preview">&#9654;</button>
                <div class="sound-lib-info">
                    <div class="sound-lib-name">${safeName}</div>
                    <div class="sound-lib-tags">${safeTags}</div>
                </div>
                <span class="sound-lib-type type-sfx">custom</span>
                <button class="sound-lib-delete-custom" data-idx="${i}" title="Delete">&times;</button>
            </div>`;
        }).join('');

        listEl.onclick = (e) => {
            const previewBtn = e.target.closest('.custom-preview');
            if (previewBtn) {
                e.stopPropagation();
                const idx = parseInt(previewBtn.dataset.idx);
                const sound = this.customSounds[idx];
                if (sound && sound.dataUrl) {
                    // If already playing this custom sound, stop it
                    if (previewBtn.classList.contains('playing')) {
                        if (this._previewHowl) { this._previewHowl.stop(); this._previewHowl.unload(); this._previewHowl = null; }
                        previewBtn.classList.remove('playing');
                        previewBtn.innerHTML = '&#9654;';
                        return;
                    }
                    // Stop any other preview
                    if (this._previewHowl) { this._previewHowl.stop(); this._previewHowl.unload(); }
                    document.querySelectorAll('.sound-lib-preview.playing').forEach(b => { b.classList.remove('playing'); b.innerHTML = '&#9654;'; });
                    previewBtn.classList.add('playing');
                    previewBtn.innerHTML = '&#9632;';
                    this._previewHowl = new Howl({
                        src: [sound.dataUrl],
                        format: ['webm'],
                        volume: 0.5,
                        onend: () => { previewBtn.classList.remove('playing'); previewBtn.innerHTML = '&#9654;'; this._previewHowl = null; }
                    });
                    this._previewHowl.play();
                }
                return;
            }
            const deleteBtn = e.target.closest('.sound-lib-delete-custom');
            if (deleteBtn) {
                e.stopPropagation();
                const idx = parseInt(deleteBtn.dataset.idx);
                this.customSounds.splice(idx, 1);
                localStorage.setItem('Effexiq_custom_sounds', JSON.stringify(this.customSounds));
                this.renderCustomSounds();
                return;
            }
        };
    }

    // ===== CUSTOM SOUND RECORDING =====
    setupRecordSound() {
        const recordBtn = document.getElementById('recordSoundBtn');
        const modal = document.getElementById('recordSoundModal');
        const closeBtn = document.getElementById('closeRecordModal');
        const startBtn = document.getElementById('recordStartBtn');
        const stopBtn = document.getElementById('recordStopBtn');
        const saveBtn = document.getElementById('recordSaveBtn');
        const nameInput = document.getElementById('recordName');
        const tagsInput = document.getElementById('recordTags');
        const timerEl = document.getElementById('recordTimer');
        const playbackEl = document.getElementById('recordPlayback');
        const audioEl = document.getElementById('recordAudio');
        if (!recordBtn || !modal) return;

        let mediaRecorder = null;
        let chunks = [];
        let timerInterval = null;
        let recordStart = 0;
        let recordedBlob = null;
        let recordedBlobUrl = null;

        recordBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            // Reset state
            if (playbackEl) playbackEl.classList.add('hidden');
            if (saveBtn) saveBtn.disabled = true;
            if (nameInput) nameInput.value = '';
            if (tagsInput) tagsInput.value = '';
            if (timerEl) timerEl.textContent = '0:00';
            recordedBlob = null;
        });

        const closeModal = () => {
            modal.classList.add('hidden');
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            clearInterval(timerInterval);
            if (recordedBlobUrl) { URL.revokeObjectURL(recordedBlobUrl); recordedBlobUrl = null; }
        };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        if (startBtn) startBtn.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                chunks = [];
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                mediaRecorder.onstop = () => {
                    stream.getTracks().forEach(t => t.stop());
                    recordedBlob = new Blob(chunks, { type: 'audio/webm' });
                    if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
                    recordedBlobUrl = URL.createObjectURL(recordedBlob);
                    if (audioEl) audioEl.src = recordedBlobUrl;
                    if (playbackEl) playbackEl.classList.remove('hidden');
                    if (saveBtn) saveBtn.disabled = false;
                    clearInterval(timerInterval);
                };
                mediaRecorder.start();
                recordStart = Date.now();
                startBtn.classList.add('hidden');
                stopBtn.classList.remove('hidden');
                timerInterval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - recordStart) / 1000);
                    const m = Math.floor(elapsed / 60);
                    const s = elapsed % 60;
                    if (timerEl) timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
                }, 250);
                // Limit recording to 30 seconds
                setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                        startBtn.classList.remove('hidden');
                        stopBtn.classList.add('hidden');
                    }
                }, 30000);
            } catch (err) {
                console.error('Recording failed:', err);
            }
        });

        if (stopBtn) stopBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            startBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
        });

        if (saveBtn) saveBtn.addEventListener('click', () => {
            if (!recordedBlob) return;
            const name = (nameInput?.value || '').trim() || `Custom Sound ${this.customSounds.length + 1}`;
            const tags = (tagsInput?.value || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

            const reader = new FileReader();
            reader.onloadend = () => {
                const customSound = {
                    name,
                    tags,
                    dataUrl: reader.result,
                    created: Date.now()
                };
                this.customSounds.push(customSound);
                localStorage.setItem('Effexiq_custom_sounds', JSON.stringify(this.customSounds));
                this.renderCustomSounds();
                closeModal();
            };
            reader.readAsDataURL(recordedBlob);
        });
    }

    async startStoryFlowAsync(id, targetMode) {
        let needWait = false;
        let waitToken = this.preloadVersion;

        // Switch to target mode if not already
        if (this.currentMode !== targetMode) {
            try { 
                const before = this.preloadVersion;
                this.selectMode(targetMode); 
                const after = this.preloadVersion;
                if (after !== before) { needWait = true; waitToken = after; }
            } catch(_) {}
        } else if (this.preloadInProgress) {
            needWait = true; waitToken = this.preloadVersion;
        }

        // If a preload is in progress for bedtime, wait briefly for it to finish
        if (needWait) {
            await this.waitForPreloadComplete(waitToken, 15000); // up to 15s safety
        }

        // Show story overlay after preload completes (or timeout)
        this.showStoryOverlay(id);
        if (this.autoStartStoryListening && !this.isListening) {
            this.startListening();
        }
    }

    async waitForPreloadComplete(versionToken, timeoutMs = 12000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (!this.preloadInProgress && this.preloadVersion === versionToken) return true;
            await this.sleep(120);
        }
        return false; // timed out
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    
    selectMode(mode) {
        if (!mode) return;
        
        this.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Update visualizer section mode class
        const vizSection = document.getElementById('visualizerSection');
        if (vizSection) {
            vizSection.className = 'visualizer-section';
            vizSection.classList.add(`mode-${mode}`);
        }
        
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            startBtn.style.cursor = 'pointer';
        }

    // Reset AI/run state so previous mode's context doesn't leak
        if (this.analysisTimer) { clearInterval(this.analysisTimer); this.analysisTimer = null; }
        this.analysisVersion++;          // invalidate any in-flight analyses
        this.lastAnalysisTime = 0;       // allow immediate fresh analysis
        this.analysisInProgress = false; // best-effort cancel gate
        this._lastAnalyzedText = null;   // reset VAD so first speech in new mode triggers

        // Clear transcript and interim text (chat log)
        this.transcriptBuffer = [];
        this.currentInterim = '';
        this.updateTranscriptDisplay();

    // Clear mode-specific cache entries; keep cross-mode sounds (e.g. common SFX)
    for (const [key] of this.soundCache) {
        // Cache keys are "type:query" — clear all music (mode-dependent) and mode-preload SFX
        if (key.startsWith('music:')) this.soundCache.delete(key);
    }
    this.recentlyPlayed.clear();

        // Stop any currently playing audio immediately
        this.stopAllAudio();

        // Update UI/status and begin preload with overlay
        this.updateStatus(`Mode changed to: ${mode.toUpperCase()} — reset sounds and context.`);
        const version = ++this.preloadVersion;
        this.showLoadingOverlay('Preparing sounds...');
        setTimeout(() => {
            this.preloadSfxForCurrentMode(version)
                .catch(e => debugLog('Preload error:', e?.message || e))
                .finally(() => {
                    // Only hide if the same preload version is current
                    if (this.preloadVersion === version) {
                        this.hideLoadingOverlay();
                    }
                });
        }, 200);
    }
    
    // ===== AUDIO CONTEXT =====
    initializeAudioContext() {
        // Validate Howler.js loaded (CDN script may have failed)
        if (typeof Howl === 'undefined') {
            console.error('Howler.js failed to load — audio playback will be limited');
            this.updateStatus('Audio library failed to load. Check your internet connection.', 'error');
        }
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create gain nodes for mixing and ducking
        this.masterGainNode = this.audioContext.createGain();
        this.musicGainNode = this.audioContext.createGain();
        // SFX bus with light compression
        this.sfxCompressor = this.audioContext.createDynamicsCompressor();
        this.sfxCompressor.threshold.value = -24;
        this.sfxCompressor.knee.value = 30;
        this.sfxCompressor.ratio.value = 3;
        this.sfxCompressor.attack.value = 0.01;
        this.sfxCompressor.release.value = 0.2;
        this.sfxBusGain = this.audioContext.createGain();
        
        // Create analyser for visualizer
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        
        // Audio graph:
        // music -> musicGain -> master -> analyser -> destination
        // sfx (per-source) -> panner -> gain -> sfxCompressor -> sfxBusGain -> master
        this.musicGainNode.connect(this.masterGainNode);
        this.sfxCompressor.connect(this.sfxBusGain);
        this.sfxBusGain.connect(this.masterGainNode);
        this.masterGainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        // Global audio unlock for mobile: resume AudioContext on first user gesture
        this._setupMobileAudioUnlock();
    }

    _setupMobileAudioUnlock() {
        const unlockAudio = () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    debugLog('AudioContext resumed via user gesture');
                }).catch(e => console.warn('AudioContext resume failed:', e));
            }
            // Also unlock Howler's internal AudioContext
            if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state === 'suspended') {
                Howler.ctx.resume().catch(() => {});
            }
        };
        const events = ['touchstart', 'touchend', 'click', 'keydown'];
        const onFirstInteraction = () => {
            unlockAudio();
            this._playStartupSound();
            // Remove listeners after first successful unlock
            if (this.audioContext && this.audioContext.state === 'running') {
                events.forEach(e => document.removeEventListener(e, onFirstInteraction, true));
                debugLog('Mobile audio unlock listeners removed');
            }
        };
        events.forEach(e => document.addEventListener(e, onFirstInteraction, true));
    }
    
    _playStartupSound() {
        if (this._startupSoundPlayed) return;
        this._startupSoundPlayed = true;
        const howl = new Howl({
            src: ['/startup.mp3'],
            volume: 0.7,
            onloaderror: () => debugLog('Startup sound unavailable, skipping'),
        });
        howl.play();
    }

    // ===== MIC INTENSITY ANALYSER =====
    // Measures RMS loudness of the mic in a rAF loop so playback volume can
    // scale with how loudly the user speaks (e.g. a shouted "BOO!" = louder SFX).
    async _setupMicIntensityAnalyser() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const micSource = this.audioContext.createMediaStreamSource(stream);
            this._micAnalyser = this.audioContext.createAnalyser();
            this._micAnalyser.fftSize = 256;
            this._micAnalyser.smoothingTimeConstant = 0.8;
            micSource.connect(this._micAnalyser);
            // Intentionally NOT connected to destination — measurement only, zero echo risk

            const buf = new Uint8Array(this._micAnalyser.frequencyBinCount);
            const sample = () => {
                if (!this._micAnalyser) return;
                if (!this.isListening) {
                    // Decay back to neutral when not actively listening
                    this.voiceIntensity = 0.5;
                    requestAnimationFrame(sample);
                    return;
                }
                this._micAnalyser.getByteTimeDomainData(buf);
                let sumSq = 0;
                for (let i = 0; i < buf.length; i++) {
                    const v = (buf[i] - 128) / 128;
                    sumSq += v * v;
                }
                const rms = Math.sqrt(sumSq / buf.length);
                // Map: quiet ≈ 0.01 RMS → 0.4 multiplier, shouting ≈ 0.15+ RMS → 1.5 multiplier
                const raw = Math.min(1.0, rms / 0.15);
                this.voiceIntensity = 0.4 + raw * 1.1;
                requestAnimationFrame(sample);
            };
            sample();
            debugLog('Mic intensity analyser started');
        } catch (e) {
            debugLog('Mic intensity analyser unavailable:', e.message);
            this.voiceIntensity = 0.7; // neutral fallback
        }
    }

    // ===== SPEECH RECOGNITION =====
    initializeSpeechRecognition() {
        // Feature detection with UI feedback
        if (!isSpeechRecognitionAvailable()) {
            this.updateStatus('⚠️ Speech recognition not supported in this browser. Please use Chrome/Edge or connect to backend STT.', 'error');
            console.warn('Speech recognition not available');
            return;
        }
        
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 3;
            
            this.recognition.onresult = (event) => this.handleSpeechResult(event);
            this.recognition.onerror = (event) => this.handleSpeechError(event);
            this.recognition.onend = () => {
                if (this.isListening) {
                    // Delay before restart to avoid rapid cycling on unstable connections
                    setTimeout(() => {
                        if (this.isListening) {
                            try {
                                this.recognition.start();
                            } catch (e) {
                                debugLog('Recognition restart skipped:', e.message);
                            }
                        }
                    }, 500);
                }
            };
            
            this.recognition.onstart = () => {
                debugLog('Speech recognition started');
                this.updateStatus('Listening... Speak clearly!');
            };
            
            this.recognition.onaudiostart = () => {
                debugLog('Audio input detected');
            };
            
            this.recognition.onsoundstart = () => {
                debugLog('Sound detected');
            };
            
            this.recognition.onspeechstart = () => {
                debugLog('Speech detected');
                this.updateStatus('I hear you. Keep talking...');
            };

            // Mic intensity analyser is deferred to startListeningWithContext()
            // to avoid requesting getUserMedia before a user gesture (fails on mobile).
        } catch (error) {
            console.error('Failed to initialize speech recognition:', error);
            this.updateStatus('⚠️ Failed to initialize speech recognition. Check console for details.', 'error');
        }
    }
    
    handleSpeechResult(event) {
        let interimTranscript = '';
        let finalTranscript = '';
        const finalAlts = []; // non-primary recognition alternatives for keyword checking
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
                // Collect alternative transcripts (indices 1+) for keyword detection
                for (let j = 1; j < event.results[i].length; j++) {
                    finalAlts.push(event.results[i][j].transcript);
                }
            } else {
                interimTranscript += transcript;
            }
        }
        
        if (finalTranscript) {
            const trimmed = finalTranscript.trim();

            // Scene-break anchor windowing: reset buffer at narrative scene transitions
            if (this._sceneBreakRegex.test(trimmed)) {
                debugLog('Scene-break anchor detected, resetting transcript window:', trimmed.substring(0, 40));
                this.transcriptBuffer = [trimmed];
                this._lastAnalyzedText = null; // force re-analysis with clean slate
                this.rollingSceneSummary = ''; // scene memory resets too
                this._analysisCountSinceLastSummary = 0;
            } else {
                this.transcriptBuffer.push(trimmed);
            }

            this.currentInterim = '';
            this.updateTranscriptDisplay();
            // Advance story highlighting on finalized phrases
            this.advanceStoryWithTranscript(finalTranscript);
            
                // Voice commands & instant triggers (skip instant keywords in demo - story cue map handles it)
                this.handleVoiceCommands(finalTranscript);
                if (!this.demoRunning) this.checkInstantKeywords(finalTranscript, finalAlts);
                if (!this.demoRunning) this.checkPhraseKeywords(finalTranscript, finalAlts);
            
            // Dramatic beat detection: long pause + dramatic phrase = force immediate analysis
            const now = Date.now();
            const pauseLength = this.lastSpeechTime ? now - this.lastSpeechTime : 0;
            this.lastSpeechTime = now;
            if (pauseLength > 2000 && this.dramaticPhrases.test(trimmed)) {
                debugLog('Dramatic beat detected:', trimmed.substring(0, 40));
                // Force immediate analysis regardless of interval
                if (!this.analysisInProgress) {
                    this.lastAnalysisTime = 0; // Reset cooldown
                    this.analyzeContext(trimmed)
                        .catch(err => console.error('Dramatic beat analysis failed:', err));
                }
            }
            
            // Keep only last 30 seconds of transcript (approx 150 words)
            if (this.transcriptBuffer.length > 50) {
                this.transcriptBuffer.shift();
            }

            // Silence-triggered analysis: schedule analysis ~1.2s after speech goes quiet
            // This fires sounds right after each sentence finishes rather than waiting for the interval
            if (this._silenceAnalysisTimer) clearTimeout(this._silenceAnalysisTimer);
            this._silenceAnalysisTimer = setTimeout(() => {
                this._silenceAnalysisTimer = null;
                // Only fire if no analysis pending and transcript is fresh
                if (this.predictionEnabled && !this.analysisInProgress) {
                    const ctx = this.transcriptBuffer.slice(-6).join(' ').trim();
                    if (ctx.length >= 8 && ctx !== this._lastAnalyzedText) {
                        this.lastAnalysisTime = Date.now();
                        this.analysisInProgress = true;
                        debugLog('Silence-triggered analysis:', ctx.substring(0, 50));
                        this.analyzeContext(ctx)
                            .catch(err => console.error('Silence analysis failed:', err))
                            .finally(() => {
                                this.analysisInProgress = false;
                                // Drain pending queue if something arrived while we were running
                                if (this._pendingAnalysisTranscript) {
                                    const pending = this._pendingAnalysisTranscript;
                                    this._pendingAnalysisTranscript = null;
                                    this.lastAnalysisTime = Date.now();
                                    this.analysisInProgress = true;
                                    this.analyzeContext(pending)
                                        .catch(e => console.error('Pending analysis failed:', e))
                                        .finally(() => { this.analysisInProgress = false; });
                                }
                            });
                    }
                }
            }, 1200);
            
            // Consider analysis on final chunks
            this.maybeAnalyzeLive();
        } else if (interimTranscript) {
            // Track interim text continuously
            this.currentInterim = interimTranscript.trim();
            this.updateTranscriptDisplay();
            // Don't advance story on interim results — they're unstable and cause
            // the highlight to jump around. Only final results move the story forward.
            
                // Predictive prefetch on interim (but NOT instant triggers — those only fire on final
                // results to prevent the same keyword triggering multiple times from unstable interim text)
                this.predictivePrefetch(interimTranscript);
            
            this.maybeAnalyzeLive();
        }
    }
    
    handleSpeechError(event) {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
            // This is normal - just means no speech in current window
            // Don't spam the user with messages
            return;
        } else if (event.error === 'audio-capture') {
            this.updateStatus('Microphone access denied or not available');
            this.stopListening();
            this._resetDemoListenUI('Microphone not available. Check browser settings, or use Auto Read.');
        } else if (event.error === 'not-allowed') {
            this.updateStatus('Please allow microphone access in browser settings');
            this.stopListening();
            this._resetDemoListenUI('Microphone access denied. Allow it in browser settings, or use Auto Read.');
        } else if (event.error === 'network') {
            // Network error - try to continue listening
            this.updateStatus('Network hiccup - continuing to listen...');
            // Don't stop - the recognition will auto-restart
        } else {
            this.updateStatus(`Recognition error: ${event.error}`);
            this._resetDemoListenUI(`Microphone error: ${event.error}. Try Auto Read instead.`);
        }
    }

    // Reset demo listen/stop button state and show a message — called when mic fails during demo
    _resetDemoListenUI(message) {
        if (!this.demoRunning) return;
        const demoStartBtn = document.getElementById('demoStartListening');
        const demoAutoBtn = document.getElementById('demoAutoReadBtn');
        const demoStopBtn = document.getElementById('demoStopBtn');
        const demoStatus = document.getElementById('demoStatusText');
        if (demoStartBtn) demoStartBtn.classList.remove('hidden');
        if (demoAutoBtn) demoAutoBtn.classList.remove('hidden');
        if (demoStopBtn) demoStopBtn.classList.add('hidden');
        if (demoStatus && message) demoStatus.textContent = message;
    }
    
    updateTranscriptDisplay() {
        const transcriptBox = document.getElementById('transcript');
        if (!transcriptBox) return;
        const recentText = this.transcriptBuffer.slice(-5).join(' ');
        const display = [recentText, this.currentInterim].filter(Boolean).join(' ');
        transcriptBox.textContent = display || 'Listening...';
        transcriptBox.scrollTop = transcriptBox.scrollHeight;
    }
    
        // ===== INSTANT KEYWORD DETECTION =====
        checkInstantKeywords(text, altTexts = []) {
            if (!text || !this.sfxEnabled) return;
        
            const lowerText = text.toLowerCase();
            const lowerAlts = altTexts.map(t => t.toLowerCase());
            let triggered = 0;
            const maxTriggers = 2;
            const now = Date.now();
            const KEYWORD_COOLDOWN = this.keywordCooldownMs || 3000;
        
            for (const [keyword, config] of Object.entries(this.instantKeywords)) {
                if (triggered >= maxTriggers) break;
                // Per-keyword cooldown to prevent spam from repeated interim transcripts
                const lastTrigger = this.instantKeywordCooldowns.get(keyword) || 0;
                if (now - lastTrigger < KEYWORD_COOLDOWN) continue;
                const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedKw}\\b`, 'i');
                // Check primary transcript AND any alternative transcriptions
                if (regex.test(lowerText) || lowerAlts.some(alt => regex.test(alt))) {
                    this.instantKeywordCooldowns.set(keyword, now);
                    debugLog(`Instant trigger detected: "${keyword}"`);
                    this.bumpStat('keywords');
                    this.bumpStat('triggers');
                    config._triggerStart = performance.now();
                    this.logActivity(`Keyword: "${keyword}" -> ${config.query || config.file || '?'}`, 'trigger');
                    const intensityMul = Math.max(0.4, Math.min(1.5, this.voiceIntensity));
                    this.playInstantSound(config, keyword, intensityMul);
                    triggered++;
                }
            }
        }
    
    // ===== MULTI-WORD PHRASE TRIGGER MATCHING =====
    // Covers high-drama 2-3 word narrative phrases the single-keyword system misses.
    // Phrases are grouped into buckets so only one fires per sentence.
    checkPhraseKeywords(text, altTexts = []) {
        if (!text || !this.sfxEnabled) return;
        const lower = text.toLowerCase();
        const lowerAlts = altTexts.map(t => t.toLowerCase());
        const now = Date.now();
        const PHRASE_COOLDOWN = Math.max(this.keywordCooldownMs || 3000, 4000);

        // Phrase table: each entry is { patterns[], query, volume, category }
        // Patterns are checked as substrings (order matters: more specific first)
        const phraseTable = [
            // Combat actions
            { patterns: ['drew his sword', 'drew her sword', 'drew their sword', 'draws his sword', 'draws her sword', 'pulled out his sword', 'pulled out her sword'], query: 'sword draw', volume: 0.8 },
            { patterns: ['swings his sword', 'swings her sword', 'slashes with', 'brings his blade', 'brings her blade', 'blade cuts', 'sword slices'], query: 'sword slash', volume: 0.85 },
            { patterns: ['notched an arrow', 'nocked an arrow', 'drew an arrow', 'takes aim', 'takes her aim', 'takes his aim', 'lines up the shot'], query: 'bow draw', volume: 0.7 },
            { patterns: ['fires the arrow', 'releases the arrow', 'lets the arrow fly', 'looses the arrow'], query: 'arrow release', volume: 0.75 },
            { patterns: ['kicks the door', 'kicks open the door', 'door flies open', 'burst through the door', 'bursts through the door', 'slams the door', 'door slams'], query: 'door slam', volume: 0.85 },
            { patterns: ['throws a punch', 'throws his fist', 'throws her fist', 'lands a blow', 'delivers a punch', 'connects with a punch'], query: 'punch impact', volume: 0.8 },
            { patterns: ['cracks of thunder', 'crack of thunder', 'thunder crashes', 'thunder rolls', 'thunder booms', 'lightning strikes', 'lightning flashes'], query: 'thunder crack', volume: 0.9 },
            // Environment
            { patterns: ['the room goes dark', 'lights go out', 'candle goes out', 'torch goes out', 'plunged into darkness'], query: 'candle extinguish', volume: 0.6 },
            { patterns: ['glass shatters', 'window shatters', 'mirror shatters', 'shatters into pieces', 'breaks the glass', 'glass breaks', 'smashes the window'], query: 'glass shatter', volume: 0.85 },
            { patterns: ['fire spreads', 'flames erupt', 'fire roars', 'flames roar', 'burst into flames', 'catches fire', 'erupts in flames'], query: 'fire roar', volume: 0.8 },
            { patterns: ['heavy rain', 'rain begins', 'starts to rain', 'rain pours', 'pouring rain', 'downpour', 'sheets of rain'], query: 'heavy rain', volume: 0.6 },
            { patterns: ['creaking floorboards', 'floor creaks', 'floorboard creaks', 'old staircase', 'stairs creak', 'creaking stairs'], query: 'floorboard creak', volume: 0.6 },
            // Creatures / NPCs
            { patterns: ['wolf howls', 'wolves howl', 'howl in the distance', 'distant howl', 'howling in the night'], query: 'wolf howl', volume: 0.75 },
            { patterns: ['horse gallops', 'horse charges', 'horses thunder', 'hooves pound', 'clatter of hooves', 'sound of hooves'], query: 'horse gallop', volume: 0.7 },
            { patterns: ['crowd cheers', 'crowd erupts', 'crowd roars', 'audience applauds', 'cheers from the crowd', 'roar of the crowd'], query: 'crowd cheer', volume: 0.7 },
            { patterns: ['screams echo', 'a scream rings', 'someone screams', 'lets out a scream', 'blood-curdling scream', 'piercing scream'], query: 'scream', volume: 0.9 },
            { patterns: ['bell rings', 'bell tolls', 'church bell', 'alarm bell', 'bells ring', 'bells toll'], query: 'bell toll', volume: 0.7 },
            { patterns: ['ears ringing', 'ear ringing', 'ears are ringing', 'ringing in her ears', 'ringing in his ears', 'ringing in my ears', 'head ringing', 'ears rang', 'ears began to ring'], query: 'ringing in ears tinnitus', volume: 0.75 },
            // Magic
            { patterns: ['casts a spell', 'cast a spell', 'waves her wand', 'waves his wand', 'mutters an incantation', 'speaks the words of power', 'activates the rune', 'channels her magic', 'channels his magic'], query: 'magic spell cast', volume: 0.8 },
            { patterns: ['explosion rips', 'explosion tears', 'massive explosion', 'deafening explosion', 'explosion rocks', 'explosion shakes'], query: 'explosion large', volume: 0.95 },
        ];

        let fired = 0;
        const maxPhraseTriggers = 1;
        const fullTable = [...phraseTable, ...(this._customPhraseEntries || [])];
        for (const entry of fullTable) {
            if (fired >= maxPhraseTriggers) break;
            const bucketKey = 'phrase:' + entry.patterns[0];
            const lastFired = this.instantKeywordCooldowns.get(bucketKey) || 0;
            if (now - lastFired < PHRASE_COOLDOWN) continue;
            const matched = entry.patterns.some(p => lower.includes(p) || lowerAlts.some(alt => alt.includes(p)));
            if (matched) {
                this.instantKeywordCooldowns.set(bucketKey, now);
                debugLog('Phrase trigger:', entry.patterns[0], '->', entry.query);
                this.bumpStat('keywords');
                this.bumpStat('triggers');
                this.logActivity(`Phrase: "${entry.query}"`, 'trigger');
                this.playSoundEffect({ query: entry.query, volume: entry.volume });
                fired++;
            }
        }
    }

    // Add a custom phrase trigger. patterns: string[] of substrings to match;
    // query: freesound search term; volume: 0-1 (default 0.8).
    addCustomPhrase(patterns, query, volume = 0.8) {
        if (!Array.isArray(patterns) || patterns.length === 0 || !query) return;
        const entry = { patterns: patterns.map(p => String(p).toLowerCase()), query: String(query), volume: Number(volume) };
        this._customPhraseEntries = this._customPhraseEntries || [];
        // Replace if same query already exists
        const idx = this._customPhraseEntries.findIndex(e => e.query === entry.query);
        if (idx !== -1) this._customPhraseEntries[idx] = entry;
        else this._customPhraseEntries.push(entry);
        localStorage.setItem('Effexiq_custom_phrases', JSON.stringify(this._customPhraseEntries));
    }

    // Remove a custom phrase trigger by query string.
    removeCustomPhrase(query) {
        this._customPhraseEntries = (this._customPhraseEntries || []).filter(e => e.query !== String(query));
        localStorage.setItem('Effexiq_custom_phrases', JSON.stringify(this._customPhraseEntries));
    }

    // Return a copy of all user-defined phrase entries.
    getCustomPhrases() {
        return JSON.parse(JSON.stringify(this._customPhraseEntries || []));
    }

    async playInstantSound(config, keyword, intensityMul = 1.0) {
            const latencyStart = config._triggerStart || performance.now();
            // Track last played instant sound so 'again' can replay it
            this._lastInstantSound = { config: { ...config }, keyword, intensityMul };
            const cached = this.instantKeywordBuffers.get(keyword);
            if (cached) {
                debugLog(`Playing instant keyword from cache: ${keyword}`);
                this.bumpStat('sounds');
                const latency = Math.round(performance.now() - latencyStart);
                this.logActivity(`Play: ${keyword} (cached, ${latency}ms)`, 'play');
                this._lastSoundLatency = latency;
                this.playBufferDirect(cached.url, cached.buffer, (cached.volume || config.volume) * intensityMul);
                return;
            }
            
            // If trigger map has a direct file path, use it (skip search)
            if (config.file) {
                const url = encodeURI(config.file);
                debugLog(`Playing instant keyword from file: ${keyword} -> ${config.file}`);
                // Try to play from activeBuffers if already decoded
                if (this.activeBuffers?.has(url)) {
                    this.playBufferDirect(url, this.activeBuffers.get(url), config.volume * intensityMul);
                    return;
                }
                // Otherwise play via Howler (still fast for local files)
                await this.playSoundEffect({ query: config.query, priority: 10, volume: config.volume * intensityMul, directUrl: url });
                return;
            }
            
            // Fallback to normal search path (slower but still works)
            debugLog(`Playing instant keyword via search: ${keyword}`);
            await this.playSoundEffect({ query: config.query, priority: 10, volume: config.volume * intensityMul });
        }
        
        // Play audio buffer directly without decoding
        playBufferDirect(url, buffer, volume = 0.7, loop = false) {
            if (!this.audioContext || !buffer) return;

            // Resume suspended AudioContext (mobile safety net)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(e => console.warn('AudioContext resume failed in playBufferDirect:', e));
            }
            
            try {
                // Duck music
                this.duckMusic(0.6);
                
                // Create buffer source
                const source = this.audioContext.createBufferSource();
                source.buffer = buffer;
                if (loop) source.loop = true;
                
                // Create gain node for volume control
                const gainNode = this.audioContext.createGain();
                const effective = Math.max(0, Math.min(1, volume * this.sfxLevel));
                gainNode.gain.value = effective;
                
                // Connect: source → gain → sfxBusGain → master chain
                source.connect(gainNode);
                gainNode.connect(this.sfxBusGain);
                
                // Track as active sound
                const id = 'instant_' + Date.now();
                this.activeSounds.set(id, {
                    type: 'sfx',
                    source,
                    gainNode,
                    startTime: Date.now()
                });
                
                // Clean up on end (only fires for non-looping sources)
                source.onended = () => {
                    this.activeSounds.delete(id);
                    source.disconnect();
                    gainNode.disconnect();
                };
                
                // Start playback
                source.start(0);
                
                debugLog(`✓ Playing instant buffer: ${url}${loop ? ' (looping)' : ''}`);
            } catch (e) {
                console.error('Buffer playback error:', e);
            }
        }
    
    // ===== AI CONTEXT ANALYSIS =====
    async analyzeContext(customTranscript = null) {
        const recentTranscript = (customTranscript ?? this.transcriptBuffer.slice(-10).join(' ')).trim();
        if (!recentTranscript) return;
        this.updateStatus('Analyzing context...');
        this.bumpStat('analyses');
        this.logActivity(`AI analyzing: "${recentTranscript.substring(0, 50)}..."`, 'ai');
        
        try {
            const versionAtStart = this.analysisVersion;
            
            const response = await this.callBackendAnalyze(recentTranscript);
            
            // Success - reset interval to fast (after any previous backoff)
            this.analysisInterval = this.baseAnalysisInterval;
            
            // If mode changed during the async call, ignore this result
            if (this.analysisVersion !== versionAtStart) {
                debugLog('Discarding stale analysis result after mode change');
                return;
            }

            if (response) {
                // Hybrid routing: if AI confidence is low, supplement with rule-based
                if (typeof response.confidence === 'number' && response.confidence < 0.5) {
                    try {
                        const fallback = ruleBasedDecision(recentTranscript, this.currentMode, this.instantKeywords, this.savedSounds);
                        if (fallback) {
                            // Merge rule-based SFX with AI SFX (AI takes priority)
                            const aiSfxIds = new Set((response.sfx || []).map(s => s.id));
                            if (fallback.sfx?.length) {
                                const extraSfx = fallback.sfx.map(s => {
                                    const entry = this.soundCatalog.find(e => e.src === s.file || e.id === s.file);
                                    return entry && !aiSfxIds.has(entry.id) ? { id: entry.id, when: 'immediate', volume: s.volume } : null;
                                }).filter(Boolean);
                                response.sfx = [...(response.sfx || []), ...extraSfx];
                            }
                            // Use rule-based music if AI didn't provide one
                            if (!response.music?.id && fallback.music) {
                                const musicEntry = this.soundCatalog.find(s => s.src === fallback.music.file || s.id === fallback.music.file);
                                if (musicEntry) {
                                    response.music = { id: musicEntry.id, action: 'play_or_continue', volume: fallback.music.volume };
                                }
                            }
                            debugLog('Hybrid merge: AI conf=' + response.confidence + ', added rule-based results');
                        }
                    } catch (hybridErr) {
                        debugLog('Hybrid merge error:', hybridErr);
                    }
                }
                await this.processSoundDecisions(response);
            }
        } catch (error) {
            // Check for rate limiting
            if (error && String(error.message || '').includes('429')) {
                // Exponential backoff on rate limits
                this.analysisInterval = Math.min(this.analysisInterval * 1.5, 15000);
                console.warn(`Rate limited, backing off to ${this.analysisInterval}ms`);
            }
            console.error('AI Analysis error:', error);
            
            // Rule-based fallback: make sound decisions without AI
            try {
                const fallback = ruleBasedDecision(recentTranscript, this.currentMode, this.instantKeywords, this.savedSounds);
                if (fallback) {
                    debugLog('Using rule-based fallback:', fallback);
                    // Convert rule-based result to processSoundDecisions format
                    const decisions = { scene: 'rule-based fallback' };
                    if (fallback.music) {
                        // Find the catalog ID for this music file
                        const musicEntry = this.soundCatalog.find(s => s.src === fallback.music.file || s.id === fallback.music.file);
                        if (musicEntry) {
                            decisions.music = { id: musicEntry.id, action: 'play_or_continue', volume: fallback.music.volume };
                        }
                    }
                    if (fallback.sfx?.length) {
                        decisions.sfx = fallback.sfx.map(s => {
                            const entry = this.soundCatalog.find(e => e.src === s.file || e.id === s.file);
                            return entry ? { id: entry.id, when: 'immediate', volume: s.volume } : null;
                        }).filter(Boolean);
                    }
                    if (decisions.music || decisions.sfx?.length) {
                        await this.processSoundDecisions(decisions);
                        this.updateStatus('Playing (offline mode)');
                        return;
                    }
                }
            } catch (fbErr) {
                debugLog('Rule-based fallback error:', fbErr);
            }
            
            this.updateStatus('Analysis error. Check console for details.');
        }
    }
    
    async callBackendAnalyze(transcript) {
        // Build context for backend
        const moodSummary = this.moodHistory.length
            ? this.moodHistory.slice(-5).map(m => `${m.primary}(${m.intensity})`).join(' → ')
            : null;
        const context = {
            mode: this.currentMode,
            musicEnabled: this.musicEnabled,
            sfxEnabled: this.sfxEnabled,
            moodBias: this.moodBias,
            recentSounds: Array.from(this.recentlyPlayed).slice(-5),
            recentMusic: this.currentMusic?.dataset?.id || null,
            storyActive: this.storyActive || false,
            storyTitle: this.currentStory?.title || null,
            sessionContext: this.sessionContext || null,
            moodHistory: moodSummary,
            sceneMemory: this.rollingSceneSummary || null,
            sceneState: this.sceneState || null
        };
        
        // Use centralized API service (from api.js)
        // This will try backend first, then fallback to client-side OpenAI if needed
        return await analyzeTranscript({
            transcript,
            mode: this.currentMode,
            context
        });
    }

    // Stop all audio immediately and clear tracking
    stopAllAudio() {
        // --- Cancel the async analysis pipeline so no new sounds restart after we stop ---
        this.analysisVersion++;                        // poisons any in-flight AI responses
        this.analysisInProgress = false;
        if (this._silenceAnalysisTimer) { clearTimeout(this._silenceAnalysisTimer); this._silenceAnalysisTimer = null; }
        this._pendingAnalysisTranscript = null;        // discard queued transcripts
        // (analysisTimer/recognition stay alive — mic may still be running)

        // Cancel stingers
        if (this.stingerTimer) { clearTimeout(this.stingerTimer); this.stingerTimer = null; }

        // Hard stop via Howler global (stops any stray sounds not tracked)
        try {
            if (typeof Howler !== 'undefined') {
                Howler.stop();
            }
        } catch (_) {}

        // Stop and release music (Howler or legacy)
        if (this.currentMusic) {
            try {
                if (this.currentMusic._howl) {
                    this.currentMusic._howl.stop();
                    this.currentMusic._howl.unload();
                } else if (this.currentMusic.pause) {
                    this.currentMusic.pause();
                    this.currentMusic.currentTime = 0;
                    this.currentMusic.src = '';
                    this.currentMusic.load();
                }
            } catch(_) {}
            this.currentMusic = null;
        }
        if (this.currentMusicSource) {
            try { this.currentMusicSource.disconnect(); } catch (_) {}
            this.currentMusicSource = null;
        }

        // Stop all active SFX (Howler or legacy Web Audio/HTMLAudioElement)
        this.activeSounds.forEach((soundObj) => {
            try {
                if (soundObj._howl) {
                    soundObj._howl.stop();
                    soundObj._howl.unload();
                } else if (soundObj.source) {
                    // Web Audio buffer source path
                    try { soundObj.source.stop(); } catch(_) {}
                    try { soundObj.source.disconnect(); } catch(_) {}
                    try { soundObj.panner && soundObj.panner.disconnect(); } catch(_) {}
                    try { soundObj.gainNode && soundObj.gainNode.disconnect(); } catch(_) {}
                } else if (soundObj.pause) {
                    // HTMLAudioElement path
                    soundObj.pause();
                    soundObj.currentTime = 0;
                    try { soundObj.src = ''; soundObj.load(); } catch(_) {}
                }
            } catch (_) {}
        });
        this.activeSounds.clear();



        // Extra safety: unload all Howler instances to prevent loops
        try {
            if (typeof Howler !== 'undefined' && Array.isArray(Howler._howls)) {
                Howler._howls.forEach(h => { try { h.stop(); h.unload(); } catch(_) {} });
            }
        } catch (_) {}

        // Clear any queued sounds if used
        if (Array.isArray(this.soundQueue)) this.soundQueue.length = 0;

        // Reflect empty state in UI
        this.updateSoundsList();
    }

    maybeAnalyzeLive() {
        if (!this.predictionEnabled) return;
        const now = Date.now();
        const contextText = [
            this.transcriptBuffer.slice(-10).join(' '),
            this.currentInterim
        ].filter(Boolean).join(' ').trim();
        if (contextText.length < 8) return;
        if (this._lastAnalyzedText === contextText) return;

        if (this.analysisInProgress) {
            // Queue it: save the latest transcript so it runs when current analysis finishes
            this._pendingAnalysisTranscript = contextText;
            return;
        }
        if (now - this.lastAnalysisTime < this.analysisInterval) return;
        
        // VAD: skip if transcript hasn't changed since last analysis
        this._lastAnalyzedText = contextText;
        
        this.lastAnalysisTime = now;
        this.analysisInProgress = true;
        this.analyzeContext(contextText)
            .catch(err => console.error('Live analysis failed:', err))
            .finally(() => {
                this.analysisInProgress = false;
                // Drain pending queue
                if (this._pendingAnalysisTranscript) {
                    const pending = this._pendingAnalysisTranscript;
                    this._pendingAnalysisTranscript = null;
                    if (pending !== this._lastAnalyzedText) {
                        this._lastAnalyzedText = pending;
                        this.lastAnalysisTime = Date.now();
                        this.analysisInProgress = true;
                        this.analyzeContext(pending)
                            .catch(e => console.error('Queued analysis failed:', e))
                            .finally(() => { this.analysisInProgress = false; });
                    }
                }
            });
    }
    
    
    
    // ===== SOUND DECISION ENGINE =====
    async processSoundDecisions(decisions) {
        debugLog('Sound Decisions:', decisions);
        if (!this.predictionEnabled) { return; }

        // Track mood from AI response
        if (decisions.mood && decisions.mood.primary) {
            this.currentMood = {
                primary: decisions.mood.primary,
                intensity: typeof decisions.mood.intensity === 'number' ? decisions.mood.intensity : 0.5
            };
            this.moodHistory.push({ ...this.currentMood, time: Date.now() });
            if (this.moodHistory.length > 20) this.moodHistory.shift();
            // Dynamic cooldowns: adjust based on mood intensity
            this.adaptCooldownsToMood();
            // Scene memory: detect chapter transitions
            this.detectSceneTransition(decisions);
            // Scene state machine: update state + potentially force fast music change
            this._updateSceneState(decisions);
            // Rolling scene memory: rebuild summary every 3 analyses
            this._analysisCountSinceLastSummary = (this._analysisCountSinceLastSummary || 0) + 1;
            if (this._analysisCountSinceLastSummary >= 3) {
                this._analysisCountSinceLastSummary = 0;
                this._updateRollingSceneSummary(decisions.scene);
            }
        }

        // Log with confidence if available
        const conf = typeof decisions.confidence === 'number' ? ` conf=${decisions.confidence.toFixed(2)}` : '';
        this.logActivity(`AI decided: scene="${decisions.scene || '?'}" music=${decisions.music?.id || 'none'} sfx=${decisions.sfx?.length || 0}${conf}`, 'ai');
        
        const now = Date.now();
        this.activeSounds.forEach((soundObj, id) => {
            if (soundObj.type === 'sfx') {
                const age = now - (soundObj.startTime || now);
                if (age > 2000) {
                    try {
                        if (soundObj._howl) {
                            soundObj._howl.fade(soundObj._howl.volume(), 0, 300);
                            setTimeout(() => {
                                try { soundObj._howl.stop(); soundObj._howl.unload(); } catch(_) {}
                                this.activeSounds.delete(id);
                            }, 350);
                        }
                    } catch(_) {}
                }
            }
        });
        
        // Handle Music (mood-adaptive: prefer mood-matching tracks)
        if (this.musicEnabled && decisions.music && decisions.music.id) {
            if (!this.soundCatalog.find(s => s.id === decisions.music.id)) {
                console.warn(`[Effexiq] AI returned unknown music ID: ${decisions.music.id} — skipping`);
            } else {
                this.bumpStat('transitions');
                await this.updateMusicById(decisions.music);
            }
        } else if (this.musicEnabled && this.moodHistory.length >= 3) {
            // Mood-adaptive: if mood has shifted significantly but AI didn't suggest music, pick one
            this.maybeAdaptMusicToMood();
        }
        
        // Handle Sound Effects (skip in demo mode — story cue map handles SFX)
        if (this.sfxEnabled && !this.demoRunning && decisions.sfx && decisions.sfx.length > 0) {
            for (const sfx of decisions.sfx) {
                // Skip sounds not found in catalog (hallucinated IDs)
                if (sfx.id && !this.soundCatalog.find(s => s.id === sfx.id)) {
                    console.warn(`[Effexiq] AI returned unknown sound ID: ${sfx.id} — skipping`);
                    continue;
                }
                // Skip disabled sounds
                if (sfx.id && this.disabledSounds.has(sfx.id)) {
                    debugLog('Skipping disabled sound:', sfx.id);
                    continue;
                }
                // Skip low-confidence SFX (below 0.4 threshold)
                if (typeof sfx.confidence === 'number' && sfx.confidence < 0.4) {
                    debugLog('Skipping low-confidence SFX:', sfx.id, sfx.confidence);
                    continue;
                }
                // Check semantic cooldown (tag-based similarity)
                if (this.isSemanticallyCoolingDown(sfx)) {
                    debugLog('Semantic cooldown active for:', sfx.id);
                    continue;
                }
                this.bumpStat('sounds');
                // Pass spatial hint from AI
                await this.playSoundEffectById(sfx, sfx.spatial || null);
                // Record in sound history for semantic cooldown
                const catalogEntry = this.soundCatalog.find(s => s.id === sfx.id);
                this.soundHistory.push({ id: sfx.id, tags: sfx.tags || catalogEntry?.tags || [], time: Date.now() });
                if (this.soundHistory.length > 30) this.soundHistory.shift();
            }
        }
        
    this.updateStatus(`${decisions.scene || 'Playing sounds...'}`);
    }
    
    async updateMusicById(musicData) {
        if (!musicData || !musicData.id) return;
        if (!this.musicEnabled) {
            this.updateStatus('Music disabled (toggle off)');
            return;
        }
        
            // Check if music context has changed (major scene shift)
            const contextChanged = this.hasMusicContextChanged(musicData);
            const now = Date.now();
        
            // If music is already playing and context hasn't changed, keep it playing
            if (!contextChanged && this.currentMusic && this.currentMusic.id) {
                // Check if current music is the same or in the same context group
                if (musicData.action === 'play_or_continue' || 
                    this.isSameMusicContext(this.currentMusic.id, musicData.id)) {
                    debugLog('Music context stable, continuing:', this.currentMusic.id);
                    return;
                }
            }
        
            // Respect minimum time between music changes (unless forced change)
            if (!contextChanged && 
                musicData.action === 'play_or_continue' &&
                (now - this.lastMusicChange) < this.musicChangeThreshold) {
                debugLog('Music change too soon, waiting...');
                return;
            }
        
        // Find sound in catalog (exact match, then filename-only fallback)
        let sound = this.soundCatalog.find(s => s.id === musicData.id);
        if (!sound) {
            // AI sometimes returns just the filename without the folder prefix
            sound = this.soundCatalog.find(s => s.id && s.id.endsWith('/' + musicData.id));
        }
        if (!sound) {
            console.warn('Music ID not found in catalog:', musicData.id);
            return;
        }
        
        // Skip if this sound has failed recently (404 blacklist)
        if (!this.soundFailureCache) this.soundFailureCache = new Map();
        const failKey = sound.id;
        if (this.soundFailureCache.has(failKey)) {
            const failTime = this.soundFailureCache.get(failKey);
            if (Date.now() - failTime < 60000) { // 60s blacklist
                console.warn('Skipping recently failed music:', sound.id);
                return;
            }
        }
        
        // Build URL (relative paths resolved by browser, buildSrcCandidates adds backend fallback)
        const soundUrl = encodeURI(sound.src);
        
        // Apply volume with mood bias
        const moodMul = 0.85 + this.moodBias * 0.3;
        const baseVol = musicData.volume || 0.5;
        const effectiveVol = Math.max(0, Math.min(1, baseVol * moodMul * this.musicLevel));
        
            // Build rotation queue for this music context
            this.buildMusicRotationQueue(musicData.id);
        
            // Update music context
            this.currentMusicContext = this.getMusicContext(musicData.id);
            this.lastMusicChange = now;
        
        await this.playAudio(soundUrl, {
            type: 'music',
            name: sound.id,
            volume: effectiveVol,
            loop: sound.loop || true,
            id: sound.id
        });
        
        // Start stingers scheduling
        this.scheduleNextStinger();
    }
    
    // Legacy updateMusic for fallback (Freesound/Saved Sounds)
    async updateMusic(musicData) {
        if (!this.musicEnabled) {
            this.updateStatus('Music disabled (toggle off)');
            return;
        }
        // Only change music if AI explicitly says to (change: true) or if no music playing
        if (!musicData.change && this.currentMusic && !this.currentMusic.paused) {
            debugLog('Music stable, not changing (change: false)');
            return;
        }
        
        // Don't change music too frequently
        if (this.currentMusic && this.currentMusic.query === musicData.query) {
            return;
        }
        
        // Search and crossfade to new music
        const soundUrl = await this.searchAudio(musicData.query, 'music');
        if (soundUrl) {
            this.currentMusicBase = this.calculateVolume(musicData.intensity || 0.5);
            // Mood bias: scale base a bit by mood (calm -> less, intense -> more)
            const moodMul = 0.85 + this.moodBias * 0.3;
            const base = Math.max(0, Math.min(1, this.currentMusicBase * moodMul));
            const effectiveVol = Math.max(0, Math.min(1, base * this.musicLevel));
            await this.playAudio(soundUrl, {
                type: 'music',
                name: musicData.query,
                volume: effectiveVol,
                loop: true
            });
            // Start stingers scheduling
            this.scheduleNextStinger();
        }
    }
    
        // Check if music context has changed significantly (major scene shift)
        hasMusicContextChanged(musicData) {
            if (!this.currentMusicContext) return true; // No current context
            if (!musicData.action) return true; // No action specified
            if (musicData.action === 'change') return true; // Explicit change requested
        
            const newContext = this.getMusicContext(musicData.id);
        
            // Check for major mood/scene shifts
            if (this.currentMusicContext.mood !== newContext.mood) {
                // Allow some mood transitions without stopping music
                const allowedTransitions = [
                    ['calm', 'peaceful'],
                    ['tense', 'epic'],
                    ['mysterious', 'dark']
                ];
            
                const isAllowedTransition = allowedTransitions.some(([a, b]) => 
                    (this.currentMusicContext.mood === a && newContext.mood === b) ||
                    (this.currentMusicContext.mood === b && newContext.mood === a)
                );
            
                if (!isAllowedTransition) {
                    debugLog('Major mood shift detected:', this.currentMusicContext.mood, '->', newContext.mood);
                    return true;
                }
            }
        
            // Check for scene category changes
            if (this.currentMusicContext.category !== newContext.category) {
                debugLog('Scene category changed:', this.currentMusicContext.category, '->', newContext.category);
                return true;
            }
        
            return false;
        }
    
        // Get music context from sound ID or tags
        getMusicContext(soundId) {
            const sound = this.soundCatalog.find(s => s.id === soundId);
            if (!sound) return { mood: 'unknown', category: 'general' };
        
            const tags = sound.tags || [];
            const id = sound.id.toLowerCase();
        
            // Determine mood
            let mood = 'calm';
            if (tags.some(t => ['horror', 'creepy', 'dark', 'eerie'].includes(t))) mood = 'dark';
            else if (tags.some(t => ['epic', 'battle', 'war', 'intense'].includes(t))) mood = 'epic';
            else if (tags.some(t => ['tense', 'suspense', 'mysterious'].includes(t))) mood = 'tense';
            else if (tags.some(t => ['joyful', 'happy', 'festive', 'christmas'].includes(t))) mood = 'joyful';
            else if (tags.some(t => ['peaceful', 'calm', 'gentle', 'ambient'].includes(t))) mood = 'peaceful';
            else if (tags.some(t => ['mysterious', 'enigmatic'].includes(t))) mood = 'mysterious';
        
            // Determine category
            let category = 'general';
            if (tags.includes('christmas') || id.includes('christmas')) category = 'christmas';
            else if (tags.includes('halloween') || id.includes('halloween')) category = 'halloween';
            else if (tags.includes('medieval') || tags.includes('fantasy') || tags.includes('rpg')) category = 'fantasy';
            else if (tags.includes('horror') || mood === 'dark') category = 'horror';
            else if (tags.includes('tavern') || id.includes('tavern')) category = 'tavern';
        
            return { mood, category, tags };
        }
    
        // Check if two music tracks belong to the same context
        isSameMusicContext(currentId, newId) {
            if (currentId === newId) return true;
        
            const currentContext = this.getMusicContext(currentId);
            const newContext = this.getMusicContext(newId);
        
            // Same category and similar mood = same context
            return currentContext.category === newContext.category &&
                   currentContext.mood === newContext.mood;
        }
    
        // Build rotation queue of related music tracks
        buildMusicRotationQueue(primaryId) {
            const context = this.getMusicContext(primaryId);
        
            // Find all music tracks matching this context
            const relatedTracks = this.soundCatalog.filter(s => {
                if (s.type !== 'music') return false;
                const trackContext = this.getMusicContext(s.id);
                return trackContext.category === context.category &&
                       trackContext.mood === context.mood;
            });
        
            // Shuffle for variety
            this.musicRotationQueue = this.shuffleArray([...relatedTracks]);
            this.musicRotationIndex = 0;
        
            debugLog(`Built music rotation queue: ${this.musicRotationQueue.length} tracks in ${context.category}/${context.mood}`);
        }
    
        // Get next music track in rotation
        getNextMusicInRotation() {
            if (this.musicRotationQueue.length === 0) return null;
        
            this.musicRotationIndex = (this.musicRotationIndex + 1) % this.musicRotationQueue.length;
            const nextTrack = this.musicRotationQueue[this.musicRotationIndex];
        
            debugLog(`Rotating to next music: ${nextTrack.id} (${this.musicRotationIndex + 1}/${this.musicRotationQueue.length})`);
            return nextTrack;
        }
    
        shuffleArray(array) {
            return shuffle([...array]);
        }
    
    // Mood-adaptive music: when mood trajectory shifts, pick matching music
    maybeAdaptMusicToMood() {
        const now = Date.now();
        if (now - this.lastMusicChange < this.musicChangeThreshold) return;
        
        // Check if recent moods show a consistent shift
        const recent = this.moodHistory.slice(-3);
        if (recent.length < 3) return;
        const dominant = recent[recent.length - 1].primary;
        const consistent = recent.every(m => m.primary === dominant);
        if (!consistent) return;
        
        // Current music context - don't change if already matching
        if (this.currentMusic?.id) {
            const currentEntry = this.soundCatalog.find(s => s.id === this.currentMusic.id);
            if (currentEntry && currentEntry.tags && currentEntry.tags.includes(dominant)) return;
        }
        
        // Richer mood-to-tag mapping with primary and secondary tags
        const moodMap = {
            tense: { primary: ['tension', 'suspense', 'dark', 'ominous'], secondary: ['mystery', 'dramatic'] },
            happy: { primary: ['upbeat', 'cheerful', 'bright', 'adventure'], secondary: ['playful', 'light'] },
            sad: { primary: ['melancholy', 'somber', 'emotional', 'sad'], secondary: ['gentle', 'slow'] },
            angry: { primary: ['intense', 'battle', 'aggressive', 'war'], secondary: ['epic', 'heavy'] },
            fear: { primary: ['horror', 'creepy', 'dark', 'suspense'], secondary: ['eerie', 'ominous'] },
            calm: { primary: ['peaceful', 'ambient', 'calm', 'gentle'], secondary: ['nature', 'soft'] },
            excited: { primary: ['epic', 'adventure', 'heroic', 'upbeat'], secondary: ['battle', 'triumphant'] },
            neutral: { primary: ['ambient', 'background', 'calm'], secondary: ['gentle', 'light'] }
        };
        const moodEntry = moodMap[dominant] || moodMap.neutral;
        const primaryTags = moodEntry.primary;
        const secondaryTags = moodEntry.secondary;
        const avgIntensity = recent.reduce((s, m) => s + m.intensity, 0) / recent.length;
        
        // Score candidates by tag relevance and intensity match
        const candidates = this.soundCatalog
            .filter(s => s.type === 'music' && !this.disabledSounds.has(s.id) && s.tags && s.tags.length > 0)
            .map(s => {
                const tags = s.tags.map(t => t.toLowerCase());
                let score = 0;
                score += tags.filter(t => primaryTags.includes(t)).length * 3;
                score += tags.filter(t => secondaryTags.includes(t)).length * 1;
                // Favor higher-energy tracks for intense moods
                if (avgIntensity > 0.7 && tags.some(t => ['epic', 'intense', 'battle', 'aggressive'].includes(t))) score += 2;
                if (avgIntensity < 0.3 && tags.some(t => ['calm', 'gentle', 'soft', 'ambient'].includes(t))) score += 2;
                return { sound: s, score };
            })
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score);
        
        if (candidates.length > 0) {
            // Pick from top 3 for variety
            const topN = candidates.slice(0, Math.min(3, candidates.length));
            const pick = topN[Math.floor(Math.random() * topN.length)].sound;
            debugLog('Mood-adaptive music switch:', dominant, `(intensity=${avgIntensity.toFixed(2)})`, '->', pick.id);
            this.updateMusicById({ id: pick.id, action: 'play_or_continue', volume: 0.5 });
        }
    }
    
    async playSoundEffectById(sfxData, spatialHint) {
        if (!this.sfxEnabled) {
            this.updateStatus('SFX disabled (toggle off)');
            return;
        }
        // Limit simultaneous sounds
        if (this.activeSounds.size >= this.maxSimultaneousSounds) {
            return;
        }
        
        // Check disabled sounds
        if (sfxData.id && this.disabledSounds.has(sfxData.id)) {
            return;
        }
        
        // Find sound in catalog
        const sound = this.soundCatalog.find(s => s.id === sfxData.id);
        if (!sound) {
            // Semantic fallback: search by ID as a query
            const fallbacks = this.semanticSearchCatalog(sfxData.id, 'sfx', 1);
            if (fallbacks.length > 0) {
                debugLog('Semantic fallback for', sfxData.id, '->', fallbacks[0].id);
                sfxData = { ...sfxData, id: fallbacks[0].id };
                return this.playSoundEffectById(sfxData, spatialHint);
            }
            console.warn('SFX ID not found in catalog:', sfxData.id);
            return;
        }
        
        // Skip if this sound has failed recently (404 blacklist)
        if (!this.soundFailureCache) this.soundFailureCache = new Map();
        const failKey = sound.id;
        if (this.soundFailureCache.has(failKey)) {
            const failTime = this.soundFailureCache.get(failKey);
            if (Date.now() - failTime < 60000) { // 60s blacklist
                return; // Skip sounds that recently 404'd
            }
        }
        
        // Cooldown to prevent rapid repeats of the same effect
        const bucket = this.getSfxBucket(sfxData.id);
        const now = Date.now();
        const nextAllowed = this.sfxCooldowns.get(bucket) || 0;
        if (now < nextAllowed) {
            // Skip duplicate within cooldown window
            return;
        }
        
        // Build URL (relative paths resolved by browser, buildSrcCandidates adds backend fallback)
        const soundUrl = encodeURI(sound.src);
        
        // Apply volume with SFX level
        const effectiveVol = Math.max(0, Math.min(1, (sfxData.volume || 0.7) * this.sfxLevel));
        
        const played = await this.playAudio(soundUrl, {
            type: 'sfx',
            name: sound.id,
            volume: effectiveVol,
            loop: false,
            id: sound.id,
            spatial: spatialHint || null
        });
        
        if (played) {
            // Start cooldown for this bucket
            this.sfxCooldowns.set(bucket, Date.now() + this.sfxCooldownMs);
        } else {
            // Mark as failed to avoid retrying 404s
            this.soundFailureCache.set(failKey, Date.now());
        }
    }
    
    // Legacy playSoundEffect for fallback (Freesound/Saved Sounds)
    async playSoundEffect(sfxData) {
        if (!this.sfxEnabled) {
            this.updateStatus('SFX disabled (toggle off)');
            return;
        }
        // Limit simultaneous sounds
        if (this.activeSounds.size >= this.maxSimultaneousSounds) {
            return;
        }
        // Cooldown to prevent rapid repeats of the same effect
        const bucket = this.getSfxBucket(sfxData.query || '');
        const now = Date.now();
        const nextAllowed = this.sfxCooldowns.get(bucket) || 0;
        if (now < nextAllowed) {
            // Skip duplicate within cooldown window
            return;
        }
        
        const soundUrl = await this.searchAudio(sfxData.query, 'sfx');
        if (soundUrl) {
            const played = await this.playAudio(soundUrl, {
                type: 'sfx',
                name: sfxData.query,
                volume: this.calculateVolume(sfxData.volume || 0.7),
                loop: false
            });
            if (played) {
                // Start cooldown for this bucket
                this.sfxCooldowns.set(bucket, Date.now() + this.sfxCooldownMs);
            }
        }
    }

    // Normalize and bucket SFX queries so variants like "door creak" and "door slam" share cooldown
    getSfxBucket(query) {
        return sfxBucket(query);
    }
    
    // Semantic cooldown: prevent similar-sounding effects from firing too close together
    // Uses tag overlap to determine similarity, with a time-based cooldown
    isSemanticallyCoolingDown(sfxData) {
        if (!sfxData.id || this.soundHistory.length === 0) return false;
        const now = Date.now();
        const cooldownMs = this.sfxCooldownMs || 3500;
        
        // Find the catalog entry for this sound to get its tags
        const entry = this.soundCatalog.find(s => s.id === sfxData.id);
        if (!entry || !entry.tags || entry.tags.length === 0) return false;
        
        const entryTags = new Set(entry.tags);
        
        for (const recent of this.soundHistory) {
            if (now - recent.time > cooldownMs) continue;
            // Exact match — always on cooldown
            if (recent.id === sfxData.id) return true;
            // Tag overlap: if more than half the tags overlap, consider it semantically similar
            if (Array.isArray(recent.tags) && recent.tags.length > 0) {
                const overlap = recent.tags.filter(t => entryTags.has(t)).length;
                const similarity = overlap / Math.min(entryTags.size, recent.tags.length);
                if (similarity >= 0.5) return true;
            }
        }
        return false;
    }
    
    // ===== DYNAMIC COOLDOWNS =====
    // Adjust SFX/music cooldowns based on current mood
    adaptCooldownsToMood() {
        const mood = this.currentMood.primary;
        const intensity = this.currentMood.intensity;
        const baseSfx = 3500;
        const baseMusic = 30000;
        // High-action moods: shorter cooldowns for rapid SFX, faster music changes
        const moodMultipliers = {
            angry: 0.5, excited: 0.55, fear: 0.6, tense: 0.65,
            happy: 0.85, sad: 1.1, calm: 1.4, neutral: 1.0
        };
        const mul = moodMultipliers[mood] || 1.0;
        // Intensity further scales: high intensity = even shorter cooldowns
        const intensityScale = 1.0 - (intensity - 0.5) * 0.4; // 0.5 int → 1.0, 1.0 int → 0.8
        this.sfxCooldownMs = Math.round(baseSfx * mul * intensityScale);
        this.musicChangeThreshold = Math.round(baseMusic * mul * intensityScale);
        debugLog(`Cooldowns adapted: mood=${mood} sfx=${this.sfxCooldownMs}ms music=${this.musicChangeThreshold}ms`);
    }
    
    // ===== SCENE STATE MACHINE =====
    // Tracks: exploration | combat | dialogue | rest | travel
    // A single high-confidence state change immediately adjusts musicChangeThreshold
    _updateSceneState(decisions) {
        const mood = this.currentMood.primary;
        const intensity = this.currentMood.intensity;
        const scene = (decisions.scene || '').toLowerCase();

        const COMBAT_MOODS = new Set(['angry', 'excited', 'fear', 'tense']);
        const REST_MOODS = new Set(['calm', 'sad', 'neutral']);
        const DIALOGUE_KEYWORDS = ['conversation', 'talking', 'speaks', 'says', 'whispers', 'asks', 'replies', 'argues', 'explains'];
        const TRAVEL_KEYWORDS = ['walking', 'riding', 'journey', 'path', 'road', 'forest', 'moving', 'traveling', 'enter'];

        let newState = this.sceneState;
        if (COMBAT_MOODS.has(mood) && intensity >= 0.6) {
            newState = 'combat';
        } else if (DIALOGUE_KEYWORDS.some(w => scene.includes(w))) {
            newState = 'dialogue';
        } else if (TRAVEL_KEYWORDS.some(w => scene.includes(w))) {
            newState = 'travel';
        } else if (REST_MOODS.has(mood) && intensity < 0.4) {
            newState = 'rest';
        } else if (REST_MOODS.has(mood)) {
            newState = 'exploration';
        }

        if (newState !== this.sceneState) {
            const prev = this.sceneState;
            this.sceneState = newState;
            this._sceneStateConfidence = (this._sceneStateConfidence || 0) + 1;
            debugLog(`Scene state: ${prev} → ${newState} (intensity=${intensity.toFixed(2)})`);
            this.logActivity(`Scene state: ${newState}`, 'scene');

            // Immediate music responsiveness: if entering/leaving combat, slash the music threshold
            if (newState === 'combat' || prev === 'combat') {
                this.musicChangeThreshold = Math.min(this.musicChangeThreshold, 5000);
                debugLog('Fast music transition triggered by scene state change');
                // Force mood-adaptive music pick right now for this new state
                if (this.musicEnabled) {
                    setTimeout(() => this.maybeAdaptMusicToMood(), 300);
                }
            }
            // Immediately refresh procedural ambient layers on any state change
            this.lastProceduralUpdate = 0;
            this.updateProceduralLayers();
        } else {
            this._sceneStateConfidence = Math.min(10, (this._sceneStateConfidence || 0) + 1);
        }
    }

    // ===== ROLLING SCENE MEMORY =====
    // Builds a one-line running summary of the session (last 3 scene descriptions)
    // Passed to the AI as "scene memory" so it understands what happened earlier
    _updateRollingSceneSummary(latestScene) {
        if (!latestScene) return;
        const MAX_EVENTS = 4;
        // Accumulate scene events
        if (!this._sceneEvents) this._sceneEvents = [];
        // Avoid duplicates (same description as last)
        const last = this._sceneEvents[this._sceneEvents.length - 1];
        if (last && last.toLowerCase() === latestScene.toLowerCase()) return;
        this._sceneEvents.push(latestScene);
        if (this._sceneEvents.length > MAX_EVENTS) this._sceneEvents.shift();
        this.rollingSceneSummary = this._sceneEvents.join(' → ');
        debugLog('Rolling scene summary:', this.rollingSceneSummary);
    }

    // ===== SCENE MEMORY / AUTO-CHAPTERS =====
    detectSceneTransition(decisions) {
        const mood = this.currentMood.primary;
        const scene = decisions.scene || '';
        
        // First chapter
        if (!this.currentChapterMood) {
            this.currentChapterMood = mood;
            this.chapterStartTime = Date.now();
            this.sceneChapters.push({
                mood,
                description: scene,
                timestamp: Date.now(),
                elapsed: 0,
                sounds: []
            });
            debugLog('Chapter 1 started:', mood, scene);
            return;
        }
        
        // Detect mood shift: if mood changed and persisted for 2+ readings
        if (mood !== this.currentChapterMood) {
            const recent = this.moodHistory.slice(-3);
            const newMoodCount = recent.filter(m => m.primary === mood).length;
            if (newMoodCount >= 2) {
                // Close current chapter
                const current = this.sceneChapters[this.sceneChapters.length - 1];
                if (current) {
                    current.duration = Date.now() - (current.timestamp || this.chapterStartTime);
                }
                // Start new chapter
                const chapterNum = this.sceneChapters.length + 1;
                const recentSounds = this.soundHistory.slice(-5).map(s => s.id);
                this.sceneChapters.push({
                    mood,
                    description: scene,
                    timestamp: Date.now(),
                    elapsed: Date.now() - this.sessionStartTime,
                    sounds: recentSounds
                });
                this.currentChapterMood = mood;
                this.chapterStartTime = Date.now();
                debugLog(`Chapter ${chapterNum} started:`, mood, scene);
                this.logActivity(`Scene shift: ${mood} - ${scene || 'new scene'}`, 'scene');
            }
        } else {
            // Update current chapter description if scene changed
            const current = this.sceneChapters[this.sceneChapters.length - 1];
            if (current && scene && scene !== current.description) {
                current.description = scene;
            }
        }
    }
    
    getSceneTimeline() {
        return this.sceneChapters.map((ch, i) => ({
            chapter: i + 1,
            mood: ch.mood,
            description: ch.description,
            elapsed: this.formatElapsed(ch.elapsed || 0),
            duration: ch.duration ? this.formatElapsed(ch.duration) : 'ongoing',
            sounds: ch.sounds
        }));
    }
    
    formatElapsed(ms) {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${String(sec).padStart(2, '0')}`;
    }
    
    // ===== CLIENT-SIDE SEMANTIC SEARCH =====
    // Score catalog sounds against a text query using tag similarity + substring matching
    semanticSearchCatalog(query, type = null, maxResults = 5) {
        if (!query || this.soundCatalog.length === 0) return [];
        const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        if (tokens.length === 0) return [];
        
        // Synonym expansion for common audio terms
        const synonyms = {
            sword: ['blade', 'slash', 'metal', 'clang'],
            door: ['creak', 'open', 'slam', 'knock'],
            rain: ['water', 'drip', 'storm', 'wet'],
            fire: ['flame', 'crackle', 'burn', 'torch'],
            wind: ['breeze', 'gust', 'howl', 'whoosh'],
            walk: ['footstep', 'step', 'boots'],
            horse: ['gallop', 'hooves', 'neigh'],
            fight: ['battle', 'combat', 'clash', 'war'],
            magic: ['spell', 'enchant', 'arcane', 'mystic'],
            monster: ['creature', 'beast', 'roar', 'growl'],
            forest: ['trees', 'leaves', 'birds', 'nature'],
            tavern: ['crowd', 'mug', 'inn', 'chatter'],
            ocean: ['waves', 'sea', 'water', 'shore'],
            night: ['crickets', 'owl', 'dark', 'nocturnal']
        };
        
        // Expand tokens with synonyms
        const expanded = new Set(tokens);
        for (const token of tokens) {
            if (synonyms[token]) synonyms[token].forEach(s => expanded.add(s));
        }
        
        return this.soundCatalog
            .filter(s => {
                if (type && s.type !== type) return false;
                if (this.disabledSounds.has(s.id)) return false;
                return true;
            })
            .map(s => {
                let score = 0;
                const id = s.id.toLowerCase();
                const tags = (s.tags || []).map(t => t.toLowerCase());
                
                for (const token of expanded) {
                    // Exact tag match (highest value)
                    if (tags.includes(token)) score += 3;
                    // Partial tag match
                    else if (tags.some(t => t.includes(token) || token.includes(t))) score += 1.5;
                    // ID contains token
                    if (id.includes(token)) score += 2;
                }
                return { sound: s, score };
            })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(r => r.sound);
    }
    
    // ===== PIXABAY INTEGRATION =====
    async searchPixabay(query, type) {
        // Note: Pixabay's free API doesn't include a dedicated audio endpoint
        // We'll use it for future expansion or premium tier
        // For now, this serves as a placeholder that gracefully falls back to Freesound
        
        if (!this.pixabayApiKey) return null;
        
        try {
            // Pixabay audio API is not available in free tier
            // This would be the endpoint if/when audio becomes available:
            // https://pixabay.com/api/sounds/
            
            debugLog('Pixabay audio API not available in free tier; using Freesound');
            return null;
            
        } catch (error) {
            console.error('Pixabay search error:', error);
            return null;
        }
    }

    // ===== DUAL-SOURCE AUDIO SEARCH =====
    async searchAudio(query, type) {
        // Try local Saved sounds first (primary source for local prototype)
        if (this.savedSounds?.files?.length > 0) {
            const local = this.searchLocalSaved(query, type);
            if (local) {
                try { this.soundCache.set(`${type}:${query}`, local); } catch (_) {}
                return local;
            }
        }
        // Try Pixabay first if key is set (faster when available)
        // Note: Currently falls back immediately as free tier has no audio
        let url = null;
        
        if (this.pixabayApiKey) {
            url = await this.searchPixabay(query, type);
            if (url) {
                debugLog(`✓ Found via Pixabay: ${query}`);
                return url;
            }
        }
        
        // Freesound is primary source (comprehensive library)
        if (this.freesoundApiKey) {
            url = await this.searchFreesound(query, type);
            if (url) {
                debugLog(`✓ Found via Freesound: ${query}`);
                return url;
            }
        }
        
        if (!this.pixabayApiKey && !this.freesoundApiKey && !this._noApiKeysWarned) {
            this._noApiKeysWarned = true;
            debugLog('No external audio API keys — using local sound library only.');
        }
        
        return url;
    }

    // ===== LOCAL SAVED SOUNDS =====
    searchLocalSaved(query, type) {
        try {
            if (!this.savedSounds?.files?.length) return null;
            
            // Use TF-IDF style matching from trigger system
            const match = tfidfMatch(query, type, this.savedSounds.files);
            if (match) {
                const encoded = encodeURI(match.file);
                // Prepend CDN base for relative paths so all consumers get an absolute URL
                const cdnBase = (typeof window !== 'undefined' && window.__R2_PUBLIC_URL) || '';
                const url = (cdnBase && !/^https?:\/\//i.test(encoded))
                    ? `${cdnBase.replace(/\/$/, '')}/${encoded.replace(/^\//, '')}`
                    : encoded;
                debugLog(`Found via Saved sounds: ${query} -> ${match.name}`);
                return url;
            }
            return null;
        } catch(_) { return null; }
    }

    // ===== FREESOUND.ORG INTEGRATION =====
    async searchFreesound(query, type) {
        // Check if Freesound API key is set
        if (!this.freesoundApiKey) {
            debugLog(`Freesound not configured. Would search for: ${query} (${type})`);
            this.updateStatus('Click "Setup Freesound API" to enable real sounds');
            return null;
        }
        
        // Simplify queries to improve CC0 results
        let searchQuery = query;
        let fallbackQueries = []; // Progressive fallbacks for music
        if (type === 'music') {
            const keywords = query.toLowerCase();
            // Check for Christmas-related terms (including "jingle bells" from AI)
            if (keywords.includes('christmas') || keywords.includes('holiday') || keywords.includes('festive') || 
                keywords.includes('xmas') || keywords.includes('jingle') || keywords.includes('carol') || 
                keywords.includes('sleigh')) {
                searchQuery = 'christmas music';
                fallbackQueries = ['jingle bells', 'holiday music', 'festive music', 'winter music'];
            }
            else if (keywords.includes('halloween') || keywords.includes('spooky')) {
                searchQuery = 'spooky halloween';
                fallbackQueries = ['halloween music', 'spooky music'];
            }
            else if (keywords.includes('epic') || keywords.includes('orchestral')) {
                searchQuery = 'epic orchestral';
                fallbackQueries = ['orchestral', 'epic music'];
            }
            else if (keywords.includes('calm') || keywords.includes('peaceful')) {
                searchQuery = 'calm ambient';
                fallbackQueries = ['peaceful music', 'ambient music'];
            }
            else if (keywords.includes('tense') || keywords.includes('suspense')) {
                searchQuery = 'dark ambient';
                fallbackQueries = ['suspense music', 'ambient music'];
            }
            else if (keywords.includes('horror') || keywords.includes('eerie')) {
                searchQuery = 'horror ambience';
                fallbackQueries = ['dark ambient', 'ambient music'];
            }
            else if (keywords.includes('forest') || keywords.includes('nature')) {
                searchQuery = 'nature ambient';
                fallbackQueries = ['ambient music'];
            }
            else if (keywords.includes('sing') || keywords.includes('vocal') || keywords.includes('melody')) {
                searchQuery = 'instrumental backing';
                fallbackQueries = ['instrumental', 'ambient music'];
            }
            else if (keywords.includes('ambient')) {
                searchQuery = 'ambient music';
                fallbackQueries = [];
            }
            else {
                searchQuery = 'ambient music';
                fallbackQueries = [];
            }
            debugLog(`Simplified music query: "${query}" → "${searchQuery}"${fallbackQueries.length ? ` (fallbacks: ${fallbackQueries.join(', ')})` : ''}`);
        } else if (type === 'sfx') {
            // Simplify common SFX queries that often fail
            const keywords = query.toLowerCase();
            if (keywords.includes('footsteps') && keywords.includes('leaves')) searchQuery = 'footsteps grass';
            else if (keywords.includes('dragon') && keywords.includes('roar')) searchQuery = 'monster roar';
            else if (keywords.includes('birds') && keywords.includes('chirp')) searchQuery = 'birds chirping';
            else if (keywords.includes('storm') && keywords.includes('brewing')) searchQuery = 'thunder storm';
            else searchQuery = query; // keep original for SFX
            
            if (searchQuery !== query) {
                debugLog(`Simplified SFX query: "${query}" → "${searchQuery}"`);
            }
        }
        
            // Check cache first for faster response
        const cacheKey = `${type}:${searchQuery}`;
            if (this.soundCache.has(cacheKey)) {
            debugLog(`Found in cache: ${searchQuery}`);
            return this.soundCache.get(cacheKey);
        }
        
        try {
            this.updateStatus(`Searching Freesound for: ${searchQuery}...`);
            
            // Build search parameters with CC0 license filter
            const baseFilter = type === 'music' ? 'duration:[30 TO *] tag:music' : 'duration:[0.5 TO 10]';
            const params = new URLSearchParams({
                query: searchQuery,
                filter: `${baseFilter} license:\"Creative Commons 0\"`,
                fields: 'id,name,previews,duration,license',
                sort: 'rating_desc',
                page_size: type === 'music' ? 10 : 3
            });
            
            const response = await fetch(`https://freesound.org/apiv2/search/text/?${params}`, {
                headers: {
                    'Authorization': `Token ${this.freesoundApiKey}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.updateStatus('❌ Invalid Freesound API key');
                    alert('Invalid Freesound API Key!\n\nPlease:\n1. Check your key at freesound.org/apiv2/apply\n2. Click "Setup Freesound API"\n3. Enter the correct key');
                    return null;
                }
                throw new Error(`Freesound API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                // Try to select a preview that hasn't played recently (for variety)
                let chosen = null;
                for (const r of data.results) {
                    const url = r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'];
                    if (!url) continue;
                    if (type === 'music' && this.recentlyPlayed.has(url)) {
                        continue; // try to avoid repeats for music
                    }
                    chosen = { name: r.name, duration: r.duration, url };
                    break;
                }
                // Fallback to the first if all are recently played or filtered out
                if (!chosen) {
                    const r = data.results[0];
                    const url = r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'];
                    chosen = { name: r.name, duration: r.duration, url };
                }

                debugLog(`Found sound: "${chosen.name}" (${chosen.duration}s)`);

                    // Cache all sounds for instant playback on repeat
                    this.soundCache.set(cacheKey, chosen.url);

                // Track recently played to reduce back-to-back repeats
                if (chosen.url) {
                    this.recentlyPlayed.add(chosen.url);
                    // Keep recent list to a reasonable size
                    if (this.recentlyPlayed.size > 20) {
                        const first = this.recentlyPlayed.values().next().value;
                        this.recentlyPlayed.delete(first);
                    }
                }

                return chosen.url;
            } else {
                debugLog(`No CC0 sounds found for: ${searchQuery}`);
                
                // For music, try fallback with broader license (CC-BY) and progressive fallback queries
                if (type === 'music') {
                    const queriesToTry = [searchQuery, ...fallbackQueries];
                    
                    for (const tryQuery of queriesToTry) {
                        debugLog(`Retrying music search with CC-BY for: "${tryQuery}"...`);
                        const fallbackParams = new URLSearchParams({
                            query: tryQuery,
                            filter: `duration:[30 TO *] tag:music`,
                            fields: 'id,name,previews,duration,license',
                            sort: 'rating_desc',
                            page_size: 10
                        });
                        
                        const fallbackResponse = await fetch(`https://freesound.org/apiv2/search/text/?${fallbackParams}`, {
                            headers: {
                                'Authorization': `Token ${this.freesoundApiKey}`
                            }
                        });
                        
                        if (fallbackResponse.ok) {
                            const fallbackData = await fallbackResponse.json();
                            if (fallbackData.results && fallbackData.results.length > 0) {
                                const r = fallbackData.results[0];
                                const url = r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'];
                                if (url) {
                                 debugLog(`✓ Found music (${r.license}): "${r.name}" (${r.duration}s)`);
                                    this.soundCache.set(cacheKey, url);
                                    this.recentlyPlayed.add(url);
                                    return url;
                                }
                            }
                        }
                    }
                    
                    console.log(`No music found after all fallbacks`);
                }
                
                return null;
            }
            
        } catch (error) {
            console.error('Freesound search error:', error);
            this.updateStatus('Freesound search failed, retrying...');
            return null;
        }
    }
    
    // ===== AUDIO PLAYBACK =====
    
    // Duck music volume when SFX plays
    duckMusic(duration = 0.6) {
        if (this.duckingInProgress) return;
        if (!this.currentMusic || !this.currentMusic._howl) return;
        
        const p = this.getDuckParams();
        this.duckingInProgress = true;
        
        const howl = this.currentMusic._howl;
        const currentVol = howl.volume();
        const floorMul = Math.max(0.08, Math.min(1, p.floor));
        const duckTo = Math.max(0.01, currentVol * floorMul);
        
        // Duck down
        howl.fade(currentVol, duckTo, p.attack * 1000);
        
        // Duck back up after hold + duration
        setTimeout(() => {
            howl.fade(duckTo, currentVol, p.release * 1000);
            setTimeout(() => { this.duckingInProgress = false; }, p.release * 1000);
        }, (p.attack + p.hold + duration) * 1000);
    }

    getDuckParams() {
        return duckParamsCalc(this.moodBias, this.duckParams);
    }
    
    async playAudio(url, options) {
        if (!url) return null;
        
        // Check muted categories
        const cat = options.type === 'music' ? 'music' : (options.type === 'ambience' ? 'ambience' : 'sfx');
        if (this.mutedCategories.has(cat)) return null;
        
        // Check long-lived buffer cache FIRST for instant playback
        const cachedBuffer = this.getFromBufferCache(url);
        if (cachedBuffer && options.type === 'sfx') {
            debugLog(`⚡ Playing from buffer cache: ${options.name || url}`);
            this.playBufferDirect(url, cachedBuffer, options.volume, !!options.loop);
            return { cached: true }; // Signal success
        }
        
        try {
            // For SFX, try to use Web Audio API with decoded buffers for better performance
            if (options.type === 'sfx') {
                return await this.playSFXBuffer(url, options);
            } else {
                // For music, use HTMLAudioElement (better for streaming long files)
                return await this.playMusicElement(url, options);
            }
        } catch (error) {
            console.error('Audio playback error:', error);
            this.updateStatus('⚠️ Audio playback error - sound may be blocked');
            return null;
        }
    }
    
    async playSFXBuffer(url, options) {
        // Duck music when playing SFX
        this.duckMusic(0.6);

        // Resume suspended AudioContext (mobile safety net)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try { await this.audioContext.resume(); } catch (_) {}
        }
        
        // Use Howler for SFX with spatial positioning
        const original = Math.max(0, Math.min(1, options.volume));
        // Sound variation: randomize volume ±10%
        const volumeVariation = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
        const effective = Math.max(0, Math.min(1, original * this.sfxLevel * volumeVariation));
        
        // Sound variation: randomize pitch ±5%
        const pitchVariation = 0.95 + Math.random() * 0.1; // 0.95 to 1.05
        
        // Spatial audio: use AI spatial hint with distance-based attenuation
        let az;
        let spatialVolMul = 1; // distance attenuation multiplier
        if (options.spatial) {
            const spatialMap = { left: -0.8, right: 0.8, center: 0 };
            if (options.spatial in spatialMap) {
                az = spatialMap[options.spatial];
            } else if (options.spatial === 'near') {
                // Near: centered, louder
                az = (Math.random() - 0.5) * 0.3;
                spatialVolMul = 1.15;
            } else if (options.spatial === 'far') {
                // Far: random stereo, quieter + slight pitch drop
                az = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4);
                spatialVolMul = 0.45;
            } else if (options.spatial === 'behind') {
                // Behind: wide stereo, slightly muffled (lower volume)
                az = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.3);
                spatialVolMul = 0.6;
            } else {
                az = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.5);
            }
        } else {
            az = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.5);
        }
        // Apply distance attenuation to effective volume
        const spatialEffective = Math.max(0, Math.min(1, effective * spatialVolMul));
        
        // Far sounds get slight pitch drop for distance illusion
        const spatialPitch = options.spatial === 'far' ? pitchVariation * 0.93 : pitchVariation;
        
        const sfxSrcs = this.buildSrcCandidates(url);
        const howl = new Howl({
            src: sfxSrcs,
            volume: spatialEffective,
            loop: !!options.loop,
            rate: spatialPitch,
            stereo: az,
            onload: () => {
                debugLog(`SFX loaded: ${options.name}`);
                // Cache duration for Sound Library display
                if (options.id && howl.duration() > 0) {
                    this.durationCache.set(options.id, howl.duration());
                }
                // Cache decoded buffer for next time (if using Web Audio backend)
                if (howl._sounds && howl._sounds.length > 0) {
                    const sound = howl._sounds[0];
                    if (sound._node && sound._node.bufferSource && sound._node.bufferSource.buffer) {
                        this.addToBufferCache(url, sound._node.bufferSource.buffer);
                    }
                }
            },
            onloaderror: (id, err) => {
                // Only log errors in debug mode to avoid console spam
                console.warn('SFX load error:', options.name, err, 'sources:', sfxSrcs);
                // Don't show status errors for failed sounds - they're often recoverable
            },
            onplayerror: (id, err) => {
                console.warn('SFX play error:', options.name, err, 'sources:', sfxSrcs);
                // Mobile: resume AudioContext and retry once
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => howl.play()).catch(() => {});
                }
            },
            onend: () => {
                // Looping sounds should NOT be cleaned up on each loop iteration
                if (howl.loop()) return;
                this.activeSounds.delete(id);
                this.updateSoundsList();
                howl.unload();
            }
        });
        
        const id = Date.now() + Math.random();
        const soundId = howl.play();
        this.activeSounds.set(id, { 
            _howl: howl, 
            soundId, 
            name: options.name, 
            originalVolume: original, 
            type: 'sfx',
            startTime: Date.now() // Track when SFX started for age-based cleanup
        });
        
            debugLog(`Playing SFX: ${options.name} at ${Math.round(effective * 100)}%`);
        this.updateSoundsList();
        
        // Prefetch alternates to diversify repeats
        this.prefetchAlternates(options.name).catch(e => debugLog('Prefetch alternates failed:', e.message));
        
        return { _howl: howl, soundId, name: options.name };
    }
    
    async playMusicElement(url, options) {
        const targetVol = options.volume;
        const oldHowl = this.currentMusic;
        const crossfadeMs = 2500;

        // Crossfade: fade out old music over 2.5s (old track keeps playing during fade)
        if (oldHowl && oldHowl._howl) {
            const old = oldHowl._howl;
            old.fade(old.volume(), 0, crossfadeMs);
            setTimeout(() => {
                try { old.stop(); old.unload(); } catch(_){}
            }, crossfadeMs + 100);
        }

        // Create new Howl instance for music
        const musicSrcs = this.buildSrcCandidates(url);
        const newHowl = new Howl({
            src: musicSrcs,
            html5: true,
            loop: !!options.loop,
            volume: 0,
            onload: () => debugLog(`Music loaded: ${options.name}`),
            onloaderror: (id, err) => {
                console.warn('Music load error:', options.name, err, 'sources:', musicSrcs);
                // Clear stale currentMusic reference if it points to this failed howl (#10)
                if (this.currentMusic && this.currentMusic._howl === newHowl) {
                    this.currentMusic = null;
                }
                // Blacklist the sound to avoid retrying a broken URL (#6)
                if (!this.soundFailureCache) this.soundFailureCache = new Map();
                if (options.id) this.soundFailureCache.set(options.id, Date.now());
            },
            onplayerror: (id, err) => {
                console.warn('Music play error:', options.name, err, 'sources:', musicSrcs);
            },
            onend: () => {
                // When a music track finishes, rotate to the next one
                const next = this.getNextMusicInRotation();
                if (next) {
                    const nextUrl = encodeURI(next.src);
                    this.playMusicElement(nextUrl, {
                        type: 'music',
                        name: next.id,
                        volume: targetVol,
                        loop: next.loop || true,
                        id: next.id
                    }).catch(e => debugLog('Music rotation failed:', e.message));
                }
            }
        });

        newHowl.play();
        newHowl.fade(0, targetVol, crossfadeMs);

        // Store reference with metadata
        this.currentMusic = { _howl: newHowl, name: options.name, type: options.type, volume: targetVol, id: options.id || '', query: options.name };
        this.updateSoundsList();
        
        // Update ambient bed to match new music context
        this.maybeUpdateAmbientBed();
        
        return this.currentMusic;
    }
    
    // ===== AMBIENT BED LAYERING =====
    // Persistent low-volume ambient track that runs under music for depth
    maybeUpdateAmbientBed() {
        if (!this.ambienceEnabled) return;
        const now = Date.now();
        if (now - this.lastAmbientChange < 45000) return; // Don't change too fast
        
        const mood = this.currentMood.primary;
        // Map moods to ambient tags
        const ambientMoodMap = {
            tense: ['dark', 'wind', 'dungeon'],
            happy: ['nature', 'birds', 'forest'],
            sad: ['rain', 'wind', 'night'],
            angry: ['fire', 'storm', 'battle'],
            fear: ['creepy', 'wind', 'night', 'dungeon'],
            calm: ['nature', 'forest', 'birds', 'water'],
            excited: ['crowd', 'fire', 'adventure'],
            neutral: ['ambient', 'nature', 'wind']
        };
        const targetTags = ambientMoodMap[mood] || ambientMoodMap.neutral;
        
        // Find ambience-type sounds matching mood
        const candidates = this.soundCatalog.filter(s => {
            if (s.type !== 'ambience') return false;
            if (this.disabledSounds.has(s.id)) return false;
            if (s.id === this.ambientBedId) return false; // Don't pick same
            return s.tags && s.tags.some(t => targetTags.includes(t.toLowerCase()));
        });
        
        if (candidates.length === 0) return;
        
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        this.playAmbientBed(pick);
    }
    
    playAmbientBed(catalogEntry) {
        const crossfadeMs = 3000;
        
        // Fade out current ambient bed
        if (this.ambientBed && this.ambientBed._howl) {
            const old = this.ambientBed._howl;
            old.fade(old.volume(), 0, crossfadeMs);
            setTimeout(() => { try { old.stop(); old.unload(); } catch(_){} }, crossfadeMs + 100);
        }
        
        const url = encodeURI(catalogEntry.src);
        const srcs = this.buildSrcCandidates(url);
        const howl = new Howl({
            src: srcs,
            html5: true,
            loop: true,
            volume: 0,
            onloaderror: (id, err) => console.warn('Ambient bed load error:', catalogEntry.id, err)
        });
        
        howl.play();
        howl.fade(0, this.ambientBedGain * this.musicLevel, crossfadeMs);
        
        this.ambientBed = { _howl: howl, name: catalogEntry.id };
        this.ambientBedId = catalogEntry.id;
        this.lastAmbientChange = Date.now();
        debugLog('Ambient bed:', catalogEntry.id);
    }
    
    stopAmbientBed(fadeMs = 1000) {
        if (this.ambientBed && this.ambientBed._howl) {
            const howl = this.ambientBed._howl;
            howl.fade(howl.volume(), 0, fadeMs);
            setTimeout(() => { try { howl.stop(); howl.unload(); } catch(_){} }, fadeMs + 100);
        }
        this.ambientBed = null;
        this.ambientBedId = null;
    }
    
    stopAllSounds() {
        // Stop music
        if (this.currentMusic?._howl) {
            try { this.currentMusic._howl.stop(); this.currentMusic._howl.unload(); } catch(_){}
            this.currentMusic = null;
        }
        // Stop ambient bed
        this.stopAmbientBed(300);
        // Stop procedural ambient layers
        if (this.proceduralLayers) {
            this.proceduralLayers.forEach(layer => {
                try { layer.howl.stop(); layer.howl.unload(); } catch(_){}
            });
            this.proceduralLayers.clear();
        }
        // Stop all active SFX
        this.activeSounds.forEach((soundObj, id) => {
            try { if (soundObj._howl) { soundObj._howl.stop(); soundObj._howl.unload(); } } catch(_){}
        });
        this.activeSounds.clear();
        this.updateSoundsList();
    }
    
    // ===== PROCEDURAL AMBIENT SEQUENCES =====
    // Layer multiple ambient elements driven by mood trajectory
    startProceduralAmbient() {
        if (!this.ambienceEnabled) return;
        if (this.proceduralTimer) return; // Already running
        this.updateProceduralLayers();
        // Re-evaluate layers periodically
        this.proceduralTimer = setInterval(() => this.updateProceduralLayers(), 45000);
    }
    
    stopProceduralAmbient() {
        if (this.proceduralTimer) {
            clearInterval(this.proceduralTimer);
            this.proceduralTimer = null;
        }
        this.proceduralLayers.forEach((layer, name) => {
            try { layer.howl.fade(layer.howl.volume(), 0, 2000); } catch(_){}
            setTimeout(() => { try { layer.howl.stop(); layer.howl.unload(); } catch(_){} }, 2100);
        });
        this.proceduralLayers.clear();
    }
    
    updateProceduralLayers() {
        const now = Date.now();
        if (now - this.lastProceduralUpdate < 25000) return;
        this.lastProceduralUpdate = now;
        
        const mood = this.currentMood.primary;
        const intensity = this.currentMood.intensity;
        const state = this.sceneState || 'exploration';

        // Rich scene-state-aware palettes: each entry is { tag, vol }
        // Priority: sceneState palette first, mood palette as fallback when state is neutral
        const statePalettes = {
            combat: [
                { tag: 'fire', vol: 0.12 },
                { tag: 'wind', vol: 0.10 },
                { tag: 'storm', vol: 0.14 }
            ],
            exploration: [
                { tag: 'forest', vol: 0.12 },
                { tag: 'birds', vol: 0.08 },
                { tag: 'wind', vol: 0.07 }
            ],
            dialogue: [
                { tag: 'ambient', vol: 0.08 },
                { tag: 'nature', vol: 0.06 }
            ],
            rest: [
                { tag: 'nature', vol: 0.12 },
                { tag: 'water', vol: 0.10 },
                { tag: 'birds', vol: 0.07 }
            ],
            travel: [
                { tag: 'wind', vol: 0.10 },
                { tag: 'forest', vol: 0.10 },
                { tag: 'nature', vol: 0.07 }
            ]
        };

        // Mood palettes (used to blend/override state when mood is strong)
        const moodPalettes = {
            tense: [
                { tag: 'wind', vol: 0.15 },
                { tag: 'night', vol: 0.10 },
                { tag: 'dungeon', vol: 0.12 }
            ],
            fear: [
                { tag: 'wind', vol: 0.18 },
                { tag: 'creepy', vol: 0.12 },
                { tag: 'night', vol: 0.10 }
            ],
            calm: [
                { tag: 'nature', vol: 0.15 },
                { tag: 'birds', vol: 0.10 },
                { tag: 'water', vol: 0.12 }
            ],
            happy: [
                { tag: 'birds', vol: 0.12 },
                { tag: 'nature', vol: 0.10 },
                { tag: 'forest', vol: 0.10 }
            ],
            sad: [
                { tag: 'rain', vol: 0.18 },
                { tag: 'wind', vol: 0.10 },
                { tag: 'night', vol: 0.08 }
            ],
            angry: [
                { tag: 'fire', vol: 0.15 },
                { tag: 'storm', vol: 0.18 },
                { tag: 'wind', vol: 0.12 }
            ],
            excited: [
                { tag: 'crowd', vol: 0.12 },
                { tag: 'fire', vol: 0.10 },
                { tag: 'adventure', vol: 0.10 }
            ],
            neutral: [
                { tag: 'ambient', vol: 0.10 },
                { tag: 'nature', vol: 0.08 }
            ]
        };

        // Blend: start with scene-state palette, then overlay mood palette if intensity is high
        let basePalette = statePalettes[state] || statePalettes.exploration;
        const moodPalette = moodPalettes[mood] || moodPalettes.neutral;

        let targetPalette;
        if (intensity > 0.7) {
            // High intensity: mood dominates (e.g. tense combat = wind+night+dungeon not birds)
            targetPalette = moodPalette;
        } else if (intensity > 0.4) {
            // Blend: prefer state palette but add a mood layer if it doesn't overlap
            const stateTags = new Set(basePalette.map(l => l.tag));
            const extraMoodLayers = moodPalette.filter(l => !stateTags.has(l.tag)).slice(0, 1);
            targetPalette = [...basePalette, ...extraMoodLayers];
        } else {
            // Low intensity: pure scene-state palette (calm/ambient)
            targetPalette = basePalette;
        }

        // Scale layer count: low intensity = fewer layers, high = up to maxProceduralLayers
        const layerCount = Math.max(1, Math.min(this.maxProceduralLayers, Math.round(0.5 + intensity * this.maxProceduralLayers)));
        const desiredLayers = targetPalette.slice(0, layerCount);
        
        // Remove layers no longer in palette
        const desiredTags = new Set(desiredLayers.map(l => l.tag));
        this.proceduralLayers.forEach((layer, tag) => {
            if (!desiredTags.has(tag)) {
                layer.howl.fade(layer.howl.volume(), 0, 3000);
                setTimeout(() => { try { layer.howl.stop(); layer.howl.unload(); } catch(_){} }, 3100);
                this.proceduralLayers.delete(tag);
            }
        });
        
        // Add or adjust desired layers
        for (const desired of desiredLayers) {
            if (this.proceduralLayers.has(desired.tag)) {
                // Adjust volume of existing layer
                const existing = this.proceduralLayers.get(desired.tag);
                const targetVol = desired.vol * this.musicLevel * Math.max(0.3, intensity);
                existing.howl.fade(existing.howl.volume(), targetVol, 2000);
                continue;
            }
            
            // Find a matching ambience sound from catalog
            const candidates = this.soundCatalog.filter(s =>
                s.type === 'ambience' && !this.disabledSounds.has(s.id) &&
                s.tags && s.tags.some(t => t.toLowerCase().includes(desired.tag))
            );
            if (candidates.length === 0) continue;
            
            // Exclude recently played IDs so the same track doesn't repeat across scene transitions
            if (!this._recentProceduralIds) this._recentProceduralIds = new Set();
            const freshCandidates = candidates.filter(c => !this._recentProceduralIds.has(c.id));
            const pool = freshCandidates.length > 0 ? freshCandidates : candidates;
            const pick = pool[Math.floor(Math.random() * pool.length)];
            // Track recently used; evict oldest when set exceeds half of the tag's catalog size
            this._recentProceduralIds.add(pick.id);
            const maxRecent = Math.max(3, Math.floor(candidates.length / 2));
            if (this._recentProceduralIds.size > maxRecent) {
                this._recentProceduralIds.delete(this._recentProceduralIds.values().next().value);
            }
            const url = encodeURI(pick.src);
            const srcs = this.buildSrcCandidates(url);
            const targetVol = desired.vol * this.musicLevel * Math.max(0.3, intensity);
            
            const howl = new Howl({
                src: srcs,
                html5: true,
                loop: true,
                volume: 0,
                onloaderror: (id, err) => {
                    console.warn('Procedural layer load error:', pick.id, err);
                    this.proceduralLayers.delete(desired.tag);
                }
            });
            
            howl.play();
            howl.fade(0, targetVol, 3000);
            this.proceduralLayers.set(desired.tag, { howl, catalogId: pick.id, volume: targetVol });
            debugLog('Procedural layer added:', desired.tag, '->', pick.id, `(state=${state}, mood=${mood})`);
        }
    }
    
    fadeOutAudio(audio, ms = 300) {
        if (!audio) return;
        if (audio._howl) {
            audio._howl.fade(audio._howl.volume(), 0, ms);
            setTimeout(() => {
                try { audio._howl.stop(); audio._howl.unload(); } catch(_){}
            }, ms + 50);
        } else if (audio.pause) {
            // Legacy HTMLAudioElement fallback
            const steps = 12;
            const stepTime = Math.max(10, Math.round(ms / steps));
            let i = 0;
            const startVol = audio.volume || 1;
            const timer = setInterval(() => {
                i++;
                const t = i / steps;
                audio.volume = Math.max(0, startVol * (1 - t));
                if (i >= steps) { clearInterval(timer); try { audio.pause(); } catch (_){} }
            }, stepTime);
        }
    }
    
    calculateVolume(intensity) {
        return calcVolume(intensity, this.minVolume, this.maxVolume);
    }

    getMusicTargetGain() {
        const moodMul = 0.85 + this.moodBias * 0.3; // modest bias
        return Math.max(0, Math.min(1, (this.currentMusicBase || 0.5) * moodMul * this.musicLevel));
    }

    computeNormalizationGain(buffer) {
        return computeNormGain(buffer);
    }

    /** Prune stale entries from caches to prevent unbounded growth */
    _cleanupCaches() {
        const now = Date.now();
        // Prune soundFailureCache entries older than 5 minutes
        if (this.soundFailureCache?.size > 0) {
            for (const [key, time] of this.soundFailureCache) {
                if (now - time > 300000) this.soundFailureCache.delete(key);
            }
        }
        // Cap activeBuffers at 50 entries (remove oldest-added)
        if (this.activeBuffers?.size > 50) {
            const excess = this.activeBuffers.size - 50;
            const iter = this.activeBuffers.keys();
            for (let i = 0; i < excess; i++) { this.activeBuffers.delete(iter.next().value); }
        }
        // Prune instant keyword cooldowns older than 10s
        if (this.instantKeywordCooldowns?.size > 0) {
            for (const [key, time] of this.instantKeywordCooldowns) {
                if (now - time > 10000) this.instantKeywordCooldowns.delete(key);
            }
        }
    }
    
    updateSoundsList() {
        const container = document.getElementById('currentSounds');
        if (!container) return;
        container.innerHTML = '';
        const latencyTag = this._lastSoundLatency ? `<span class="latency-badge">${this._lastSoundLatency}ms</span>` : '';
        
        if (this.currentMusic) {
            const playing = this.currentMusic._howl ? this.currentMusic._howl.playing() : (!this.currentMusic.paused);
            if (playing) {
                const item = document.createElement('div');
                item.className = 'sound-item';
                const vol = this.currentMusic._howl ? 
                    Math.round(this.currentMusic._howl.volume() * 100) :
                    Math.round((this.currentMusic.volume || 1) * 100);
                const name = this.currentMusic.name || 'Unknown';
                item.innerHTML = `
                    <span class="sound-type">Music</span>
                    <span class="sound-name">${escapeHtml(name)}</span>
                    <span class="sound-volume">${vol}%</span>
                `;
                container.appendChild(item);
            }
        }
        
        this.activeSounds.forEach((soundObj) => {
            const item = document.createElement('div');
            item.className = 'sound-item';
            const name = soundObj.name || (soundObj.dataset ? soundObj.dataset.name : 'Unknown');
            let volume = 50;
            if (soundObj._howl) {
                volume = Math.round(soundObj._howl.volume() * 100);
            } else if (soundObj.gainNode) {
                volume = Math.round(soundObj.gainNode.gain.value * 100);
            } else if (soundObj.volume !== undefined) {
                volume = Math.round(soundObj.volume * 100);
            }
            
            item.innerHTML = `
                <span class="sound-type">SFX</span>
                <span class="sound-name">${escapeHtml(name)}</span>
                <span class="sound-volume">${volume}%</span>
                ${latencyTag}
            `;
            container.appendChild(item);
        });
        
        if (container.children.length === 0) {
            container.innerHTML = '<div class="sound-item inactive">No sounds playing</div>';
        }

        // SFX pulse on visualizer
        if (this.activeSounds.size > 0) {
            const vizSection = document.getElementById('visualizerSection');
            if (vizSection && !vizSection.classList.contains('sfx-pulse')) {
                vizSection.classList.add('sfx-pulse');
                setTimeout(() => vizSection.classList.remove('sfx-pulse'), 400);
            }
        }
    }
    
    // ===== VISUALIZER =====
    setupVisualizer() {
        this.canvas = document.getElementById('visualizer');
        this.canvasCtx = this.canvas.getContext('2d');
        this.resizeCanvas();
        this._resizeHandler = () => this.resizeCanvas();
        window.addEventListener('resize', this._resizeHandler);
    }
    
    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }
    
    startVisualizer() {
        // Mode-specific color palettes
        const MODE_COLORS = {
            horror:    { low: '#8b0000', mid: '#cf6679', high: '#ff5252' },
            christmas: { low: '#b71c1c', mid: '#ff9800', high: '#ffc107' },
            halloween: { low: '#e65100', mid: '#ff9800', high: '#ffcc02' },
            dnd:       { low: '#4a148c', mid: '#8a2be2', high: '#bb86fc' },
            bedtime:   { low: '#1a237e', mid: '#64b5f6', high: '#e1bee7' },
            sing:      { low: '#004d40', mid: '#03dac6', high: '#b2ff59' },
            auto:      { low: '#8a2be2', mid: '#bb86fc', high: '#03dac6' },
        };

        let frameSkip = 0;
        const draw = () => {
            this.visualizerAnimationId = requestAnimationFrame(draw);
            
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);
            
            const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
            if (avg < 1) {
                frameSkip++;
                if (frameSkip < 10) return;
                frameSkip = 0;
            } else {
                frameSkip = 0;
            }
            
            this.canvasCtx.fillStyle = '#000';
            this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            const colors = MODE_COLORS[this.currentMode] || MODE_COLORS.auto;
            const barWidth = (this.canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            const gradient = this.canvasCtx.createLinearGradient(0, this.canvas.height, 0, 0);
            gradient.addColorStop(0, colors.low);
            gradient.addColorStop(0.5, colors.mid);
            gradient.addColorStop(1, colors.high);
            this.canvasCtx.fillStyle = gradient;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * this.canvas.height * 0.8;
                
                this.canvasCtx.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
    }
    
    stopVisualizer() {
        if (this.visualizerAnimationId) {
            cancelAnimationFrame(this.visualizerAnimationId);
        }
    }
    
    // ===== CONTROL METHODS =====
    async testMicrophone() {
        const testPassages = [
            "The knight drew his sword and stepped into the dark forest. Thunder rumbled across the sky as rain began to fall.",
            "A dragon roared from the mountain above. The wizard raised his staff and cast a bolt of lightning through the storm.",
            "The rogue crept through the shadowy castle corridor. An owl hooted outside as wind howled through the broken window.",
            "Fire crackled in the old tavern hearth. The warrior set down her shield and listened to the wolves howling in the distance."
        ];
        const passage = testPassages[Math.floor(Math.random() * testPassages.length)];
        const passageWords = passage.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean);

        // Check mic permission first
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (error) {
            console.error('Microphone test failed:', error);
            if (error.name === 'NotAllowedError') {
                this.updateStatus('Microphone access denied. Please check browser permissions.');
                alert('Microphone Permission Denied!\n\nTo fix:\n1. Click the site information icon in the address bar\n2. Set Microphone to "Allow"\n3. Refresh the page\n4. Try again');
            } else if (error.name === 'NotFoundError') {
                this.updateStatus('No microphone found. Please connect a microphone.');
            } else {
                this.updateStatus('Microphone test failed: ' + error.message);
            }
            return;
        }
        stream.getTracks().forEach(track => track.stop());

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.updateStatus('Speech recognition not supported in this browser.');
            return;
        }

        // Build the test modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'micTestModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:620px;">
                <h2>Microphone Test</h2>
                <p style="color:#aaa;margin-bottom:12px;">Read the passage below out loud. Words will highlight as the app hears them.</p>
                <div id="micTestPassage" style="font-size:1.15rem;line-height:1.8;margin:16px 0;text-align:left;padding:16px;background:rgba(0,0,0,0.3);border-radius:12px;">${
                    passage.split(/\s+/).map((w, i) => `<span class="mic-test-word" data-idx="${i}" style="padding:2px 3px;border-radius:4px;transition:background 0.2s;">${w}</span>`).join(' ')
                }</div>
                <p id="micTestHearing" style="color:#888;font-size:0.9rem;min-height:1.4em;">Listening...</p>
                <button id="micTestDone" class="btn-primary" style="margin-top:14px;display:none;padding:10px 28px;border-radius:10px;background:#8a2be2;color:#fff;border:none;cursor:pointer;font-size:1rem;">See Results</button>
            </div>
        `;
        document.body.appendChild(modal);

        const heardWords = new Set();
        const allSpoken = [];
        let finished = false;

        const testRecognition = new SpeechRecognition();
        testRecognition.continuous = true;
        testRecognition.interimResults = true;
        testRecognition.lang = 'en-US';

        const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

        const processTranscript = (transcript) => {
            const words = transcript.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean);
            for (const w of words) {
                const nw = normalize(w);
                if (!nw) continue;
                for (let pi = 0; pi < passageWords.length; pi++) {
                    if (heardWords.has(pi)) continue;
                    if (this.eqLoose(normalize(passageWords[pi]), nw)) {
                        heardWords.add(pi);
                        const span = modal.querySelector(`.mic-test-word[data-idx="${pi}"]`);
                        if (span) span.style.background = 'rgba(76,175,80,0.35)';
                    }
                }
            }
            const hearingEl = document.getElementById('micTestHearing');
            if (hearingEl) hearingEl.textContent = `Hearing: "${transcript}"`;
        };

        testRecognition.onresult = (event) => {
            let full = '';
            for (let i = 0; i < event.results.length; i++) {
                full += event.results[i][0].transcript + ' ';
                if (event.results[i].isFinal) {
                    allSpoken.push(event.results[i][0].transcript);
                }
            }
            processTranscript(full.trim());
        };

        testRecognition.onerror = (event) => {
            if (event.error === 'no-speech') return; // ignore silence
            const hearingEl = document.getElementById('micTestHearing');
            if (hearingEl) hearingEl.textContent = `Error: ${event.error}`;
        };

        testRecognition.onend = () => {
            // Restart if not finished (browser may stop after silence)
            if (!finished) {
                try { testRecognition.start(); } catch(_) {}
            }
        };

        // Auto-finish after 30s or let user click Done
        const autoTimeout = setTimeout(() => showResults(), 30000);

        const doneBtn = document.getElementById('micTestDone');
        // Show Done button after 3 seconds so user can finish early
        setTimeout(() => { if (doneBtn) doneBtn.style.display = 'inline-block'; }, 3000);

        const showResults = () => {
            if (finished) return;
            finished = true;
            clearTimeout(autoTimeout);
            try { testRecognition.stop(); } catch(_) {}

            const total = passageWords.length;
            const heard = heardWords.size;
            const pct = Math.round((heard / total) * 100);

            // Build word-by-word report
            const wordReport = passageWords.map((w, i) => {
                const ok = heardWords.has(i);
                return `<span style="padding:2px 5px;border-radius:4px;margin:2px;display:inline-block;background:${ok ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'};">${passage.split(/\s+/)[i]}</span>`;
            }).join(' ');

            let rating, ratingColor;
            if (pct >= 90) { rating = 'Excellent'; ratingColor = '#4caf50'; }
            else if (pct >= 70) { rating = 'Good'; ratingColor = '#8bc34a'; }
            else if (pct >= 50) { rating = 'Fair'; ratingColor = '#ff9800'; }
            else { rating = 'Needs Improvement'; ratingColor = '#f44336'; }

            const missedWords = passageWords
                .map((w, i) => heardWords.has(i) ? null : passage.split(/\s+/)[i])
                .filter(Boolean);

            // Build tiered recommendations based on accuracy
            let tips = '';
            if (pct < 100) {
                const tipItems = [];
                if (pct < 50) {
                    tipItems.push('Open your device sound settings and turn your <strong>microphone input volume up to at least 80%</strong>');
                    tipItems.push('Make sure the correct microphone is selected in your browser — click the padlock/site-info icon in the address bar and check Microphone permissions');
                    tipItems.push('If using a laptop built-in mic, try plugging in a <strong>headset or external microphone</strong> for much better results');
                }
                if (pct < 70) {
                    tipItems.push('Move <strong>closer to the microphone</strong> — ideally within 30cm / 1 foot');
                    tipItems.push('Reduce <strong>background noise</strong> — close windows, turn off fans, TV, or music');
                    tipItems.push('Speak at a <strong>steady, moderate pace</strong> — avoid rushing or mumbling');
                }
                if (pct < 90) {
                    tipItems.push('Pronounce each word <strong>clearly and fully</strong> — don\'t trail off at the end of sentences');
                    tipItems.push('Avoid <strong>pausing too long</strong> between words — the mic may stop listening during silence');
                }
                if (pct >= 70 && pct < 100) {
                    tipItems.push('A few missed words is normal — the app is designed to keep up even when it misses some');
                }
                tips = `
                    <div style="text-align:left;background:rgba(255,255,255,0.05);border-radius:10px;padding:14px 18px;margin-bottom:14px;">
                        <p style="color:#bb86fc;font-weight:bold;margin-bottom:8px;font-size:0.95rem;">Recommendations to improve accuracy:</p>
                        <ul style="color:#aaa;font-size:0.85rem;margin:0;padding-left:20px;line-height:1.7;">
                            ${tipItems.map(t => `<li>${t}</li>`).join('')}
                        </ul>
                    </div>`;
            }

            const contentEl = modal.querySelector('.modal-content');
            contentEl.innerHTML = `
                <h2>Test Results</h2>
                <p style="font-size:2rem;font-weight:bold;color:${ratingColor};margin:10px 0;">${rating}</p>
                <p style="color:#ccc;margin-bottom:6px;">${heard} of ${total} words recognised (${pct}%)</p>
                <div style="background:rgba(0,0,0,0.2);height:12px;border-radius:6px;margin:8px 0 16px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${ratingColor};border-radius:6px;transition:width 0.5s;"></div>
                </div>
                <p style="color:#aaa;margin-bottom:8px;font-size:0.9rem;">Green = heard, Red = missed</p>
                <div style="font-size:1.05rem;line-height:1.8;text-align:left;padding:14px;background:rgba(0,0,0,0.3);border-radius:12px;margin-bottom:14px;">
                    ${wordReport}
                </div>
                ${missedWords.length > 0 ? `<p style="color:#f44336;font-size:0.9rem;margin-bottom:14px;">Missed words: <strong>${missedWords.join(', ')}</strong></p>` : ''}
                ${tips}
                <button id="micTestClose" class="btn-primary" style="padding:10px 28px;border-radius:10px;background:#8a2be2;color:#fff;border:none;cursor:pointer;font-size:1rem;">Close</button>
                <button id="micTestRetry" class="btn-primary" style="padding:10px 28px;border-radius:10px;background:transparent;color:#bb86fc;border:2px solid #8a2be2;cursor:pointer;font-size:1rem;margin-left:10px;">Try Again</button>
            `;

            document.getElementById('micTestClose').addEventListener('click', () => {
                modal.remove();
                this.updateStatus(pct >= 70 ? 'Mic test passed — ready to listen.' : 'Mic test done — check tips above to improve recognition.', pct >= 70 ? 'success' : 'warning');
            });
            document.getElementById('micTestRetry').addEventListener('click', () => {
                modal.remove();
                this.testMicrophone();
            });
        };

        if (doneBtn) doneBtn.addEventListener('click', showResults);

        testRecognition.start();
        this.updateStatus('Mic test: read the passage aloud...');
    }
    
    async startListening() {
        // Auto-set to auto mode if not set
        if (!this.currentMode) {
            this.selectMode('auto');
        }
        
        // Check for API key (needed for AI analysis)
        const apiKey = getOpenAIKey();
        if (!apiKey && !this.backendAvailable) {
            this.updateStatus('Please set your OpenAI API key to enable AI analysis', 'error');
            return;
        }
        
        // Check if speech recognition is available
        if (!this.recognition) {
            this.updateStatus('⚠️ Speech recognition not initialized. Please use a supported browser.', 'error');
            return;
        }

        // Show context modal before starting
        this.showStoryContextModal();
    }

    showStoryContextModal() {
        const modal = document.getElementById('storyContextModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideStoryContextModal() {
        const modal = document.getElementById('storyContextModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async startListeningWithContext() {
        this.isListening = true;
        this.sessionStartTime = Date.now();
        
        // Start procedural ambient layering
        this.startProceduralAmbient();
        
        // Resume audio context if suspended (browser requirement)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.error('Failed to resume audio context:', error);
            }
        }

        // Start mic intensity analyser now (deferred from init for mobile compatibility)
        if (!this._micAnalyser) {
            this._setupMicIntensityAnalyser().catch(() => {});
        }
        
        // Update UI first
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const visualizerSection = document.querySelector('.visualizer-section');
        
        if (startBtn) startBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');
        if (visualizerSection) visualizerSection.classList.add('listening');
        
        // Show mic indicator
        const micInd = document.getElementById('micIndicator');
        if (micInd) micInd.classList.add('active');
        
        // Start visualizer
        this.startVisualizer();
        
        // Start speech recognition
        try {
            this.recognition.start();
            this.updateStatus('Requesting microphone... Please speak!');
            
            // Add helpful tip after 3 seconds if no speech detected
            setTimeout(() => {
                if (this.isListening && this.transcriptBuffer.length === 0) {
                    this.updateStatus('Tip: Speak clearly and close to your microphone');
                }
            }, 3000);
            
            // Start periodic live analysis while listening (only if predictions enabled)
            if (this.analysisTimer) clearInterval(this.analysisTimer);
            this.lastAnalysisTime = 0;
            if (this.predictionEnabled) {
                this.analysisTimer = setInterval(() => this.maybeAnalyzeLive(), 1000); // Check every second for faster response
            }
            
        } catch (error) {
            console.error('Failed to start recognition:', error);
            
            if (error.message && error.message.includes('already started')) {
                // Recognition already running, that's fine
                this.updateStatus('Listening... Speak clearly!');
            } else {
                this.updateStatus('⚠️ Failed to start speech recognition. Check microphone permissions and browser compatibility.', 'error');
                this.isListening = false;
                this.stopListening();
            }
        }

        // Begin preloading likely SFX shortly after starting (non-blocking, no overlay here)
        const version = ++this.preloadVersion;
        setTimeout(() => this.preloadSfxForCurrentMode(version), 300);
    }
    
    stopListening() {
        this.isListening = false;
        this.currentInterim = '';
        // Cancel pending silence-triggered analysis timer
        if (this._silenceAnalysisTimer) {
            clearTimeout(this._silenceAnalysisTimer);
            this._silenceAnalysisTimer = null;
        }
        this._pendingAnalysisTranscript = null;
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
        if (this._cacheCleanupInterval) {
            clearInterval(this._cacheCleanupInterval);
            this._cacheCleanupInterval = null;
        }
        
        // Stop procedural ambient
        this.stopProceduralAmbient();
        // Stop ambient bed
        this.stopAmbientBed();
        
        // Stop speech recognition
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                    console.warn('Error stopping recognition:', error);
            }
        }
        
        // Stop all audio completely
        if (this.currentMusic) {
            try {
                if (this.currentMusic._howl) {
                    this.currentMusic._howl.stop();
                    this.currentMusic._howl.unload();
                } else if (this.currentMusic.pause) {
                    this.currentMusic.pause();
                }
            } catch (e) {
                    console.warn('Error stopping music:', e);
            }
            this.currentMusic = null;
        }
        
        if (this.currentMusicSource) {
            try {
                this.currentMusicSource.disconnect();
            } catch (e) {}
            this.currentMusicSource = null;
        }
        
        this.activeSounds.forEach(soundObj => {
            try {
                if (soundObj._howl) {
                    soundObj._howl.stop();
                    soundObj._howl.unload();
                } else if (soundObj.source) {
                    // Web Audio buffer source
                    soundObj.source.stop();
                } else if (soundObj.pause) {
                    // HTMLAudioElement
                    soundObj.pause();
                    soundObj.currentTime = 0;
                }
            } catch (e) {
                    console.warn('Error stopping sound:', e);
            }
        });
        this.activeSounds.clear();
        
        // Update UI
        const startBtnEl = document.getElementById('startBtn');
        const stopBtnEl = document.getElementById('stopBtn');
        const vizSection = document.querySelector('.visualizer-section');
        if (startBtnEl) startBtnEl.classList.remove('hidden');
        if (stopBtnEl) stopBtnEl.classList.add('hidden');
        if (vizSection) vizSection.classList.remove('listening');
        
        // Hide mic indicator
        const micInd = document.getElementById('micIndicator');
        if (micInd) micInd.classList.remove('active');
        
        // Stop visualizer
        this.stopVisualizer();
        
        // Clear canvas
        if (this.canvasCtx && this.canvas) {
            this.canvasCtx.fillStyle = '#000';
            this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Reset CB listen mode if active
        if (this.cbListenMode) {
            this.cbListenMode = false;
            const listenBtn = document.getElementById('cbListenToggle');
            const listenStatus = document.getElementById('cbListenStatus');
            if (listenBtn) { listenBtn.textContent = 'Listen'; listenBtn.classList.remove('cb-listen-active'); }
            if (listenStatus) listenStatus.classList.add('hidden');
        }

        this.updateStatus('Stopped. Ready to listen again.');
        this.updateSoundsList();
    }
    
    /**
     * Update status message with optional level for visual feedback
     * @param {string} message - Status message to display
     * @param {string} level - Level: 'info' (default), 'error', 'warning', 'success'
     */
    updateStatus(message, level = 'info') {
        const statusEl = document.getElementById('statusText');
        if (!statusEl) {
            console.warn('statusText element not found');
                debugLog('Status:', message);
            return;
        }
        
        statusEl.textContent = message;
        
        // Remove previous level classes
        statusEl.classList.remove('status-info', 'status-error', 'status-warning', 'status-success');
        
        // Add appropriate class based on level
        statusEl.classList.add(`status-${level}`);
        
        // Log with appropriate console method
        switch (level) {
            case 'error':
                console.error('Status:', message);
                break;
            case 'warning':
                console.warn('Status:', message);
                break;
            case 'success':
                 debugLog('✓ Status:', message);
                break;
            default:
                 debugLog('Status:', message);
        }
    }

    // ===== VOICE COMMANDS =====
    handleVoiceCommands(text) {
        const t = text.toLowerCase();
        let handled = false;
        const say = (msg) => this.updateStatus(msg);
        if (/\b(skip|next) (track|song|music)\b/.test(t)) {
            if (this.currentMusic) { this.fadeOutAudio(this.currentMusic, 300); }
            this.updateStatus('Skipping track...');
            handled = true;
        }
        if (/\bquieter music\b|\bturn (the )?music down\b/.test(t)) {
            this.musicLevel = Math.max(0, this.musicLevel - 0.1);
            localStorage.setItem('Effexiq_music_level', String(this.musicLevel));
            say(`Music level: ${Math.round(this.musicLevel*100)}%`);
            const target = this.getMusicTargetGain();
            if (this.currentMusic?._howl) { try { this.currentMusic._howl.volume(target); } catch(_){} }
            try { this.musicGainNode.gain.setValueAtTime(target, this.audioContext.currentTime); } catch(_){}
            handled = true;
        }
        if (/\blower (the )?music\b|\bquieter\b/.test(t)) {
            // already covered
        }
        if (/\blouder music\b|\bturn (the )?music up\b/.test(t)) {
            this.musicLevel = Math.min(1, this.musicLevel + 0.1);
            localStorage.setItem('Effexiq_music_level', String(this.musicLevel));
            say(`Music level: ${Math.round(this.musicLevel*100)}%`);
            const target = this.getMusicTargetGain();
            if (this.currentMusic?._howl) { try { this.currentMusic._howl.volume(target); } catch(_){} }
            try { this.musicGainNode.gain.setValueAtTime(target, this.audioContext.currentTime); } catch(_){}
            handled = true;
        }
        // SFX volume commands
        if (/\blouder (sound effects|sfx|effects)\b|\bturn (the )?(sfx|effects) up\b/.test(t)) {
            this.sfxLevel = Math.min(1, this.sfxLevel + 0.1);
            localStorage.setItem('Effexiq_sfx_level', String(this.sfxLevel));
            say(`SFX level: ${Math.round(this.sfxLevel*100)}%`);
            handled = true;
        }
        if (/\bquieter (sound effects|sfx|effects)\b|\bturn (the )?(sfx|effects) down\b/.test(t)) {
            this.sfxLevel = Math.max(0, this.sfxLevel - 0.1);
            localStorage.setItem('Effexiq_sfx_level', String(this.sfxLevel));
            say(`SFX level: ${Math.round(this.sfxLevel*100)}%`);
            handled = true;
        }
        if (/\bmute sfx\b|\bmute sound effects\b/.test(t)) {
            this.sfxEnabled = false; localStorage.setItem('Effexiq_sfx_enabled', 'false'); say('Sound effects muted'); handled = true;
        }
        if (/\bunmute sfx\b|\bunmute sound effects\b/.test(t)) {
            this.sfxEnabled = true; localStorage.setItem('Effexiq_sfx_enabled', 'true'); say('Sound effects unmuted'); handled = true;
        }
        if (/\bmute music\b/.test(t)) {
            this.musicEnabled = false; localStorage.setItem('Effexiq_music_enabled', 'false'); if (this.currentMusic) this.fadeOutAudio(this.currentMusic, 250); say('Music muted'); handled = true;
        }
        if (/\bunmute music\b/.test(t)) {
            this.musicEnabled = true; localStorage.setItem('Effexiq_music_enabled', 'true'); say('Music unmuted'); handled = true;
        }
        // Replay last sound
        if (/\b(play (that |it )?(again|once more)|(repeat|replay) (that |the )?(last |that )?(sound|effect)?s?)\b/.test(t)) {
            if (this._lastInstantSound) {
                const { config, keyword, intensityMul } = this._lastInstantSound;
                config._triggerStart = performance.now();
                this.logActivity(`Replay: ${keyword}`, 'trigger');
                this.playInstantSound(config, keyword, intensityMul);
                say(`Replaying: ${keyword}`);
            } else {
                say('No recent sound to replay');
            }
            handled = true;
        }
        // Stop all audio
        if (/\bstop (all|everything|audio|sounds)\b|\bsilence\b/.test(t)) {
            this.stopAllSounds();
            say('All audio stopped');
            handled = true;
        }
        // Pause / resume
        if (/\bpause (music|audio|everything)\b/.test(t)) {
            if (this.currentMusic?._howl) { try { this.currentMusic._howl.pause(); } catch(_){} }
            if (this.ambientBed?._howl) { try { this.ambientBed._howl.pause(); } catch(_){} }
            say('Audio paused');
            handled = true;
        }
        if (/\bresume (music|audio|everything)\b/.test(t)) {
            if (this.currentMusic?._howl) { try { this.currentMusic._howl.play(); } catch(_){} }
            if (this.ambientBed?._howl) { try { this.ambientBed._howl.play(); } catch(_){} }
            say('Audio resumed');
            handled = true;
        }
        // Stop ambient bed
        if (/\bstop ambient\b|\bno ambient\b/.test(t)) {
            this.stopAmbientBed();
            say('Ambient stopped');
            handled = true;
        }
        // Play a specific sound by name from catalog
        const playMatch = t.match(/\bplay (?:the )?(?:sound )?(.+?)(?:\s+sound)?$/);
        if (playMatch && !handled) {
            const query = playMatch[1].trim();
            const match = this.soundCatalog.find(s =>
                s.id.toLowerCase().includes(query) ||
                (s.tags && s.tags.some(tag => tag.toLowerCase().includes(query)))
            );
            if (match) {
                if (match.type === 'music') {
                    this.updateMusicById({ id: match.id, action: 'play_or_continue', volume: 0.5 });
                } else {
                    this.playSoundEffectById({ id: match.id, volume: 0.7 }, null);
                }
                say(`Playing: ${match.id}`);
                handled = true;
            }
        }
        const modeMatch = t.match(/\bswitch to (horror|christmas|halloween|dnd|bedtime|sing|auto)\b/);
        // Mode switching disabled -- always auto mode
        return handled;
    }

    // ===== PREDICTIVE PREFETCH =====
    predictivePrefetch(text) {
        if (!this.freesoundApiKey || !this.sfxEnabled || !this.predictionEnabled) return;
        const t = text.toLowerCase();
        // simple debounce
        if (this._predictiveBusy) return; this._predictiveBusy = true; setTimeout(()=>{this._predictiveBusy=false;}, 400);

        // Cancel any in-flight fetches from a previous call (stale predictions)
        if (this._predictiveAbortCtrl) { this._predictiveAbortCtrl.abort(); }
        this._predictiveAbortCtrl = new AbortController();
        const signal = this._predictiveAbortCtrl.signal;

        const cues = [
            { k: /\bbark|woof\b/, q: 'dog bark' },
            { k: /\bknock|door\b/, q: 'door knock' },
            { k: /\bthunder|storm\b/, q: 'thunder' },
            { k: /\bfootsteps?\b/, q: 'footsteps' },
            { k: /\bcreak\b/, q: 'door creak' },
            { k: /\bwind|whoosh\b/, q: 'wind whoosh' },
        ];
        
        // Context-aware predictions (narrative cues)
        const contextPredictions = [];
        
        // Movement & location cues
        if (/approach|walk|move|enter|step/.test(t)) {
            contextPredictions.push('footsteps', 'door creak', 'door open');
        }
        if (/dark|night|shadow|midnight/.test(t)) {
            contextPredictions.push('crickets', 'owl hoot', 'wind whoosh');
        }
        if (/fight|battle|combat|attack/.test(t)) {
            contextPredictions.push('sword clash', 'armor clang', 'grunt');
        }
        if (/forest|woods|trees/.test(t)) {
            contextPredictions.push('bird chirp', 'leaves rustle', 'wind forest');
        }
        if (/tavern|inn|bar/.test(t)) {
            contextPredictions.push('crowd tavern', 'mug clink', 'door open');
        }
        if (/rain|wet|storm/.test(t)) {
            contextPredictions.push('rain', 'thunder', 'wind');
        }
        if (/fire|flame|torch/.test(t)) {
            contextPredictions.push('fire crackling', 'torch crackle');
        }
        
        // Mode-specific predictions
        if (this.currentMode === 'horror') {
            if (/door|room|house|hall/.test(t)) {
                contextPredictions.push('door creak', 'floorboard creak', 'heartbeat');
            }
            if (/breath|gasp|pant/.test(t)) {
                contextPredictions.push('breath heavy', 'heartbeat');
            }
        } else if (this.currentMode === 'dnd') {
            if (/magic|spell|cast/.test(t)) {
                contextPredictions.push('magic whoosh', 'spell cast');
            }
            if (/dragon|beast|monster/.test(t)) {
                contextPredictions.push('monster roar', 'dragon roar');
            }
        }
        
        // Combine keyword cues with context predictions
        const toWarm = [...new Set([
            ...cues.filter(c => c.k.test(t)).map(c => c.q),
            ...contextPredictions
        ])].slice(0, 3); // Top 3 predictions
        
        Promise.allSettled(toWarm.map(async (q) => {
            const cacheKey = `sfx:${q}`;
            if (this.soundCache.has(cacheKey)) return; // already cached URL
            const url = await this.searchAudio(q, 'sfx');
            if (!url || signal.aborted) return;
            
            // Cache in buffer cache for instant playback
            const cached = this.getFromBufferCache(url);
            if (cached) return; // Already in long-term cache
            
            if (!this.activeBuffers.has(url)) {
                try {
                    const resp = await fetch(url, { signal }); 
                    const ab = await resp.arrayBuffer();
                    const buf = await this.audioContext.decodeAudioData(ab);
                    this.activeBuffers.set(url, buf);
                    // Also add to long-term cache
                    this.addToBufferCache(url, buf);
                    debugLog(`✓ Predictively cached: ${q}`);
                } catch(e) {
                    if (e.name !== 'AbortError') debugLog('Predictive prefetch error:', e.message);
                }
            }
        }));
    }

    // ===== PREFETCH ALTERNATES =====
    async prefetchAlternates(query) {
        const q = query.toLowerCase();
        const related = {
            'door creak': ['door squeak','wood creak'],
            'wind whoosh': ['wind howl','wind gust'],
            'footsteps': ['footsteps hallway','footsteps gravel'],
            'wolf howl': ['dog howl','coyote howl'],
            'witch cackle': ['creepy laugh','evil laugh'],
            'thunder': ['thunder rumble','quick lightning strike']
        };
        const alts = related[q] || [];
        for (const alt of alts.slice(0,2)) {
            const url = await this.searchAudio(alt, 'sfx');
            if (url && !this.activeBuffers.has(url)) {
                if (this.getFromBufferCache(url)) continue; // already in unified cache
                try {
                    const resp = await fetch(url);
                    const ab = await resp.arrayBuffer();
                    const buf = await this.audioContext.decodeAudioData(ab);
                    this.activeBuffers.set(url, buf);
                    this.addToBufferCache(url, buf); // enter unified LRU cache
                } catch(_){}
            }
        }
    }

    // ===== STINGERS =====
    scheduleNextStinger() {
        if (!this.sfxEnabled || !this.predictionEnabled) return;
        if (this.stingerTimer) clearTimeout(this.stingerTimer);
        const interval = 20000 + Math.random() * 25000; // 20–45s
        const modeAtSchedule = this.currentMode;
        this.stingerTimer = setTimeout(async () => {
            if (this.currentMode !== modeAtSchedule) return;
            const stingerSet = this.getModeStingers();
            const choice = stingerSet[Math.floor(Math.random()*stingerSet.length)];
            const url = await this.searchAudio(choice, 'sfx');
            if (url) { await this.playAudio(url, { type:'sfx', name: choice, volume: this.calculateVolume(0.5), loop:false }); }
            this.scheduleNextStinger();
        }, interval);
    }

    getModeStingers() {
        return MODE_STINGERS[this.currentMode] || MODE_STINGERS.auto;
    }

    // ===== SFX PRELOADING (expanded, concurrency-limited) =====
    async preloadSfxForCurrentMode(versionToken) {
        if (!this.sfxEnabled) return;
        if (this.preloadInProgress) return;
        const base = this.modePreloadSets[this.currentMode] || this.modePreloadSets.auto;
        const merged = [...new Set([...(base || []), ...this.genericPreloadSet])];
        const target = merged.slice(0, 20); // cap at 20
        if (target.length === 0) return;

        this.preloadInProgress = true;
        const startedAt = Date.now();
        let sfxLoaded = 0;
        this.updatePreloadProgress(0, target.length);
        try {
            const tasks = target.map(q => async () => {
                // Abort if mode changed during preload
                if (versionToken !== this.preloadVersion) return;
                const cacheKey = `sfx:${q}`;
                // If fully ready, skip
                if (this.soundCache.has(cacheKey)) {
                    const cachedUrl = this.soundCache.get(cacheKey);
                    if (cachedUrl && this.activeBuffers.has(cachedUrl)) {
                        sfxLoaded++;
                        this.updatePreloadProgress(sfxLoaded, target.length);
                        return;
                    }
                }
                const url = await this.searchAudio(q, 'sfx');
                if (!url) { sfxLoaded++; this.updatePreloadProgress(sfxLoaded, target.length); return; }
                try {
                    if (!this.activeBuffers.has(url)) {
                        const srcs = this.buildSrcCandidates(url);
                        let resp = null;
                        for (const src of srcs) {
                            try { resp = await fetch(src); if (resp.ok) break; } catch(_) { resp = null; }
                        }
                        if (!resp || !resp.ok) throw new Error('fetch failed');
                        const ab = await resp.arrayBuffer();
                        const buf = await this.audioContext.decodeAudioData(ab);
                        this.activeBuffers.set(url, buf);
                    }
                } catch (_) {
                    // Decoding may fail due to CORS; playback will fallback later
                }
                sfxLoaded++;
                this.updatePreloadProgress(sfxLoaded, target.length);
            });

            await this.runWithConcurrency(tasks, this.getPreloadConcurrency());
            const elapsed = Date.now() - startedAt;
            this.updateStatus(`Prepared sounds (${target.length}) in ${Math.max(1, Math.round(elapsed/100)/10)}s`);
        } catch (e) {
            console.log('Preload failed:', e?.message || e);
        } finally {
            this.preloadInProgress = false;
        }
    }

    async runWithConcurrency(taskFns, limit = 5) {
        const queue = [...taskFns];
        const runners = new Array(Math.min(limit, queue.length)).fill(0).map(async () => {
            while (queue.length) {
                const fn = queue.shift();
                try { await fn(); } catch (_) {}
            }
        });
        await Promise.all(runners);
    }

    getPreloadConcurrency() {
        const conn = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
        const effective = conn?.effectiveType || '4g';
        const base = this.lowLatencyMode ? 7 : 4;
        if (effective.includes('2g')) return Math.max(2, base - 2);
        if (effective.includes('3g')) return Math.max(3, base - 1);
        return base;
    }

    showLoadingOverlay(message = 'Preparing sounds...') {
        if (this._suppressLoadingOverlay) return;
        const overlay = document.getElementById('loadingOverlay');
        const msg = document.getElementById('loadingMessage');
        if (msg) msg.textContent = message;
        if (overlay) overlay.classList.remove('hidden');
    }

    hideLoadingOverlay() {
        if (this._suppressLoadingOverlay) return;
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

    updateApiStatusIndicators() {
        const openaiStatus = document.getElementById('openaiStatus');
        const freesoundStatus = document.getElementById('freesoundStatus');
        const pixabayStatus = document.getElementById('pixabayStatus');
        
        if (openaiStatus) {
            // Show active when subscription token is present or backend confirms OpenAI is configured
            const backendOpenAI = this.backendHealth?.openai === true;
            const assumedBackend = this.backendAvailable && this.backendHealth == null;
            if (this.accessToken) {
                openaiStatus.className = 'api-status active';
                openaiStatus.setAttribute('aria-label', 'AI active — subscription valid');
            } else if (backendOpenAI || assumedBackend) {
                openaiStatus.className = 'api-status active';
                openaiStatus.setAttribute('aria-label', 'OpenAI available via backend');
            } else {
                openaiStatus.className = 'api-status inactive';
                openaiStatus.setAttribute('aria-label', 'Subscribe to enable AI features');
            }
        }
        
        if (freesoundStatus) {
            const backendFreesound = this.backendHealth?.freesound === true;
            const catalogAvailable = Array.isArray(this.soundCatalog) && this.soundCatalog.length > 0;
            if (this.freesoundApiKey && this.freesoundApiKey.length > 10) {
                freesoundStatus.className = 'api-status active';
                freesoundStatus.setAttribute('aria-label', 'Freesound API key is configured (local)');
            } else if (backendFreesound || (this.backendAvailable && catalogAvailable)) {
                freesoundStatus.className = 'api-status active';
                freesoundStatus.setAttribute('aria-label', 'Audio sources available via backend');
            } else {
                freesoundStatus.className = 'api-status inactive';
                freesoundStatus.setAttribute('aria-label', 'Freesound API key is missing');
            }
        }
        
        if (pixabayStatus) {
            if (this.pixabayApiKey && this.pixabayApiKey.length > 10) {
                pixabayStatus.className = 'api-status active';
                pixabayStatus.setAttribute('aria-label', 'Pixabay API key is configured (local)');
            } else {
                const backendPixabay = this.backendHealth?.pixabay === true;
                if (backendPixabay) {
                    pixabayStatus.className = 'api-status active';
                    pixabayStatus.setAttribute('aria-label', 'Pixabay available via backend');
                } else {
                    pixabayStatus.className = 'api-status inactive';
                    pixabayStatus.setAttribute('aria-label', 'Pixabay (future support)');
                }
            }
        }
    }

    // ===== ACTIVITY FEED =====
    _setupAudioControls() {
        // SFX toggle
        const sfxToggle = document.getElementById('sfxToggle');
        if (sfxToggle) {
            sfxToggle.checked = this.sfxEnabled;
            sfxToggle.addEventListener('change', () => {
                this.sfxEnabled = sfxToggle.checked;
                localStorage.setItem('Effexiq_sfx_enabled', JSON.stringify(this.sfxEnabled));
                if (!this.sfxEnabled) {
                    // Stop all active SFX
                    this.activeSounds.forEach((snd, id) => {
                        if (snd.type === 'sfx') {
                            try { if (snd._howl) { snd._howl.stop(); snd._howl.unload(); } } catch(_){}
                            try { if (snd.source) snd.source.stop(); } catch(_){}
                            this.activeSounds.delete(id);
                        }
                    });
                    this.updateSoundsList();
                }
            });
        }

        // Music toggle
        const musicToggle = document.getElementById('musicToggle');
        if (musicToggle) {
            musicToggle.checked = this.musicEnabled;
            musicToggle.addEventListener('change', () => {
                this.musicEnabled = musicToggle.checked;
                localStorage.setItem('Effexiq_music_enabled', JSON.stringify(this.musicEnabled));
                if (!this.musicEnabled && this.currentMusic && this.currentMusic._howl) {
                    this.currentMusic._howl.fade(this.currentMusic._howl.volume(), 0, 500);
                    setTimeout(() => {
                        try { this.currentMusic._howl.stop(); this.currentMusic._howl.unload(); } catch(_){}
                        this.currentMusic = null;
                        this.updateSoundsList();
                    }, 550);
                }
            });
        }

        // Ambience toggle
        const ambienceToggle = document.getElementById('ambienceToggle');
        if (ambienceToggle) {
            ambienceToggle.checked = this.ambienceEnabled;
            ambienceToggle.addEventListener('change', () => {
                this.ambienceEnabled = ambienceToggle.checked;
                localStorage.setItem('Effexiq_ambience_enabled', JSON.stringify(this.ambienceEnabled));
                if (!this.ambienceEnabled) {
                    // Stop ambient bed
                    if (this.ambientBed && this.ambientBed._howl) {
                        try { this.ambientBed._howl.stop(); this.ambientBed._howl.unload(); } catch(_){}
                        this.ambientBed = null;
                    }
                    // Stop procedural ambient layers
                    this.stopProceduralAmbient();
                    // Stop looping SFX (ambient cue sounds)
                    if (this._activeStorySfx) {
                        for (const [id, entry] of this._activeStorySfx) {
                            this._fadeOutStorySfx(entry, 500);
                        }
                    }
                }
            });
        }

        // Ambient duration slider
        const ambientDurSlider = document.getElementById('ambientDurationSlider');
        const ambientDurValue = document.getElementById('ambientDurationValue');
        if (ambientDurSlider) {
            ambientDurSlider.value = String(Math.round(this.ambientDurationMultiplier * 100));
            if (ambientDurValue) ambientDurValue.textContent = this.ambientDurationMultiplier.toFixed(1) + 'x';
            ambientDurSlider.addEventListener('input', (e) => {
                this.ambientDurationMultiplier = parseInt(e.target.value) / 100;
                localStorage.setItem('Effexiq_ambient_duration', String(this.ambientDurationMultiplier));
                if (ambientDurValue) ambientDurValue.textContent = this.ambientDurationMultiplier.toFixed(1) + 'x';
            });
        }
    }

    setupActivityFeed() {
        const toggle = document.getElementById('activityFeedToggle');
        const log = document.getElementById('activityLog');
        if (toggle && log) {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('collapsed');
                log.classList.toggle('collapsed');
            });
        }
    }

    logActivity(msg, type = 'info') {
        const log = document.getElementById('activityLog');
        if (!log) return;
        const entry = document.createElement('div');
        entry.className = `activity-entry type-${type}`;
        const now = new Date();
        const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        entry.innerHTML = `<span class="activity-time">${ts}</span><span class="activity-msg">${this.escapeHtml(msg)}</span>`;
        log.appendChild(entry);
        while (log.children.length > 100) log.removeChild(log.firstChild);
        log.scrollTop = log.scrollHeight;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== SESSION STATS =====
    bumpStat(key, amount = 1) {
        if (key in this.sessionStats) {
            this.sessionStats[key] += amount;
        }
        this.renderStats();
    }

    renderStats() {
        const map = { sounds: 'statSounds', triggers: 'statTriggers', transitions: 'statTransitions', keywords: 'statKeywords', analyses: 'statAnalyses' };
        for (const [k, id] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) el.textContent = this.sessionStats[k];
        }
    }

    // ===== HUB NAVIGATION =====
    setupHubNavigation() {
        // Wire sidebar nav items
        document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.section;
                if (!target) return;
                this.navigateToSection(target);
            });
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
            });
        });

        // Wire use-case cards on dashboard
        document.querySelectorAll('.use-case-card').forEach(card => {
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.addEventListener('click', () => {
                const target = card.dataset.section;
                const context = card.dataset.context;
                if (!target) return;
                if (context === 'storytelling') this._updateEditorLabels('storySection');
                else if (context === 'dnd') this._updateEditorLabels('dndSection');
                this.navigateToSection(target);
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
            });
        });

        // Wire dashboard demo CTA
        const demoCta = document.querySelector('#dashboardPanel .hub-hero-cta');
        if (demoCta) demoCta.addEventListener('click', () => this.startDemo());

        // Wire mobile sidebar toggle
        const toggleBtn = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('platformSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = sidebar.classList.toggle('sidebar-open');
                backdrop?.classList.toggle('hidden', !isOpen);
                toggleBtn.setAttribute('aria-expanded', String(isOpen));
            });
            backdrop?.addEventListener('click', () => {
                sidebar.classList.remove('sidebar-open');
                backdrop.classList.add('hidden');
                toggleBtn.setAttribute('aria-expanded', 'false');
            });
        }
    }

    _updateEditorLabels(parent) {
        const title = document.getElementById('createSectionTitle');
        const intro = document.getElementById('createSectionIntro');
        const savedTitle = document.getElementById('createSectionSavedTitle');
        const titleInput = document.getElementById('scTitleInput');
        const textArea = document.getElementById('scTextArea');
        const playBtn = document.getElementById('scPlayBtn');

        if (parent === 'storySection') {
            if (title) title.textContent = 'Create Your Story';
            if (intro) intro.textContent = 'Write your stories and play them with Effexiq\'s real-time sound engine.';
            if (savedTitle) savedTitle.textContent = 'Your Stories';
            if (titleInput) titleInput.placeholder = 'Story Title...';
            if (textArea) textArea.placeholder = 'Write your story here...\n\nThe rain tapped against the window as she opened the old letter...';
            if (playBtn) playBtn.textContent = 'Play Story';
        } else {
            if (title) title.textContent = 'Create Your Campaign';
            if (intro) intro.textContent = 'Write your campaigns and play them with Effexiq\'s real-time sound engine.';
            if (savedTitle) savedTitle.textContent = 'Your Campaigns';
            if (titleInput) titleInput.placeholder = 'Campaign Title...';
            if (textArea) textArea.placeholder = 'Write your campaign here...\n\nThe adventurers gathered at the tavern as thunder rolled across the darkened sky...';
            if (playBtn) playBtn.textContent = 'Play Campaign';
        }
    }

    navigateToSection(sectionId) {
        const target = document.getElementById(sectionId);

        // Hide all sections, show target
        document.querySelectorAll('.app-section').forEach(s => {
            s.classList.add('hidden');
            s.classList.remove('section-visible');
        });

        if (target) {
            target.classList.remove('hidden');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    target.classList.add('section-visible');
                });
            });
        }

        // Update sidebar active state
        document.querySelectorAll('.sidebar-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        // Close mobile sidebar if open
        const sidebar = document.getElementById('platformSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar?.classList.contains('sidebar-open')) {
            sidebar.classList.remove('sidebar-open');
            backdrop?.classList.add('hidden');
            document.getElementById('sidebarToggle')?.setAttribute('aria-expanded', 'false');
        }

        // Scroll main content area to top
        const main = document.getElementById('platformMain');
        if (main) main.scrollTop = 0;
        else window.scrollTo(0, 0);
    }

    navigateToHub() {
        if (this.isListening) this.stopListening();
        this.stopAllAudio();
        this.navigateToSection('dashboardPanel');
    }

    // ===== STORIES SECTION (populates dynamically) =====
    async populateStoriesSection() {
        const container = document.getElementById('storiesListContainer');
        if (!container) return;
        container.innerHTML = '';

        // Only show user-created stories from localStorage
        try {
            const userStories = JSON.parse(localStorage.getItem('Effexiq_sc_stories') || '[]');
            for (let i = 0; i < userStories.length; i++) {
                const s = userStories[i];
                if (!s.title || !s.text) continue;
                const userStoryId = 'user_' + s.title.replace(/\s+/g, '_').toLowerCase();
                if (!this.stories) this.stories = {};
                if (!this.stories[userStoryId]) {
                    this.stories[userStoryId] = {
                        title: s.title,
                        text: s.text,
                        theme: 'User Story',
                        pages: [{ text: s.text }]
                    };
                }
                this._addStoryCard(container, userStoryId, s.title, s.text, i);
            }
        } catch (e) {
            console.warn('[Effexiq] Failed to load user stories:', e);
        }

        if (container.children.length === 0) {
            container.innerHTML = '<p class="info-text">No saved campaigns yet. Write one above!</p>';
        }
    }

    _addStoryCard(container, id, title, text, storageIndex) {
        const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
        const card = document.createElement('div');
        card.className = 'story-select-card';
        card.innerHTML = `
            <div class="story-card-top">
                <p class="story-select-card-title">${escapeHtml(title)}</p>
                <span class="story-card-wc">${wordCount} words</span>
            </div>
            <div class="story-card-actions">
                <button class="story-card-edit btn-secondary" type="button">Edit</button>
                <button class="story-card-play btn-primary" type="button">Play</button>
                <button class="story-card-delete" type="button" title="Delete story">&times;</button>
            </div>`;
        // Edit: load story into editor
        card.querySelector('.story-card-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            const saved = JSON.parse(localStorage.getItem('Effexiq_sc_stories') || '[]');
            const s = saved[storageIndex];
            if (!s) return;
            document.getElementById('scTitleInput').value = s.title;
            document.getElementById('scTextArea').value = s.text;
            this.scLoadCues(s.cues || []);
            this._updateWordCount('scTextArea', 'scWordCount');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        // Play: start story immediately
        card.querySelector('.story-card-play').addEventListener('click', (e) => {
            e.stopPropagation();
            this.startStoryFlow(id, 'auto');
        });
        // Delete
        card.querySelector('.story-card-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm(`Delete "${title}"?`)) return;
            const saved = JSON.parse(localStorage.getItem('Effexiq_sc_stories') || '[]');
            saved.splice(storageIndex, 1);
            localStorage.setItem('Effexiq_sc_stories', JSON.stringify(saved));
            this.populateStoriesSection();
        });
        container.appendChild(card);
    }

    _updateWordCount(textareaId, countId) {
        const textarea = document.getElementById(textareaId);
        const counter = document.getElementById(countId);
        if (!textarea || !counter) return;
        const text = textarea.value.trim();
        const wc = text ? text.split(/\s+/).filter(Boolean).length : 0;
        counter.textContent = `${wc} word${wc !== 1 ? 's' : ''}`;
    }

    // ===== AUTO-SAVE DRAFTS =====
    _autosaveDraft() {
        const scTitle = (document.getElementById('scTitleInput')?.value || '').trim();
        const scText = (document.getElementById('scTextArea')?.value || '').trim();
        const draft = {};
        if (scTitle || scText) draft.sc = { title: scTitle, text: scText };
        if (Object.keys(draft).length > 0) {
            localStorage.setItem('Effexiq_draft', JSON.stringify(draft));
        }
    }

    _restoreDraft() {
        try {
            const draft = JSON.parse(localStorage.getItem('Effexiq_draft') || '{}');
            if (draft.sc) {
                const scTitle = document.getElementById('scTitleInput');
                const scText = document.getElementById('scTextArea');
                if (scTitle && !scTitle.value && draft.sc.title) scTitle.value = draft.sc.title;
                if (scText && !scText.value && draft.sc.text) scText.value = draft.sc.text;
                this._updateWordCount('scTextArea', 'scWordCount');
            }

        } catch (_) {}
    }

    _clearDraft(section) {
        try {
            const draft = JSON.parse(localStorage.getItem('Effexiq_draft') || '{}');
            delete draft[section];
            if (Object.keys(draft).length === 0) {
                localStorage.removeItem('Effexiq_draft');
            } else {
                localStorage.setItem('Effexiq_draft', JSON.stringify(draft));
            }
        } catch (_) {}
    }

    // ===== SUGGEST CUES =====
    suggestCues(textareaId, cuesListId, addRowFn) {
        const textarea = document.getElementById(textareaId);
        if (!textarea) return;
        const text = textarea.value.toLowerCase();
        if (!text.trim()) { alert('Write your story first, then click Suggest Cues.'); return; }

        const existingRows = document.querySelectorAll(`#${cuesListId} .wyo-cue-row`);
        const existingKeywords = new Set();
        existingRows.forEach(row => {
            const kw = (row.querySelector('.wyo-cue-keyword')?.value || '').trim().toLowerCase();
            if (kw) existingKeywords.add(kw);
        });

        let added = 0;
        for (const [keyword, config] of Object.entries(this.instantKeywords)) {
            if (existingKeywords.has(keyword)) continue;
            const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedKw}\\b`, 'i');
            if (regex.test(text)) {
                addRowFn.call(this, keyword, config.file || '', config.category === 'music' ? 'music' : 'sfx');
                added++;
                if (added >= 20) break;
            }
        }
        if (added === 0) {
            alert('No matching keywords found in your story text.');
        }
    }

    // ===== CUE PREVIEW IN CONTEXT (Test Run) =====
    testCueInContext(textareaId, cuesListId) {
        const textarea = document.getElementById(textareaId);
        if (!textarea) return;
        const text = textarea.value;
        if (!text.trim()) { alert('Write your story first.'); return; }
        const rows = document.querySelectorAll(`#${cuesListId} .wyo-cue-row`);
        const cues = [];
        rows.forEach(row => {
            const kw = (row.querySelector('.wyo-cue-keyword')?.value || '').trim().toLowerCase();
            const file = row.querySelector('.wyo-cue-sound-select')?.value || '';
            if (kw && file) cues.push({ keyword: kw, file });
        });
        if (cues.length === 0) { alert('Add at least one sound cue first.'); return; }

        let targetCue = null;
        let sentenceWithKeyword = '';
        for (const cue of cues) {
            const escapedCueKw = cue.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedCueKw}\\b`, 'i');
            const match = regex.exec(text);
            if (match) {
                targetCue = cue;
                const before = text.substring(Math.max(0, match.index - 80), match.index);
                const after = text.substring(match.index, Math.min(text.length, match.index + cue.keyword.length + 80));
                sentenceWithKeyword = (before + after).trim();
                break;
            }
        }
        if (!targetCue) { alert('None of your cue keywords appear in the story text.'); return; }

        if (!window.speechSynthesis) { alert('Speech synthesis not available in this browser.'); return; }
        if (this._wyoPreviewHowl) { this._wyoPreviewHowl.stop(); this._wyoPreviewHowl.unload(); this._wyoPreviewHowl = null; }
        window.speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(sentenceWithKeyword);
        utter.rate = 0.9;
        const kwPos = sentenceWithKeyword.toLowerCase().indexOf(targetCue.keyword);
        const totalLen = sentenceWithKeyword.length;

        // Count how many words precede the keyword to know when onboundary should fire
        const wordsBeforeKw = sentenceWithKeyword.substring(0, kwPos).trim().split(/\s+/).filter(Boolean).length;
        let wordCount = 0;
        let fired = false;

        const fireSound = () => {
            if (fired) return;
            fired = true;
            this._wyoPreviewHowl = new Howl({ src: this.buildSrcCandidates(encodeURI(targetCue.file)), html5: true, volume: 0.7 });
            this._wyoPreviewHowl.play();
        };

        // Primary: fire on the correct word boundary event
        utter.onboundary = (event) => {
            if (event.name !== 'word') return;
            if (wordCount >= wordsBeforeKw) fireSound();
            wordCount++;
        };

        // Fallback: character-position timer in case onboundary doesn't fire (some mobile browsers)
        const approxDuration = totalLen * 60;
        const fireDelay = Math.max(200, (kwPos / totalLen) * approxDuration) + 1500;
        const timer = setTimeout(fireSound, fireDelay);

        utter.onend = () => {
            clearTimeout(timer);
            setTimeout(() => {
                if (this._wyoPreviewHowl) { this._wyoPreviewHowl.stop(); this._wyoPreviewHowl.unload(); this._wyoPreviewHowl = null; }
            }, 2000);
        };
        utter.onerror = () => {
            clearTimeout(timer);
            if (this._wyoPreviewHowl) { this._wyoPreviewHowl.stop(); this._wyoPreviewHowl.unload(); this._wyoPreviewHowl = null; }
        };
        window.speechSynthesis.speak(utter);
    }

    // ===== WEB WORKER =====
    _createJsonWorker() {
        try {
            const blob = new Blob([`
                self.onmessage = function(e) {
                    try {
                        const result = JSON.parse(e.data);
                        self.postMessage({ ok: true, data: result });
                    } catch (err) {
                        // Try repairing JSON
                        const m = e.data.match(/\\{[\\s\\S]*\\}/);
                        if (m) {
                            try {
                                self.postMessage({ ok: true, data: JSON.parse(m[0]) });
                                return;
                            } catch (_) {}
                        }
                        self.postMessage({ ok: false, error: err.message });
                    }
                };
            `], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const w = new Worker(url);
            URL.revokeObjectURL(url);
            return w;
        } catch (_) {
            return null;
        }
    }

    parseJsonOffThread(str) {
        if (!this._jsonWorker) return Promise.resolve(JSON.parse(str));
        if (!this._jsonWorkerQueue) this._jsonWorkerQueue = [];
        return new Promise((resolve, reject) => {
            this._jsonWorkerQueue.push({ str, resolve, reject });
            if (!this._jsonWorkerBusy) this._processJsonQueue();
        });
    }

    _processJsonQueue() {
        if (!this._jsonWorkerQueue || !this._jsonWorkerQueue.length) {
            this._jsonWorkerBusy = false;
            return;
        }
        this._jsonWorkerBusy = true;
        const { str, resolve, reject } = this._jsonWorkerQueue.shift();
        const timeout = setTimeout(() => {
            this._jsonWorker.onmessage = null;
            this._jsonWorkerBusy = false;
            this._processJsonQueue();
            reject(new Error('Worker timeout'));
        }, 5000);
        this._jsonWorker.onmessage = (e) => {
            clearTimeout(timeout);
            this._jsonWorker.onmessage = null;
            this._jsonWorkerBusy = false;
            this._processJsonQueue();
            if (e.data.ok) resolve(e.data.data);
            else reject(new Error(e.data.error));
        };
        this._jsonWorker.postMessage(str);
    }

    // ===== AUTO DETECT (Start Listening) =====
    setupDndAutoDetect() {
        const startBtn = document.getElementById('startBtn');

        // Always set auto mode
        if (!this.currentMode) this.selectMode('auto');

        // Start button: use context from textarea
        if (startBtn) {
            const origClick = () => {
                const dndSection = document.getElementById('dndAutoDetect');
                if (dndSection && !dndSection.classList.contains('hidden')) {
                    const contextInput = document.getElementById('dndContextInput');
                    this.storyContext = contextInput ? contextInput.value.trim() : '';
                    // Persist as session context for AI prompt
                    this.sessionContext = this.storyContext;
                    localStorage.setItem('Effexiq_session_context', this.sessionContext);
                    if (!this.currentMode) this.selectMode('auto');
                    this.startListeningWithContext().catch(e => debugLog('Listen start failed:', e.message));
                    return;
                }
                this.startListening();
            };
            // Remove and re-add click handler
            const newBtn = startBtn.cloneNode(true);
            startBtn.parentNode.replaceChild(newBtn, startBtn);
            newBtn.addEventListener('click', () => {
                if (newBtn.disabled) return;
                newBtn.disabled = true;
                setTimeout(() => { newBtn.disabled = false; }, 1000);
                origClick();
            });
        }

        this._renderScenePresetsBar();
    }

    // ===== SHARED CUE ROW BUILDER =====

    _buildCueRow(list, keyword, soundFile, soundType) {
        const row = document.createElement('div');
        row.className = 'wyo-cue-row';

        // Keyword input
        const kwInput = document.createElement('input');
        kwInput.type = 'text';
        kwInput.className = 'wyo-cue-keyword';
        kwInput.placeholder = 'Keyword...';
        kwInput.value = keyword || '';

        // Arrow
        const arrow = document.createElement('span');
        arrow.className = 'wyo-cue-arrow';
        arrow.textContent = '\u2192';

        // Type toggle (SFX / Music)
        const typeToggle = document.createElement('div');
        typeToggle.className = 'wyo-cue-type-toggle';
        const sfxBtn = document.createElement('button');
        sfxBtn.className = 'wyo-cue-type-btn' + ((soundType || 'sfx') === 'sfx' ? ' active' : '');
        sfxBtn.textContent = 'SFX';
        sfxBtn.type = 'button';
        sfxBtn.setAttribute('aria-label', 'Set cue type to SFX');
        const musicBtn = document.createElement('button');
        musicBtn.className = 'wyo-cue-type-btn' + (soundType === 'music' ? ' active' : '');
        musicBtn.textContent = 'Music';
        musicBtn.type = 'button';
        musicBtn.setAttribute('aria-label', 'Set cue type to music');
        typeToggle.appendChild(sfxBtn);
        typeToggle.appendChild(musicBtn);

        // Sound select with search filter
        const selectWrap = document.createElement('div');
        selectWrap.className = 'wyo-cue-select-wrap';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'wyo-cue-search';
        searchInput.placeholder = 'Search sounds...';
        const select = document.createElement('select');
        select.className = 'wyo-cue-sound-select';
        selectWrap.appendChild(searchInput);
        selectWrap.appendChild(select);

        let allFiltered = [];
        const populateSelect = (type, filter) => {
            select.innerHTML = '<option value="">-- Choose a sound --</option>';
            if (!this.savedSounds?.files) return;
            allFiltered = this.savedSounds.files
                .filter(f => f.type === type)
                .sort((a, b) => a.name.localeCompare(b.name));
            const q = (filter || '').toLowerCase();
            const shown = q ? allFiltered.filter(f => f.name.toLowerCase().includes(q) || (f.keywords || []).join(' ').toLowerCase().includes(q)) : allFiltered;
            for (const f of shown) {
                const opt = document.createElement('option');
                opt.value = f.file;
                opt.textContent = f.name;
                if (soundFile && f.file === soundFile) opt.selected = true;
                select.appendChild(opt);
            }
        };

        const currentType = () => sfxBtn.classList.contains('active') ? 'sfx' : 'music';
        populateSelect(currentType());

        searchInput.addEventListener('input', () => {
            populateSelect(currentType(), searchInput.value);
        });
        sfxBtn.addEventListener('click', () => {
            sfxBtn.classList.add('active'); musicBtn.classList.remove('active');
            populateSelect('sfx', searchInput.value);
        });
        musicBtn.addEventListener('click', () => {
            musicBtn.classList.add('active'); sfxBtn.classList.remove('active');
            populateSelect('music', searchInput.value);
        });

        // Preview / Stop button (toggles between play and stop)
        const previewBtn = document.createElement('button');
        previewBtn.className = 'wyo-cue-preview';
        previewBtn.type = 'button';
        previewBtn.innerHTML = '&#9654;';
        previewBtn.setAttribute('aria-label', 'Preview sound');
        previewBtn.addEventListener('click', () => {
            if (this._wyoPreviewHowl && this._wyoPreviewBtn === previewBtn) {
                this._wyoPreviewHowl.stop();
                this._wyoPreviewHowl.unload();
                this._wyoPreviewHowl = null;
                this._wyoPreviewBtn = null;
                previewBtn.innerHTML = '&#9654;';
                previewBtn.classList.remove('wyo-cue-playing');
                return;
            }
            if (this._wyoPreviewHowl) {
                this._wyoPreviewHowl.stop();
                this._wyoPreviewHowl.unload();
                if (this._wyoPreviewBtn) {
                    this._wyoPreviewBtn.innerHTML = '&#9654;';
                    this._wyoPreviewBtn.classList.remove('wyo-cue-playing');
                }
            }
            const file = select.value;
            if (!file) return;
            previewBtn.innerHTML = '&#9632;';
            previewBtn.classList.add('wyo-cue-playing');
            this._wyoPreviewBtn = previewBtn;
            this._wyoPreviewHowl = new Howl({ src: this.buildSrcCandidates(encodeURI(file)), html5: true, volume: 0.6 });
            this._wyoPreviewHowl.on('end', () => {
                previewBtn.innerHTML = '&#9654;';
                previewBtn.classList.remove('wyo-cue-playing');
                this._wyoPreviewHowl = null;
                this._wyoPreviewBtn = null;
            });
            this._wyoPreviewHowl.play();
            setTimeout(() => {
                if (this._wyoPreviewHowl && this._wyoPreviewBtn === previewBtn) {
                    this._wyoPreviewHowl.stop();
                    this._wyoPreviewHowl.unload();
                    this._wyoPreviewHowl = null;
                    this._wyoPreviewBtn = null;
                    previewBtn.innerHTML = '&#9654;';
                    previewBtn.classList.remove('wyo-cue-playing');
                }
            }, 10000);
        });

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'wyo-cue-delete';
        delBtn.type = 'button';
        delBtn.innerHTML = '&times;';
        delBtn.setAttribute('aria-label', 'Delete cue row');
        delBtn.addEventListener('click', () => row.remove());

        row.appendChild(kwInput);
        row.appendChild(arrow);
        row.appendChild(typeToggle);
        row.appendChild(selectWrap);
        row.appendChild(previewBtn);
        row.appendChild(delBtn);
        list.appendChild(row);
    }

    // ===== STORY CREATOR =====
    setupStoryCreator() {
        const saveBtn = document.getElementById('scSaveBtn');
        const loadBtn = document.getElementById('scLoadBtn');
        const playBtn = document.getElementById('scPlayBtn');
        const savedClose = document.getElementById('scSavedClose');
        const addCueBtn = document.getElementById('scAddCueBtn');

        if (saveBtn) saveBtn.addEventListener('click', () => this.scSave());
        if (loadBtn) loadBtn.addEventListener('click', () => this.scToggleSaved());
        if (savedClose) savedClose.addEventListener('click', () => {
            const list = document.getElementById('scSavedList');
            if (list) list.classList.add('hidden');
        });
        if (playBtn) playBtn.addEventListener('click', () => this.scPlay());
        if (addCueBtn) addCueBtn.addEventListener('click', () => this.scAddCueRow());

        // Suggest Cues + Test Run
        const suggestBtn = document.getElementById('scSuggestCuesBtn');
        if (suggestBtn) suggestBtn.addEventListener('click', () => this.suggestCues('scTextArea', 'scCuesList', this.scAddCueRow));
        const testRunBtn = document.getElementById('scTestRunBtn');
        if (testRunBtn) testRunBtn.addEventListener('click', () => this.testCueInContext('scTextArea', 'scCuesList'));

        // Word count for story textarea
        const scTextArea = document.getElementById('scTextArea');
        if (scTextArea) {
            scTextArea.addEventListener('input', () => this._updateWordCount('scTextArea', 'scWordCount'));
            this._updateWordCount('scTextArea', 'scWordCount');
        }

        // Auto-save drafts every 30s
        this._autosaveInterval = setInterval(() => this._autosaveDraft(), 30000);
        // Restore any existing draft
        this._restoreDraft();
        // Migrate old WYO campaigns to SC stories (one-time)
        this._migrateWyoData();
    }

    _migrateWyoData() {
        try {
            const old = localStorage.getItem('Effexiq_wyo_campaigns');
            if (!old) return;
            const campaigns = JSON.parse(old);
            if (!Array.isArray(campaigns) || campaigns.length === 0) { localStorage.removeItem('Effexiq_wyo_campaigns'); return; }
            const existing = JSON.parse(localStorage.getItem('Effexiq_sc_stories') || '[]');
            const existingTitles = new Set(existing.map(s => s.title));
            for (const c of campaigns) {
                if (!existingTitles.has(c.title)) existing.push(c);
            }
            localStorage.setItem('Effexiq_sc_stories', JSON.stringify(existing));
            localStorage.removeItem('Effexiq_wyo_campaigns');
        } catch (_) {}
    }

    scSave() {
        const title = (document.getElementById('scTitleInput')?.value || '').trim();
        const text = (document.getElementById('scTextArea')?.value || '').trim();
        if (!title || !text) { alert('Please enter a title and story text.'); return; }
        const cues = this.scGetCues();
        const saved = JSON.parse(localStorage.getItem('Effexiq_sc_stories') || '[]');
        const idx = saved.findIndex(s => s.title === title);
        const entry = { title, text, cues, savedAt: Date.now() };
        if (idx >= 0) saved[idx] = entry; else saved.push(entry);
        localStorage.setItem('Effexiq_sc_stories', JSON.stringify(saved));
        this._clearDraft('sc');
        alert('Story saved!');
        this.populateStoriesSection();
    }

    scToggleSaved() {
        const listEl = document.getElementById('scSavedList');
        if (!listEl) return;
        if (!listEl.classList.contains('hidden')) { listEl.classList.add('hidden'); return; }
        const items = document.getElementById('scSavedItems');
        const saved = JSON.parse(localStorage.getItem('Effexiq_sc_stories') || '[]');
        items.innerHTML = '';
        if (saved.length === 0) {
            items.innerHTML = '<p class="info-text">No saved campaigns yet.</p>';
        } else {
            saved.forEach((s, i) => {
                const row = document.createElement('div');
                row.className = 'wyo-saved-item';
                const titleSpan = document.createElement('span');
                titleSpan.className = 'wyo-saved-item-title';
                titleSpan.textContent = s.title;
                titleSpan.addEventListener('click', () => {
                    document.getElementById('scTitleInput').value = s.title;
                    document.getElementById('scTextArea').value = s.text;
                    this.scLoadCues(s.cues || []);
                    listEl.classList.add('hidden');
                });
                const delBtn = document.createElement('button');
                delBtn.className = 'wyo-saved-item-delete';
                delBtn.textContent = 'Delete';
                delBtn.setAttribute('aria-label', `Delete story: ${s.title}`);
                delBtn.addEventListener('click', () => {
                    saved.splice(i, 1);
                    localStorage.setItem('Effexiq_sc_stories', JSON.stringify(saved));
                    this.scToggleSaved();
                });
                row.appendChild(titleSpan);
                row.appendChild(delBtn);
                items.appendChild(row);
            });
        }
        listEl.classList.remove('hidden');
    }

    scPlay() {
        const title = (document.getElementById('scTitleInput')?.value || '').trim() || 'My Story';
        const text = (document.getElementById('scTextArea')?.value || '').trim();
        if (!text) { alert('Please write your story first.'); return; }
        // Stop any preview sound
        if (this._wyoPreviewHowl) { this._wyoPreviewHowl.stop(); this._wyoPreviewHowl.unload(); this._wyoPreviewHowl = null; }
        // Apply custom sound cues
        this.scApplyCustomCues();
        const id = 'sc_' + Date.now();
        if (!this.stories) this.stories = {};
        this.stories[id] = { id, title, text, demo: false, theme: '', description: '' };
        this._scPlayAsync(id, 'auto').catch(e => console.warn('SC play failed:', e.message));
    }

    async _scPlayAsync(id, mode) {
        let needWait = false;
        let waitToken = this.preloadVersion;
        if (this.currentMode !== mode) {
            const before = this.preloadVersion;
            this.selectMode(mode);
            const after = this.preloadVersion;
            if (after !== before) { needWait = true; waitToken = after; }
        } else if (this.preloadInProgress) {
            needWait = true; waitToken = this.preloadVersion;
        }
        if (needWait) {
            await this.waitForPreloadComplete(waitToken, 15000);
        }
        this.showStoryOverlay(id);
        setTimeout(() => this.startListeningWithContext().catch(e => debugLog('Listen start failed:', e.message)), 300);
    }

    // ===== SC SOUND CUE MANAGEMENT =====
    scAddCueRow(keyword, soundFile, soundType) {
        const list = document.getElementById('scCuesList');
        if (!list) return;
        // Reuse the same row-building logic as WYO
        this._buildCueRow(list, keyword, soundFile, soundType);
    }

    scGetCues() {
        const rows = document.querySelectorAll('#scCuesList .wyo-cue-row');
        const cues = [];
        rows.forEach(row => {
            const keyword = (row.querySelector('.wyo-cue-keyword')?.value || '').trim().toLowerCase();
            const soundFile = row.querySelector('.wyo-cue-sound-select')?.value || '';
            const type = row.querySelector('.wyo-cue-type-btn.active')?.textContent === 'Music' ? 'music' : 'sfx';
            if (keyword && soundFile) cues.push({ keyword, soundFile, type });
        });
        return cues;
    }

    scLoadCues(cues) {
        const list = document.getElementById('scCuesList');
        if (list) list.innerHTML = '';
        if (!Array.isArray(cues)) return;
        for (const c of cues) this.scAddCueRow(c.keyword, c.soundFile, c.type);
    }

    scApplyCustomCues() {
        const cues = this.scGetCues();
        if (cues.length === 0) return;
        for (const cue of cues) {
            this.instantKeywords[cue.keyword] = {
                query: cue.keyword,
                file: cue.soundFile,
                volume: 0.7,
                category: cue.type === 'music' ? 'music' : 'sfx'
            };
        }
        debugLog(`[SC] Applied ${cues.length} custom sound cues`);
    }

    // ===== SCENE PRESETS =====
    _defaultScenePresets() {
        return [
            { id: 'p1', name: 'Tavern',   moodBias: 0.2, context: 'A lively tavern with music, chatter, and ale flowing freely' },
            { id: 'p2', name: 'Dungeon',  moodBias: 0.7, context: 'Dark dungeon corridors, torchlight flickering, distant dripping water' },
            { id: 'p3', name: 'Forest',   moodBias: 0.3, context: 'Ancient forest with ambient nature sounds, birdsong, and rustling leaves' },
            { id: 'p4', name: 'Combat',   moodBias: 0.9, context: 'Intense battle with swords clashing, war cries, and chaos' },
            { id: 'p5', name: 'Mystical', moodBias: 0.5, context: 'Mysterious magical realm with arcane energy and ethereal sounds' },
        ];
    }

    _saveScenePresets() {
        localStorage.setItem('Effexiq_scene_presets', JSON.stringify(this.scenePresets));
    }

    applyScenePreset(preset) {
        this.moodBias = preset.moodBias;
        localStorage.setItem('Effexiq_mood_bias', String(this.moodBias));
        const moodSlider = document.getElementById('moodBias');
        const moodValue = document.getElementById('moodBiasValue');
        if (moodSlider) moodSlider.value = Math.round(preset.moodBias * 100);
        if (moodValue) moodValue.textContent = Math.round(preset.moodBias * 100);
        const ctx = document.getElementById('dndContextInput');
        if (ctx) ctx.value = preset.context;
        this.updateStatus(`Scene set: ${preset.name}`);
    }

    _renderScenePresetsBar() {
        const bar = document.getElementById('scenePresetsBar');
        if (!bar) return;
        if (!this.scenePresets) this.scenePresets = this._defaultScenePresets();
        bar.innerHTML = '';
        for (const p of this.scenePresets) {
            const btn = document.createElement('button');
            btn.className = 'scene-preset-btn';
            btn.textContent = p.name;
            btn.setAttribute('aria-label', `Apply scene preset: ${p.name}`);
            btn.addEventListener('click', () => this.applyScenePreset(p));
            bar.appendChild(btn);
        }
    }

    _renderScenePresetsSettings() {
        const list = document.getElementById('scenePresetsList');
        if (!list) return;
        if (!this.scenePresets) this.scenePresets = this._defaultScenePresets();
        list.innerHTML = '';
        this.scenePresets.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'scene-preset-edit-row';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'scene-preset-name-input';
            nameInput.value = p.name;
            nameInput.placeholder = 'Scene name';
            nameInput.addEventListener('change', () => {
                p.name = nameInput.value.trim() || p.name;
                this._saveScenePresets();
                this._renderScenePresetsBar();
            });

            const contextInput = document.createElement('input');
            contextInput.type = 'text';
            contextInput.className = 'scene-preset-context-input';
            contextInput.value = p.context;
            contextInput.placeholder = 'Context for AI...';
            contextInput.addEventListener('change', () => {
                p.context = contextInput.value.trim();
                this._saveScenePresets();
            });

            const moodLabel = document.createElement('span');
            moodLabel.className = 'scene-preset-mood-label';
            moodLabel.textContent = 'Mood';

            const moodInput = document.createElement('input');
            moodInput.type = 'range';
            moodInput.min = '0'; moodInput.max = '100'; moodInput.step = '1';
            moodInput.value = Math.round(p.moodBias * 100);
            moodInput.className = 'scene-preset-mood-slider';
            moodInput.title = `Mood intensity: ${Math.round(p.moodBias * 100)}%`;
            moodInput.addEventListener('input', () => {
                p.moodBias = parseInt(moodInput.value) / 100;
                moodInput.title = `Mood intensity: ${moodInput.value}%`;
                this._saveScenePresets();
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'scene-preset-delete';
            delBtn.textContent = 'Delete';
            delBtn.addEventListener('click', () => {
                this.scenePresets.splice(i, 1);
                this._saveScenePresets();
                this._renderScenePresetsSettings();
                this._renderScenePresetsBar();
            });

            row.appendChild(nameInput);
            row.appendChild(contextInput);
            row.appendChild(moodLabel);
            row.appendChild(moodInput);
            row.appendChild(delBtn);
            list.appendChild(row);
        });
    }

    _renderCustomPhrasesList() {
        const list = document.getElementById('customPhrasesList');
        if (!list) return;
        list.innerHTML = '';
        const entries = this._customPhraseEntries || [];
        if (entries.length === 0) {
            list.innerHTML = '<p class="info-text" style="margin:6px 0;">No custom phrases yet.</p>';
            return;
        }
        entries.forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'scene-preset-edit-row';
            row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;';
            const phraseSpan = document.createElement('span');
            phraseSpan.style.flex = '2';
            phraseSpan.textContent = entry.patterns.join(' / ');
            const querySpan = document.createElement('span');
            querySpan.style.flex = '2';
            querySpan.style.color = 'var(--text-muted, #999)';
            querySpan.textContent = `→ "${entry.query}" (vol ${entry.volume})`;
            const delBtn = document.createElement('button');
            delBtn.className = 'scene-preset-delete';
            delBtn.textContent = 'Delete';
            delBtn.setAttribute('aria-label', `Delete custom phrase: ${entry.query}`);
            delBtn.addEventListener('click', () => {
                this.removeCustomPhrase(entry.query);
                this._renderCustomPhrasesList();
            });
            row.appendChild(phraseSpan);
            row.appendChild(querySpan);
            row.appendChild(delBtn);
            list.appendChild(row);
        });
    }

    _addScenePreset() {
        if (!this.scenePresets) this.scenePresets = this._defaultScenePresets();
        this.scenePresets.push({ id: 'p_' + Date.now(), name: 'New Scene', moodBias: 0.5, context: '' });
        this._saveScenePresets();
        this._renderScenePresetsSettings();
        this._renderScenePresetsBar();
    }

    // ===== CONTROL BOARD (Soundboard) =====
    setupControlBoard() {
        // Initialize tab structure (migrate legacy flat board data if present)
        const savedTabs = JSON.parse(localStorage.getItem('Effexiq_cb_tabs') || 'null');
        if (savedTabs && Array.isArray(savedTabs) && savedTabs.length > 0) {
            this.cbTabs = savedTabs.map(t => ({
                id: t.id || 'tab_' + Date.now(),
                name: t.name || 'Scene',
                buttons: (t.buttons || []).map(b => ({
                    id: 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    label: b.label, type: b.type, file: b.file, name: b.name || b.label,
                    group: b.group || '', x: b.x, y: b.y, w: b.w, h: b.h, playing: false, howl: null
                }))
            }));
        } else {
            this.cbTabs = [{ id: 'tab_' + Date.now(), name: 'Scene 1', buttons: [] }];
        }
        this.cbActiveTabIdx = 0;
        this.cbButtons = this.cbTabs[0].buttons;

        this.cbDragging = null;
        this.cbResizing = null;
        this.cbRecentSounds = JSON.parse(localStorage.getItem('Effexiq_cb_recent') || '[]');
        this.cbUndoStack = [];

        const addBtn = document.getElementById('cbAddBtn');
        const saveBtn = document.getElementById('cbSaveBtn');
        const loadBtn = document.getElementById('cbLoadBtn');
        const stopAllBtn = document.getElementById('cbStopAllBtn');

        if (addBtn) addBtn.addEventListener('click', () => this.cbShowAddModal());
        if (saveBtn) saveBtn.addEventListener('click', () => this.cbSaveBoard());
        if (loadBtn) loadBtn.addEventListener('click', () => this.cbShowLoadModal());
        if (stopAllBtn) stopAllBtn.addEventListener('click', () => this.cbStopAll());
        const undoBtn = document.getElementById('cbUndoBtn');
        if (undoBtn) undoBtn.addEventListener('click', () => this.cbUndo());

        // Listen mode toggle
        const listenToggle = document.getElementById('cbListenToggle');
        if (listenToggle) listenToggle.addEventListener('click', () => this.cbToggleListenMode());

        // Add modal
        const addConfirm = document.getElementById('cbAddConfirm');
        const addCancel = document.getElementById('cbAddCancel');
        if (addConfirm) addConfirm.addEventListener('click', () => this.cbConfirmAdd());
        if (addCancel) addCancel.addEventListener('click', () => {
            const modal = document.getElementById('cbAddModal');
            if (modal) modal.classList.add('hidden');
        });

        // Search sounds in add modal
        const searchInput = document.getElementById('cbSoundSearch');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => this.cbSearchSounds(searchInput.value.trim()), 250);
            });
        }

        // Load modal cancel
        const loadCancel = document.getElementById('cbLoadCancel');
        if (loadCancel) loadCancel.addEventListener('click', () => {
            const modal = document.getElementById('cbLoadModal');
            if (modal) modal.classList.add('hidden');
        });

        // Canvas drag/resize handlers
        const canvas = document.getElementById('cbCanvas');
        if (canvas) {
            canvas.addEventListener('mousedown', (e) => this.cbMouseDown(e));
            document.addEventListener('mousemove', (e) => this.cbMouseMove(e));
            document.addEventListener('mouseup', () => this.cbMouseUp());
            // Touch support
            canvas.addEventListener('touchstart', (e) => this.cbTouchStart(e), { passive: false });
            document.addEventListener('touchmove', (e) => this.cbTouchMove(e), { passive: false });
            document.addEventListener('touchend', () => this.cbMouseUp());
        }

        // Render tabs and initial board
        this.cbRenderTabs();
        this.cbRender();
    }

    // ===== CONTROL BOARD TABS =====
    cbRenderTabs() {
        const bar = document.getElementById('cbTabsBar');
        if (!bar) return;
        bar.innerHTML = '';
        this.cbTabs.forEach((tab, i) => {
            const tabEl = document.createElement('button');
            tabEl.className = 'cb-tab' + (i === this.cbActiveTabIdx ? ' cb-tab-active' : '');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'cb-tab-name';
            nameSpan.textContent = tab.name;
            // Double-click to rename
            nameSpan.addEventListener('dblclick', (e) => { e.stopPropagation(); this._cbRenameTab(i, nameSpan); });
            tabEl.appendChild(nameSpan);

            if (this.cbTabs.length > 1) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'cb-tab-close';
                closeBtn.textContent = 'Ã—';
                closeBtn.title = 'Delete this scene tab';
                closeBtn.setAttribute('aria-label', `Delete tab: ${tab.name}`);
                closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this._cbDeleteTab(i); });
                tabEl.appendChild(closeBtn);
            }

            tabEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('cb-tab-close')) return;
                this.cbSwitchTab(i);
            });
            bar.appendChild(tabEl);
        });

        const addTabBtn = document.createElement('button');
        addTabBtn.className = 'cb-tab cb-tab-add';
        addTabBtn.textContent = '+';
        addTabBtn.title = 'Add new scene tab';
        addTabBtn.setAttribute('aria-label', 'Add new scene tab');
        addTabBtn.addEventListener('click', () => this._cbAddTab());
        bar.appendChild(addTabBtn);
    }

    cbSwitchTab(idx) {
        this.cbActiveTabIdx = idx;
        this.cbButtons = this.cbTabs[idx].buttons;
        this.cbRenderTabs();
        this.cbRender();
    }

    _cbAddTab() {
        const name = `Scene ${this.cbTabs.length + 1}`;
        this.cbTabs.push({ id: 'tab_' + Date.now(), name, buttons: [] });
        this.cbSwitchTab(this.cbTabs.length - 1);
        this._cbSaveTabs();
    }

    _cbDeleteTab(idx) {
        if (this.cbTabs.length <= 1) return;
        for (const btn of this.cbTabs[idx].buttons) {
            if (btn.howl) { btn.howl.stop(); btn.howl.unload(); btn.howl = null; }
        }
        this.cbTabs.splice(idx, 1);
        this.cbActiveTabIdx = Math.min(this.cbActiveTabIdx, this.cbTabs.length - 1);
        this.cbButtons = this.cbTabs[this.cbActiveTabIdx].buttons;
        this.cbRenderTabs();
        this.cbRender();
        this._cbSaveTabs();
    }

    _cbRenameTab(idx, nameSpan) {
        const old = this.cbTabs[idx].name;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = old;
        inp.className = 'cb-tab-rename-input';
        nameSpan.replaceWith(inp);
        inp.focus(); inp.select();
        const finish = () => {
            const val = inp.value.trim() || old;
            this.cbTabs[idx].name = val;
            inp.replaceWith(nameSpan);
            nameSpan.textContent = val;
            this._cbSaveTabs();
        };
        inp.addEventListener('blur', finish);
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') inp.blur();
            if (e.key === 'Escape') { inp.value = old; inp.blur(); }
        });
    }

    _cbSaveTabs() {
        const data = this.cbTabs.map(t => ({
            id: t.id, name: t.name,
            buttons: t.buttons.map(b => ({ label: b.label, type: b.type, file: b.file, name: b.name, group: b.group || '', x: b.x, y: b.y, w: b.w, h: b.h }))
        }));
        localStorage.setItem('Effexiq_cb_tabs', JSON.stringify(data));
    }

    cbToggleListenMode() {
        const toggleBtn = document.getElementById('cbListenToggle');
        const status = document.getElementById('cbListenStatus');
        if (this.cbListenMode) {
            this.cbListenMode = false;
            this.stopListening();
            if (toggleBtn) { toggleBtn.textContent = 'Listen'; toggleBtn.classList.remove('cb-listen-active'); }
            if (status) status.classList.add('hidden');
        } else {
            this.cbListenMode = true;
            if (toggleBtn) { toggleBtn.textContent = 'Listening...'; toggleBtn.classList.add('cb-listen-active'); }
            if (status) status.classList.remove('hidden');
            if (!this.currentMode) this.selectMode('auto');
            this.startListeningWithContext().catch(e => {
                console.warn('CB listen start failed:', e.message);
                this.cbListenMode = false;
                if (toggleBtn) { toggleBtn.textContent = 'Listen'; toggleBtn.classList.remove('cb-listen-active'); }
                if (status) status.classList.add('hidden');
            });
        }
    }

    cbShowAddModal() {
        const modal = document.getElementById('cbAddModal');
        if (!modal) return;
        // Reset form
        const label = document.getElementById('cbSoundLabel');
        const type = document.getElementById('cbSoundType');
        const search = document.getElementById('cbSoundSearch');
        const file = document.getElementById('cbSoundFile');
        const results = document.getElementById('cbSoundResults');
        if (label) label.value = '';
        if (type) type.value = 'music';
        if (search) search.value = '';
        if (file) file.value = '';
        if (results) results.innerHTML = '';
        const group = document.getElementById('cbSoundGroup');
        if (group) group.value = '';
        modal.classList.remove('hidden');

        // Show recent sounds by default
        if (this.cbRecentSounds.length > 0 && results) {
            results.innerHTML = '<div class="cb-recent-label">Recent</div>';
            for (const m of this.cbRecentSounds) {
                const item = document.createElement('div');
                item.className = 'cb-sound-result-item';
                item.innerHTML = `${escapeHtml(m.name)} <span class="cb-sound-result-type">${escapeHtml(m.type)}</span>`;
                item.addEventListener('click', () => {
                    results.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                    const fileInput = document.getElementById('cbSoundFile');
                    if (fileInput) fileInput.value = m.file;
                    const labelInput = document.getElementById('cbSoundLabel');
                    if (labelInput && !labelInput.value) labelInput.value = m.name;
                    const typeSelect = document.getElementById('cbSoundType');
                    if (typeSelect) typeSelect.value = m.type === 'music' ? 'music' : 'sfx';
                });
                results.appendChild(item);
            }
        }
    }

    cbSearchSounds(query) {
        const results = document.getElementById('cbSoundResults');
        if (!results || !query) { if (results) results.innerHTML = ''; return; }

        // Search saved sounds
        const matches = [];
        const q = query.toLowerCase();
        if (this.savedSounds && this.savedSounds.files) {
            for (const s of this.savedSounds.files) {
                const name = (s.name || '').toLowerCase();
                const kw = (s.keywords || []).join(' ').toLowerCase();
                if (name.includes(q) || kw.includes(q)) {
                    matches.push({ name: s.name, file: s.file, type: s.type || 'sfx' });
                }
                if (matches.length >= 30) break;
            }
        }

        results.innerHTML = '';
        if (matches.length === 0) {
            results.innerHTML = '<div class="cb-sound-result-item" style="color:var(--muted-2)">No matches found</div>';
            return;
        }
        for (const m of matches) {
            const item = document.createElement('div');
            item.className = 'cb-sound-result-item';
            item.innerHTML = `${escapeHtml(m.name)} <span class="cb-sound-result-type">${escapeHtml(m.type)}</span>`;
            item.addEventListener('click', () => {
                // Select this sound
                results.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                const fileInput = document.getElementById('cbSoundFile');
                if (fileInput) fileInput.value = m.file;
                const labelInput = document.getElementById('cbSoundLabel');
                if (labelInput && !labelInput.value) labelInput.value = m.name;
                const typeSelect = document.getElementById('cbSoundType');
                if (typeSelect) typeSelect.value = m.type === 'music' ? 'music' : 'sfx';
            });
            results.appendChild(item);
        }
    }

    cbConfirmAdd() {
        const label = (document.getElementById('cbSoundLabel')?.value || '').trim();
        const type = document.getElementById('cbSoundType')?.value || 'sfx';
        const file = (document.getElementById('cbSoundFile')?.value || '').trim();
        const group = document.getElementById('cbSoundGroup')?.value || '';
        if (!label || !file) { alert('Please set a label and select a sound.'); return; }

        const canvas = document.getElementById('cbCanvas');
        const cw = canvas ? canvas.clientWidth : 600;
        const x = 20 + Math.floor(Math.random() * Math.max(cw - 160, 100));
        const y = 20 + Math.floor(Math.random() * 300);

        const btn = { id: 'cb_' + Date.now(), label, type, file, name: label, group, x, y, w: 130, h: 70, playing: false, howl: null };
        this.cbPushUndo();
        this.cbButtons.push(btn);
        this.cbRender();

        // Track recent sound
        this.cbRecentSounds = this.cbRecentSounds.filter(r => r.file !== file);
        this.cbRecentSounds.unshift({ name: label, file, type });
        if (this.cbRecentSounds.length > 10) this.cbRecentSounds.length = 10;
        localStorage.setItem('Effexiq_cb_recent', JSON.stringify(this.cbRecentSounds));

        const modal = document.getElementById('cbAddModal');
        if (modal) modal.classList.add('hidden');
    }

    cbRender() {
        const canvas = document.getElementById('cbCanvas');
        if (!canvas) return;
        canvas.querySelectorAll('.cb-button').forEach(el => el.remove());
        const empty = canvas.querySelector('.cb-empty-state');
        if (empty) empty.style.display = this.cbButtons.length ? 'none' : '';

        const groupColors = { combat: '#cf6679', ambience: '#03dac6', music: '#bb86fc', npc: '#ffb74d', custom: '#81c784' };

        for (const btn of this.cbButtons) {
            const el = document.createElement('div');
            el.className = 'cb-button' + (btn.playing ? ' cb-active' : '');
            el.dataset.cbId = btn.id;
            el.style.left = btn.x + 'px';
            el.style.top = btn.y + 'px';
            el.style.width = btn.w + 'px';
            el.style.height = btn.h + 'px';
            if (btn.group && groupColors[btn.group]) {
                el.style.borderColor = groupColors[btn.group];
            }
            const groupTag = btn.group ? `<span class="cb-button-group" style="color:${groupColors[btn.group] || 'var(--text-dim)'}">${escapeHtml(btn.group)}</span>` : '';
            el.innerHTML = `<span class="cb-button-label">${escapeHtml(btn.label)}</span><span class="cb-button-type">${btn.type === 'music' ? 'Music' : 'SFX'}${groupTag}</span><button class="cb-button-delete" data-cb-del="${escapeHtml(btn.id)}">&times;</button><div class="cb-button-resize" data-cb-resize="${escapeHtml(btn.id)}"></div>`;
            // Click to play/stop
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('cb-button-delete') || e.target.classList.contains('cb-button-resize')) return;
                this.cbToggleSound(btn.id);
            });
            // Delete
            el.querySelector('.cb-button-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.cbDeleteButton(btn.id);
            });
            canvas.appendChild(el);
        }
    }

    cbToggleSound(id) {
        const btn = this.cbButtons.find(b => b.id === id);
        if (!btn) return;

        if (btn.playing) {
            // Stop
            if (btn.howl) { btn.howl.stop(); btn.howl.unload(); btn.howl = null; }
            btn.playing = false;
        } else {
            // Play
            const isMusic = btn.type === 'music';
            btn.howl = new Howl({
                src: this.buildSrcCandidates(btn.file),
                loop: isMusic,
                volume: isMusic ? 0.5 : 0.8,
                onend: () => {
                    if (!isMusic) {
                        btn.playing = false;
                        btn.howl = null;
                        this.cbRender();
                    }
                },
                onloaderror: () => {
                    alert('Failed to load sound: ' + btn.label);
                    btn.playing = false;
                    btn.howl = null;
                    this.cbRender();
                }
            });
            btn.howl.play();
            btn.playing = true;
        }
        this.cbRender();
    }

    cbDeleteButton(id) {
        this.cbPushUndo();
        const btn = this.cbButtons.find(b => b.id === id);
        if (btn && btn.howl) { btn.howl.stop(); btn.howl.unload(); }
        this.cbButtons = this.cbButtons.filter(b => b.id !== id);
        this.cbTabs[this.cbActiveTabIdx].buttons = this.cbButtons;
        this._cbSaveTabs();
        this.cbRender();
    }

    cbPushUndo() {
        const snapshot = this.cbButtons.map(b => ({ label: b.label, type: b.type, file: b.file, name: b.name, group: b.group || '', x: b.x, y: b.y, w: b.w, h: b.h }));
        this.cbUndoStack.push({ tabIdx: this.cbActiveTabIdx, buttons: snapshot });
        if (this.cbUndoStack.length > 20) this.cbUndoStack.shift();
    }

    cbUndo() {
        if (this.cbUndoStack.length === 0) return;
        const state = this.cbUndoStack.pop();
        this.cbStopAll();
        if (state.tabIdx !== undefined) this.cbActiveTabIdx = state.tabIdx;
        this.cbTabs[this.cbActiveTabIdx].buttons = (state.buttons || state).map(b => ({
            id: 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            ...b, playing: false, howl: null
        }));
        this.cbButtons = this.cbTabs[this.cbActiveTabIdx].buttons;
        this.cbRenderTabs();
        this.cbRender();
    }

    cbStopAll() {
        // Stop sounds in ALL tabs so switching tabs doesn't leave orphaned audio
        for (const tab of (this.cbTabs || [])) {
            for (const btn of tab.buttons) {
                if (btn.howl) { btn.howl.stop(); btn.howl.unload(); btn.howl = null; }
                btn.playing = false;
            }
        }
        this.cbRender();
    }

    cbMouseDown(e) {
        const target = e.target.closest('.cb-button');
        if (!target) return;
        const id = target.dataset.cbId;
        if (!id) return;

        // Check if resize handle (also check closest for touch precision)
        const resizeEl = e.target.dataset.cbResize ? e.target : e.target.closest('[data-cb-resize]');
        if (resizeEl) {
            const btn = this.cbButtons.find(b => b.id === id);
            if (btn) {
                this.cbResizing = { btn, startX: e.clientX, startY: e.clientY, startW: btn.w, startH: btn.h };
            }
            e.preventDefault();
            return;
        }

        // Drag
        if (e.target.classList.contains('cb-button-delete')) return;
        const btn = this.cbButtons.find(b => b.id === id);
        if (btn) {
            const canvas = document.getElementById('cbCanvas');
            const cRect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
            this.cbDragging = { btn, offsetX: e.clientX - cRect.left - btn.x, offsetY: e.clientY - cRect.top - btn.y };
            target.classList.add('cb-dragging');
        }
        e.preventDefault();
    }

    cbMouseMove(e) {
        if (this.cbDragging) {
            const btn = this.cbDragging.btn;
            const canvas = document.getElementById('cbCanvas');
            const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 600, height: 500 };
            btn.x = Math.max(0, Math.min(e.clientX - rect.left - this.cbDragging.offsetX + (canvas ? canvas.scrollLeft : 0), rect.width - btn.w));
            btn.y = Math.max(0, Math.min(e.clientY - rect.top - this.cbDragging.offsetY + (canvas ? canvas.scrollTop : 0), rect.height - btn.h));
            const el = document.querySelector(`[data-cb-id="${btn.id}"]`);
            if (el) { el.style.left = btn.x + 'px'; el.style.top = btn.y + 'px'; }
        }
        if (this.cbResizing) {
            const dx = e.clientX - this.cbResizing.startX;
            const dy = e.clientY - this.cbResizing.startY;
            this.cbResizing.btn.w = Math.max(80, this.cbResizing.startW + dx);
            this.cbResizing.btn.h = Math.max(50, this.cbResizing.startH + dy);
            const el = document.querySelector(`[data-cb-id="${this.cbResizing.btn.id}"]`);
            if (el) { el.style.width = this.cbResizing.btn.w + 'px'; el.style.height = this.cbResizing.btn.h + 'px'; }
        }
    }

    cbMouseUp() {
        if (this.cbDragging) {
            const el = document.querySelector(`[data-cb-id="${this.cbDragging.btn.id}"]`);
            if (el) el.classList.remove('cb-dragging');
            this.cbDragging = null;
        }
        this.cbResizing = null;
    }

    cbTouchStart(e) {
        const touch = e.touches[0];
        if (!touch) return;
        // Use elementFromPoint to get the exact element under the finger (touch targets can be imprecise)
        const realTarget = document.elementFromPoint(touch.clientX, touch.clientY) || e.target;
        this.cbMouseDown({ target: realTarget, clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
    }

    cbTouchMove(e) {
        if (!this.cbDragging && !this.cbResizing) return;
        const touch = e.touches[0];
        this.cbMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        e.preventDefault();
    }

    cbSaveBoard() {
        const name = prompt('Enter a name for this soundboard:');
        if (!name) return;
        const boards = JSON.parse(localStorage.getItem('Effexiq_cb_boards') || '[]');
        const tabs = this.cbTabs.map(t => ({
            id: t.id, name: t.name,
            buttons: t.buttons.map(b => ({ label: b.label, type: b.type, file: b.file, name: b.name, group: b.group || '', x: b.x, y: b.y, w: b.w, h: b.h }))
        }));
        const idx = boards.findIndex(b => b.name === name);
        const entry = { name, tabs, savedAt: Date.now() };
        if (idx >= 0) boards[idx] = entry; else boards.push(entry);
        localStorage.setItem('Effexiq_cb_boards', JSON.stringify(boards));
        alert('Soundboard saved!');
    }

    cbShowLoadModal() {
        const modal = document.getElementById('cbLoadModal');
        const container = document.getElementById('cbSavedBoards');
        if (!modal || !container) return;
        const boards = JSON.parse(localStorage.getItem('Effexiq_cb_boards') || '[]');
        container.innerHTML = '';
        if (boards.length === 0) {
            container.innerHTML = '<p class="info-text">No saved soundboards.</p>';
        } else {
            boards.forEach((b, i) => {
                const row = document.createElement('div');
                row.className = 'cb-saved-board-item';
                const _btnCount = b.tabs
                    ? b.tabs.reduce((t, tab) => t + (tab.buttons?.length || 0), 0)
                    : (b.buttons?.length || 0);
                row.innerHTML = `<span class="cb-saved-board-name">${escapeHtml(b.name)}</span><span class="cb-saved-board-count">${_btnCount} button${_btnCount !== 1 ? 's' : ''}</span>`;
                const delBtn = document.createElement('button');
                delBtn.className = 'cb-saved-board-delete';
                delBtn.textContent = 'Delete';
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    boards.splice(i, 1);
                    localStorage.setItem('Effexiq_cb_boards', JSON.stringify(boards));
                    this.cbShowLoadModal();
                });
                row.appendChild(delBtn);
                row.addEventListener('click', () => {
                    this.cbLoadBoard(b);
                    modal.classList.add('hidden');
                });
                container.appendChild(row);
            });
        }
        modal.classList.remove('hidden');
    }

    cbLoadBoard(board) {
        this.cbStopAll();
        if (board.tabs && Array.isArray(board.tabs) && board.tabs.length > 0) {
            // New multi-tab format
            this.cbTabs = board.tabs.map(t => ({
                id: t.id || 'tab_' + Date.now(),
                name: t.name || 'Scene',
                buttons: (t.buttons || []).map(b => ({
                    id: 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    label: b.label, type: b.type, file: b.file, name: b.name || b.label,
                    group: b.group || '', x: b.x, y: b.y, w: b.w, h: b.h, playing: false, howl: null
                }))
            }));
        } else {
            // Legacy single-tab format
            this.cbTabs = [{ id: 'tab_' + Date.now(), name: 'Main', buttons: (board.buttons || []).map(b => ({
                id: 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                label: b.label, type: b.type, file: b.file, name: b.name || b.label,
                group: b.group || '', x: b.x, y: b.y, w: b.w, h: b.h, playing: false, howl: null
            })) }];
        }
        this.cbActiveTabIdx = 0;
        this.cbButtons = this.cbTabs[0].buttons;
        this.cbRenderTabs();
        this.cbRender();
    }

    // ===== DEMO MODE =====
    setupDemoMode() {
        // Demo is now launched from hub card, no standalone button needed
    }

    async startDemo() {
        // Ensure stories are loaded before showing selector
        if (!this.stories) await this.loadStories();

        // Gather all demo stories
        const storyEntries = Object.entries(this.stories)
            .filter(([, s]) => s.demo)
            .map(([id, s]) => ({ id, title: s.title, theme: s.theme || '', description: s.description || '' }));

        if (storyEntries.length === 0) return;

        // If only one demo story, skip selector
        if (storyEntries.length === 1) {
            this.launchDemoStory(storyEntries[0].id);
            return;
        }

        // Show the story selector overlay
        const overlay = document.getElementById('demoSelectorOverlay');
        const list = document.getElementById('demoStoryList');
        const closeBtn = document.getElementById('demoSelectorClose');
        if (!overlay || !list) return;

        list.innerHTML = '';
        for (const s of storyEntries) {
            const card = document.createElement('div');
            card.className = 'demo-story-card';
            card.innerHTML = `<p class="demo-story-card-theme">${escapeHtml(s.theme)}</p><p class="demo-story-card-title">${escapeHtml(s.title)}</p><p class="demo-story-card-desc">${escapeHtml(s.description)}</p>`;
            card.addEventListener('click', () => {
                overlay.classList.add('hidden');
                this.launchDemoStory(s.id);
            });
            list.appendChild(card);
        }
        overlay.classList.remove('hidden');

        if (closeBtn) {
            closeBtn.onclick = () => overlay.classList.add('hidden');
        }
    }

    async launchDemoStory(storyId) {
        const btn = document.getElementById('demoBtn');
        if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }
        this.demoRunning = true;
        this.demoCueCache = {}; // word → resolved URL for instant playback
        this.logActivity('Demo mode starting - preloading sounds...', 'info');

        // Resume AudioContext before preloading (mobile requires user gesture)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try { await this.audioContext.resume(); } catch (_) {}
        }

        // Show loading overlay and keep it up until everything is ready
        this.showLoadingOverlay('Preparing demo sounds...');

        // Switch to auto mode for demo (suppress its own loading overlay)
        this._suppressLoadingOverlay = true;
        if (this.currentMode !== 'auto') {
            this.selectMode('auto');
        }
        this._suppressLoadingOverlay = false;

        // Bump preloadVersion so selectMode's deferred preload won't hide our overlay
        this.preloadVersion++;

        // Preload ALL demo story sounds into buffer cache
        await this.preloadDemoSounds();

        // Now everything is ready — hide the loading overlay
        this.hideLoadingOverlay();

        // Launch the selected demo story
        this.showStoryOverlay(storyId);

        // Show demo controls panel
        const controlsPanel = document.getElementById('demoControls');
        const demoStartBtn = document.getElementById('demoStartListening');
        const demoAutoBtn = document.getElementById('demoAutoReadBtn');
        const demoStopBtn = document.getElementById('demoStopBtn');
        const demoStatus = document.getElementById('demoStatusText');
        if (controlsPanel) controlsPanel.classList.remove('hidden');
        if (demoStartBtn) demoStartBtn.classList.remove('hidden');
        if (demoAutoBtn) demoAutoBtn.classList.remove('hidden');
        if (demoStopBtn) demoStopBtn.classList.add('hidden');

        if (demoStartBtn) {
            demoStartBtn.onclick = async () => {
                // Resume audio context (browser requires user gesture)
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                // Re-enable story tracking (may have been paused by Stop)
                if (this.currentStory) this.storyActive = true;
                if (demoStatus) demoStatus.textContent = 'Requesting microphone...';
                // Start listening directly — bypass the context modal
                if (!this.isListening) {
                    try {
                        await this.startListeningWithContext();
                    } catch (e) {
                        debugLog('Listen start failed:', e.message);
                        if (demoStatus) demoStatus.textContent = 'Microphone unavailable. Check browser permissions, or use Auto Read.';
                        return;
                    }
                }
                // Verify listening actually started before updating buttons
                if (!this.isListening) {
                    if (demoStatus) demoStatus.textContent = 'Microphone unavailable. Check browser permissions, or use Auto Read.';
                    return;
                }
                demoStartBtn.classList.add('hidden');
                if (demoAutoBtn) demoAutoBtn.classList.add('hidden');
                if (demoStopBtn) demoStopBtn.classList.remove('hidden');
                if (demoStatus) demoStatus.textContent = 'Listening... read the story aloud!';
                this.logActivity('Listening started - read the story aloud!', 'info');
            };
        }

        if (demoAutoBtn) {
            demoAutoBtn.onclick = async () => {
                // Resume audio context (browser requires user gesture)
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                // Disable mic so it doesn't interfere with auto-read
                if (this.isListening) this.stopListening();
                // Enable story tracking for cue sounds
                if (this.currentStory) this.storyActive = true;
                // Hide Start/Auto buttons, show Stop
                demoAutoBtn.classList.add('hidden');
                demoStartBtn.classList.add('hidden');
                if (demoStopBtn) demoStopBtn.classList.remove('hidden');
                if (demoStatus) demoStatus.textContent = 'Auto reading...';
                this.logActivity('Auto read started', 'info');
                // Start TTS auto-read
                this.startAutoRead(demoStartBtn, demoAutoBtn, demoStopBtn, demoStatus);
            };
        }

        if (demoStopBtn) {
            demoStopBtn.onclick = () => {
                // Cancel auto-read if active
                this.stopAutoRead();
                // Fully halt: bump analysis version to discard in-flight AI results
                this.analysisVersion++;
                this.analysisInProgress = false;
                // Kill the live analysis timer so no new analyses start
                if (this.analysisTimer) { clearInterval(this.analysisTimer); this.analysisTimer = null; }
                // Pause story tracking so no more cue sounds fire
                this.storyActive = false;
                // Stop all audio and speech recognition
                this.stopAllAudio();
                if (this.isListening) this.stopListening();
                demoStopBtn.classList.add('hidden');
                if (demoStartBtn) demoStartBtn.classList.remove('hidden');
                if (demoAutoBtn) demoAutoBtn.classList.remove('hidden');
                if (demoStatus) demoStatus.textContent = 'Stopped. Press Start Listening or Auto Read to resume.';
                this.logActivity('Demo stopped', 'info');
            };
        }

        if (btn) { btn.textContent = 'Stop Demo'; btn.disabled = false; btn.classList.add('demo-active'); }
        this.logActivity('Demo ready - press Start Listening when ready', 'info');
    }

    async preloadDemoSounds() {
        const cueMap = this.getStoryCueMap();
        const uniqueQueries = [...new Set(Object.values(cueMap))];
        const total = uniqueQueries.length;
        let loaded = 0;
        this.updatePreloadProgress(0, total);

        // Build reverse map: query → list of cue words
        const queryToWords = {};
        for (const [word, query] of Object.entries(cueMap)) {
            if (!queryToWords[query]) queryToWords[query] = [];
            queryToWords[query].push(word);
        }

        // Preload in batches of 5 for performance
        const batchSize = 5;
        for (let i = 0; i < uniqueQueries.length; i += batchSize) {
            const batch = uniqueQueries.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(async (query) => {
                try {
                    const url = await this.searchAudio(query, 'sfx');
                    if (url) {
                        // Map each cue word to the resolved URL for instant lookup
                        for (const w of (queryToWords[query] || [])) {
                            this.demoCueCache[w] = url;
                        }
                        // Decode and store in buffer cache for instant playback
                        if (!this.getFromBufferCache(url)) {
                            const resp = await fetch(url);
                            if (resp.ok) {
                                const ab = await resp.arrayBuffer();
                                const buf = await this.audioContext.decodeAudioData(ab);
                                this.addToBufferCache(url, buf);
                            }
                        }
                    }
                } catch (_) {}
                loaded++;
                this.updatePreloadProgress(loaded, total);
            }));
        }
        debugLog(`Demo preload complete: ${loaded}/${total} sounds cached, ${Object.keys(this.demoCueCache).length} cue words mapped`);
    }

    stopDemo() {
        this.demoRunning = false;
        this.demoCueCache = {};
        this.demoTimeouts.forEach(t => clearTimeout(t));
        this.demoTimeouts = [];
        // Clear story SFX fadeout timers
        if (this._activeStorySfx) {
            for (const entry of this._activeStorySfx.values()) { if (entry.timer) clearTimeout(entry.timer); }
            this._activeStorySfx.clear();
        }
        this.stopAllAudio();
        const controlsPanel = document.getElementById('demoControls');
        if (controlsPanel) controlsPanel.classList.add('hidden');
        const selectorOverlay = document.getElementById('demoSelectorOverlay');
        if (selectorOverlay) selectorOverlay.classList.add('hidden');
        this.hideStoryOverlay();
        if (this.isListening) this.stopListening();
        const btn = document.getElementById('demoBtn');
        if (btn) { btn.textContent = 'Demo Mode'; btn.disabled = false; btn.classList.remove('demo-active'); }
    }

    simulateSpeech(text) {
        const transcriptEl = document.getElementById('transcript');
        if (transcriptEl) transcriptEl.textContent = text;
        this.transcriptBuffer.push(text);
        this.updateTranscriptDisplay();
        this.logActivity(`Simulated: "${text.substring(0, 60)}..."`, 'info');
        if (!this.demoRunning) this.checkInstantKeywords(text);
        this.advanceStoryWithTranscript(text);
        if (this.predictionEnabled) {
            this._lastAnalyzedText = null;
            this.analysisInProgress = false;
            this.lastAnalysisTime = 0;
            this.analyzeContext(text).catch(() => {});
        }
    }

    // ===== PRELOAD PROGRESS =====
    updatePreloadProgress(loaded, total) {
        const fill = document.getElementById('preloadBarFill');
        const text = document.getElementById('preloadText');
        if (!fill) return;
        const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
        fill.style.width = `${pct}%`;
        if (text) text.textContent = `${loaded}/${total} sounds ready`;
    }

    // ===== TOAST NOTIFICATIONS =====
    showToast(message, type = 'info', duration = 8000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast-show'));

        const dismiss = () => {
            toast.classList.remove('toast-show');
            toast.classList.add('toast-hide');
            const fallback = setTimeout(() => toast.remove(), 400);
            toast.addEventListener('transitionend', () => {
                clearTimeout(fallback);
                toast.remove();
            }, { once: true });
        };

        // Click to dismiss
        toast.style.cursor = 'pointer';
        toast.addEventListener('click', () => {
            clearTimeout(autoHide);
            dismiss();
        });

        const autoHide = setTimeout(dismiss, duration);
    }

    // ===== BUTTON LOADING STATE =====
    setButtonLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.classList.add('btn-loading');
            btn.dataset.originalText = btn.textContent;
            btn.disabled = true;
        } else {
            btn.classList.remove('btn-loading');
            if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
            btn.disabled = false;
        }
    }
}

// ===== COLLAPSIBLE MENU FUNCTIONALITY =====
function initializeMenuToggles() {
    const volumeToggle = document.getElementById('volumeMenuToggle');
    const volumeContent = document.getElementById('volumeMenuContent');
    const settingsToggle = document.getElementById('settingsMenuToggle');
    const settingsContent = document.getElementById('settingsMenuContent');

    // Volume menu toggle
    if (volumeToggle && volumeContent) {
        volumeToggle.addEventListener('click', () => {
            volumeToggle.classList.toggle('active');
            volumeContent.classList.toggle('hidden');
        });
    }

    // Settings menu toggle
    if (settingsToggle && settingsContent) {
        settingsToggle.addEventListener('click', () => {
            settingsToggle.classList.toggle('active');
            settingsContent.classList.toggle('hidden');
        });
    }

    // Trigger Cooldown subsection toggle
    const triggerCooldownToggle = document.getElementById('triggerCooldownToggle');
    const triggerCooldownContent = document.getElementById('triggerCooldownContent');
    if (triggerCooldownToggle && triggerCooldownContent) {
        triggerCooldownToggle.addEventListener('click', () => {
            triggerCooldownToggle.classList.toggle('active');
            triggerCooldownContent.classList.toggle('hidden');
        });
    }

    // Scene Presets subsection toggle
    const scenePresetsToggle = document.getElementById('scenePresetsToggle');
    const scenePresetsContent = document.getElementById('scenePresetsContent');
    if (scenePresetsToggle && scenePresetsContent) {
        scenePresetsToggle.addEventListener('click', () => {
            scenePresetsToggle.classList.toggle('active');
            scenePresetsContent.classList.toggle('hidden');
        });
    }
}

// ===== EXPORTS FOR NEXT.JS =====
// Auto-initialization via DOMContentLoaded is replaced by explicit init in AppShell.jsx useEffect.
// Call initEffexiq() after the React component has mounted and the DOM is ready.
export { initializeMenuToggles };
export default Effexiq;
