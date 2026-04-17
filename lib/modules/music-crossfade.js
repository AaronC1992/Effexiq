/**
 * WebAudio music crossfade.
 *
 * The engine currently hard-cuts between music tracks. This helper
 * wires two gain nodes in parallel so one fades out while the other
 * fades in. It works against the engine's existing musicGainNode by
 * inserting a small A/B bus in front of it.
 *
 * Two modes:
 *
 *   1. Howl-based tracks (current engine path)
 *        new Howl({ src, html5: false });
 *      We connect the Howl's underlying AudioNode via Howler's internal
 *      graph. When that's not accessible we fall back to volume fades
 *      on both Howls — still sounds like a crossfade, just without
 *      shared compression.
 *
 *   2. Raw AudioBufferSource path
 *        Fully native — both sources route through parallel gains
 *        connected to the engine's musicGainNode.
 */

const DEFAULT_FADE_MS = 1200;

export class MusicCrossfader {
    /**
     * @param {AudioContext} audioContext
     * @param {AudioNode} destination  usually engine.musicGainNode
     */
    constructor(audioContext, destination) {
        this.ctx = audioContext;
        this.destination = destination;
        /** @type {'a'|'b'} */ this.active = 'a';
        this.a = this._mkBus();
        this.b = this._mkBus();
    }

    _mkBus() {
        const g = this.ctx.createGain();
        g.gain.value = 0;
        g.connect(this.destination);
        return { gain: g, source: null, howl: null, startedAt: 0 };
    }

    getActiveBus()   { return this.active === 'a' ? this.a : this.b; }
    getInactiveBus() { return this.active === 'a' ? this.b : this.a; }

    /**
     * Crossfade to a new AudioBufferSourceNode. The source must NOT be
     * connected yet — this method wires it to the inactive bus.
     *
     * @param {AudioBufferSourceNode} nextSource
     * @param {number} targetVolume 0..1
     * @param {number} fadeMs
     */
    crossfadeToSource(nextSource, targetVolume = 0.7, fadeMs = DEFAULT_FADE_MS) {
        const now = this.ctx.currentTime;
        const fadeS = fadeMs / 1000;

        const inactive = this.getInactiveBus();
        const active   = this.getActiveBus();

        // wire new source → inactive bus
        nextSource.connect(inactive.gain);
        inactive.source = nextSource;
        inactive.howl = null;
        inactive.startedAt = Date.now();
        inactive.gain.gain.cancelScheduledValues(now);
        inactive.gain.gain.setValueAtTime(0, now);
        inactive.gain.gain.linearRampToValueAtTime(targetVolume, now + fadeS);

        // fade out the currently-active bus
        const currentVol = active.gain.gain.value;
        active.gain.gain.cancelScheduledValues(now);
        active.gain.gain.setValueAtTime(currentVol, now);
        active.gain.gain.linearRampToValueAtTime(0, now + fadeS);

        // stop the old source after the fade completes
        const oldSource = active.source;
        setTimeout(() => {
            try { oldSource?.stop?.(); } catch {}
            try { oldSource?.disconnect?.(); } catch {}
            if (active.source === oldSource) active.source = null;
        }, fadeMs + 80);

        this.active = this.active === 'a' ? 'b' : 'a';
    }

    /**
     * Fallback when we only have Howl references (no direct AudioNode):
     * fade via each Howl's own volume.
     */
    crossfadeToHowl(nextHowl, targetVolume = 0.7, fadeMs = DEFAULT_FADE_MS) {
        const inactive = this.getInactiveBus();
        const active   = this.getActiveBus();

        try {
            nextHowl.volume(0);
            if (!nextHowl.playing()) nextHowl.play();
            nextHowl.fade(0, targetVolume, fadeMs);
        } catch {}
        inactive.howl = nextHowl;
        inactive.source = null;
        inactive.startedAt = Date.now();

        const oldHowl = active.howl;
        if (oldHowl) {
            try {
                const cur = oldHowl.volume();
                oldHowl.fade(cur, 0, fadeMs);
            } catch {}
            setTimeout(() => {
                try { oldHowl.stop(); } catch {}
                if (active.howl === oldHowl) active.howl = null;
            }, fadeMs + 80);
        }

        this.active = this.active === 'a' ? 'b' : 'a';
    }

    /** Cut both buses to silence without a fade. */
    silence() {
        const now = this.ctx.currentTime;
        for (const bus of [this.a, this.b]) {
            bus.gain.gain.cancelScheduledValues(now);
            bus.gain.gain.setValueAtTime(0, now);
            try { bus.source?.stop?.(); } catch {}
            try { bus.howl?.stop?.(); } catch {}
            bus.source = null;
            bus.howl = null;
        }
    }

    destroy() {
        this.silence();
        try { this.a.gain.disconnect(); } catch {}
        try { this.b.gain.disconnect(); } catch {}
    }
}
