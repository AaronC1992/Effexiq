/**
 * Local keyword classifier — offline fallback for /api/analyze.
 *
 * When the OpenAI call fails, rate-limits, or is explicitly disabled,
 * this module returns a best-effort decision based on pure keyword
 * matching. No network, no async, no dependencies.
 *
 * It's deliberately conservative: it will never invent a mood swing
 * or a music change it isn't confident about. The client-side rule-
 * based path (already in the engine) merges this as a starting point.
 */

const MOOD_KEYWORDS = {
    tense:      ['tense', 'danger', 'threat', 'threatening', 'hiding', 'creeping', 'stalking', 'chase', 'chased', 'warning', 'quiet', 'silent', 'still'],
    fearful:    ['afraid', 'scared', 'terror', 'terrified', 'horror', 'horrified', 'panic', 'panicked', 'dread', 'fear', 'frozen', 'shivered', 'trembled'],
    ominous:    ['shadow', 'shadows', 'darkness', 'cold', 'empty', 'abandoned', 'unnatural', 'wrong', 'eerie', 'unsettling', 'foreboding', 'grim', 'black'],
    mysterious: ['mystery', 'mysterious', 'strange', 'odd', 'curious', 'hidden', 'secret', 'unknown', 'ancient', 'forgotten', 'whisper', 'whispered'],
    angry:      ['angry', 'rage', 'raged', 'fury', 'furious', 'shouted', 'yelled', 'roared', 'slammed', 'smashed', 'crash', 'crashed'],
    sad:        ['sad', 'tears', 'cried', 'crying', 'wept', 'sobbed', 'mourned', 'mourning', 'grief', 'lonely', 'loss', 'gone'],
    happy:      ['happy', 'laughed', 'laughing', 'laughter', 'joy', 'joyful', 'smile', 'smiled', 'cheered', 'celebrate', 'celebration'],
    excited:    ['excited', 'thrilled', 'amazing', 'incredible', 'fantastic', 'wow', 'yes', 'ready', 'charged', 'pumped'],
    calm:       ['calm', 'peaceful', 'serene', 'gentle', 'soft', 'quiet', 'restful', 'warm', 'safe', 'slept', 'dreaming'],
};

const LOCATION_KEYWORDS = {
    forest:   ['forest', 'woods', 'trees', 'grove', 'thicket', 'underbrush'],
    cave:     ['cave', 'caves', 'cavern', 'tunnel', 'underground', 'dungeon'],
    tavern:   ['tavern', 'inn', 'pub', 'bar', 'mead hall'],
    castle:   ['castle', 'keep', 'fortress', 'throne room', 'great hall'],
    cottage:  ['cottage', 'cabin', 'hut', 'house', 'home'],
    ocean:    ['ocean', 'sea', 'beach', 'shore', 'waves', 'tide', 'ship'],
    city:     ['city', 'town', 'street', 'alley', 'market', 'square'],
    battle:   ['battle', 'battlefield', 'war', 'skirmish', 'siege'],
};

const WEATHER_KEYWORDS = {
    rain:   ['rain', 'raining', 'rained', 'downpour', 'drizzle'],
    storm:  ['storm', 'thunder', 'lightning', 'tempest'],
    snow:   ['snow', 'snowing', 'blizzard', 'frost'],
    fog:    ['fog', 'mist', 'misty', 'foggy', 'haze'],
    wind:   ['wind', 'windy', 'gale', 'howling wind', 'breeze'],
};

const TIME_KEYWORDS = {
    dawn: ['dawn', 'sunrise', 'early morning', 'first light'],
    day:  ['noon', 'midday', 'afternoon', 'daylight'],
    dusk: ['dusk', 'sunset', 'twilight', 'evening'],
    night:['night', 'nighttime', 'midnight', 'dark'],
};

// Keywords that flag a NEW discrete event (so SFX can be justified).
const EVENT_KEYWORDS = {
    'door knock':     ['knock', 'knocked', 'knocking'],
    'door slam':      ['slam', 'slammed', 'slamming'],
    'door creak':     ['creak', 'creaked', 'creaking'],
    'thunder':        ['thunderclap', 'thundered'],
    'scream':         ['scream', 'screamed', 'shriek', 'shrieked'],
    'glass break':    ['shatter', 'shattered', 'shattering'],
    'footsteps':      ['footsteps', 'footstep'],
    'wolf howl':      ['howl', 'howled', 'howling'],
    'metal crash':    ['crash', 'crashed', 'crashing'],
};

function tokenize(text) {
    return String(text || '').toLowerCase().match(/[a-z']+/g) || [];
}

function bestMatch(tokens, dict) {
    let best = null;
    let bestScore = 0;
    for (const [label, words] of Object.entries(dict)) {
        let score = 0;
        for (const w of words) if (tokens.includes(w)) score++;
        if (score > bestScore) { bestScore = score; best = label; }
    }
    return { label: best, score: bestScore };
}

/**
 * Classify a transcript into a compact decision object with the same
 * shape as /api/analyze returns. Never throws.
 *
 * @param {string} transcript
 * @param {object} [opts]
 * @param {string} [opts.mode] optional mode to bias defaults
 * @returns {object}
 */
export function classifyLocal(transcript, opts = {}) {
    const tokens = tokenize(transcript);
    const mood = bestMatch(tokens, MOOD_KEYWORDS);
    const loc  = bestMatch(tokens, LOCATION_KEYWORDS);
    const wx   = bestMatch(tokens, WEATHER_KEYWORDS);
    const tod  = bestMatch(tokens, TIME_KEYWORDS);

    // Only emit an SFX if a clear present/past-discrete event is in the transcript.
    const sfx = [];
    for (const [id, words] of Object.entries(EVENT_KEYWORDS)) {
        if (words.some(w => tokens.includes(w))) {
            sfx.push({ id, intent: 'event', when: 'immediate', volume: 0.7, tags: [id.split(' ')[0]], confidence: 0.5 });
            if (sfx.length >= 2) break;
        }
    }

    const intensity = Math.min(1, 0.25 + mood.score * 0.15);
    const confidence = Math.min(0.7, 0.2 + (mood.score + loc.score + wx.score) * 0.08);

    return {
        scene: loc.label || null,
        mood: {
            primary: mood.label || 'neutral',
            intensity,
        },
        confidence,
        worldState: {
            location: loc.label || null,
            weather: wx.label || null,
            timeOfDay: tod.label || null,
        },
        // Don't change music from the local classifier; let the engine's
        // rule-based path or the next successful AI call decide.
        music: { id: null, action: 'play_or_continue', volume: 0.5 },
        sfx,
        _source: 'local-classifier',
        _mode: opts.mode || null,
    };
}
