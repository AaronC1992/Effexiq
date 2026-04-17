/**
 * requestAnimationFrame coalescer.
 *
 * The engine has several independent rAF loops (visualizer, pacing,
 * scene-bed ducking, perf sampler). On slower devices those frames
 * stack and cause jank. This module provides a single shared rAF
 * loop that invokes all registered callbacks in one frame.
 *
 * Usage:
 *   const ticker = getSharedTicker();
 *   const handle = ticker.add(ts => drawVisualizer(ts));
 *   // later
 *   ticker.remove(handle);
 *
 * Also exposes throttle(fn, hz) helper for work that should run at a
 * fixed rate (e.g., 10Hz perf sampling) regardless of rAF cadence.
 */

let _ticker = null;

export function getSharedTicker() {
    if (_ticker) return _ticker;
    _ticker = new SharedTicker();
    return _ticker;
}

class SharedTicker {
    constructor() {
        this.callbacks = new Map(); // handle -> fn
        this._handle = 0;
        this._rafId = null;
        this._loop = this._loop.bind(this);
    }

    add(fn) {
        if (typeof fn !== 'function') return null;
        const id = ++this._handle;
        this.callbacks.set(id, fn);
        this._start();
        return id;
    }

    remove(id) {
        const removed = this.callbacks.delete(id);
        if (this.callbacks.size === 0) this._stop();
        return removed;
    }

    _start() {
        if (this._rafId != null) return;
        if (typeof requestAnimationFrame === 'undefined') return;
        this._rafId = requestAnimationFrame(this._loop);
    }

    _stop() {
        if (this._rafId != null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this._rafId);
        }
        this._rafId = null;
    }

    _loop(ts) {
        // Snapshot to insulate against callbacks mutating the map.
        const list = [...this.callbacks.values()];
        for (const fn of list) {
            try { fn(ts); } catch (e) { /* one bad callback mustn't kill the ticker */ }
        }
        if (this.callbacks.size > 0) {
            this._rafId = requestAnimationFrame(this._loop);
        } else {
            this._rafId = null;
        }
    }

    getStats() { return { callbacks: this.callbacks.size, running: this._rafId != null }; }
}

/**
 * Throttle a function to `hz` calls per second. Returns a wrapped
 * function and a cancel() method.
 */
export function throttle(fn, hz = 10) {
    const interval = 1000 / Math.max(1, hz);
    let last = 0;
    let pending = null;
    let timer = null;
    const wrapped = (...args) => {
        const now = Date.now();
        const remaining = interval - (now - last);
        if (remaining <= 0) {
            last = now;
            fn(...args);
        } else {
            pending = args;
            if (!timer) {
                timer = setTimeout(() => {
                    last = Date.now();
                    timer = null;
                    const a = pending; pending = null;
                    if (a) fn(...a);
                }, remaining);
            }
        }
    };
    wrapped.cancel = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        pending = null;
    };
    return wrapped;
}
