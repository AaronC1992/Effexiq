// ===== SuiteRhythm TRIGGER SYSTEM =====
// Expanded instant keyword triggers mapped to actual sound catalog files
// 300+ trigger words covering all 176 SFX in the library

/**
 * Build the full keyword→sound mapping from the saved-sounds catalog.
 * Returns { keyword: { query, file, volume, category } }
 * Called once after savedSounds loads.
 */
export function buildTriggerMap(savedSounds) {
    const map = {};
    
    // Helper: register a keyword with its sound file and search query
    function add(keyword, query, file, volume = 0.7, category = 'sfx') {
        if (!map[keyword]) {
            map[keyword] = { query, file, volume, category };
        }
    }

    // ===== ANIMALS =====
    // Dogs
    add('bark', 'dog bark', 'Saved sounds/large_dog_barking.mp3', 0.7, 'animal');
    add('barking', 'dog bark', 'Saved sounds/large_dog_barking.mp3', 0.7, 'animal');
    add('woof', 'dog bark', 'Saved sounds/large_dog_barking.mp3', 0.7, 'animal');
    add('dog', 'dog bark', 'Saved sounds/large_dog_barking.mp3', 0.6, 'animal');
    add('puppy', 'dog bark', 'Saved sounds/small_dog_barking.mp3', 0.6, 'animal');
    add('whimper', 'dog whimper', 'Saved sounds/ES_Golden Retriever, Barks, Whimper - Epidemic Sound.mp3', 0.5, 'animal');
    add('whimpering', 'dog whimper', 'Saved sounds/ES_Whimpering, Indoor - Epidemic Sound.mp3', 0.5, 'animal');
    add('howl', 'wolf howl', 'Saved sounds/wolf-howl.mp3', 0.7, 'animal');
    add('howling', 'wolf howl', 'Saved sounds/wolf-howl-moon.mp3', 0.7, 'animal');
    // Cats
    add('meow', 'cat meow', 'Saved sounds/cat-meow.mp3', 0.6, 'animal');
    add('cat', 'cat meow', 'Saved sounds/cat-meow.mp3', 0.5, 'animal');
    add('hiss', 'cat hiss', 'Saved sounds/cat-screech.mp3', 0.6, 'animal');
    add('screech', 'cat screech', 'Saved sounds/cat-screech.mp3', 0.7, 'animal');
    // Wolves
    add('wolf', 'wolf howl', 'Saved sounds/wolf-howl.mp3', 0.7, 'animal');
    add('wolves', 'wolf howl', 'Saved sounds/wolf-howl-moon.mp3', 0.7, 'animal');
    add('growl', 'wolf growl', 'Saved sounds/wolf-growl.mp3', 0.7, 'animal');
    add('growling', 'wolf growl', 'Saved sounds/wolf-growl.mp3', 0.7, 'animal');
    add('snarl', 'wolf growl', 'Saved sounds/wolf-growl.mp3', 0.7, 'animal');
    add('snarling', 'snarling growl', 'Saved sounds/ES_Snarling, Growling 01 - Epidemic Sound.mp3', 0.7, 'creature');
    // Birds
    add('bird', 'bird chirp', 'Saved sounds/bird_whistling_chirping.mp3', 0.5, 'animal');
    add('chirp', 'bird chirp', 'Saved sounds/bird_whistling_chirping.mp3', 0.5, 'animal');
    add('chirping', 'bird chirp', 'Saved sounds/bird_whistling_chirping.mp3', 0.5, 'animal');
    add('tweet', 'bird chirp', 'Saved sounds/bird_whistling_chirping.mp3', 0.5, 'animal');
    add('crow', 'crow caw', 'Saved sounds/crow-call.mp3', 0.6, 'animal');
    add('crows', 'crow caw', 'Saved sounds/crow-call.mp3', 0.6, 'animal');
    add('raven', 'crow caw', 'Saved sounds/crow-call.mp3', 0.6, 'animal');
    add('caw', 'crow caw', 'Saved sounds/crow-call.mp3', 0.6, 'animal');
    add('owl', 'owl hoot', 'Saved sounds/owl-hoot.mp3', 0.6, 'animal');
    add('owls', 'owl hoot', 'Saved sounds/owl-hoot.mp3', 0.6, 'animal');
    add('hoot', 'owl hoot', 'Saved sounds/owl-hoot.mp3', 0.6, 'animal');
    add('rooster', 'rooster crow', 'Saved sounds/rooster-calling-close.mp3', 0.6, 'animal');
    add('cockerel', 'rooster crow', 'Saved sounds/rooster-calling-close.mp3', 0.6, 'animal');
    add('cock-a-doodle', 'rooster crow', 'Saved sounds/rooster-calling-close.mp3', 0.7, 'animal');
    add('chicken', 'chicken cluck', 'Saved sounds/chicken-bawking.mp3', 0.5, 'animal');
    add('cluck', 'chicken cluck', 'Saved sounds/chicken-bawking.mp3', 0.5, 'animal');
    // Farm
    add('cow', 'cow moo', 'Saved sounds/cows-mooing.mp3', 0.5, 'animal');
    add('moo', 'cow moo', 'Saved sounds/cows-mooing.mp3', 0.6, 'animal');
    // Horses
    add('horse', 'horse gallop', 'Saved sounds/horse_galloping.mp3', 0.7, 'animal');
    add('gallop', 'horse gallop', 'Saved sounds/horse_galloping.mp3', 0.7, 'animal');
    add('galloping', 'horse gallop', 'Saved sounds/horse_galloping.mp3', 0.7, 'animal');
    add('trot', 'horse trot', 'Saved sounds/trotting-horse-in-rural-road.mp3', 0.6, 'animal');
    add('trotting', 'horse trot', 'Saved sounds/trotting-horse-in-rural-road.mp3', 0.6, 'animal');
    add('hooves', 'horse gallop', 'Saved sounds/horse_galloping.mp3', 0.6, 'animal');
    add('neigh', 'horse whinny', 'Saved sounds/horse-whinny.mp3', 0.6, 'animal');
    add('whinny', 'horse whinny', 'Saved sounds/horse-whinny.mp3', 0.6, 'animal');
    add('cavalry', 'cavalry gallop', 'Saved sounds/horses_army_calvery_galloping-Jennas-Laptop.flac', 0.8, 'animal');
    add('charging', 'cavalry gallop', 'Saved sounds/horses_army_calvery_galloping-Jennas-Laptop.flac', 0.8, 'animal');
    add('charged', 'cavalry gallop', 'Saved sounds/horses_army_calvery_galloping-Jennas-Laptop.flac', 0.7, 'animal');
    // Big cats / exotic
    add('lion', 'lion roar', 'Saved sounds/ES_Lion Roar LIke, Gugrling - Epidemic Sound.mp3', 0.8, 'animal');
    add('tiger', 'tiger growl', 'Saved sounds/ES_Tiger, Growls, Roars, Several, Intimidated - Epidemic Sound.mp3', 0.8, 'animal');
    add('roar', 'creature roar', 'Saved sounds/ES_Roar - Epidemic Sound v1.mp3', 0.8, 'creature');
    add('roared', 'creature roar', 'Saved sounds/ES_Roar - Epidemic Sound v1.mp3', 0.7, 'creature');

    // ===== CREATURES & MONSTERS =====
    add('monster', 'monster growl', 'Saved sounds/monster-growl.flac', 0.8, 'creature');
    add('beast', 'evil beast', 'Saved sounds/ES_Evil Beast, Growl, Snarl - Epidemic Sound.mp3', 0.8, 'creature');
    add('creature', 'creature roar', 'Saved sounds/ES_Giant Creature, Roaring - Epidemic Sound.mp3', 0.8, 'creature');
    add('dragon', 'dragon growl', 'Saved sounds/dragon_growl.ogg', 0.8, 'creature');
    add('ogre', 'troll growl', 'Saved sounds/ES_Troll, Mad, Growling, Pitchdown -12st 04 - Epidemic Sound.mp3', 0.8, 'creature');
    add('troll', 'troll growl', 'Saved sounds/ES_Troll, Mad, Growling, Pitchdown -12st 04 - Epidemic Sound.mp3', 0.8, 'creature');
    add('orc', 'monster growl', 'Saved sounds/ES_Snarling, Growling 01 - Epidemic Sound.mp3', 0.8, 'creature');
    add('goblin', 'monster growl', 'Saved sounds/monster_breath_growl.mp3', 0.7, 'creature');
    add('demon', 'monster growl', 'Saved sounds/ES_Evil Beast, Growl, Snarl - Epidemic Sound.mp3', 0.8, 'creature');
    add('zombie', 'zombie growl', 'Saved sounds/zombie_growl.mp3', 0.7, 'creature');
    add('zombies', 'zombie group', 'Saved sounds/ES_Creatures, Humanoid, Zombie, Group, Ext Roar, Scream, Shriek - Epidemic Sound.mp3', 0.8, 'creature');
    add('undead', 'zombie growl', 'Saved sounds/monster_zombie_growl.mp3', 0.7, 'creature');
    add('ghost', 'ghost eerie', 'Saved sounds/ES_Something in the Basement - Lennon Hutton.mp3', 0.6, 'creature');
    add('wraith', 'monster vocal', 'Saved sounds/ES_Monster Vocal, Screams 03 - Epidemic Sound.mp3', 0.7, 'creature');
    add('vampire', 'monster breath', 'Saved sounds/monster_breath_growl.mp3', 0.7, 'creature');
    add('werewolf', 'wolf howl', 'Saved sounds/wolf-howl-moon.mp3', 0.8, 'creature');
    add('slurp', 'creature eating', 'Saved sounds/ES_Creature Slurps and eating  02 - Epidemic Sound.mp3', 0.6, 'creature');
    add('devour', 'creature eating', 'Saved sounds/ES_Creature Slurps and eating  02 - Epidemic Sound.mp3', 0.7, 'creature');

    // ===== COMBAT & WEAPONS =====
    add('sword', 'sword clash', 'Saved sounds/swords-fighting.mp3', 0.8, 'combat');
    add('swords', 'swords fighting', 'Saved sounds/swords-fighting.mp3', 0.8, 'combat');
    add('blade', 'sword swing', 'Saved sounds/large-sword-swing.mp3', 0.7, 'combat');
    add('slash', 'sword swing', 'Saved sounds/sword-swing.mp3', 0.7, 'combat');
    add('slashed', 'sword swing', 'Saved sounds/sword-swing.mp3', 0.7, 'combat');
    add('slashing', 'sword swing', 'Saved sounds/sword-swing.mp3', 0.7, 'combat');
    add('swing', 'sword swing', 'Saved sounds/sword-swing.mp3', 0.7, 'combat');
    add('stab', 'sword stab', 'Saved sounds/sword-stab-body-hit.mp3', 0.8, 'combat');
    add('stabbed', 'sword stab', 'Saved sounds/sword-stab-body-hit.mp3', 0.8, 'combat');
    add('stabbing', 'sword stab', 'Saved sounds/sword-stab-body-hit.mp3', 0.8, 'combat');
    add('pierce', 'sword stab', 'Saved sounds/sword-stab-body-hit.mp3', 0.7, 'combat');
    add('unsheath', 'sword unsheath', 'Saved sounds/sword-unsheath.mp3', 0.6, 'combat');
    add('drew his sword', 'draw sword', 'Saved sounds/draw-sword.mp3', 0.7, 'combat');
    add('drew her sword', 'draw sword', 'Saved sounds/draw-sword.mp3', 0.7, 'combat');
    add('sheath', 'sword sheath', 'Saved sounds/sword-sheath.mp3', 0.5, 'combat');
    add('sharpen', 'sword sharpen', 'Saved sounds/sword-sharpen.m4a', 0.5, 'combat');
    add('parry', 'sword block', 'Saved sounds/ES_Metal Impact, Block, Parry, Sword Fight, Ring Out 01 - Epidemic Sound.mp3', 0.7, 'combat');
    add('block', 'shield block', 'Saved sounds/ES_Metal Impact, Block, Parry, Sword Fight, Ring Out 01 - Epidemic Sound.mp3', 0.6, 'combat');
    add('clang', 'metal impact', 'Saved sounds/ES_Metal Impact, Block, Parry, Sword Fight, Ring Out 01 - Epidemic Sound.mp3', 0.7, 'combat');
    add('clash', 'swords clash', 'Saved sounds/swords-fighting.mp3', 0.8, 'combat');
    add('duel', 'sword fight', 'Saved sounds/ES_Sword Fight, 1v1, Longsword, Medieval Warriors, Knights, In Armor, Schoeps (MS) - Epidemic Sound.mp3', 0.8, 'combat');
    add('fight', 'sword fight', 'Saved sounds/ES_Sword Fight, 1v1, Longsword, Medieval Warriors, Knights, In Armor, Schoeps (MS) - Epidemic Sound.mp3', 0.7, 'combat');
    add('battle', 'battle', 'Saved sounds/ES_Medieval Battlefield, Medium Group, Sword Impacts, Screams, Grunts - Epidemic Sound.mp3', 0.8, 'combat');
    add('war', 'medieval war', 'Saved sounds/ES_Medieval, War, Battle, Armors, Shields, Arrows, Swords Layer - Epidemic Sound.mp3', 0.8, 'combat');
    add('army', 'medieval battle', 'Saved sounds/ES_Medieval, War, Battle, Many Swords, Layer - Epidemic Sound.mp3', 0.8, 'combat');
    // Ranged
    add('arrow', 'arrow shot', 'Saved sounds/bow_shot.mp3', 0.7, 'combat');
    add('bow', 'bow shot', 'Saved sounds/bow_shot.mp3', 0.7, 'combat');
    add('twang', 'bow twang', 'Saved sounds/bow_shot.mp3', 0.6, 'combat');
    add('shoot', 'bow shot', 'Saved sounds/bow_shot.mp3', 0.7, 'combat');
    add('crossbow', 'crossbow shot', 'Saved sounds/bow_shot.mp3', 0.7, 'combat');
    add('musket', 'musket shot', 'Saved sounds/gun-shot.mp3', 0.8, 'combat');
    // Gunfire
    add('gunshot', 'gunshot', 'Saved sounds/gun-shot.mp3', 0.9, 'combat');
    add('gun', 'gunshot', 'Saved sounds/gun-shot.mp3', 0.8, 'combat');
    add('pistol', 'gunshot', 'Saved sounds/gun-shot.mp3', 0.8, 'combat');
    add('rifle', 'gunshot distant', 'Saved sounds/gunshot-distant.mp3', 0.8, 'combat');
    add('shot', 'gunshot', 'Saved sounds/gun-shot.mp3', 0.8, 'combat');
    add('fired', 'gunshot', 'Saved sounds/gun-shot.mp3', 0.8, 'combat');
    add('shooting', 'gunshot', 'Saved sounds/gun-shot.mp3', 0.8, 'combat');
    add('bullet', 'bullet whiz', 'Saved sounds/bullet-or-arrow-nearmiss.mp3', 0.7, 'combat');
    // Impacts
    add('struck', 'sword clash', 'Saved sounds/swords-fighting.mp3', 0.7, 'combat');
    add('punch', 'punch impact', 'Saved sounds/punch_2.mp3', 0.7, 'combat');
    add('hit', 'punch', 'Saved sounds/punch.mp3', 0.7, 'combat');
    add('smack', 'punch', 'Saved sounds/punch.mp3', 0.7, 'combat');

    // ===== EXPLOSIONS & IMPACTS =====
    add('bang', 'gunshot explosion', 'Saved sounds/big_explosion.mp3', 0.9, 'explosion');
    add('explosion', 'big explosion', 'Saved sounds/big_explosion.mp3', 0.9, 'explosion');
    add('explode', 'big explosion', 'Saved sounds/big_explosion.mp3', 0.9, 'explosion');
    add('exploded', 'big explosion', 'Saved sounds/big_explosion.mp3', 0.9, 'explosion');
    add('exploding', 'big explosion', 'Saved sounds/big_explosion.mp3', 0.9, 'explosion');
    add('boom', 'explosion boom', 'Saved sounds/ES_Boom, Distant Explosion 01 - Epidemic Sound v3.mp3', 0.9, 'explosion');
    add('blast', 'cannon blast', 'Saved sounds/ES_Explosion, Real, Cannon Blast, Airy - Epidemic Sound v1.mp3', 0.9, 'explosion');
    add('cannon', 'cannon blast', 'Saved sounds/ES_Explosion, Real, Cannon Blast, Airy - Epidemic Sound v1.mp3', 0.9, 'explosion');
    add('dynamite', 'explosion', 'Saved sounds/big_explosion.mp3', 0.9, 'explosion');
    add('bomb', 'explosion', 'Saved sounds/big_explosion.mp3', 0.9, 'explosion');
    add('fireball', 'magic fireball', 'Saved sounds/magic_fireball.mp3', 0.8, 'explosion');
    add('crash', 'glass crash', 'Saved sounds/glass-shatter.mp3', 0.8, 'impact');
    add('shatter', 'glass shatter', 'Saved sounds/glass-shatter.mp3', 0.8, 'impact');
    add('smash', 'glass shatter', 'Saved sounds/glass-shatter.mp3', 0.8, 'impact');
    add('thud', 'heavy thud', 'Saved sounds/thud.mp3', 0.7, 'impact');
    add('thump', 'heavy thud', 'Saved sounds/thud.mp3', 0.7, 'impact');
    add('slam', 'door slam', 'Saved sounds/thud.mp3', 0.7, 'impact');
    add('impact', 'dark impact', 'Saved sounds/ES_Impact, Dark, Cinematic, Low, Explosive - Epidemic Sound.mp3', 0.8, 'impact');
    add('cinematic', 'cinematic impact', 'Saved sounds/ES_Impact, Dark, Cinematic, Low, Explosive - Epidemic Sound.mp3', 0.7, 'impact');
    add('fell', 'tree falling', 'Saved sounds/tree-falling-down.mp3', 0.7, 'impact');
    add('timber', 'tree falling', 'Saved sounds/tree-falling-down.mp3', 0.8, 'impact');
    add('collapse', 'tree falling', 'Saved sounds/tree-falling-down.mp3', 0.8, 'impact');

    // ===== MAGIC & SPELLS =====
    add('spell', 'magic spell', 'Saved sounds/magic-spell.mp3', 0.7, 'magic');
    add('magic', 'magic spell', 'Saved sounds/magic-spell.mp3', 0.7, 'magic');
    add('cast', 'magic spell', 'Saved sounds/magic-spell.mp3', 0.7, 'magic');
    add('casting', 'magic spell', 'Saved sounds/magic-spell.mp3', 0.7, 'magic');
    add('enchant', 'magic spell', 'Saved sounds/magic-spell.mp3', 0.6, 'magic');
    add('heal', 'magic heal', 'Saved sounds/magic-heal.mp3', 0.6, 'magic');
    add('healing', 'magic heal', 'Saved sounds/magic-heal.mp3', 0.6, 'magic');
    add('missile', 'magic missile', 'Saved sounds/magic-missiles.mp3', 0.7, 'magic');
    add('poof', 'poof magic', 'Saved sounds/poof.mp3', 0.6, 'magic');
    add('vanish', 'poof', 'Saved sounds/poof.mp3', 0.6, 'magic');
    add('vanished', 'poof', 'Saved sounds/poof.mp3', 0.6, 'magic');
    add('vanishing', 'poof', 'Saved sounds/poof.mp3', 0.6, 'magic');
    add('disappear', 'poof', 'Saved sounds/poof.mp3', 0.6, 'magic');
    add('wizard', 'magic spell', 'Saved sounds/magic-spell.mp3', 0.6, 'magic');

    // ===== WEATHER =====
    add('thunder', 'thunder storm', 'Saved sounds/thunder_storm.mp3', 0.8, 'weather');
    add('thunderstorm', 'thunder storm', 'Saved sounds/thunder_storm.mp3', 0.8, 'weather');
    add('lightning', 'lightning strike', 'Saved sounds/freesound_community-quick-lightning-strike-29683.mp3', 0.8, 'weather');
    add('rain', 'rain', 'Saved sounds/light_rain_shower.mp3', 0.5, 'weather');
    add('raining', 'rain', 'Saved sounds/rain-on-windows-interior.mp3', 0.5, 'weather');
    add('drizzle', 'light rain', 'Saved sounds/light_rain_shower.mp3', 0.4, 'weather');
    add('storm', 'thunder storm', 'Saved sounds/thunder_storm.mp3', 0.7, 'weather');
    add('wind', 'wind', 'Saved sounds/wind_windy.mp3', 0.5, 'weather');
    add('windy', 'wind', 'Saved sounds/wind_windy.mp3', 0.5, 'weather');
    add('breeze', 'wind', 'Saved sounds/wind_windy.mp3', 0.4, 'weather');
    add('gust', 'wind howl', 'Saved sounds/wind_howl.mp3', 0.6, 'weather');
    add('blizzard', 'wind howl', 'Saved sounds/wind_howl.mp3', 0.7, 'weather');
    add('whoosh', 'wind whoosh', 'Saved sounds/whoosh.flac', 0.6, 'weather');

    // ===== FIRE =====
    add('fire', 'fire crackling', 'Saved sounds/campfire_ambient.mp3', 0.5, 'fire');
    add('fireplace', 'fireplace', 'Saved sounds/campfire_ambient.mp3', 0.5, 'fire');
    add('campfire', 'campfire', 'Saved sounds/campfire_ambient.mp3', 0.5, 'fire');
    add('crackling', 'fire crackling', 'Saved sounds/campfire_ambient.mp3', 0.5, 'fire');
    add('ember', 'fire ember', 'Saved sounds/campfire_ambient.mp3', 0.4, 'fire');
    add('flame', 'flames', 'Saved sounds/ES_Flame, Fireball, Fast x4 - Epidemic Sound.mp3', 0.7, 'fire');
    add('flames', 'large fire', 'Saved sounds/ES_Flames, Large, Movement 01 - Epidemic Sound.mp3', 0.7, 'fire');
    add('inferno', 'large fire', 'Saved sounds/ES_Textures, Large Fire, Inferno, Winds, Continuously On Fire - Epidemic Sound.mp3', 0.8, 'fire');
    add('blaze', 'large fire', 'Saved sounds/ES_Textures, Large Fire, Inferno, Winds, Continuously On Fire - Epidemic Sound.mp3', 0.7, 'fire');
    add('burning', 'fire crackling', 'Saved sounds/campfire_ambient.mp3', 0.6, 'fire');
    add('burned', 'fire crackling', 'Saved sounds/campfire_ambient.mp3', 0.5, 'fire');
    add('torch', 'fire', 'Saved sounds/fireplace.mp3', 0.5, 'fire');
    add('fireworks', 'fireworks', 'Saved sounds/fireworks_display.mp3', 0.7, 'fire');

    // ===== WATER =====
    add('splash', 'water splash', 'Saved sounds/footsteps_water.mp3', 0.6, 'water');
    add('water', 'water flowing', 'Saved sounds/ES_Water Flowing, Small Stream 01 - Epidemic Sound.mp3', 0.4, 'water');
    add('stream', 'stream water', 'Saved sounds/stream-water.mp3', 0.4, 'water');
    add('river', 'river flowing', 'Saved sounds/ES_River, Small, Distant Waterfall 02 - Epidemic Sound.mp3', 0.4, 'water');
    add('waterfall', 'waterfall', 'Saved sounds/ES_River, Small, Distant Waterfall 02 - Epidemic Sound.mp3', 0.5, 'water');
    add('waves', 'waves shore', 'Saved sounds/waves-sea-shore.mp3', 0.5, 'water');
    add('ocean', 'waves shore', 'Saved sounds/waves-sea-shore.mp3', 0.5, 'water');
    add('sea', 'waves shore', 'Saved sounds/waves-sea-shore.mp3', 0.5, 'water');
    add('drip', 'water drip', 'Saved sounds/dragon-studio-water-dripping-364450.mp3', 0.5, 'water');

    // ===== FOOTSTEPS & MOVEMENT =====
    add('footstep', 'footsteps', 'Saved sounds/footsteps_daytime_hike.mp3', 0.6, 'movement');
    add('footsteps', 'footsteps', 'Saved sounds/footsteps_daytime_hike.mp3', 0.6, 'movement');
    add('walking', 'footsteps', 'Saved sounds/ES_Hardwood, Boots, Walking By 02 - Epidemic Sound.mp3', 0.5, 'movement');
    add('walked', 'footsteps', 'Saved sounds/footsteps_daytime_hike.mp3', 0.5, 'movement');
    add('steps', 'footsteps', 'Saved sounds/footsteps_daytime_hike.mp3', 0.5, 'movement');
    add('crept', 'footsteps slow', 'Saved sounds/footsteps_grass.mp3', 0.4, 'movement');
    add('sneak', 'sneaking footsteps', 'Saved sounds/footsteps_grass.mp3', 0.4, 'movement');
    add('sneaking', 'sneaking footsteps', 'Saved sounds/footsteps_grass.mp3', 0.4, 'movement');
    add('running', 'running', 'Saved sounds/ES_Gravel, Sneaker, Running 01 - Epidemic Sound.mp3', 0.6, 'movement');
    add('ran', 'running', 'Saved sounds/ES_Gravel, Sneaker, Running 01 - Epidemic Sound.mp3', 0.6, 'movement');
    add('run', 'running', 'Saved sounds/ES_Running, Panting, Outdoors - Epidemic Sound.mp3', 0.6, 'movement');
    add('chase', 'running', 'Saved sounds/ES_Running, Panting, Outdoors - Epidemic Sound.mp3', 0.7, 'movement');
    add('chased', 'running', 'Saved sounds/ES_Running, Panting, Outdoors - Epidemic Sound.mp3', 0.7, 'movement');
    add('heels', 'heels walking', 'Saved sounds/ES_Hardwood, Female, Heels, Walk 03 - Epidemic Sound.mp3', 0.5, 'movement');
    add('boots', 'boots walking', 'Saved sounds/ES_Hardwood, Boots, Walking By 02 - Epidemic Sound.mp3', 0.5, 'movement');
    add('stairs', 'footsteps stairs', 'Saved sounds/footsteps_wood_stairs.mp3', 0.5, 'movement');
    add('gravel', 'footsteps gravel', 'Saved sounds/ES_Walk On Gravel - Epidemic Sound.mp3', 0.5, 'movement');
    add('leaves', 'footsteps leaves', 'Saved sounds/footsteps_leaves.mp3', 0.5, 'movement');
    add('snow', 'footsteps snow', 'Saved sounds/footsteps_snow.mp3', 0.5, 'movement');
    add('sand', 'footsteps sand', 'Saved sounds/footsteps_sand.mp3', 0.5, 'movement');
    add('grass', 'footsteps grass', 'Saved sounds/footsteps_grass.mp3', 0.5, 'movement');

    // ===== DOORS & BUILDINGS =====
    add('knock', 'door knock', 'Saved sounds/ES_Thick Wood Front Door, Knock Variations 07 - Epidemic Sound.mp3', 0.7, 'door');
    add('knocked', 'door knock', 'Saved sounds/ES_Thick Wood Front Door, Knock Variations 07 - Epidemic Sound.mp3', 0.7, 'door');
    add('knocking', 'door knock', 'Saved sounds/ES_Thick Wood Front Door, Knock Variations 07 - Epidemic Sound.mp3', 0.7, 'door');
    add('knocks', 'door knock', 'Saved sounds/ES_Thick Wood Front Door, Knock Variations 07 - Epidemic Sound.mp3', 0.7, 'door');
    add('door', 'door creak', 'Saved sounds/ES_Wood, 50\'s Gallery Open, Shut - Epidemic Sound.mp3', 0.6, 'door');
    add('creak', 'door creak', 'Saved sounds/ES_Wood, 50\'s Gallery Open, Shut - Epidemic Sound.mp3', 0.6, 'door');
    add('creaking', 'door creak', 'Saved sounds/ES_Wood, 50\'s Gallery Open, Shut - Epidemic Sound.mp3', 0.6, 'door');
    add('gate', 'door creak', 'Saved sounds/ES_Wood, 50\'s Gallery Open, Shut - Epidemic Sound.mp3', 0.6, 'door');
    // Bell
    add('bell', 'bell chime', 'Saved sounds/ding_shop-bell.mp3', 0.6, 'door');
    add('ding', 'bell ding', 'Saved sounds/ding_shop-bell-v2.mp3', 0.6, 'door');
    add('doorbell', 'bell ding', 'Saved sounds/ding_shop-bell.mp3', 0.6, 'door');
    add('elevator', 'elevator chime', 'Saved sounds/elevator-chime.mp3', 0.5, 'door');

    // ===== HUMAN SOUNDS =====
    add('scream', 'scream', 'Saved sounds/woman_scream.mp3', 0.7, 'human');
    add('screamed', 'scream', 'Saved sounds/woman_scream.mp3', 0.7, 'human');
    add('screaming', 'scream', 'Saved sounds/woman_scream.mp3', 0.7, 'human');
    add('shriek', 'scream', 'Saved sounds/woman_scream.mp3', 0.7, 'human');
    add('yell', 'scream', 'Saved sounds/woman_scream.mp3', 0.7, 'human');
    add('wail', 'wail scream', 'Saved sounds/woman_scream.mp3', 0.6, 'human');
    add('moan', 'creature moan', 'Saved sounds/monster_breath_growl.mp3', 0.5, 'human');
    add('groan', 'creature groan', 'Saved sounds/monster_breath_growl.mp3', 0.5, 'human');
    add('laugh', 'laugh', 'Saved sounds/ES_Toddler, Male, 15 Months, Laugh - Epidemic Sound.mp3', 0.7, 'human');
    add('laughing', 'laugh', 'Saved sounds/ES_Toddler, Male, 15 Months, Laugh - Epidemic Sound.mp3', 0.7, 'human');
    add('giggle', 'laugh', 'Saved sounds/ES_Toddler, Male, 15 Months, Laugh - Epidemic Sound.mp3', 0.6, 'human');
    add('baby', 'baby crying', 'Saved sounds/ES_Newborn, Maternity Ward, Baby Crying - Epidemic Sound.mp3', 0.6, 'human');
    add('crying', 'baby crying', 'Saved sounds/ES_Newborn, Maternity Ward, Baby Crying - Epidemic Sound.mp3', 0.6, 'human');
    add('cry', 'baby crying', 'Saved sounds/ES_Newborn, Maternity Ward, Baby Crying - Epidemic Sound.mp3', 0.5, 'human');
    add('breathing', 'heavy breathing', 'Saved sounds/heavy-breathing.mp3', 0.5, 'human');
    add('breath', 'heavy breathing', 'Saved sounds/heavy-breathing.mp3', 0.5, 'human');
    add('panting', 'heavy breathing', 'Saved sounds/heavy-breathing.mp3', 0.5, 'human');
    add('heartbeat', 'heartbeat', 'Saved sounds/heart_beat.mp3', 0.6, 'human');
    add('heart', 'heartbeat', 'Saved sounds/heart_beat.mp3', 0.5, 'human');
    add('whisper', 'whisper breath', 'Saved sounds/ES_Static Breath - Lennon Hutton.mp3', 0.5, 'human');
    add('writing', 'pencil writing', 'Saved sounds/pencil_writing.mp3', 0.4, 'human');
    add('pencil', 'pencil writing', 'Saved sounds/pencil_writing.mp3', 0.4, 'human');

    // ===== CROWDS & CELEBRATIONS =====
    add('applause', 'applause', 'Saved sounds/modern_crowd_cheering.mp3', 0.7, 'crowd');
    add('clap', 'applause', 'Saved sounds/modern_crowd_cheering.mp3', 0.7, 'crowd');
    add('clapping', 'applause', 'Saved sounds/modern_crowd_cheering.mp3', 0.7, 'crowd');
    add('cheer', 'crowd cheering', 'Saved sounds/modern_crowd_cheering.mp3', 0.7, 'crowd');
    add('cheering', 'crowd cheering', 'Saved sounds/modern_crowd_cheering.mp3', 0.7, 'crowd');
    add('hooray', 'crowd cheering', 'Saved sounds/ES_Wohoo, Yay, 7 People 02 - Epidemic Sound.mp3', 0.7, 'crowd');
    add('yay', 'crowd yay', 'Saved sounds/ES_Wohoo, Yay, 7 People 02 - Epidemic Sound.mp3', 0.7, 'crowd');
    add('crowd', 'crowd', 'Saved sounds/ES_Concert Crowd, Stadium, Large, Interior, Long Swell, Call To Encore, The Forum Stadium, Applause - Epidemic Sound.mp3', 0.6, 'crowd');
    add('audience', 'crowd', 'Saved sounds/ES_Concert Crowd, Stadium, Large, Interior, Long Swell, Call To Encore, The Forum Stadium, Applause - Epidemic Sound.mp3', 0.6, 'crowd');
    add('stadium', 'crowd stadium', 'Saved sounds/ES_Concert Crowd, Stadium, Large, Interior, Long Swell, Call To Encore, The Forum Stadium, Applause - Epidemic Sound.mp3', 0.7, 'crowd');
    add('concert', 'concert', 'Saved sounds/ES_Concert, Girls, Teenagers, Squealing, Artist Enters, Bell Centre, Montreal, Canada - Epidemic Sound.mp3', 0.6, 'crowd');
    add('children', 'children', 'Saved sounds/ES_Suburban Kids - Marc Torch.mp3', 0.5, 'crowd');
    add('kids', 'kids', 'Saved sounds/ES_Suburban Kids - Marc Torch.mp3', 0.5, 'crowd');

    // ===== VEHICLES & TRANSPORT =====
    add('car', 'car engine', 'Saved sounds/car-engine-start.mp3', 0.6, 'vehicle');
    add('engine', 'car engine', 'Saved sounds/car-engine-start.mp3', 0.6, 'vehicle');
    add('train', 'train passing', 'Saved sounds/train-passing-by.mp3', 0.6, 'vehicle');
    add('ship', 'ship horn', 'Saved sounds/ES_Ships Whistle -horn- Three Blasts - Epidemic Sound.mp3', 0.7, 'vehicle');
    add('boat', 'boat floating', 'Saved sounds/wood-ship-boat-floating-sounds.mp3', 0.5, 'vehicle');
    add('pirate', 'pirate ship', 'Saved sounds/pirate-ship-floating-noise.mp3', 0.5, 'vehicle');
    add('horn', 'ship horn', 'Saved sounds/ES_Ships Whistle -horn- Three Blasts - Epidemic Sound.mp3', 0.7, 'vehicle');
    add('sailing', 'ship floating', 'Saved sounds/pirate-ship-floating-noise.mp3', 0.5, 'vehicle');

    // ===== EMERGENCY VEHICLES & SIRENS =====
    add('siren', 'police siren', 'Saved sounds/police-siren-wail.mp3', 0.75, 'vehicle');
    add('sirens', 'distant sirens', 'Saved sounds/distant-city-siren-ambience.mp3', 0.6, 'vehicle');
    add('police', 'police siren', 'Saved sounds/police-siren-wail.mp3', 0.75, 'vehicle');
    add('cop', 'police siren', 'Saved sounds/police-siren-wail.mp3', 0.75, 'vehicle');
    add('cops', 'police siren', 'Saved sounds/police-siren-wail.mp3', 0.75, 'vehicle');
    add('cruiser', 'police siren', 'Saved sounds/police-siren-wail.mp3', 0.75, 'vehicle');
    add('patrol', 'police siren', 'Saved sounds/police-siren-wail.mp3', 0.7, 'vehicle');
    add('ambulance', 'ambulance siren', 'Saved sounds/ambulance-siren.mp3', 0.75, 'vehicle');
    add('paramedic', 'ambulance siren', 'Saved sounds/ambulance-siren.mp3', 0.75, 'vehicle');
    add('medic', 'ambulance siren', 'Saved sounds/ambulance-siren.mp3', 0.7, 'vehicle');
    add('ems', 'ambulance siren', 'Saved sounds/ambulance-siren.mp3', 0.75, 'vehicle');
    add('firetruck', 'fire truck siren', 'Saved sounds/fire-truck-siren-air-horn.mp3', 0.75, 'vehicle');
    add('firefighter', 'fire truck siren', 'Saved sounds/fire-truck-siren-air-horn.mp3', 0.7, 'vehicle');
    add('raid', 'air raid siren', 'Saved sounds/air-raid-siren-warning.mp3', 0.8, 'vehicle');
    add('airraid', 'air raid siren', 'Saved sounds/air-raid-siren-warning.mp3', 0.8, 'vehicle');
    add('wartime', 'air raid siren', 'Saved sounds/air-raid-siren-warning.mp3', 0.7, 'vehicle');
    add('wwii', 'air raid siren', 'Saved sounds/air-raid-siren-warning.mp3', 0.7, 'vehicle');
    add('blitz', 'air raid siren', 'Saved sounds/air-raid-siren-warning.mp3', 0.75, 'vehicle');
    add('evacuation', 'air raid siren', 'Saved sounds/air-raid-siren-warning.mp3', 0.7, 'vehicle');
    add('klaxon', 'air raid siren', 'Saved sounds/air-raid-siren-warning.mp3', 0.75, 'vehicle');
    add('tornado', 'tornado siren', 'Saved sounds/tornado-civil-defense-siren.mp3', 0.8, 'vehicle');
    add('twister', 'tornado siren', 'Saved sounds/tornado-civil-defense-siren.mp3', 0.75, 'vehicle');
    add('cyclone', 'tornado siren', 'Saved sounds/tornado-civil-defense-siren.mp3', 0.75, 'vehicle');
    add('dispatch', 'police radio', 'Saved sounds/police-radio-dispatch-chatter.mp3', 0.6, 'vehicle');
    add('dispatcher', 'police radio', 'Saved sounds/police-radio-dispatch-chatter.mp3', 0.6, 'vehicle');
    add('squelch', 'police radio', 'Saved sounds/police-radio-dispatch-chatter.mp3', 0.6, 'vehicle');
    add('scanner', 'emergency scanner', 'Saved sounds/emergency-scanner-static.mp3', 0.55, 'vehicle');
    add('honk', 'car horn', 'Saved sounds/car-horn-single-honk.mp3', 0.7, 'vehicle');
    add('honking', 'car horn', 'Saved sounds/car-horn-single-honk.mp3', 0.7, 'vehicle');
    add('beep', 'car horn', 'Saved sounds/car-horn-single-honk.mp3', 0.6, 'vehicle');
    add('slam', 'car door slam', 'Saved sounds/cop-car-door-slam.mp3', 0.65, 'vehicle');
    add('doppler', 'emergency pass by', 'Saved sounds/emergency-vehicle-passing-by.mp3', 0.7, 'vehicle');

    // ===== HOUSEHOLD & MISC =====
    add('clock', 'tick tock', 'Saved sounds/tick-tock.mp3', 0.5, 'misc');
    add('tick', 'tick tock', 'Saved sounds/tick-tock.mp3', 0.5, 'misc');
    add('ticking', 'tick tock', 'Saved sounds/tick-tock.mp3', 0.5, 'misc');
    add('alarm', 'alarm clock', 'Saved sounds/alarm-clock.mp3', 0.7, 'misc');
    add('phone', 'phone ring', 'Saved sounds/phone-ring.mp3', 0.6, 'misc');
    add('ringing', 'phone ring', 'Saved sounds/phone-ring.mp3', 0.6, 'misc');
    add('telephone', 'phone ring', 'Saved sounds/phone-ring.mp3', 0.6, 'misc');
    add('anvil', 'anvil strike', 'Saved sounds/anvil-being-struck.mp3', 0.7, 'misc');
    add('hammer', 'anvil strike', 'Saved sounds/anvil-being-struck.mp3', 0.7, 'misc');
    add('forge', 'anvil strike', 'Saved sounds/anvil-being-struck.mp3', 0.6, 'misc');
    add('coin', 'coin clink', 'Saved sounds/coin-clink_drop_gold_collect.mp3', 0.5, 'misc');
    add('coins', 'coin clink', 'Saved sounds/coin-clink_drop_gold_collect.mp3', 0.5, 'misc');
    add('gold', 'coin clink', 'Saved sounds/coin-clink_drop_gold_collect.mp3', 0.5, 'misc');
    add('treasure', 'coin clink', 'Saved sounds/coin-clink_drop_gold_collect.mp3', 0.5, 'misc');
    add('money', 'coin clink', 'Saved sounds/coin-clink_drop_gold_collect.mp3', 0.5, 'misc');
    add('chain', 'chain rattle', 'Saved sounds/ES_Metal Impact, Block, Parry, Sword Fight, Ring Out 01 - Epidemic Sound.mp3', 0.6, 'misc');
    add('chains', 'chain rattle', 'Saved sounds/ES_Metal Impact, Block, Parry, Sword Fight, Ring Out 01 - Epidemic Sound.mp3', 0.6, 'misc');
    add('static', 'radio static', 'Saved sounds/radio-static.mp3', 0.5, 'misc');
    add('radio', 'radio static', 'Saved sounds/radio-static.mp3', 0.5, 'misc');
    add('rewind', 'tape rewind', 'Saved sounds/rewind.mp3', 0.5, 'misc');
    add('flatline', 'heart monitor', 'Saved sounds/heart-beep-monitor_dieing-long-beep.mp3', 0.6, 'misc');
    add('monitor', 'heart monitor', 'Saved sounds/heart-beep-monitor_dieing-long-beep.mp3', 0.5, 'misc');
    add('hospital', 'heart monitor', 'Saved sounds/heart-beep-monitor_dieing-long-beep.mp3', 0.5, 'misc');

    // ===== NATURE & AMBIENCE =====
    add('cricket', 'crickets', 'Saved sounds/ES_Campfire, Night, Wood Burning Medium, Crickets In Background - Epidemic Sound.mp3', 0.4, 'nature');
    add('crickets', 'crickets', 'Saved sounds/ES_Campfire, Night, Wood Burning Medium, Crickets In Background - Epidemic Sound.mp3', 0.4, 'nature');
    add('night', 'crickets night', 'Saved sounds/ES_Campfire, Night, Wood Burning Medium, Crickets In Background - Epidemic Sound.mp3', 0.3, 'nature');
    add('chimes', 'wind chimes', 'Saved sounds/wind-chimes.mp3', 0.4, 'nature');
    add('tree', 'tree falling', 'Saved sounds/tree-falling-down.mp3', 0.6, 'nature');

    // ===== HORROR =====
    add('scratch', 'scratching window', 'Saved sounds/scratching-window.mp3', 0.6, 'horror');
    add('scratching', 'scratching window', 'Saved sounds/scratching-window.mp3', 0.6, 'horror');
    add('rattle', 'chain rattle', 'Saved sounds/ES_Metal Impact, Block, Parry, Sword Fight, Ring Out 01 - Epidemic Sound.mp3', 0.5, 'horror');
    add('basement', 'something basement', 'Saved sounds/ES_Something in the Basement - Lennon Hutton.mp3', 0.6, 'horror');
    add('cellar', 'something basement', 'Saved sounds/ES_Something in the Basement - Lennon Hutton.mp3', 0.6, 'horror');
    add('sewer', 'sewer', 'Saved sounds/ES_Trapped in the Sewers - Experia.mp3', 0.6, 'horror');
    add('sewers', 'sewer', 'Saved sounds/ES_Trapped in the Sewers - Experia.mp3', 0.6, 'horror');
    add('eerie', 'ringing ears', 'Saved sounds/ringing-in-the-ears.mp3', 0.5, 'horror');
    add('tinnitus', 'ringing ears', 'Saved sounds/ringing-in-the-ears.mp3', 0.5, 'horror');
    add('scuba', 'scuba breathing', 'Saved sounds/ES_Scuba Mask, Breathing, Oxygen Tank - Epidemic Sound.mp3', 0.5, 'horror');

    // ===== CHRISTMAS =====
    add('jingle', 'jingle bells', 'Saved sounds/wind-chimes.mp3', 0.7, 'christmas');
    add('sleigh', 'sleigh bells', 'Saved sounds/wind-chimes.mp3', 0.7, 'christmas');
    add('santa', 'santa laugh', 'Saved sounds/ES_Toddler, Male, 15 Months, Laugh - Epidemic Sound.mp3', 0.7, 'christmas');
    add('hohoho', 'santa laugh', 'Saved sounds/ES_Toddler, Male, 15 Months, Laugh - Epidemic Sound.mp3', 0.8, 'christmas');
    add('reindeer', 'sleigh bells', 'Saved sounds/wind-chimes.mp3', 0.6, 'christmas');
    add('present', 'bell chime', 'Saved sounds/ding_shop-bell.mp3', 0.5, 'christmas');

    // ===== HALLOWEEN =====
    add('cackle', 'witch cackle', 'Saved sounds/woman_scream.mp3', 0.7, 'halloween');
    add('witch', 'witch cackle', 'Saved sounds/woman_scream.mp3', 0.6, 'halloween');
    add('boo', 'ghost whisper', 'Saved sounds/ES_Static Breath - Lennon Hutton.mp3', 0.5, 'halloween');
    add('spooky', 'eerie', 'Saved sounds/ES_Something in the Basement - Lennon Hutton.mp3', 0.5, 'halloween');
    add('skeleton', 'bone rattle', 'Saved sounds/ES_Metal Impact, Block, Parry, Sword Fight, Ring Out 01 - Epidemic Sound.mp3', 0.5, 'halloween');
    add('bat', 'bat flutter', 'Saved sounds/whoosh.flac', 0.5, 'halloween');

    // ===== NAUTICAL =====
    add('anchor', 'anchor chain drop', 'Saved sounds/pirate-ship-floating-noise.mp3', 0.6, 'nautical');
    add('captain', 'ship horn', 'Saved sounds/ES_Ships Whistle -horn- Three Blasts - Epidemic Sound.mp3', 0.5, 'nautical');
    add('ahoy', 'ship horn', 'Saved sounds/ES_Ships Whistle -horn- Three Blasts - Epidemic Sound.mp3', 0.6, 'nautical');

    // ===== D&D FLAVOR =====
    add('tavern', 'tavern crowd chatter', 'Saved sounds/pirate-tavern-croud.mp3', 0.5, 'dnd');
    add('dungeon', 'cave dungeon drip', 'Saved sounds/dragon-studio-droplets-in-a-cave-482871.mp3', 0.5, 'dnd');
    add('cave', 'cave ambience', 'Saved sounds/dragon-studio-droplets-in-a-cave-482871.mp3', 0.5, 'dnd');
    add('potion', 'magic heal', 'Saved sounds/magic-heal.mp3', 0.5, 'dnd');
    add('scroll', 'magic spell', 'Saved sounds/magic-spell.mp3', 0.5, 'dnd');
    add('torch', 'fire', 'Saved sounds/fireplace.mp3', 0.4, 'dnd');
    add('dice', 'coin clink', 'Saved sounds/coin-clink_drop_gold_collect.mp3', 0.4, 'dnd');

    return map;
}

/**
 * Rule-based fallback engine: decides sounds without AI.
 * Uses mode + keywords to make instant decisions.
 * @param {string} transcript - spoken text
 * @param {string} mode - current mode (bedtime, dnd, horror, etc.)
 * @param {Object} triggerMap - the keyword->sound map
 * @param {Array} savedSounds - the saved sounds catalog
 * @returns {Object|null} - { music: {file, volume}, sfx: [{file, volume}] } or null
 */
export function ruleBasedDecision(transcript, mode, triggerMap, savedSounds) {
    if (!transcript || !mode) return null;

    const words = transcript.toLowerCase().replace(/[^a-z0-9\s'-]/g, '').split(/\s+/).filter(Boolean);
    const result = { music: null, sfx: [] };

    // Collect SFX from trigger map (max 3)
    const triggered = new Set();
    for (const word of words) {
        if (triggered.size >= 3) break;
        const match = triggerMap[word];
        if (match && !triggered.has(match.file)) {
            triggered.add(match.file);
            result.sfx.push({ file: match.file, volume: match.volume, query: match.query });
        }
    }

    // Music decisions based on mode + detected atmosphere
    const text = transcript.toLowerCase();
    const musicFiles = savedSounds?.files?.filter(f => f.type === 'music') || [];

    if (musicFiles.length > 0) {
        const modeMusic = {
            bedtime: ['calm', 'gentle', 'lullaby', 'peaceful', 'piano', 'soft', 'ambient'],
            dnd: ['medieval', 'fantasy', 'epic', 'battle', 'tavern', 'adventure', 'rpg'],
            horror: ['horror', 'dark', 'eerie', 'creepy', 'suspense', 'tense', 'scary'],
            christmas: ['christmas', 'holiday', 'festive', 'jingle', 'winter', 'carol'],
            halloween: ['halloween', 'spooky', 'eerie', 'witch', 'pumpkin', 'dark'],
            sing: ['pop', 'rock', 'jazz', 'blues', 'country', 'folk'],
            auto: ['ambient', 'calm', 'dramatic']
        };
        const moodKeywords = modeMusic[mode] || modeMusic.auto;

        // Score music tracks by how well they match the mode
        let bestTrack = null, bestScore = 0;
        for (const track of musicFiles) {
            let score = 0;
            const hay = [track.name, ...track.keywords].join(' ').toLowerCase();
            for (const kw of moodKeywords) {
                if (hay.includes(kw)) score += 2;
            }
            // Boost if transcript words appear in track keywords
            for (const w of words) {
                if (w.length > 3 && hay.includes(w)) score += 1;
            }
            if (score > bestScore) { bestScore = score; bestTrack = track; }
        }

        if (bestTrack && bestScore >= 2) {
            result.music = { file: bestTrack.file, volume: 0.4, name: bestTrack.name };
        }
    }

    // Return null if nothing triggered
    if (!result.music && result.sfx.length === 0) return null;
    return result;
}

/**
 * TF-IDF-style sound matching.
 * Replaces the simple token counter with weighted scoring.
 * @param {string} query - search query
 * @param {string} type - 'music' or 'sfx'
 * @param {Array} files - savedSounds.files array
 * @returns {Object|null} - best matching file object or null
 */
export function tfidfMatch(query, type, files) {
    if (!query || !files?.length) return null;

    const norm = (s) => String(s || '').toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    const base = norm(query);
    if (!base) return null;

    const tokens = base.split(' ').filter(Boolean);
    if (!tokens.length) return null;

    // Word boundary match: token must appear as a whole word (not a substring of another)
    const wordMatch = (hay, token) => {
        const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        return re.test(hay);
    };

    // Compute document frequency (how many files contain each token)
    const candidates = files.filter(f => f.type === (type === 'music' ? 'music' : 'sfx'));
    if (!candidates.length) return null;

    const df = {};
    for (const f of candidates) {
        const hay = norm([f.name || '', ...(Array.isArray(f.keywords) ? f.keywords : [])].join(' '));
        const seen = new Set();
        for (const t of tokens) {
            if (wordMatch(hay, t) && !seen.has(t)) {
                df[t] = (df[t] || 0) + 1;
                seen.add(t);
            }
        }
    }

    const N = candidates.length;

    // Synonym expansion with weights
    const synonyms = {
        'bark': ['dog', 'woof'], 'woof': ['dog', 'bark'],
        'howl': ['wolf', 'wind'], 'meow': ['cat'],
        'creak': ['door', 'wood'], 'boom': ['explosion', 'blast'],
        'bang': ['explosion', 'gunshot'], 'slash': ['sword', 'swing'],
        'roar': ['monster', 'creature'], 'growl': ['snarl'],
        'scream': ['horror', 'shriek'], 'female': ['woman', 'girl', 'she'], 'male': ['man', 'boy', 'he'],
        'child': ['kid', 'young', 'small'], 'woman': ['female', 'girl'], 'man': ['male', 'warrior'],
        'campfire': ['outdoor', 'logs', 'wood'], 'lighter': ['zippo', 'flick', 'spark'],
        'candle': ['wax', 'taper', 'wick'], 'torch': ['dungeon', 'wall', 'flare'],
        'fireplace': ['hearth', 'indoor', 'cozy'], 'bonfire': ['massive', 'outdoor', 'roaring'],
        'crash': ['glass', 'shatter', 'metal'],
        'thunder': ['lightning', 'storm'], 'lightning': ['thunder', 'strike'],
        'footstep': ['walking', 'steps'], 'footsteps': ['walking', 'steps'],
        'gallop': ['horse', 'hooves'], 'trot': ['horse'],
        'knock': ['door', 'wood'], 'splash': ['water'],
        'fire': ['flame', 'crackling'], 'rain': ['drizzle', 'storm'],
        'spell': ['magic', 'cast'], 'heal': ['magic', 'chime'],
        'sword': ['blade', 'metal', 'combat'], 'arrow': ['bow', 'twang'],
        'gun': ['shot', 'bang'], 'punch': ['hit', 'impact', 'fight'],
        'bell': ['chime', 'ding'], 'clock': ['tick', 'tock'],
        'zombie': ['undead', 'growl'], 'dragon': ['roar', 'creature'],
        'wolf': ['howl'], 'cat': ['meow', 'hiss'],
        'dog': ['bark', 'woof'], 'horse': ['gallop', 'hooves', 'whinny'],
        'bird': ['chirp', 'tweet'], 'owl': ['hoot', 'night'],
        'crow': ['caw', 'raven'], 'cow': ['moo'],
    };

    // Expand query tokens
    const expandedTokens = new Map(); // token -> weight
    for (const t of tokens) {
        expandedTokens.set(t, 1.0); // original tokens get full weight
        const syns = synonyms[t];
        if (syns) {
            for (const s of syns) {
                if (!expandedTokens.has(s)) expandedTokens.set(s, 0.5); // synonyms get half weight
            }
        }
    }

    let best = null, bestScore = -1;

    for (const f of candidates) {
        const hay = norm([f.name || '', ...(Array.isArray(f.keywords) ? f.keywords : [])].join(' '));
        let score = 0;

        for (const [token, weight] of expandedTokens) {
            if (wordMatch(hay, token)) {
                // IDF = log(N / df), higher for rare words, lower for common ones
                const idf = Math.log((N + 1) / ((df[token] || 0) + 1));
                score += weight * idf;
            }
        }

        // Exact phrase bonus (big boost)
        if (base.length > 3 && hay.includes(base)) {
            score += 3.0;
        }

        // Keyword position bonus: keywords in the name are worth more than in the filename
        const nameHay = norm(f.name || '');
        for (const t of tokens) {
            if (wordMatch(nameHay, t)) score += 0.5;
        }

        if (score > bestScore) {
            bestScore = score;
            best = f;
        }
    }

    // Minimum threshold to avoid garbage matches
    const threshold = tokens.length === 1 ? 0.5 : 1.0;
    if (best && bestScore >= threshold) return best;
    return null;
}
