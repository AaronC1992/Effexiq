/**
 * POST /api/analyze
 * Analyzes a story transcript via OpenAI and returns a sound decision.
 * The API key lives server-side only — never exposed to the browser.
 * Protected by HMAC token auth via requireAuth().
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { MODE_CONTEXTS, MODE_RULES } from '../../../lib/modules/ai-director.js';
import { requireAuth } from '../../../lib/api-auth.js';
import { classifyLocal } from '../../../lib/modules/local-classifier.js';

let _openai;
function getOpenAI() {
  return (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

// --- Load sound catalog once at startup for the AI prompt ---
let _catalogSummary = null;
function getCatalogSummary() {
  if (_catalogSummary) return _catalogSummary;
  try {
    const filePath = path.join(process.cwd(), 'public', 'saved-sounds.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const files = data?.files || [];

    const music = files
      .filter(f => f.type === 'music')
      .map(f => `${f.name} [${(f.keywords || []).slice(0, 4).join(', ')}]`);
    const sfx = files
      .filter(f => f.type !== 'music')
      .map(f => f.name);

    _catalogSummary = `\nAVAILABLE MUSIC (${music.length} tracks — pick by exact name):\n${music.join(' | ')}\n\nAVAILABLE SFX (${sfx.length} sounds — pick by exact name):\n${sfx.join(' | ')}`;
  } catch (e) {
    console.warn('[analyze] Could not load catalog summary:', e.message);
    _catalogSummary = '';
  }
  return _catalogSummary;
}

// --- In-memory rate limiting (per IP, resets on deploy) ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 15;           // max requests per window per IP
const rateLimitMap = new Map();      // ip -> { count, resetAt }

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  // Inline cleanup: cap map size and prune stale entries
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap) {
      if (now >= v.resetAt) rateLimitMap.delete(k);
    }
  }
  return { allowed: entry.count <= RATE_LIMIT_MAX, remaining, resetAt: entry.resetAt };
}

// --- Response cache (hash-based dedup for identical transcripts) ---
const CACHE_TTL_MS = 30_000; // 30 seconds
const MAX_CACHE_SIZE = 500;
const responseCache = new Map(); // hash -> { data, expiresAt }

function getCacheKey(transcript, mode, context) {
  const raw = JSON.stringify({ transcript: transcript.trim().toLowerCase(), mode, context });
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function getCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  // Evict oldest entries if over limit
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

const SYSTEM_PROMPT = `You are SuiteRhythm, an AI sound director for live narration sessions.
Given a transcript and a list of available sounds, respond with a JSON object that drives a layered audio engine.

RESPONSE FORMAT (strict JSON):
{
  "scene": "short description of the current scene/setting",
  "mood": {
    "primary": "one of: calm, tense, happy, sad, angry, fearful, mysterious, excited, ominous, neutral",
    "intensity": 0.0 to 1.0
  },
  "confidence": 0.0 to 1.0,
  "worldState": {
    "location": "short location tag if detected, else null",
    "weather": "clear|rain|storm|snow|fog|wind|null",
    "timeOfDay": "dawn|day|dusk|night|null"
  },
  "music": {
    "id": "exact name from AVAILABLE MUSIC list, or null",
    "action": "play_or_continue",
    "volume": 0.0 to 1.0
  },
  "sfx": [
    {
      "id": "exact name from AVAILABLE SFX list",
      "intent": "event | state | continuing",
      "when": "immediate",
      "volume": 0.0 to 1.0,
      "tags": ["keyword1", "keyword2"],
      "confidence": 0.0 to 1.0
    }
  ]
}

CRITICAL RULES:
- You MUST pick sounds from the AVAILABLE lists below. Use the EXACT name as the "id". Do NOT invent sound names.
- "scene" drives ambient bed selection. Use descriptive keywords: forest, cave, tavern, cottage, castle, ocean, rain, battle, etc.
- "mood.primary" + "mood.intensity" drive the emotional arc. Be consistent — don't flip moods every response.
- "confidence" reflects how certain you are. Set 0.3-0.5 when transcript is ambiguous.
- "music" — only change when scene/mood shifts significantly. Use null if current music should keep playing. Pick music that matches the mood and setting.
- "sfx" — max 2 per response. Only include sounds CLEARLY described or implied in the transcript. Never hallucinate sounds not mentioned.

VERB TENSE & INTENT (important for not repeating one-shot sounds):
- "intent": "event"      — a NEW discrete action happening now ("a door slams", "the train passes"). Play once.
- "intent": "state"      — an ongoing condition ("it is raining", "fire crackles"). Engine will loop it.
- "intent": "continuing" — already established ambience that should keep going. Rarely needed; prefer omitting sfx entirely.
- If a transcript is PAST TENSE describing something that already finished ("the train passed", "the door had slammed"), DO NOT include an sfx for it. Those are narration of past events, not current events.
- If a sound id appears in "activeSfx" (currently playing) or "consumedEvents" (already fired recently), DO NOT pick it again. Choose silence, a related-but-different sound, or an ambient bed instead.
- If a sound id appears in "recentSounds" (played in the last few turns), only pick it again if the transcript clearly describes a NEW instance of that event.

OTHER RULES:
- Prioritize atmosphere over action. Ambient context (forest sounds, wind, fire crackling) matters more than one-off SFX.
- Never include sounds that contradict the scene (no crowd noise in a lonely forest, no birds in a dungeon).
- If no SFX are warranted, return an empty array. Silence is better than wrong sounds.
- When "sceneStabilityMs" is low (< 10000), be cautious: set sfx confidence 0.5+ only if you are sure, else drop the sfx.
- When "creatorMode" is true (live streamer context), you may be slightly more responsive with SFX, but still never duplicate active or consumed sounds.`;

function buildSystemPrompt() {
  return SYSTEM_PROMPT + getCatalogSummary();
}

function buildUserMessage(transcript, mode, context) {
  const modeContext = MODE_CONTEXTS[mode] || MODE_CONTEXTS.auto;
  const modeRule = MODE_RULES[mode] || MODE_RULES.auto;

  const parts = [
    `Transcript: "${transcript.trim()}"`,
    `Mode: ${mode || 'auto'} (${modeContext})`,
    modeRule,
  ];

  if (context) {
    if (context.sceneState) parts.push(`Current scene state: ${context.sceneState}`);
    if (context.sceneMemory) parts.push(`Scene history: ${context.sceneMemory}`);
    if (context.moodHistory) parts.push(`Mood history: ${context.moodHistory}`);
    if (context.recentMusic) parts.push(`Currently playing music: ${context.recentMusic}`);
    if (context.recentSounds?.length) parts.push(`recentSounds (played in last few turns): ${context.recentSounds.join(', ')}`);
    if (context.activeSfx?.length) parts.push(`activeSfx (still playing right now — DO NOT re-pick): ${context.activeSfx.join(', ')}`);
    if (context.consumedEvents?.length) parts.push(`consumedEvents (already fired, do not repeat): ${context.consumedEvents.join(', ')}`);
    if (typeof context.sceneStabilityMs === 'number') parts.push(`sceneStabilityMs: ${context.sceneStabilityMs} (ms since last scene change)`);
    if (context.worldState) {
      const ws = context.worldState;
      const bits = [];
      if (ws.location) bits.push(`location=${ws.location}`);
      if (ws.weather) bits.push(`weather=${ws.weather}`);
      if (ws.timeOfDay) bits.push(`timeOfDay=${ws.timeOfDay}`);
      if (bits.length) parts.push(`worldState: ${bits.join(', ')}`);
    }
    if (context.creatorMode) parts.push(`creatorMode: true (live streamer — slightly more responsive is ok)`);
    if (context.newSpeech) parts.push(`newSpeechSinceLastTurn: "${context.newSpeech}"`);
    // Sing mode extras
    if (context.singState) parts.push(`singState: ${context.singState}`);
    if (typeof context.detectedBPM === 'number' && context.detectedBPM > 0) parts.push(`detectedBPM: ${context.detectedBPM}`);
    if (typeof context.vocalEnergy === 'number') parts.push(`vocalEnergy: ${context.vocalEnergy} (0=silent, 0.15+=belting)`);
    if (context.storyTitle) parts.push(`Story: ${context.storyTitle}`);
    if (context.sessionContext) parts.push(`Session context: ${context.sessionContext}`);
  }

  return parts.join('\n');
}

export async function POST(request) {
  // Auth check — reject unauthenticated requests before doing any work
  const denied = requireAuth(request);
  if (denied) return denied;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
  }

  // Rate limiting by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const { allowed, remaining, resetAt } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { transcript, mode, context } = body;
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
  }
  if (transcript.length > 3000) {
    return NextResponse.json({ error: 'transcript exceeds maximum length' }, { status: 400 });
  }

  // Check response cache for identical recent requests
  const cacheKey = getCacheKey(transcript, mode, context);
  const cached = getCache(cacheKey);
  if (cached) {
    const res = NextResponse.json(cached);
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-Cache', 'HIT');
    return res;
  }

  const userMessage = buildUserMessage(transcript, mode, context);

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from OpenAI');
    const data = JSON.parse(raw);

    // Cache the response for dedup
    setCache(cacheKey, data);

    const res = NextResponse.json(data);
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-Cache', 'MISS');
    return res;
  } catch (err) {
    console.error('[/api/analyze]', err);
    // Graceful degrade: instead of a hard 500, return a minimal
    // "keep current" JSON so the client-side rule-based fallback
    // has a clean decision to merge with (no hallucinated SFX).
    const local = classifyLocal(transcript, { mode });
    const fallback = {
      scene: local.scene,
      mood: local.mood,
      confidence: Math.min(local.confidence, 0.35),
      worldState: local.worldState,
      music: { id: null, action: 'play_or_continue', volume: 0.5 },
      sfx: local.sfx,
      _fallback: true,
      _reason: err?.status === 429 ? 'openai_rate_limit' : 'openai_error',
      _source: 'local-classifier',
    };
    const status = err?.status === 429 ? 429 : 200; // 200 lets client merge with ruleBased
    const res = NextResponse.json(fallback, { status });
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-Fallback', fallback._reason);
    return res;
  }
}
