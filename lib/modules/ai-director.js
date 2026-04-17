// ===== Effexiq AI DIRECTOR =====
// AI prompt building and sound decision processing

/**
 * Mode context descriptions for AI prompts.
 */
export const MODE_CONTEXTS = {
    bedtime: 'soothing bedtime story with calm, gentle atmosphere',
    dnd: 'Dungeons & Dragons campaign with fantasy adventure elements',
    horror: 'horror storytelling with tense, eerie, suspenseful atmosphere',
    christmas: 'festive Christmas storytelling with joyful, magical, winter holiday atmosphere',
    halloween: 'spooky Halloween atmosphere with playful scares, autumn vibes, and trick-or-treat energy',
    fairytale: 'storybook fairytale narration with medieval folklore, enchanted forests, castles, and magical creatures',
    creator: 'content creator livestream or recording - reactive sound effects, transitions, and reactions for entertainment',
    sing: 'live singing performance - match musical accompaniment, harmonies, and effects to the vocals',
    auto: 'any context - detect the mood and setting automatically'
};

/**
 * Mode-specific rules for the AI prompt.
 */
export const MODE_RULES = {
    bedtime: '- Bedtime: prefer calm ambient context sounds (crickets, gentle wind, soft fire). ONE-OFF actions only when mentioned.',
    dnd: '- D&D: prefer fantasy atmosphere (tavern, torch, cave wind). ONE-OFF combat sounds only when mentioned.',
    horror: '- Horror: prefer eerie atmosphere (wind, distant thunder, creaking). ONE-OFF scares only when mentioned.',
    christmas: '- Christmas: prefer festive atmosphere (jingle, crackling fire). Music MUST be christmas-tagged if available.',
    halloween: '- Halloween: prefer spooky atmosphere (wind, owl, chains). ONE-OFF scares only when mentioned.',
    fairytale: '- Fairytale: prioritize slow ambient atmosphere (forest, gentle wind, fireplace, birds). Avoid modern/industrial/chaotic sounds. Favour cozy, magical, or ominous tones. SFX only on strong narrative cues (door knock, twig snap, wolf howl). Smooth transitions.',
    creator: '- Creator: focus on reactive one-off SFX triggered by speech (laugh, wow, fail, win, surprise). Keep ambient minimal or lo-fi. Favour punchy short sounds over atmosphere. Respond quickly to emotional cues, reactions, and exclamations. Transition whooshes on topic changes.',
    sing: `- Sing: the user is SINGING, not narrating. Your job is backing accompaniment only.
  * ALWAYS return "sfx": [] — no sound effects at all during a performance.
  * Pick ONE "music" track that matches the singer's energy, tempo (see "detectedBPM" when present), and mood.
  * Prefer instrumental, karaoke-style, or backing tracks. Avoid tracks with strong lead vocals that would fight the singer.
  * Once music is playing, keep it steady. Only change music when the song clearly ends (long silence) or the style shifts dramatically.
  * Match tempo: if detectedBPM is fast (>110) prefer upbeat tracks; slow (<80) prefer ballads; mid (80-110) prefer mid-tempo.
  * Match mood from the lyrics you can detect: love/heartbreak/happy/sad/angry/hopeful.
  * If the singer pauses between verses, DO NOT restart or change music — keep the same track.
  * When a clear song end is detected (context mentions "applause", "end of song", "thank you", or sustained silence), you may return null music to let the track fade out.`,
    auto: '- Auto: detect mood and setting. Ambient context OK. ONE-OFF actions only when mentioned.'
};

/**
 * Mode-specific stinger queries (ambient sounds that play periodically).
 */
export const MODE_STINGERS = {
    bedtime: ['owl hoot', 'wind soft', 'crickets night'],
    dnd: ['torch crackle', 'distant crowd', 'wind cave'],
    horror: ['door creak', 'wind howl', 'static burst'],
    christmas: ['jingle bells', 'bell chime', 'wind arctic'],
    halloween: ['owl hoot', 'wind howl', 'crow caw'],
    fairytale: ['bird chirp', 'wind soft', 'owl hoot', 'crickets night'],
    creator: ['whoosh transition', 'pop notification', 'click ui'],
    sing: ['crowd cheer', 'applause', 'clap'],
    auto: ['wind whoosh', 'door creak', 'footsteps']
};

/**
 * Mode-specific preload sets for SFX buffering.
 */
export const MODE_PRELOAD_SETS = {
    bedtime: [
        'dog bark','cat meow','door knock','rain','wind whoosh','fire crackling','owl hoot',
        'crickets','soft footsteps','wood creak','clock tick',
        'distant thunder','water drip','bird chirp','piano soft',
        'heartbeat soft'
    ],
    dnd: [
        'sword clash','arrow shot','monster roar','footsteps','door creak','thunder','coin jingle',
        'spell cast','magic whoosh','shield block','torch crackle','crowd tavern','horse gallop',
        'gate open','dragon roar','bow twang','chain rattle','door slam','wind cave'
    ],
    horror: [
        'door creak','whisper','heartbeat','wind whoosh','ghost boo','witch cackle','chain drag',
        'footsteps hallway','breath heavy','thunder distant','scream far','floorboard creak',
        'owl hoot','metal scrape','water drip','clock tick','radio static','crow caw','cat hiss','wolf howl'
    ],
    christmas: [
        'jingle bells','sleigh bells','fire crackling','children laugh','wind arctic','snow footsteps',
        'door knock','bell chime','reindeer bells','door creak',
        'wind whoosh','glass clink','crowd cheer','applause','laugh'
    ],
    halloween: [
        'witch cackle','ghost boo','wolf howl','door creak','thunder','owl hoot','chain rattle',
        'bat flutter','cat hiss','wind whoosh','zombie groan','crow caw','footsteps leaves',
        'monster roar','scream far','gate creak','rain'
    ],
    sing: [
        'applause','crowd cheer','clap',
        'guitar strum','piano chord'
    ],
    fairytale: [
        'bird chirp','owl hoot','wind whoosh','fire crackling','crickets','wolf howl',
        'door knock','footsteps','wood creak','horse gallop','crow caw','water drip',
        'bell chime','door creak','rain','twig snap','thunder distant'
    ],
    creator: [
        'applause','crowd cheer','laugh','whoosh','bell chime','drum roll',
        'fail buzzer','win fanfare','gasp','record scratch','air horn',
        'pop','click','ding','boom impact','sad trombone','tada reveal'
    ],
    auto: [
        'dog bark','door knock','footsteps','thunder','fire crackling','wind whoosh','applause',
        'laugh','scream','metal crash','water splash','door slam','heartbeat','bird chirp','cat meow',
        'bell chime','coin jingle','crow caw','owl hoot','chain rattle'
    ]
};

export const GENERIC_PRELOAD_SET = [
    'dog bark','door knock','footsteps','thunder','fire crackling','wind whoosh','applause',
    'laugh','scream','metal crash','water splash','door slam','heartbeat','bird chirp','cat meow',
    'bell chime','coin jingle','crow caw','owl hoot','chain rattle'
];
