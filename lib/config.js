// ===== Effexiq - CENTRALIZED CONFIGURATION =====
// All configurable constants in one place for easy tuning

/**
 * Application configuration
 * @type {Object}
 */
export const CONFIG = {
    // ===== ENVIRONMENT =====
    ENV: 'production',
    DEBUG_MODE: false, // Set to true only during local development
    VERSION: '3.0.0',
    
    // ===== API CONFIGURATION =====
    API: {
        OPENAI_MODEL: 'gpt-4o-mini',
        OPENAI_MAX_TOKENS: 300,
        OPENAI_TEMPERATURE: 0.7,
        OPENAI_KEY_PREFIX: 'sk-',
        OPENAI_KEY_MIN_LENGTH: 20,
        
        // Timeouts (milliseconds)
        FETCH_TIMEOUT: 5000,
        OPENAI_TIMEOUT: 25000,
        BACKEND_TIMEOUT: 28000,
        
        // Rate limiting
        BACKEND_COOLDOWN: 60000, // 60s cooldown after 429
        RATE_LIMIT_WINDOW: 60000,
        RATE_LIMIT_MAX: 10,
        
        // Retry configuration
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000, // Initial delay, increases exponentially
        RETRY_MULTIPLIER: 2,
    },
    
    // ===== AUDIO CONFIGURATION =====
    AUDIO: {
        // Playback limits
        MAX_SIMULTANEOUS_SFX: 3,
        MAX_SIMULTANEOUS_SOUNDS: 5,
        
        // Volume defaults
        DEFAULT_MIN_VOLUME: 0.2,
        DEFAULT_MAX_VOLUME: 0.7,
        DEFAULT_MUSIC_LEVEL: 0.5,
        DEFAULT_SFX_LEVEL: 0.9,
        DEFAULT_MOOD_BIAS: 0.5,
        
        // Ducking parameters
        DUCK_ATTACK: 0.05,
        DUCK_HOLD: 0.15,
        DUCK_RELEASE: 0.35,
        DUCK_FLOOR: 0.25,
        
        // Cache settings
        BUFFER_CACHE_SIZE: 100, // Max decoded buffers in memory
        PRELOAD_CONCURRENCY: 5, // Parallel preload limit (standard)
        PRELOAD_CONCURRENCY_LOW_LATENCY: 10, // Parallel preload limit (low latency mode)
        
        // Timing
        SFX_COOLDOWN: 3500, // Min gap between same-category SFX (ms)
        MUSIC_CHANGE_THRESHOLD: 30000, // Min time between music changes (ms)
        STINGER_MIN_DELAY: 20000,
        STINGER_MAX_DELAY: 45000,
        PRELOAD_DELAY: 300,
        
        // CDN & Sources
        R2_CDN_BASE: '', // Disabled - using local sounds
        SOUNDS_CACHE_TTL: 60000, // 60s
    },
    
    // ===== SPEECH RECOGNITION =====
    SPEECH: {
        ANALYSIS_INTERVAL: 5000, // Standard mode (ms)
        ANALYSIS_INTERVAL_LOW_LATENCY: 3000, // Low latency mode (ms)
        DEBOUNCE_DELAY: 400,
        TRANSCRIPT_BUFFER_SIZE: 30, // seconds
        
        // Voice activity detection
        VAD_ENABLED: true,
        VAD_SILENCE_THRESHOLD: 2000, // Skip analysis after 2s silence
        VAD_VOLUME_THRESHOLD: 0.01, // Minimum audio level to consider "speech"
    },
    
    // ===== PERFORMANCE =====
    PERFORMANCE: {
        // Memory management
        MEMORY_CHECK_INTERVAL: 60000, // Check every 60s
        MEMORY_WARNING_THRESHOLD: 400, // MB
        MEMORY_CRITICAL_THRESHOLD: 450, // MB
        MEMORY_FORCE_GC_THRESHOLD: 480, // MB
        
        // Cache cleanup
        CACHE_CLEANUP_INTERVAL: 300000, // Every 5 minutes
        RECENT_PLAYED_MAX_SIZE: 20,
        SOUND_CACHE_MAX_SIZE: 50,
        
        // Metrics collection
        ENABLE_METRICS: true,
        METRICS_REPORT_INTERVAL: 300000, // Report every 5 minutes
    },
    
    // ===== UI/UX =====
    UI: {
        MODE_CHANGE_VERSION_DELAY: 100,
        STATUS_MESSAGE_DURATION: 3000, // Auto-clear status messages after 3s
        LOADING_MIN_DISPLAY_TIME: 500, // Show loading for at least 500ms
        TOAST_DURATION: 4000,
        
        // Accessibility
        ENABLE_KEYBOARD_SHORTCUTS: true,
        ENABLE_SCREEN_READER: true,
        REDUCED_MOTION: false, // Will be detected from browser
    },
    
    // ===== NETWORK & CONNECTIVITY =====
    NETWORK: {
        // Circuit breaker
        CIRCUIT_BREAKER_THRESHOLD: 5, // Failures before opening circuit
        CIRCUIT_BREAKER_TIMEOUT: 30000, // 30s before retry
        CIRCUIT_BREAKER_RESET_TIMEOUT: 60000, // 60s before full reset
        
        // Health checks
        HEALTH_CHECK_INTERVAL: 120000, // Every 2 minutes
        CDN_HEALTH_CHECK_TIMEOUT: 3000,
        
        // Offline detection
        OFFLINE_CHECK_INTERVAL: 10000,
        // Use production backend health endpoint for live testing
        PING_URL: '', // No remote backend for local prototype
    },
    
    // ===== STORAGE =====
    STORAGE: {
        KEY_PREFIX: 'Effexiq_',
        KEYS: {
            API_KEY: 'api_key',
            FREESOUND_KEY: 'freesound_api_key',
            PIXABAY_KEY: 'pixabay_api_key',
            MUSIC_ENABLED: 'music_enabled',
            SFX_ENABLED: 'sfx_enabled',
            MUSIC_LEVEL: 'music_level',
            SFX_LEVEL: 'sfx_level',
            MOOD_BIAS: 'mood_bias',
            LOW_LATENCY: 'low_latency',
            PREDICTION_ENABLED: 'prediction_enabled',
            AUTO_START_STORY: 'auto_start_story_listening',
            SOUND_HISTORY: 'sound_history',
        },
    },
    
    // ===== FEATURE FLAGS =====
    FEATURES: {
        ENABLE_DEEPGRAM: false, // Discontinued
        ENABLE_CHROMA: false, // Discontinued
        ENABLE_PRELOADING: true,
        ENABLE_BUFFER_CACHE: true,
        ENABLE_INSTANT_KEYWORDS: true,
        ENABLE_STORIES_MODE: true,
        ENABLE_VOICE_COMMANDS: true,
        ENABLE_MUSIC_ROTATION: true,
        ENABLE_SPATIAL_AUDIO: true,
    },
    
    // ===== BACKEND URLS =====
    BACKEND: {
        PRODUCTION: '', // No remote backend for local prototype
        LOCAL: 'http://localhost:8080',
        // Will auto-detect based on hostname
    },
};

/**
 * Get backend URL based on environment
 * @returns {string} Backend base URL
 */
export function getBackendUrl() {
    if (typeof window !== 'undefined' && window.Effexiq_BACKEND_URL) {
        return window.Effexiq_BACKEND_URL;
    }
    
    const host = location.hostname || '';
    if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1') {
        return CONFIG.BACKEND.LOCAL;
    }
    
    return CONFIG.BACKEND.PRODUCTION;
}

/**
 * Check if running in development mode
 * @returns {boolean}
 */
export function isDevelopment() {
    return CONFIG.DEBUG_MODE || CONFIG.ENV === 'development';
}

/**
 * Get configuration value with optional override
 * @param {string} path - Dot notation path (e.g., 'AUDIO.MAX_SIMULTANEOUS_SFX')
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Configuration value
 */
export function getConfig(path, defaultValue = null) {
    const parts = path.split('.');
    let value = CONFIG;
    
    for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
            value = value[part];
        } else {
            return defaultValue;
        }
    }
    
    return value;
}

/**
 * Update configuration at runtime (for testing/debugging)
 * @param {string} path - Dot notation path
 * @param {*} value - New value
 */
export function setConfig(path, value) {
    if (!isDevelopment()) {
        console.warn('setConfig should only be used in development');
        return;
    }
    
    const parts = path.split('.');
    const last = parts.pop();
    let obj = CONFIG;
    
    for (const part of parts) {
        if (!(part in obj)) {
            obj[part] = {};
        }
        obj = obj[part];
    }
    
    obj[last] = value;
    console.log(`Config updated: ${path} = ${value}`);
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.Effexiq_CONFIG = CONFIG;
    window.Effexiq_getConfig = getConfig;
    if (isDevelopment()) {
        window.Effexiq_setConfig = setConfig;
    }
}

export default CONFIG;
