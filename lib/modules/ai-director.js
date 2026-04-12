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
    sing: '- Sing: provide complementary backing. Change music only if song style shifts. Minimal SFX.',
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
