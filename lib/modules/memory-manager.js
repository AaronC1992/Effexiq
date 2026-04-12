// ===== MEMORY MANAGER - LRU cache and memory monitoring =====

import { CONFIG } from '../config.js';

/**
 * LRU (Least Recently Used) Cache implementation
 */
export class LRUCache {
    constructor(maxSize = CONFIG.AUDIO.BUFFER_CACHE_SIZE) {
        this.maxSize = maxSize;
        this.cache = new Map(); // Map preserves insertion order; first key = LRU, last key = MRU
    }
    
    /**
     * Get value from cache
     * @param {string} key
     * @returns {*} Value or undefined
     */
    get(key) {
        if (!this.cache.has(key)) {
            return undefined;
        }
        
        // Move to end (most recently used) by re-inserting — O(1)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }
    
    /**
     * Set value in cache
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
        // Delete first so re-insertion moves key to end (MRU) — O(1)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        
        // Evict least recently used if at capacity
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        
        this.cache.set(key, value);
    }
    
    /**
     * Check if key exists
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.cache.has(key);
    }
    
    /**
     * Delete specific key
     * @param {string} key
     * @returns {boolean} True if deleted
     */
    delete(key) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
            return true;
        }
        return false;
    }
    
    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
    }
    
    /**
     * Get current cache size
     * @returns {number}
     */
    size() {
        return this.cache.size;
    }
    
    /**
     * Get cache statistics
     * @returns {Object}
     */
    getStats() {
        let totalSize = 0;
        
        // Estimate memory usage
        for (const [key, value] of this.cache) {
            totalSize += key.length * 2; // UTF-16 characters
            if (value instanceof AudioBuffer) {
                // AudioBuffer: duration * sampleRate * channels * 4 bytes per sample
                totalSize += value.duration * value.sampleRate * value.numberOfChannels * 4;
            } else if (value) {
                totalSize += JSON.stringify(value).length * 2;
            }
        }
        
        const keys = [...this.cache.keys()];
        return {
            entries: this.cache.size,
            maxSize: this.maxSize,
            utilizationPercent: Math.round((this.cache.size / this.maxSize) * 100),
            estimatedMemoryMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
            oldestKey: keys[0],
            newestKey: keys[keys.length - 1]
        };
    }
    
    /**
     * Evict least recently used item
     * @private
     */
    evictLRU() {
        if (this.cache.size === 0) return;
        
        // First key in Map is LRU (oldest insertion) — O(1)
        const lruKey = this.cache.keys().next().value;
        const evicted = this.cache.get(lruKey);
        this.cache.delete(lruKey);
        
        if (CONFIG.DEBUG_MODE) {
            console.log(`[LRU] Evicted: ${lruKey}`);
        }
        
        // Unload AudioBuffer if applicable
        if (evicted && typeof evicted.unload === 'function') {
            evicted.unload();
        }
    }
    
}


/**
 * Memory monitor with automatic cleanup
 */
export class MemoryMonitor {
    constructor() {
        this.checkInterval = null;
        this.metrics = {
            peakMemory: 0,
            currentMemory: 0,
            warnings: 0,
            forcedGCs: 0
        };
        this.onWarning = null;
        this.onCritical = null;
    }
    
    /**
     * Start monitoring
     */
    start() {
        if (this.checkInterval) return;
        
        this.checkInterval = setInterval(() => {
            this.checkMemory();
        }, CONFIG.PERFORMANCE.MEMORY_CHECK_INTERVAL);
        
        console.log('[MemoryMonitor] Started');
    }
    
    /**
     * Stop monitoring
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    
    /**
     * Check current memory usage
     */
    checkMemory() {
        if (!performance.memory) {
            return; // Not supported in this browser
        }
        
        const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
        
        this.metrics.currentMemory = usedMB;
        if (usedMB > this.metrics.peakMemory) {
            this.metrics.peakMemory = usedMB;
        }
        
        if (CONFIG.DEBUG_MODE) {
            console.log(`[Memory] Used: ${usedMB}MB / ${totalMB}MB (Limit: ${limitMB}MB)`);
        }
        
        // Warning threshold
        if (usedMB > CONFIG.PERFORMANCE.MEMORY_WARNING_THRESHOLD) {
            this.metrics.warnings++;
            console.warn(`⚠ Memory usage high: ${usedMB}MB`);
            if (this.onWarning) this.onWarning(usedMB);
        }
        
        // Critical threshold - force cleanup
        if (usedMB > CONFIG.PERFORMANCE.MEMORY_CRITICAL_THRESHOLD) {
            console.error(`🔴 Memory usage critical: ${usedMB}MB - forcing cleanup`);
            if (this.onCritical) this.onCritical(usedMB);
            this.forceCleanup();
        }
        
        // Very critical - try to trigger GC
        if (usedMB > CONFIG.PERFORMANCE.MEMORY_FORCE_GC_THRESHOLD) {
            this.triggerGC();
        }
    }
    
    /**
     * Force cleanup of caches
     */
    forceCleanup() {
        // Emit event for app to clean up
        window.dispatchEvent(new CustomEvent('Effexiq:memory-critical', {
            detail: { memoryUsageMB: this.metrics.currentMemory }
        }));
    }
    
    /**
     * Attempt to trigger garbage collection
     */
    triggerGC() {
        this.metrics.forcedGCs++;
        
        if (window.gc) {
            console.warn('[MemoryMonitor] Forcing garbage collection');
            window.gc();
        }
        // Note: do NOT create large arrays here — that increases memory pressure rather than relieving it
    }
    
    /**
     * Get memory statistics
     * @returns {Object}
     */
    getStats() {
        const memory = performance.memory;
        if (!memory) {
            return {
                supported: false,
                message: 'Memory API not supported in this browser'
            };
        }
        
        return {
            supported: true,
            currentMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
            totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
            limitMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
            peakMB: this.metrics.peakMemory,
            warnings: this.metrics.warnings,
            forcedGCs: this.metrics.forcedGCs
        };
    }
}

/**
 * Cache manager with automatic cleanup
 */
export class CacheManager {
    constructor() {
        this.caches = new Map();
        this.cleanupInterval = null;
    }
    
    /**
     * Register a cache for management
     * @param {string} name - Cache name
     * @param {LRUCache} cache - Cache instance
     */
    register(name, cache) {
        this.caches.set(name, cache);
    }
    
    /**
     * Start automatic cleanup
     */
    start() {
        if (this.cleanupInterval) return;
        
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, CONFIG.PERFORMANCE.CACHE_CLEANUP_INTERVAL);
        
        // Listen for memory critical events
        window.addEventListener('Effexiq:memory-critical', () => {
            this.emergencyCleanup();
        });
    }
    
    /**
     * Stop automatic cleanup
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    
    /**
     * Regular cleanup - remove old entries
     */
    cleanup() {
        for (const [name, cache] of this.caches) {
            if (cache instanceof LRUCache) {
                const stats = cache.getStats();
                if (stats.utilizationPercent > 80) {
                    console.log(`[CacheManager] ${name} at ${stats.utilizationPercent}% capacity`);
                }
            }
        }
    }
    
    /**
     * Emergency cleanup - clear 50% of all caches
     */
    emergencyCleanup() {
        console.warn('[CacheManager] Emergency cleanup triggered');
        
        for (const [name, cache] of this.caches) {
            if (cache instanceof LRUCache) {
                const itemsToRemove = Math.ceil(cache.size() / 2);
                for (let i = 0; i < itemsToRemove; i++) {
                    cache.evictLRU();
                }
                console.log(`[CacheManager] Cleared ${itemsToRemove} items from ${name}`);
            } else if (cache instanceof Map) {
                // Regular Map - clear half
                const keys = Array.from(cache.keys());
                const toRemove = keys.slice(0, Math.ceil(keys.length / 2));
                toRemove.forEach(key => cache.delete(key));
                console.log(`[CacheManager] Cleared ${toRemove.length} items from ${name}`);
            }
        }
    }
    
    /**
     * Get statistics for all caches
     * @returns {Object}
     */
    getAllStats() {
        const stats = {};
        for (const [name, cache] of this.caches) {
            if (cache instanceof LRUCache) {
                stats[name] = cache.getStats();
            } else if (cache instanceof Map) {
                stats[name] = {
                    entries: cache.size,
                    type: 'Map'
                };
            }
        }
        return stats;
    }
}

export default {
    LRUCache,
    MemoryMonitor,
    CacheManager
};
