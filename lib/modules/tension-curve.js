/**
 * Tension curve — a rolling intensity score that reacts to mood, pacing,
 * and event density. Used to modulate reverb wet, music volume, and
 * stinger cadence so the mix arc follows the narrative arc.
 *
 * Output is a number in [0, 1]:
 *   0.0  = flat / peaceful
 *   0.5  = normal storytelling
 *   1.0  = peak tension (fight scene, jump scare, climax)
 *
 * The curve decays toward the mood baseline when no events fire, so
 * tension never sticks at max forever.
 */

const DECAY_PER_SEC = 0.10;      // drop 10% per second when idle
const EVENT_BUMP    = 0.14;      // each SFX event bumps tension
const WORD_BUMP     = 0.002;     // each spoken word nudges tension up (tiny)

const MOOD_BASELINE = {
    calm:       0.15,
    happy:      0.25,
    sad:        0.35,
    neutral:    0.40,
    excited:    0.55,
    mysterious: 0.55,
    tense:      0.70,
    ominous:    0.72,
    angry:      0.80,
    fearful:    0.85,
};

export class TensionCurve {
    constructor() {
        this._value = 0.4;
        this._lastUpdate = Date.now();
        this._baseline = 0.4;
    }

    get value() { return this._value; }

    setMood(primary, intensity = 0.5) {
        const base = MOOD_BASELINE[primary] ?? 0.4;
        // mood baseline tracks primary mood, scaled softly by intensity.
        this._baseline = Math.max(0.1, Math.min(0.95, base * (0.7 + intensity * 0.6)));
    }

    /** Call when a new SFX event fires. */
    bumpEvent(count = 1) {
        this._tick();
        this._value = Math.min(1, this._value + EVENT_BUMP * count);
    }

    /** Call when N new words are spoken. */
    bumpWords(n = 1) {
        this._tick();
        this._value = Math.min(1, this._value + WORD_BUMP * Math.max(0, n));
    }

    /** Drive the curve toward baseline with time. */
    _tick(now) {
        now = now || Date.now();
        const dt = Math.max(0, (now - this._lastUpdate) / 1000);
        this._lastUpdate = now;
        if (dt === 0) return this._value;

        // exponential decay toward baseline
        const diff = this._value - this._baseline;
        const decayed = this._baseline + diff * Math.exp(-DECAY_PER_SEC * dt * Math.PI);
        this._value = Math.max(0, Math.min(1, decayed));
        return this._value;
    }

    sample() { return this._tick(); }

    /** Suggested reverb wet gain (0..0.6). Deeper reverb at higher tension. */
    reverbWet() {
        const v = this.sample();
        return 0.05 + v * 0.35; // 0.05 calm → 0.40 peak
    }

    /** Suggested music volume multiplier (0.4..1.0). Quieter at peak tension. */
    musicDuck() {
        const v = this.sample();
        // Music pulls back under high tension so SFX punch through.
        return 1.0 - v * 0.35;
    }

    /** Suggested stinger-cadence multiplier. Faster when tense. */
    stingerCadence() {
        const v = this.sample();
        return Math.max(0.5, 1.6 - v); // 1.6x slow-down when calm, 0.6x speed-up when peak
    }
}
