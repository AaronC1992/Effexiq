// ===== Effexiq SOUND ENGINE UTILITIES =====
// Pure audio utility functions extracted from game.js

/**
 * Compute a normalization gain for an audio buffer.
 * Uses combined peak and RMS analysis for perceptually consistent volume.
 * @param {AudioBuffer} buffer - decoded audio buffer
 * @returns {number} gain multiplier (0.5 to 3.0)
 */
export function computeNormalizationGain(buffer) {
    if (!buffer || !buffer.numberOfChannels) return 1.0;
    const data = buffer.getChannelData(0);
    let peak = 0;
    let sumSq = 0;
    let sampleCount = 0;
    // Sample every 100th value for performance
    for (let i = 0; i < data.length; i += 100) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
        sumSq += data[i] * data[i];
        sampleCount++;
    }
    if (peak < 0.01) return 1.0; // silence
    const rms = Math.sqrt(sumSq / sampleCount);
    // Target: peak of 0.8 and RMS of ~0.2 (typical for well-normalized audio)
    const peakGain = 0.8 / peak;
    const rmsGain = rms > 0.001 ? 0.2 / rms : 1.0;
    // Weighted blend: 60% peak, 40% RMS for perceptual balance
    const blended = peakGain * 0.6 + rmsGain * 0.4;
    return Math.min(3.0, Math.max(0.5, blended));
}

/**
 * Calculate effective volume from intensity and min/max bounds.
 * @param {number} intensity - 0.0 to 1.0
 * @param {number} minVolume - minimum volume
 * @param {number} maxVolume - maximum volume
 * @returns {number} effective volume
 */
export function calculateVolume(intensity, minVolume = 0.3, maxVolume = 1.0) {
    return minVolume + (maxVolume - minVolume) * Math.max(0, Math.min(1, intensity));
}

/**
 * Categorize a sound effect query into a bucket for cooldown tracking.
 * @param {string} query - search query or sound description
 * @returns {string} bucket name
 */
export function getSfxBucket(query) {
    if (!query) return 'other';
    const q = query.toLowerCase();
    const buckets = [
        ['bark', 'woof', 'dog'],
        ['gunshot', 'gun', 'shot', 'bullet'],
        ['explosion', 'boom', 'blast', 'bang'],
        ['sword', 'blade', 'clash', 'metal'],
        ['footstep', 'steps', 'walking', 'running'],
        ['door', 'knock', 'creak'],
        ['thunder', 'lightning', 'storm'],
        ['scream', 'shriek', 'yell'],
        ['howl', 'wolf', 'growl'],
        ['splash', 'water'],
        ['fire', 'flame', 'crackling'],
        ['wind', 'whoosh', 'breeze'],
        ['bell', 'chime', 'ding'],
        ['crowd', 'cheer', 'applause'],
    ];
    for (const words of buckets) {
        for (const w of words) {
            if (q.includes(w)) return words[0];
        }
    }
    return 'other';
}

/**
 * Get duck parameters adjusted for mood intensity.
 * @param {number} moodBias - 0.0 to 1.0
 * @param {Object} baseDuckParams - { attack, hold, release, floor }
 * @returns {Object} adjusted duck parameters
 */
export function getDuckParams(moodBias, baseDuckParams) {
    const base = baseDuckParams || { attack: 0.05, hold: 0.15, release: 0.35, floor: 0.25 };
    // More intense moods → deeper ducking
    const floor = Math.max(0.1, base.floor - (moodBias * 0.15));
    return {
        attack: base.attack,
        hold: base.hold + (moodBias * 0.1),
        release: base.release,
        floor
    };
}

/**
 * Shuffle an array in-place using Fisher-Yates.
 * @param {Array} array
 * @returns {Array} same array, shuffled
 */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
