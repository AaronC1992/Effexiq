/**
 * Second-wave sound generator — fills the biggest gaps in the current
 * catalog (ambience is only 23 entries, sci-fi/horror music is thin,
 * scene presets need more matching entries to score against).
 *
 * Same pipeline as scripts/generate-sounds.js:
 *   ElevenLabs Sound Generation API  →  Cloudflare R2  →  saved-sounds.json
 *
 * Usage:
 *   node scripts/generate-sounds-batch2.js --dry-run    # validate schema, print plan, no API calls
 *   node scripts/generate-sounds-batch2.js              # run for real (requires .env.local)
 *
 * Idempotent: skips entries already in saved-sounds.json or already in R2.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const API_KEY = process.env.ELEVENLABS_API_KEY;
const BUCKET = process.env.R2_BUCKET_NAME || 'cueai-media';
const PREFIX = 'Saved sounds/';

const r2 = DRY_RUN ? null : new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

// ── 200 NEW SOUNDS ──────────────────────────────────────────────────────────
// Schema: { name, filename, prompt, duration, type, keywords, loop }

const NEW_SOUNDS = [
    // ═══════════ MUSIC — COMBAT VARIANTS (10) ═══════════
    { name: 'boss fight epic music', filename: 'boss-fight-epic-music.mp3', duration: 24, type: 'music', keywords: ['boss', 'fight', 'epic', 'battle', 'climactic', 'fantasy'], prompt: 'Huge climactic boss fight orchestral music, thundering drums, heroic brass, electric strings, desperate intense epic battle, cinematic fantasy' },
    { name: 'skirmish quick combat music', filename: 'skirmish-quick-combat-music.mp3', duration: 22, type: 'music', keywords: ['skirmish', 'combat', 'fight', 'quick', 'short'], prompt: 'Fast short skirmish combat music, punchy percussion, brief aggressive strings, minor fight encounter, tight and urgent' },
    { name: 'arena gladiator combat music', filename: 'arena-gladiator-combat-music.mp3', duration: 24, type: 'music', keywords: ['arena', 'gladiator', 'combat', 'crowd', 'roman'], prompt: 'Gladiator arena combat music, roaring crowds in background, pounding tribal war drums, brass fanfare, Roman coliseum duel' },
    { name: 'duel tense standoff music', filename: 'duel-tense-standoff-music.mp3', duration: 22, type: 'music', keywords: ['duel', 'standoff', 'tense', 'honor', 'western'], prompt: 'Tense duel standoff music, single sustained string pad, distant harmonica, slow building dread before violence, honor duel' },
    { name: 'siege warfare music', filename: 'siege-warfare-music.mp3', duration: 24, type: 'music', keywords: ['siege', 'war', 'castle', 'assault', 'medieval'], prompt: 'Medieval siege warfare music, relentless war drums, brass stabs, battering ram pounding rhythm, army assaulting castle walls' },
    { name: 'last stand heroic music', filename: 'last-stand-heroic-music.mp3', duration: 24, type: 'music', keywords: ['last stand', 'heroic', 'sacrifice', 'final', 'defiant'], prompt: 'Heroic last stand music, defiant crescendo, soaring strings and triumphant horns, outnumbered heroes fighting to the end, sacrifice' },
    { name: 'retreat escape music', filename: 'retreat-escape-music.mp3', duration: 22, type: 'music', keywords: ['retreat', 'escape', 'flee', 'desperate', 'chase'], prompt: 'Desperate retreat escape music, panicked strings, pounding drums, party fleeing overwhelming enemy, breathless tension' },
    { name: 'stealth heist music', filename: 'stealth-heist-music.mp3', duration: 22, type: 'music', keywords: ['stealth', 'heist', 'sneak', 'rogue', 'infiltration'], prompt: 'Stealth heist music, pulsing bass, pizzicato strings, careful footsteps rhythm, rogue infiltrating vault, cautious tension' },
    { name: 'naval battle music', filename: 'naval-battle-music.mp3', duration: 24, type: 'music', keywords: ['naval', 'sea', 'battle', 'cannon', 'pirate'], prompt: 'Naval sea battle music, cannon booms in the rhythm, stormy strings, crashing waves, pirate ships trading broadsides' },
    { name: 'ambush surprise music', filename: 'ambush-surprise-music.mp3', duration: 20, type: 'music', keywords: ['ambush', 'surprise', 'sudden', 'attack'], prompt: 'Sudden ambush surprise music, quiet then shocking attack stinger, violent strings, enemies leaping from cover' },

    // ═══════════ MUSIC — EXPLORATION & LOCATION (10) ═══════════
    { name: 'cave exploration music', filename: 'cave-exploration-music.mp3', duration: 24, type: 'music', keywords: ['cave', 'exploration', 'underground', 'echo', 'dark'], prompt: 'Deep cave exploration music, echoing drones, sparse dripping percussion, cautious underground ambient, sense of vast unseen space' },
    { name: 'ancient ruins exploration music', filename: 'ancient-ruins-exploration-music.mp3', duration: 24, type: 'music', keywords: ['ruins', 'ancient', 'exploration', 'mystery', 'archaeology'], prompt: 'Ancient ruins exploration music, mysterious ethnic flutes, gentle percussion, wonder at forgotten civilization, archaeology' },
    { name: 'snowy mountain pass music', filename: 'snowy-mountain-pass-music.mp3', duration: 24, type: 'music', keywords: ['snow', 'mountain', 'pass', 'cold', 'travel'], prompt: 'Snowy mountain pass travel music, cold wind underscore, lonely strings, weary travelers crossing icy peaks, vast and cold' },
    { name: 'coastal voyage music', filename: 'coastal-voyage-music.mp3', duration: 24, type: 'music', keywords: ['coastal', 'voyage', 'sea', 'travel', 'adventure'], prompt: 'Coastal voyage music, lilting Celtic melody, gentle ocean rhythm, ship sailing alongside cliffs, adventure and discovery' },
    { name: 'haunted forest music', filename: 'haunted-forest-music.mp3', duration: 24, type: 'music', keywords: ['haunted', 'forest', 'eerie', 'ghost', 'horror'], prompt: 'Haunted forest music, ghostly whispering choir, dissonant strings, cursed wood, uneasy and supernatural' },
    { name: 'underground river music', filename: 'underground-river-music.mp3', duration: 24, type: 'music', keywords: ['underground', 'river', 'cave', 'water', 'ambient'], prompt: 'Underground river music, soft echoing pads, trickling water textures, mysterious subterranean journey, dreamlike' },
    { name: 'alien world ambient music', filename: 'alien-world-ambient-music.mp3', duration: 24, type: 'music', keywords: ['alien', 'planet', 'sci-fi', 'ambient', 'strange'], prompt: 'Alien world ambient music, strange microtonal synths, exotic percussion, uncanny atmosphere of unknown planet, sci-fi wonder' },
    { name: 'ghost ship airship music', filename: 'ghost-ship-airship-music.mp3', duration: 24, type: 'music', keywords: ['airship', 'ship', 'ghost', 'steampunk', 'sky'], prompt: 'Airship flight music, rhythmic steam engine pulse, brass and woodwinds, soaring through clouds, steampunk adventure' },
    { name: 'desert expanse music', filename: 'desert-expanse-music.mp3', duration: 24, type: 'music', keywords: ['desert', 'expanse', 'dunes', 'travel', 'arid'], prompt: 'Vast desert expanse music, shimmering heat haze pads, distant oud and ney flute, endless sand dunes, lonely caravan travel' },
    { name: 'jungle expedition music', filename: 'jungle-expedition-music.mp3', duration: 24, type: 'music', keywords: ['jungle', 'expedition', 'rainforest', 'tropical', 'adventure'], prompt: 'Jungle expedition music, tribal drums and exotic flutes, hidden temple adventure, dense rainforest exploration, pulp adventure' },

    // ═══════════ MUSIC — SOCIAL & CITY (6) ═══════════
    { name: 'noble feast music', filename: 'noble-feast-music.mp3', duration: 24, type: 'music', keywords: ['noble', 'feast', 'banquet', 'royal', 'celebration'], prompt: 'Noble feast banquet music, elegant lute and harpsichord, dignified celebration in grand hall, courtly refined joy' },
    { name: 'tavern quiet evening music', filename: 'tavern-quiet-evening-music.mp3', duration: 24, type: 'music', keywords: ['tavern', 'quiet', 'evening', 'fireplace', 'peaceful'], prompt: 'Quiet tavern evening music, lone acoustic guitar, soft fiddle, low chatter, cozy fireplace ambience, reflective moment' },
    { name: 'festival dance music', filename: 'festival-dance-music.mp3', duration: 24, type: 'music', keywords: ['festival', 'dance', 'celebration', 'joyful', 'medieval'], prompt: 'Medieval festival dance music, lively fiddles and hurdy-gurdy, stomping feet, communal joy, village celebration' },
    { name: 'wedding ceremony music', filename: 'wedding-ceremony-music.mp3', duration: 24, type: 'music', keywords: ['wedding', 'ceremony', 'love', 'celebration', 'romantic'], prompt: 'Wedding ceremony music, tender strings, gentle harp and soft choir, joyful and emotional, union of two souls' },
    { name: 'city bustle music', filename: 'city-bustle-music.mp3', duration: 24, type: 'music', keywords: ['city', 'bustle', 'market', 'urban', 'medieval'], prompt: 'Medieval city bustle music, folk instruments weaving through crowd chatter, urban energy, market day vibrancy' },
    { name: 'tavern brawl music', filename: 'tavern-brawl-music.mp3', duration: 22, type: 'music', keywords: ['tavern', 'brawl', 'fight', 'chaotic', 'comedic'], prompt: 'Tavern brawl music, chaotic and comedic fiddle and drums, mugs smashing rhythm, knockabout pub fight energy' },

    // ═══════════ MUSIC — MOOD & ATMOSPHERE (10) ═══════════
    { name: 'hope rising music', filename: 'hope-rising-music.mp3', duration: 24, type: 'music', keywords: ['hope', 'rising', 'uplifting', 'hopeful', 'warm'], prompt: 'Hope rising music, gentle piano building to full strings, warm uplifting progression, darkness giving way to light' },
    { name: 'dread creeping music', filename: 'dread-creeping-music.mp3', duration: 24, type: 'music', keywords: ['dread', 'creeping', 'horror', 'unease', 'tension'], prompt: 'Creeping dread horror music, dissonant low strings, occasional metal scrapes, slow building unbearable tension, something terrible approaching' },
    { name: 'melancholy reflection music', filename: 'melancholy-reflection-music.mp3', duration: 24, type: 'music', keywords: ['melancholy', 'sad', 'reflection', 'lonely', 'introspective'], prompt: 'Melancholy reflection music, lone piano, distant cello, introspective sadness, remembering lost friends' },
    { name: 'triumph glory music', filename: 'triumph-glory-music.mp3', duration: 22, type: 'music', keywords: ['triumph', 'glory', 'victory', 'heroic', 'fanfare'], prompt: 'Triumphant glory fanfare, soaring brass, full orchestra, heroes victorious, epic celebration of hard-won win' },
    { name: 'wonder awe music', filename: 'wonder-awe-music.mp3', duration: 24, type: 'music', keywords: ['wonder', 'awe', 'magical', 'discovery', 'beauty'], prompt: 'Wonder and awe music, shimmering harp and celesta, soaring strings, discovering breathtaking magical vista, beauty' },
    { name: 'rage fury music', filename: 'rage-fury-music.mp3', duration: 22, type: 'music', keywords: ['rage', 'fury', 'berserk', 'aggressive', 'barbarian'], prompt: 'Rage fury barbarian music, aggressive tribal drums, distorted strings, uncontrolled berserker battle, raw violent energy' },
    { name: 'calm peaceful music', filename: 'calm-peaceful-music.mp3', duration: 24, type: 'music', keywords: ['calm', 'peaceful', 'rest', 'resting', 'serene'], prompt: 'Calm peaceful resting music, soft flute and ambient pads, tranquil meadow afternoon, safe camp, serene' },
    { name: 'eerie unsettling music', filename: 'eerie-unsettling-music.mp3', duration: 24, type: 'music', keywords: ['eerie', 'unsettling', 'strange', 'uneasy', 'horror'], prompt: 'Eerie unsettling music, detuned music box, ghostly whispers, strange wrong intervals, something is off' },
    { name: 'whimsical playful music', filename: 'whimsical-playful-music.mp3', duration: 22, type: 'music', keywords: ['whimsical', 'playful', 'fairy', 'comedic', 'light'], prompt: 'Whimsical playful music, pizzicato strings and light woodwinds, mischievous fairies, comedic caper, lighthearted' },
    { name: 'betrayal revelation music', filename: 'betrayal-revelation-music.mp3', duration: 22, type: 'music', keywords: ['betrayal', 'revelation', 'shock', 'dramatic', 'turn'], prompt: 'Betrayal revelation music, shocking dramatic hit, descending strings, trusted ally turning on party, devastating twist' },

    // ═══════════ MUSIC — GENRE EXPANSIONS (14) ═══════════
    { name: 'space opera sci-fi music', filename: 'space-opera-sci-fi-music.mp3', duration: 24, type: 'music', keywords: ['space', 'opera', 'sci-fi', 'epic', 'stars'], prompt: 'Epic space opera sci-fi music, soaring orchestral with synth textures, starships crossing galaxies, heroic adventure among stars' },
    { name: 'cyberpunk neon music', filename: 'cyberpunk-neon-music.mp3', duration: 24, type: 'music', keywords: ['cyberpunk', 'neon', 'sci-fi', 'future', 'synth'], prompt: 'Cyberpunk neon music, driving synthwave bass, rain-soaked city, retro-futuristic pulse, dystopian future' },
    { name: 'western frontier music', filename: 'western-frontier-music.mp3', duration: 24, type: 'music', keywords: ['western', 'frontier', 'cowboy', 'desert'], prompt: 'Western frontier music, lone harmonica and slide guitar, vast dusty plains, cowboy riding into sunset, Ennio Morricone style' },
    { name: 'gothic horror organ music', filename: 'gothic-horror-organ-music.mp3', duration: 24, type: 'music', keywords: ['gothic', 'horror', 'organ', 'dark', 'castle'], prompt: 'Gothic horror pipe organ music, haunted cathedral, dark dissonant chords, vampire castle, Bach-like but twisted evil' },
    { name: 'lovecraftian cosmic horror music', filename: 'lovecraftian-cosmic-horror-music.mp3', duration: 24, type: 'music', keywords: ['lovecraft', 'cosmic', 'horror', 'eldritch', 'insane'], prompt: 'Lovecraftian cosmic horror music, impossibly deep drones, whispering alien voices, madness-inducing dissonance, eldritch beings' },
    { name: 'post-apocalyptic wasteland music', filename: 'post-apocalyptic-wasteland-music.mp3', duration: 24, type: 'music', keywords: ['post-apocalyptic', 'wasteland', 'ruined', 'survival', 'sci-fi'], prompt: 'Post-apocalyptic wasteland music, haunting steel guitar, industrial percussion, radioactive ruins, lone survivor theme' },
    { name: 'steampunk industrial music', filename: 'steampunk-industrial-music.mp3', duration: 24, type: 'music', keywords: ['steampunk', 'industrial', 'victorian', 'clockwork'], prompt: 'Steampunk industrial music, rhythmic steam engine percussion, brass and clockwork, Victorian invention, mechanical marvel' },
    { name: 'dark fantasy grimdark music', filename: 'dark-fantasy-grimdark-music.mp3', duration: 24, type: 'music', keywords: ['dark fantasy', 'grimdark', 'brooding', 'witcher'], prompt: 'Dark fantasy grimdark music, brooding low strings, mournful vocal, harsh world where heroes are flawed, witcher style' },
    { name: 'high fantasy heroic music', filename: 'high-fantasy-heroic-music.mp3', duration: 24, type: 'music', keywords: ['high fantasy', 'heroic', 'tolkien', 'epic', 'adventure'], prompt: 'High fantasy heroic music, sweeping Celtic-tinged orchestral, noble theme, Tolkien-inspired grand adventure, brave company' },
    { name: 'asian fantasy music', filename: 'asian-fantasy-music.mp3', duration: 24, type: 'music', keywords: ['asian', 'fantasy', 'eastern', 'samurai', 'martial'], prompt: 'Asian fantasy music, koto and shakuhachi flute, taiko drums, samurai and wuxia, Eastern martial arts adventure' },
    { name: 'noir jazz detective music', filename: 'noir-jazz-detective-music.mp3', duration: 24, type: 'music', keywords: ['noir', 'jazz', 'detective', '1940s', 'investigation'], prompt: 'Film noir jazz detective music, smoky saxophone, upright bass, rainy city at night, 1940s detective mystery investigation' },
    { name: 'egyptian ancient music', filename: 'egyptian-ancient-music.mp3', duration: 24, type: 'music', keywords: ['egyptian', 'ancient', 'pyramid', 'desert', 'pharaoh'], prompt: 'Ancient Egyptian music, sistrum and harp, pharaoh court, pyramid temple, mystical desert civilization' },
    { name: 'norse viking music', filename: 'norse-viking-music.mp3', duration: 24, type: 'music', keywords: ['norse', 'viking', 'nordic', 'saga', 'warrior'], prompt: 'Norse viking music, throat singing, tagelharpa and frame drums, longship sailing fjords, warrior saga, Wardruna style' },
    { name: 'pirate sea shanty battle music', filename: 'pirate-sea-shanty-battle-music.mp3', duration: 24, type: 'music', keywords: ['pirate', 'sea shanty', 'battle', 'sailing', 'adventure'], prompt: 'Pirate sea shanty battle music, rousing accordion and hornpipe, cannon fire rhythm, swashbuckling high seas adventure' },

    // ═══════════ AMBIENCE — TAVERNS (6) ═══════════
    { name: 'tavern busy night ambience', filename: 'tavern-busy-night-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['tavern', 'busy', 'night', 'crowd', 'chatter', 'inn'], prompt: 'Busy tavern night ambience loop, layered chatter, mugs clinking, distant laughter, warm crowded inn atmosphere' },
    { name: 'tavern empty day ambience', filename: 'tavern-empty-day-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['tavern', 'empty', 'quiet', 'day', 'inn'], prompt: 'Quiet empty tavern day ambience loop, distant clinking from kitchen, floorboards creaking, soft ticking clock' },
    { name: 'tavern fireplace ambience', filename: 'tavern-fireplace-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['tavern', 'fireplace', 'crackling', 'cozy', 'fire'], prompt: 'Cozy tavern fireplace ambience loop, crackling logs, occasional pop, warm low murmur of patrons, intimate' },
    { name: 'tavern kitchen ambience', filename: 'tavern-kitchen-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['tavern', 'kitchen', 'cooking', 'pots', 'inn'], prompt: 'Tavern kitchen ambience loop, pots clanging, sizzling cooking, chef shouting in background, busy work' },
    { name: 'tavern bard performing ambience', filename: 'tavern-bard-performing-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['tavern', 'bard', 'music', 'lute', 'performance'], prompt: 'Tavern with bard performing ambience loop, distant lute melody, patrons listening and chatting, warm entertainment' },
    { name: 'tavern rowdy brawl ambience', filename: 'tavern-rowdy-brawl-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['tavern', 'rowdy', 'brawl', 'fight', 'chaotic'], prompt: 'Rowdy tavern brawl ambience loop, shouting, smashing furniture, mugs breaking, chaotic fistfight in background' },

    // ═══════════ AMBIENCE — CITIES & CROWDS (6) ═══════════
    { name: 'medieval city street ambience', filename: 'medieval-city-street-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['city', 'street', 'medieval', 'urban', 'crowd'], prompt: 'Medieval city street ambience loop, crowd chatter, distant vendors calling, cart wheels on cobblestone, footsteps' },
    { name: 'market square ambience', filename: 'market-square-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['market', 'square', 'vendors', 'crowd', 'bazaar'], prompt: 'Busy market square ambience loop, vendors hawking wares, haggling, coins clinking, crowds moving, vibrant' },
    { name: 'slum alleyway ambience', filename: 'slum-alleyway-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['slum', 'alley', 'poor', 'dirty', 'urban'], prompt: 'Grimy slum alleyway ambience loop, distant arguing, rats scurrying, dripping water, dangerous poor district' },
    { name: 'docks harbor ambience', filename: 'docks-harbor-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['docks', 'harbor', 'port', 'ships', 'sea'], prompt: 'Docks harbor ambience loop, waves against hulls, seagulls, distant sailors shouting, rope creaking, nautical' },
    { name: 'noble district ambience', filename: 'noble-district-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['noble', 'district', 'wealthy', 'city', 'quiet'], prompt: 'Wealthy noble district ambience loop, distant polite conversation, fountain trickling, carriage passing, refined quiet' },
    { name: 'city night patrol ambience', filename: 'city-night-patrol-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['city', 'night', 'patrol', 'guard', 'quiet'], prompt: 'City night ambience loop, distant guard patrol footsteps and torches, quiet streets, occasional dog barking, watchful' },

    // ═══════════ AMBIENCE — WEATHER (8) ═══════════
    { name: 'light rain gentle ambience', filename: 'light-rain-gentle-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['rain', 'light', 'gentle', 'drizzle', 'soft'], prompt: 'Gentle light rain ambience loop, soft drizzle on leaves and pavement, peaceful rainfall, no wind' },
    { name: 'distant thunder rolling ambience', filename: 'distant-thunder-rolling-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['thunder', 'distant', 'rolling', 'storm', 'rain'], prompt: 'Distant thunder rolling ambience loop, low rumbles echoing far away, steady rain in foreground, approaching storm' },
    { name: 'blizzard howling wind ambience', filename: 'blizzard-howling-wind-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['blizzard', 'wind', 'snow', 'howling', 'storm'], prompt: 'Blizzard howling wind ambience loop, violent gusts, snow whipping against walls, frozen fury storm' },
    { name: 'desert wind sand ambience', filename: 'desert-wind-sand-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['desert', 'wind', 'sand', 'dry', 'hot'], prompt: 'Desert wind sand ambience loop, dry hot wind across dunes, grains of sand skittering, vast empty expanse' },
    { name: 'mountain wind high altitude ambience', filename: 'mountain-wind-altitude-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['mountain', 'wind', 'altitude', 'cold', 'high'], prompt: 'High-altitude mountain wind ambience loop, thin cold wind whistling across peaks, sparse and lonely' },
    { name: 'foggy marsh ambience', filename: 'foggy-marsh-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['foggy', 'marsh', 'swamp', 'eerie', 'mist'], prompt: 'Foggy marsh ambience loop, muffled distant frogs, water dripping in mist, eerie muted atmosphere' },
    { name: 'summer hot cicadas ambience', filename: 'summer-hot-cicadas-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['summer', 'hot', 'cicadas', 'insects', 'day'], prompt: 'Hot summer afternoon ambience loop, buzzing cicadas, distant heat haze, lazy warm day, dry grass rustling' },
    { name: 'autumn leaves wind ambience', filename: 'autumn-leaves-wind-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['autumn', 'leaves', 'wind', 'fall', 'rustling'], prompt: 'Autumn wind through dry leaves ambience loop, rustling fallen foliage, crisp cool air, melancholy fall' },

    // ═══════════ AMBIENCE — FOREST & NATURE (6) ═══════════
    { name: 'spring forest birdsong ambience', filename: 'spring-forest-birdsong-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['spring', 'forest', 'birds', 'birdsong', 'morning'], prompt: 'Spring forest birdsong ambience loop, layered songbirds, gentle breeze, new life, peaceful morning woodland' },
    { name: 'night forest owls ambience', filename: 'night-forest-owls-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['night', 'forest', 'owls', 'nocturnal', 'dark'], prompt: 'Night forest ambience loop, distant owl hoots, crickets, occasional rustling, dark peaceful nocturnal woods' },
    { name: 'winter silent forest ambience', filename: 'winter-silent-forest-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['winter', 'forest', 'silent', 'snow', 'cold'], prompt: 'Winter silent snowy forest ambience loop, muffled stillness, occasional snow falling from branch, cold deep quiet' },
    { name: 'deep jungle wildlife ambience', filename: 'deep-jungle-wildlife-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['jungle', 'wildlife', 'rainforest', 'tropical', 'dense'], prompt: 'Deep jungle wildlife ambience loop, exotic birds, distant monkeys, insects, dense tropical rainforest canopy' },
    { name: 'meadow summer afternoon ambience', filename: 'meadow-summer-afternoon-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['meadow', 'summer', 'afternoon', 'bees', 'grass'], prompt: 'Summer meadow afternoon ambience loop, buzzing bees, gentle breeze through tall grass, distant birdsong, idyllic' },
    { name: 'riverbank flowing ambience', filename: 'riverbank-flowing-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['river', 'bank', 'flowing', 'water', 'nature'], prompt: 'Flowing riverbank ambience loop, steady water current, occasional fish splash, reeds rustling, peaceful' },

    // ═══════════ AMBIENCE — DUNGEONS & UNDERGROUND (6) ═══════════
    { name: 'damp dungeon drip ambience', filename: 'damp-dungeon-drip-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['dungeon', 'damp', 'drip', 'stone', 'underground'], prompt: 'Damp dungeon ambience loop, echoing water drips, distant chain clanking, stone oppressive cold, prison' },
    { name: 'howling wind corridor ambience', filename: 'howling-wind-corridor-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['corridor', 'wind', 'howling', 'stone', 'dungeon'], prompt: 'Ancient stone corridor howling wind ambience loop, wind whistling through cracks, torches flickering, eerie underground' },
    { name: 'rats scurrying dungeon ambience', filename: 'rats-scurrying-dungeon-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['rats', 'scurrying', 'dungeon', 'vermin', 'creepy'], prompt: 'Dungeon rats ambience loop, skittering claws on stone, occasional squeaks, scratching behind walls, infestation' },
    { name: 'crypt bones clatter ambience', filename: 'crypt-bones-clatter-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['crypt', 'bones', 'undead', 'tomb', 'creepy'], prompt: 'Crypt tomb ambience loop, occasional bones shifting, distant moans, dust falling, undead stirring, sepulchral' },
    { name: 'torch lit hall ambience', filename: 'torch-lit-hall-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['torch', 'fire', 'hall', 'dungeon', 'medieval'], prompt: 'Torch-lit stone hall ambience loop, crackling flames, low wind, distant echo, medieval castle passage' },
    { name: 'deep ominous underdark ambience', filename: 'deep-ominous-underdark-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['underdark', 'deep', 'ominous', 'cave', 'dark'], prompt: 'Deep underdark ambience loop, oppressive low drone, distant unknown creatures, vast black unexplored caverns, dread' },

    // ═══════════ AMBIENCE — INTERIORS & WORKPLACES (8) ═══════════
    { name: 'library quiet study ambience', filename: 'library-quiet-study-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['library', 'study', 'quiet', 'books', 'scholar'], prompt: 'Quiet library ambience loop, turning pages, distant footsteps, soft scribbling quill, scholarly hushed atmosphere' },
    { name: 'temple chanting ambience', filename: 'temple-chanting-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['temple', 'chanting', 'monks', 'sacred', 'holy'], prompt: 'Temple monk chanting ambience loop, distant gregorian-style vocals, echoing stone sanctuary, sacred devotion' },
    { name: 'throne hall royal ambience', filename: 'throne-hall-royal-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['throne', 'hall', 'royal', 'court', 'grand'], prompt: 'Grand throne hall ambience loop, distant courtiers, echoing footsteps on marble, banners rustling, regal air' },
    { name: 'wizard laboratory ambience', filename: 'wizard-laboratory-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['wizard', 'laboratory', 'alchemy', 'bubbling', 'magic'], prompt: 'Wizard laboratory ambience loop, bubbling potions, crackling arcane energy, scratching quill, occasional magical pop' },
    { name: 'blacksmith forge ambience', filename: 'blacksmith-forge-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['blacksmith', 'forge', 'hammer', 'anvil', 'smithy'], prompt: 'Blacksmith forge ambience loop, rhythmic hammer on anvil, bellows pumping, fire roaring, metalwork' },
    { name: 'stable horses ambience', filename: 'stable-horses-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['stable', 'horses', 'hay', 'barn', 'farm'], prompt: 'Stable horse ambience loop, horses snorting and shifting, hay rustling, occasional whinny, warm barn' },
    { name: 'ship creaking cabin ambience', filename: 'ship-creaking-cabin-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['ship', 'creaking', 'cabin', 'sailing', 'wood'], prompt: 'Ship cabin creaking ambience loop, wooden hull groaning, distant waves, rope and rigging, sailing at sea' },
    { name: 'mine pickaxe distant ambience', filename: 'mine-pickaxe-distant-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['mine', 'pickaxe', 'underground', 'dwarf', 'workers'], prompt: 'Underground mine ambience loop, distant pickaxes striking stone, dripping water, low murmur of miners, torch crackle' },

    // ═══════════ AMBIENCE — OUTDOOR ENVIRONMENTS (10) ═══════════
    { name: 'seaside calm day ambience', filename: 'seaside-calm-day-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['seaside', 'calm', 'beach', 'waves', 'day'], prompt: 'Calm seaside day ambience loop, gentle waves lapping shore, distant seagulls, peaceful beach' },
    { name: 'seaside storm waves ambience', filename: 'seaside-storm-waves-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['seaside', 'storm', 'waves', 'crashing', 'wind'], prompt: 'Stormy seaside ambience loop, crashing waves, howling wind, distant thunder, wild coast' },
    { name: 'cave dripping echo ambience', filename: 'cave-dripping-echo-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['cave', 'drip', 'echo', 'underground', 'stalactite'], prompt: 'Cave ambience loop, dripping water with deep echoes, faint draft, stalactite chamber, vast hollow space' },
    { name: 'mountain peak windswept ambience', filename: 'mountain-peak-windswept-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['mountain', 'peak', 'wind', 'high', 'summit'], prompt: 'Windswept mountain peak ambience loop, fierce high-altitude wind, rocks scattering, eagle distant cry' },
    { name: 'battlefield aftermath ambience', filename: 'battlefield-aftermath-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['battlefield', 'aftermath', 'war', 'ravens', 'dead'], prompt: 'Battlefield aftermath ambience loop, ravens cawing, distant moaning wounded, wind across corpses, grim silence' },
    { name: 'graveyard misty ambience', filename: 'graveyard-misty-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['graveyard', 'misty', 'cemetery', 'eerie', 'undead'], prompt: 'Misty graveyard ambience loop, distant crow, wind through gravestones, muffled eerie whispers, haunted cemetery' },
    { name: 'campfire night wilderness ambience', filename: 'campfire-night-wilderness-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['campfire', 'night', 'camp', 'wilderness', 'fire'], prompt: 'Night campfire wilderness ambience loop, crackling fire, crickets, distant wolf howl, cozy camp in the wild' },
    { name: 'farm countryside day ambience', filename: 'farm-countryside-day-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['farm', 'countryside', 'chickens', 'day', 'rural'], prompt: 'Farm countryside day ambience loop, chickens clucking, distant cow, wind in wheat, rural peaceful village' },
    { name: 'waterfall roaring ambience', filename: 'waterfall-roaring-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['waterfall', 'roaring', 'water', 'cascade', 'nature'], prompt: 'Large waterfall ambience loop, thunderous cascading water, mist, echoing from cliff walls, powerful nature' },
    { name: 'volcano distant rumble ambience', filename: 'volcano-distant-rumble-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['volcano', 'rumble', 'lava', 'distant', 'ominous'], prompt: 'Distant volcano rumble ambience loop, deep subterranean rumble, occasional lava pop, hot ashy air, ominous' },

    // ═══════════ AMBIENCE — SCI-FI / UNUSUAL (4) ═══════════
    { name: 'spaceship bridge ambience', filename: 'spaceship-bridge-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['spaceship', 'bridge', 'sci-fi', 'computer', 'hum'], prompt: 'Spaceship bridge ambience loop, steady engine hum, computer beeps, distant crew chatter, sci-fi cockpit' },
    { name: 'alien planet surface ambience', filename: 'alien-planet-surface-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['alien', 'planet', 'sci-fi', 'strange', 'wind'], prompt: 'Alien planet surface ambience loop, strange wind with unknown tonal qualities, distant creature calls, exotic weird atmosphere' },
    { name: 'astral plane void ambience', filename: 'astral-plane-void-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['astral', 'plane', 'void', 'magical', 'dimension'], prompt: 'Astral plane void ambience loop, ethereal shifting pads, distant cosmic whispers, weightless otherworldly dimension' },
    { name: 'feywild enchanted ambience', filename: 'feywild-enchanted-ambience.mp3', duration: 30, type: 'ambience', loop: true, keywords: ['feywild', 'enchanted', 'fairy', 'magical', 'dreamlike'], prompt: 'Feywild enchanted ambience loop, twinkling chimes, impossibly sweet birdsong, faint fairy laughter, dreamlike magical forest' },

    // ═══════════ SFX — COMBAT EXPANSIONS (20) ═══════════
    { name: 'dagger stab quick', filename: 'dagger-stab-quick.mp3', duration: 2, type: 'sfx', keywords: ['dagger', 'stab', 'quick', 'rogue', 'assassin'], prompt: 'Quick dagger stab into flesh, short sharp thrust, assassin strike' },
    { name: 'rapier thrust lunge', filename: 'rapier-thrust-lunge.mp3', duration: 2, type: 'sfx', keywords: ['rapier', 'thrust', 'fencing', 'lunge', 'duelist'], prompt: 'Rapier fencing thrust and lunge, metallic whistle through air, duelist attack' },
    { name: 'warhammer heavy swing', filename: 'warhammer-heavy-swing.mp3', duration: 3, type: 'sfx', keywords: ['warhammer', 'heavy', 'swing', 'blunt', 'warrior'], prompt: 'Heavy warhammer swinging through air, massive weight whoosh, two-handed warrior attack' },
    { name: 'throwing knife whoosh', filename: 'throwing-knife-whoosh.mp3', duration: 2, type: 'sfx', keywords: ['throwing knife', 'whoosh', 'dagger', 'throw', 'assassin'], prompt: 'Thrown knife whooshing through air, spinning blade flying toward target' },
    { name: 'whip crack sharp', filename: 'whip-crack-sharp.mp3', duration: 2, type: 'sfx', keywords: ['whip', 'crack', 'sharp', 'leather'], prompt: 'Sharp leather whip crack, snapping through air at supersonic tip, classic whip sound' },
    { name: 'punch fist impact flesh', filename: 'punch-fist-impact-flesh.mp3', duration: 2, type: 'sfx', keywords: ['punch', 'fist', 'impact', 'flesh', 'unarmed'], prompt: 'Bare-knuckle punch hitting flesh and bone, meaty impact, unarmed brawl' },
    { name: 'kick impact body', filename: 'kick-impact-body.mp3', duration: 2, type: 'sfx', keywords: ['kick', 'impact', 'body', 'martial'], prompt: 'Hard kick impact on body, muffled thud, martial arts strike' },
    { name: 'body tackle ground slam', filename: 'body-tackle-ground-slam.mp3', duration: 3, type: 'sfx', keywords: ['tackle', 'body', 'slam', 'grapple'], prompt: 'Body tackle slamming opponent to ground, heavy impact, grappler takedown' },
    { name: 'parry sword clang', filename: 'parry-sword-clang.mp3', duration: 2, type: 'sfx', keywords: ['parry', 'sword', 'clang', 'block', 'metal'], prompt: 'Sword parry clang, metal on metal sharp ringing block, swordfight' },
    { name: 'shield bash impact', filename: 'shield-bash-impact.mp3', duration: 2, type: 'sfx', keywords: ['shield', 'bash', 'impact', 'metal'], prompt: 'Shield bash impact, heavy metal shield slamming into enemy, stunning strike' },
    { name: 'disarm weapon drop', filename: 'disarm-weapon-drop.mp3', duration: 2, type: 'sfx', keywords: ['disarm', 'weapon', 'drop', 'metal'], prompt: 'Weapon knocked from hand, metallic clang and clatter on stone as sword drops, disarm' },
    { name: 'arrow hit flesh', filename: 'arrow-hit-flesh.mp3', duration: 2, type: 'sfx', keywords: ['arrow', 'hit', 'flesh', 'impact'], prompt: 'Arrow striking flesh with wet thud, bowstring whip preceding, ranged hit' },
    { name: 'arrow hit shield wood', filename: 'arrow-hit-shield-wood.mp3', duration: 2, type: 'sfx', keywords: ['arrow', 'hit', 'shield', 'wood', 'block'], prompt: 'Arrow slamming into wooden shield, thunk of arrowhead embedding, blocked shot' },
    { name: 'arrow hit stone wall', filename: 'arrow-hit-stone-wall.mp3', duration: 2, type: 'sfx', keywords: ['arrow', 'hit', 'stone', 'miss'], prompt: 'Arrow striking stone wall and clattering, missed shot ricochet, stony impact' },
    { name: 'critical hit slash heavy', filename: 'critical-hit-slash-heavy.mp3', duration: 3, type: 'sfx', keywords: ['critical', 'hit', 'slash', 'heavy', 'crit'], prompt: 'Massive critical slash hit, heavy blade impact with dramatic cinematic flourish, devastating strike' },
    { name: 'fatal blow death strike', filename: 'fatal-blow-death-strike.mp3', duration: 3, type: 'sfx', keywords: ['fatal', 'blow', 'death', 'killing'], prompt: 'Fatal killing blow, deep sword plunge with dramatic cinematic weight, death strike' },
    { name: 'dodge roll fabric', filename: 'dodge-roll-fabric.mp3', duration: 2, type: 'sfx', keywords: ['dodge', 'roll', 'fabric', 'movement'], prompt: 'Quick dodge roll across ground, fabric and leather rustling, agile evade' },
    { name: 'weapon draw sword', filename: 'weapon-draw-sword.mp3', duration: 2, type: 'sfx', keywords: ['weapon', 'draw', 'sword', 'unsheath'], prompt: 'Sword drawn from scabbard, classic metallic scraping shing, warrior unsheathing blade' },
    { name: 'weapon sheath sword', filename: 'weapon-sheath-sword.mp3', duration: 2, type: 'sfx', keywords: ['weapon', 'sheath', 'sword', 'resolve'], prompt: 'Sword sliding back into scabbard, satisfying sheath sound, fight concluded' },
    { name: 'quick draw pistol shot', filename: 'quick-draw-pistol-shot.mp3', duration: 2, type: 'sfx', keywords: ['pistol', 'quick draw', 'gun', 'flintlock', 'western'], prompt: 'Quick-draw flintlock pistol shot, fast hammer click and powder blast, western duel' },

    // ═══════════ SFX — MAGIC SCHOOLS (20) ═══════════
    { name: 'fireball cast spell', filename: 'fireball-cast-spell.mp3', duration: 3, type: 'sfx', keywords: ['fireball', 'cast', 'spell', 'fire', 'evocation'], prompt: 'Fireball spell casting, building roaring flames, magical incantation, evocation fire spell launch' },
    { name: 'fireball explosion impact', filename: 'fireball-explosion-impact.mp3', duration: 3, type: 'sfx', keywords: ['fireball', 'explosion', 'impact', 'fire', 'blast'], prompt: 'Fireball explosion impact, massive fiery detonation, roaring flames, devastating blast' },
    { name: 'ice shard spell', filename: 'ice-shard-spell.mp3', duration: 2, type: 'sfx', keywords: ['ice', 'shard', 'spell', 'frost', 'cold'], prompt: 'Ice shard spell firing, crystalline shimmer and sharp whoosh, frozen projectile' },
    { name: 'lightning bolt spell', filename: 'lightning-bolt-spell.mp3', duration: 3, type: 'sfx', keywords: ['lightning', 'bolt', 'spell', 'electric', 'thunder'], prompt: 'Lightning bolt spell, crackling electricity building to thunderous discharge, evocation strike' },
    { name: 'thunder wave spell', filename: 'thunder-wave-spell.mp3', duration: 3, type: 'sfx', keywords: ['thunder', 'wave', 'spell', 'sonic', 'blast'], prompt: 'Thunder wave spell, massive shockwave boom pushing outward, sonic concussive blast' },
    { name: 'healing word glow', filename: 'healing-word-glow.mp3', duration: 3, type: 'sfx', keywords: ['healing', 'word', 'glow', 'cleric', 'holy'], prompt: 'Healing spell warm glow, soft chime and gentle angelic vocal, restorative light, cleric' },
    { name: 'poison cloud spell', filename: 'poison-cloud-spell.mp3', duration: 4, type: 'sfx', keywords: ['poison', 'cloud', 'spell', 'gas', 'toxic'], prompt: 'Poison cloud spell, hissing toxic gas billowing out, green noxious vapor, sickly' },
    { name: 'web spell cast', filename: 'web-spell-cast.mp3', duration: 3, type: 'sfx', keywords: ['web', 'spell', 'spider', 'sticky', 'trap'], prompt: 'Web spell, shooting sticky silk threads, splatting and sticking to surfaces, trap spell' },
    { name: 'haste spell acceleration', filename: 'haste-spell-acceleration.mp3', duration: 2, type: 'sfx', keywords: ['haste', 'spell', 'acceleration', 'speed'], prompt: 'Haste spell acceleration swoosh, reality speeding up, shimmering time magic buff' },
    { name: 'invisibility shimmer', filename: 'invisibility-shimmer.mp3', duration: 3, type: 'sfx', keywords: ['invisibility', 'shimmer', 'fade', 'stealth'], prompt: 'Invisibility spell shimmer, fading magical ripple, body vanishing into thin air' },
    { name: 'detect magic ping', filename: 'detect-magic-ping.mp3', duration: 2, type: 'sfx', keywords: ['detect', 'magic', 'ping', 'sense'], prompt: 'Detect magic spell ping, soft chime with subtle glow, arcane sensing vibration' },
    { name: 'counterspell cancel', filename: 'counterspell-cancel.mp3', duration: 2, type: 'sfx', keywords: ['counterspell', 'cancel', 'dispel'], prompt: 'Counterspell cancelling magic, reverse whoosh sucking energy away, dispel' },
    { name: 'portal open arcane', filename: 'portal-open-arcane.mp3', duration: 4, type: 'sfx', keywords: ['portal', 'open', 'arcane', 'teleport'], prompt: 'Arcane portal opening, swirling energy vortex, dimensional rift forming, teleportation gate' },
    { name: 'portal close collapse', filename: 'portal-close-collapse.mp3', duration: 3, type: 'sfx', keywords: ['portal', 'close', 'collapse', 'teleport'], prompt: 'Arcane portal collapsing shut, reverse vortex imploding, dimensional gate closing' },
    { name: 'eldritch blast dark', filename: 'eldritch-blast-dark.mp3', duration: 3, type: 'sfx', keywords: ['eldritch', 'blast', 'warlock', 'dark', 'force'], prompt: 'Eldritch blast warlock spell, dark forceful beam, otherworldly crackle, patron power' },
    { name: 'sacred flame divine', filename: 'sacred-flame-divine.mp3', duration: 3, type: 'sfx', keywords: ['sacred', 'flame', 'divine', 'cleric', 'holy'], prompt: 'Sacred flame cleric spell, pillar of holy radiance, divine searing light from above' },
    { name: 'fear spell whisper', filename: 'fear-spell-whisper.mp3', duration: 4, type: 'sfx', keywords: ['fear', 'spell', 'whisper', 'terror', 'enchantment'], prompt: 'Fear spell eerie whispers, unnatural dread building in the mind, terror enchantment magic' },
    { name: 'charm spell sparkle', filename: 'charm-spell-sparkle.mp3', duration: 3, type: 'sfx', keywords: ['charm', 'spell', 'sparkle', 'enchantment', 'persuade'], prompt: 'Charm person spell, gentle magical sparkle and soothing chime, enchantment persuasion' },
    { name: 'magic missile launch', filename: 'magic-missile-launch.mp3', duration: 3, type: 'sfx', keywords: ['magic missile', 'launch', 'arcane', 'missile'], prompt: 'Magic missile spell, three arcane darts streaking out, unerring homing magic projectiles' },
    { name: 'dispel magic wave', filename: 'dispel-magic-wave.mp3', duration: 3, type: 'sfx', keywords: ['dispel', 'magic', 'wave', 'cancel'], prompt: 'Dispel magic wave, cleansing pulse removing enchantment, magical cancellation' },

    // ═══════════ SFX — CREATURES (15) ═══════════
    { name: 'zombie groan', filename: 'zombie-groan.mp3', duration: 3, type: 'sfx', keywords: ['zombie', 'groan', 'undead', 'moan'], prompt: 'Zombie deep groaning moan, guttural undead vocalization, shuffling decay' },
    { name: 'skeleton bones rattle', filename: 'skeleton-bones-rattle.mp3', duration: 3, type: 'sfx', keywords: ['skeleton', 'bones', 'rattle', 'undead'], prompt: 'Skeleton bones rattling as it moves, dry bone clatter, undead animated warrior' },
    { name: 'ghost moan distant', filename: 'ghost-moan-distant.mp3', duration: 4, type: 'sfx', keywords: ['ghost', 'moan', 'distant', 'spirit'], prompt: 'Distant ghost moaning, ethereal mournful spirit voice, phantom spectral haunting' },
    { name: 'vampire hiss', filename: 'vampire-hiss.mp3', duration: 2, type: 'sfx', keywords: ['vampire', 'hiss', 'undead', 'fangs'], prompt: 'Vampire aggressive hiss, fangs bared, undead predator, bloodthirsty' },
    { name: 'orc war cry', filename: 'orc-war-cry.mp3', duration: 3, type: 'sfx', keywords: ['orc', 'war cry', 'shout', 'battle'], prompt: 'Orc guttural war cry shout, aggressive battle roar, charging into combat' },
    { name: 'goblin cackle', filename: 'goblin-cackle.mp3', duration: 3, type: 'sfx', keywords: ['goblin', 'cackle', 'laugh', 'mischief'], prompt: 'Goblin high-pitched mischievous cackling laugh, gleeful malice' },
    { name: 'troll deep roar', filename: 'troll-deep-roar.mp3', duration: 4, type: 'sfx', keywords: ['troll', 'roar', 'deep', 'monster'], prompt: 'Troll deep bellowing roar, massive monster, bridge-dwelling brute' },
    { name: 'giant stomp footstep', filename: 'giant-stomp-footstep.mp3', duration: 2, type: 'sfx', keywords: ['giant', 'stomp', 'footstep', 'heavy'], prompt: 'Giant footstep stomp, earth-shaking heavy impact, massive humanoid' },
    { name: 'owlbear growl call', filename: 'owlbear-growl-call.mp3', duration: 3, type: 'sfx', keywords: ['owlbear', 'growl', 'monster', 'dnd'], prompt: 'Owlbear hybrid growl call, half-owl half-bear threatening vocalization, fantasy monster' },
    { name: 'mind flayer whisper', filename: 'mind-flayer-whisper.mp3', duration: 4, type: 'sfx', keywords: ['mind flayer', 'illithid', 'whisper', 'psychic'], prompt: 'Mind flayer psychic whisper, tentacled illithid alien voice inside head, cerebral horror' },
    { name: 'beholder alien chatter', filename: 'beholder-alien-chatter.mp3', duration: 3, type: 'sfx', keywords: ['beholder', 'chatter', 'alien', 'many eyes'], prompt: 'Beholder alien chattering vocalization, many-eyed floating horror, wrong-sounding voice' },
    { name: 'kraken rumble deep', filename: 'kraken-rumble-deep.mp3', duration: 5, type: 'sfx', keywords: ['kraken', 'rumble', 'sea monster', 'tentacle'], prompt: 'Kraken deep underwater rumble, massive sea monster moving, oceanic horror' },
    { name: 'phoenix rebirth cry', filename: 'phoenix-rebirth-cry.mp3', duration: 4, type: 'sfx', keywords: ['phoenix', 'cry', 'rebirth', 'fire bird'], prompt: 'Phoenix soaring cry with flame whoosh, rebirth in fire, majestic fire bird' },
    { name: 'unicorn neigh magical', filename: 'unicorn-neigh-magical.mp3', duration: 3, type: 'sfx', keywords: ['unicorn', 'neigh', 'magical', 'pure'], prompt: 'Unicorn gentle neigh with magical shimmer, pure and noble creature' },
    { name: 'griffon screech flight', filename: 'griffon-screech-flight.mp3', duration: 3, type: 'sfx', keywords: ['griffon', 'screech', 'flight', 'beast'], prompt: 'Griffon mid-flight screech, eagle-lion hybrid aerial beast, predator call' },

    // ═══════════ SFX — ENVIRONMENT & MECHANISMS (15) ═══════════
    { name: 'fire wood crackling small', filename: 'fire-wood-crackling-small.mp3', duration: 4, type: 'sfx', keywords: ['fire', 'wood', 'crackling', 'small', 'campfire'], prompt: 'Small wood fire crackling, campfire pops and snaps, warm flames' },
    { name: 'bottle glass shatter', filename: 'bottle-glass-shatter.mp3', duration: 2, type: 'sfx', keywords: ['bottle', 'glass', 'shatter', 'break'], prompt: 'Bottle glass shattering on floor, sharp break into pieces, tavern fight sound' },
    { name: 'stone slab sliding', filename: 'stone-slab-sliding.mp3', duration: 4, type: 'sfx', keywords: ['stone', 'slab', 'sliding', 'mechanism'], prompt: 'Heavy stone slab sliding, grinding rock mechanism, ancient tomb door' },
    { name: 'metal gate lock', filename: 'metal-gate-lock.mp3', duration: 3, type: 'sfx', keywords: ['metal', 'gate', 'lock', 'prison'], prompt: 'Metal gate locking, heavy iron bars clanging shut with bolt slam, prison' },
    { name: 'chain pulling heavy', filename: 'chain-pulling-heavy.mp3', duration: 4, type: 'sfx', keywords: ['chain', 'pulling', 'heavy', 'iron'], prompt: 'Heavy chain being pulled, link by link iron rattling, drawbridge mechanism' },
    { name: 'water drip cave echo', filename: 'water-drip-cave-echo.mp3', duration: 3, type: 'sfx', keywords: ['water', 'drip', 'cave', 'echo'], prompt: 'Single water drip with deep cave echo, haunting solitary drop' },
    { name: 'cauldron bubbling alchemy', filename: 'cauldron-bubbling-alchemy.mp3', duration: 5, type: 'sfx', keywords: ['cauldron', 'bubbling', 'alchemy', 'potion'], prompt: 'Cauldron bubbling potion brew, thick liquid boiling, alchemical concoction' },
    { name: 'forge hammer anvil', filename: 'forge-hammer-anvil.mp3', duration: 3, type: 'sfx', keywords: ['forge', 'hammer', 'anvil', 'smith'], prompt: 'Blacksmith hammer striking anvil, rhythmic metal shaping, forge work' },
    { name: 'bellows pumping forge', filename: 'bellows-pumping-forge.mp3', duration: 3, type: 'sfx', keywords: ['bellows', 'pumping', 'forge', 'fire'], prompt: 'Bellows pumping air into forge, leather whoosh with fire roaring response' },
    { name: 'lock picking tumbler', filename: 'lock-picking-tumbler.mp3', duration: 4, type: 'sfx', keywords: ['lock', 'pick', 'tumbler', 'rogue', 'thief'], prompt: 'Lock picking with tumblers clicking into place, delicate rogue work, successful unlock' },
    { name: 'mechanism click activate', filename: 'mechanism-click-activate.mp3', duration: 2, type: 'sfx', keywords: ['mechanism', 'click', 'activate', 'switch'], prompt: 'Mechanical switch clicking and activating, trap or device engaging' },
    { name: 'gears grinding clockwork', filename: 'gears-grinding-clockwork.mp3', duration: 4, type: 'sfx', keywords: ['gears', 'grinding', 'clockwork', 'machine'], prompt: 'Clockwork gears grinding and meshing, complex mechanism turning, steampunk device' },
    { name: 'steam hiss release', filename: 'steam-hiss-release.mp3', duration: 3, type: 'sfx', keywords: ['steam', 'hiss', 'release', 'pressure'], prompt: 'Pressurized steam hissing release, valve opening, steampunk machinery' },
    { name: 'earthquake deep rumble', filename: 'earthquake-deep-rumble.mp3', duration: 6, type: 'sfx', keywords: ['earthquake', 'rumble', 'shake', 'ground'], prompt: 'Earthquake deep ground rumble, shaking rocks falling, seismic disaster' },
    { name: 'thunder loud close', filename: 'thunder-loud-close.mp3', duration: 4, type: 'sfx', keywords: ['thunder', 'loud', 'close', 'storm', 'lightning'], prompt: 'Loud close thunder crack after lightning, violent storm overhead, sharp boom and rolling echo' },

    // ═══════════ SFX — UI & RPG CUES (10) ═══════════
    { name: 'level up fanfare', filename: 'level-up-fanfare.mp3', duration: 3, type: 'sfx', keywords: ['level up', 'fanfare', 'ui', 'reward'], prompt: 'Level up triumphant fanfare, ascending chime into bright chord, video game reward' },
    { name: 'quest accept chime', filename: 'quest-accept-chime.mp3', duration: 2, type: 'sfx', keywords: ['quest', 'accept', 'chime', 'ui'], prompt: 'Quest acceptance chime, noble short fanfare, new adventure begins, UI cue' },
    { name: 'inventory open swish', filename: 'inventory-open-swish.mp3', duration: 2, type: 'sfx', keywords: ['inventory', 'open', 'ui', 'menu'], prompt: 'Inventory menu opening swish, bag unfurling, soft leather and paper UI sound' },
    { name: 'item pickup chime', filename: 'item-pickup-chime.mp3', duration: 2, type: 'sfx', keywords: ['item', 'pickup', 'chime', 'collect'], prompt: 'Item pickup chime, short bright collect sound, loot gathered UI cue' },
    { name: 'item drop thud', filename: 'item-drop-thud.mp3', duration: 2, type: 'sfx', keywords: ['item', 'drop', 'thud', 'discard'], prompt: 'Item drop thud, soft object hitting ground, inventory discard' },
    { name: 'save game chime', filename: 'save-game-chime.mp3', duration: 2, type: 'sfx', keywords: ['save', 'chime', 'ui', 'progress'], prompt: 'Save game progress chime, reassuring bright short UI sound, progress secured' },
    { name: 'low health warning', filename: 'low-health-warning.mp3', duration: 2, type: 'sfx', keywords: ['health', 'low', 'warning', 'ui', 'danger'], prompt: 'Low health warning beat, ominous pulse, player near death, urgent UI alert' },
    { name: 'mana regen chime', filename: 'mana-regen-chime.mp3', duration: 3, type: 'sfx', keywords: ['mana', 'regen', 'chime', 'spell', 'ui'], prompt: 'Mana regeneration chime, gentle magical shimmer, spell resource returning' },
    { name: 'critical hit stinger', filename: 'critical-hit-stinger.mp3', duration: 2, type: 'sfx', keywords: ['critical', 'hit', 'stinger', 'ui', 'combat'], prompt: 'Critical hit stinger, sharp triumphant sting, natural 20 landed, combat cue' },
    { name: 'miss whoosh fail', filename: 'miss-whoosh-fail.mp3', duration: 2, type: 'sfx', keywords: ['miss', 'whoosh', 'fail', 'combat'], prompt: 'Attack miss whoosh, blade swinging through empty air, missed shot fail cue' },

    // ═══════════ SFX — SOCIAL & VOCAL (10) ═══════════
    { name: 'crowd cheer victory', filename: 'crowd-cheer-victory.mp3', duration: 4, type: 'sfx', keywords: ['crowd', 'cheer', 'victory', 'applause'], prompt: 'Crowd cheering and applauding victory, enthusiastic roar of approval, triumph celebration' },
    { name: 'crowd gasp shock', filename: 'crowd-gasp-shock.mp3', duration: 2, type: 'sfx', keywords: ['crowd', 'gasp', 'shock', 'surprise'], prompt: 'Crowd gasp of shock, collective intake of breath, surprising reveal' },
    { name: 'crowd boo disapproval', filename: 'crowd-boo-disapproval.mp3', duration: 3, type: 'sfx', keywords: ['crowd', 'boo', 'disapproval', 'jeer'], prompt: 'Crowd booing and jeering disapproval, angry mob, failed performance reaction' },
    { name: 'whisper close intimate', filename: 'whisper-close-intimate.mp3', duration: 3, type: 'sfx', keywords: ['whisper', 'close', 'intimate', 'secret'], prompt: 'Close intimate whisper, unintelligible secretive voice right next to ear, conspiratorial' },
    { name: 'scream distant terror', filename: 'scream-distant-terror.mp3', duration: 3, type: 'sfx', keywords: ['scream', 'distant', 'terror', 'horror'], prompt: 'Distant terrified scream, someone in horror far away, blood-curdling cry muffled by distance' },
    { name: 'laugh evil villain', filename: 'laugh-evil-villain.mp3', duration: 4, type: 'sfx', keywords: ['laugh', 'evil', 'villain', 'menacing'], prompt: 'Evil villain laugh, menacing maniacal cackle, triumphant wicked amusement' },
    { name: 'laugh warm friendly', filename: 'laugh-warm-friendly.mp3', duration: 3, type: 'sfx', keywords: ['laugh', 'warm', 'friendly', 'joyful'], prompt: 'Warm friendly laugh, genuine joyful chuckle, companion tavern banter' },
    { name: 'child crying', filename: 'child-crying.mp3', duration: 4, type: 'sfx', keywords: ['child', 'crying', 'sad', 'distress'], prompt: 'Child crying in distress, upset young voice sobbing, emotionally difficult scene' },
    { name: 'baby cooing laughter', filename: 'baby-cooing-laughter.mp3', duration: 3, type: 'sfx', keywords: ['baby', 'cooing', 'laughter', 'innocent'], prompt: 'Baby cooing and laughing, innocent infant happy sounds, tender moment' },
    { name: 'death gasp final', filename: 'death-gasp-final.mp3', duration: 2, type: 'sfx', keywords: ['death', 'gasp', 'final', 'dying'], prompt: 'Final death gasp, last breath escaping lungs, quiet dramatic moment of passing' },

    // ═══════════ SFX — TRAVEL & MOUNTS (10) ═══════════
    { name: 'horse gallop solo', filename: 'horse-gallop-solo.mp3', duration: 5, type: 'sfx', keywords: ['horse', 'gallop', 'solo', 'ride'], prompt: 'Single horse galloping at full speed, rhythmic four-beat hooves, lone rider' },
    { name: 'horse trot calm', filename: 'horse-trot-calm.mp3', duration: 5, type: 'sfx', keywords: ['horse', 'trot', 'calm', 'ride'], prompt: 'Horse trotting calmly, steady two-beat pace, relaxed travel' },
    { name: 'horse snort breath', filename: 'horse-snort-breath.mp3', duration: 2, type: 'sfx', keywords: ['horse', 'snort', 'breath', 'mount'], prompt: 'Horse snorting and breathing, resting mount making soft equine sounds' },
    { name: 'camel grunt desert', filename: 'camel-grunt-desert.mp3', duration: 3, type: 'sfx', keywords: ['camel', 'grunt', 'desert', 'mount'], prompt: 'Camel grunting complaint, desert mount vocal, bactrian beast of burden' },
    { name: 'carriage stop arrive', filename: 'carriage-stop-arrive.mp3', duration: 4, type: 'sfx', keywords: ['carriage', 'stop', 'arrive', 'wheel'], prompt: 'Horse-drawn carriage coming to a stop, wooden wheels halting, horses snorting, arrival' },
    { name: 'cart wheel creak slow', filename: 'cart-wheel-creak-slow.mp3', duration: 5, type: 'sfx', keywords: ['cart', 'wheel', 'creak', 'slow', 'wagon'], prompt: 'Slow cart wheel creaking, old wooden wagon rolling down dirt road, peaceful travel' },
    { name: 'ship bell ring', filename: 'ship-bell-ring.mp3', duration: 3, type: 'sfx', keywords: ['ship', 'bell', 'ring', 'nautical'], prompt: 'Ship bell ringing clear and sharp, maritime signal, change of watch nautical' },
    { name: 'oars splash rhythmic', filename: 'oars-splash-rhythmic.mp3', duration: 5, type: 'sfx', keywords: ['oars', 'splash', 'rhythmic', 'boat', 'row'], prompt: 'Rhythmic oars splashing in water, small boat being rowed steadily across calm lake' },
    { name: 'sails flapping wind', filename: 'sails-flapping-wind.mp3', duration: 5, type: 'sfx', keywords: ['sails', 'flapping', 'wind', 'ship'], prompt: 'Ship sails flapping in strong wind, canvas snapping and billowing, tall ship at sea' },
    { name: 'compass needle spin', filename: 'compass-needle-spin.mp3', duration: 3, type: 'sfx', keywords: ['compass', 'needle', 'spin', 'navigation'], prompt: 'Compass needle spinning and settling, soft metallic tick, navigation finding north' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function r2Exists(key) {
    try {
        await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        return true;
    } catch { return false; }
}

async function generateSound(prompt, duration) {
    const resp = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
        method: 'POST',
        headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt, duration_seconds: duration, prompt_influence: 0.4 }),
    });
    if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`ElevenLabs ${resp.status}: ${errText}`);
    }
    return Buffer.from(await resp.arrayBuffer());
}

async function uploadToR2(key, body) {
    await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'audio/mpeg',
        CacheControl: 'public, max-age=31536000, immutable',
    }));
}

// ── Schema validation (always runs, catches typos before API calls) ─────────

function validate() {
    const seen = new Set();
    const errors = [];
    for (const s of NEW_SOUNDS) {
        const req = ['name', 'filename', 'prompt', 'duration', 'type', 'keywords'];
        for (const key of req) {
            if (s[key] === undefined || s[key] === null) errors.push(`${s.name || '(unnamed)'}: missing ${key}`);
        }
        if (!['music', 'sfx', 'ambience'].includes(s.type)) errors.push(`${s.name}: invalid type ${s.type}`);
        if (typeof s.duration !== 'number' || s.duration <= 0 || s.duration > 30) errors.push(`${s.name}: invalid duration ${s.duration}`);
        if (!Array.isArray(s.keywords) || s.keywords.length === 0) errors.push(`${s.name}: empty keywords`);
        if (seen.has(s.name)) errors.push(`${s.name}: duplicate name`);
        if (seen.has(s.filename)) errors.push(`${s.filename}: duplicate filename`);
        seen.add(s.name); seen.add(s.filename);
    }
    return errors;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const errors = validate();
    if (errors.length) {
        console.error('Schema validation failed:');
        for (const e of errors) console.error('  -', e);
        process.exit(1);
    }

    // Breakdown summary, always printed.
    const byType = NEW_SOUNDS.reduce((acc, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc; }, {});
    console.log(`\nBatch 2: ${NEW_SOUNDS.length} new sounds`);
    for (const [t, n] of Object.entries(byType)) console.log(`  ${t.padEnd(10)} ${n}`);
    const totalDur = NEW_SOUNDS.reduce((sum, s) => sum + s.duration, 0);
    console.log(`  total duration: ${totalDur}s (~${Math.ceil(totalDur / 60)} min)`);

    if (DRY_RUN) {
        console.log('\n(dry-run — no API calls, no R2 uploads, catalog not touched)');
        return;
    }

    if (!API_KEY) { console.error('Missing ELEVENLABS_API_KEY in .env.local'); process.exit(1); }

    const catalogPath = join(process.cwd(), 'public', 'saved-sounds.json');
    const catalogJson = JSON.parse(await readFile(catalogPath, 'utf-8'));
    const catalog = catalogJson.files || catalogJson;
    const existingNames = new Set(catalog.map(s => s.name.toLowerCase()));

    console.log(`\nExisting catalog: ${catalog.length} sounds\n`);

    let generated = 0, skipped = 0, failed = 0;
    for (let i = 0; i < NEW_SOUNDS.length; i++) {
        const s = NEW_SOUNDS[i];
        const r2Key = `${PREFIX}${s.filename}`;
        const tag = `[${i + 1}/${NEW_SOUNDS.length}]`;

        if (existingNames.has(s.name.toLowerCase())) {
            console.log(`${tag} SKIP (exists): ${s.name}`);
            skipped++;
            continue;
        }

        if (await r2Exists(r2Key)) {
            console.log(`${tag} SKIP (R2): ${s.name}`);
            catalog.push({
                type: s.type, name: s.name,
                file: `Saved sounds/${s.filename}`,
                keywords: s.keywords,
                ...(s.loop ? { loop: true } : {}),
            });
            existingNames.add(s.name.toLowerCase());
            skipped++;
            continue;
        }

        try {
            process.stdout.write(`${tag} Generating: ${s.name} (${s.duration}s)...`);
            const audio = await generateSound(s.prompt, s.duration);
            process.stdout.write(` ${(audio.length / 1024).toFixed(0)}KB...`);
            await uploadToR2(r2Key, audio);
            catalog.push({
                type: s.type, name: s.name,
                file: `Saved sounds/${s.filename}`,
                keywords: s.keywords,
                ...(s.loop ? { loop: true } : {}),
            });
            existingNames.add(s.name.toLowerCase());
            generated++;
            console.log(' OK');

            // Checkpoint catalog every 10 successful generations.
            if (generated % 10 === 0) {
                await writeFile(catalogPath, JSON.stringify({ ...catalogJson, files: catalog }, null, 2) + '\n');
                console.log(`  [checkpoint: saved ${catalog.length} entries]`);
            }
            await sleep(250); // be nice to the API
        } catch (err) {
            console.log(` FAIL: ${err.message}`);
            failed++;
        }
    }

    await writeFile(catalogPath, JSON.stringify({ ...catalogJson, files: catalog }, null, 2) + '\n');
    console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${failed} failed. Catalog now ${catalog.length} entries.`);
}

main().catch(err => { console.error(err); process.exit(1); });
