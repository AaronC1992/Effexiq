/**
 * SFX → music sidechain ducking.
 *
 * Classic radio-style trick: when an SFX hits the bus, pull the music
 * down for a moment so the SFX cuts through, then release. Unlike a
 * static duck, this is triggered by actual SFX audio content so it
 * only fires when there's something to duck under.
 *
 * Implementation: we poll the analyser of the SFX bus at ~30Hz and,
 * when the envelope crosses a threshold, ramp the music gain down,
 * hold, and release. This approximates a sidechain compressor without
 * needing the experimental AudioWorklet path.
 *
 * Usage:
 *   const duck = installSidechainDuck({
 *     audioContext: ctx,
 *     sfxBus: sfxBusGain,
 *     musicGain: musicGainNode,
 *   });
 *   // later
 *   duck.destroy();
 */

const DEFAULTS = {
    threshold: 0.18,  // 0..1 amplitude that triggers ducking
    depth:    0.55,   // music dips to 55% of current volume
    attackMs:  60,
    holdMs:   160,
    releaseMs: 280,
    pollHz:    30,
};

export function installSidechainDuck({ audioContext, sfxBus, musicGain, options = {} } = {}) {
    if (!audioContext || !sfxBus || !musicGain) return { destroy: () => {} };

    const cfg = { ...DEFAULTS, ...options };

    // Tap the SFX bus with a detector analyser so we never interfere with playback.
    const detector = audioContext.createAnalyser();
    detector.fftSize = 256;
    detector.smoothingTimeConstant = 0.2;
    try { sfxBus.connect(detector); } catch { return { destroy: () => {} }; }

    const buf = new Uint8Array(detector.fftSize);
    let ducking = false;
    let releaseTimer = null;
    let lastTrigger = 0;
    let _alive = true;

    const poll = () => {
        if (!_alive) return;
        detector.getByteTimeDomainData(buf);
        // peak envelope (0..1)
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
            const v = Math.abs(buf[i] - 128) / 128;
            if (v > peak) peak = v;
        }

        const now = performance.now();
        if (peak > cfg.threshold && now - lastTrigger > cfg.attackMs) {
            lastTrigger = now;
            trigger();
        }
    };

    const interval = setInterval(poll, 1000 / cfg.pollHz);

    const trigger = () => {
        const now = audioContext.currentTime;
        const cur = musicGain.gain.value || 0.0001;
        if (!ducking) {
            ducking = true;
            // pull down fast
            musicGain.gain.cancelScheduledValues(now);
            musicGain.gain.setValueAtTime(cur, now);
            musicGain.gain.linearRampToValueAtTime(cur * cfg.depth, now + cfg.attackMs / 1000);
        } else {
            // extend hold; don't reset ramp.
        }
        if (releaseTimer) clearTimeout(releaseTimer);
        releaseTimer = setTimeout(() => {
            const t = audioContext.currentTime;
            const v = musicGain.gain.value;
            // Divide by depth to recover the pre-duck level.
            const target = Math.min(1, v / Math.max(0.05, cfg.depth));
            musicGain.gain.cancelScheduledValues(t);
            musicGain.gain.setValueAtTime(v, t);
            musicGain.gain.linearRampToValueAtTime(target, t + cfg.releaseMs / 1000);
            ducking = false;
            releaseTimer = null;
        }, cfg.holdMs);
    };

    return {
        setThreshold(v) { cfg.threshold = Math.max(0, Math.min(1, v)); },
        setDepth(v)     { cfg.depth     = Math.max(0.05, Math.min(1, v)); },
        destroy() {
            _alive = false;
            clearInterval(interval);
            if (releaseTimer) clearTimeout(releaseTimer);
            try { sfxBus.disconnect(detector); } catch {}
        },
    };
}
