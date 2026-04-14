/**
 * POST /api/analyze
 * Analyzes a story transcript via OpenAI and returns a sound decision.
 * The API key lives server-side only — never exposed to the browser.
 *
 * TODO: Add auth middleware — validate Bearer token / Stripe subscription.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import crypto from 'crypto';

let _openai;
function getOpenAI() {
  return (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
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
  return { allowed: entry.count <= RATE_LIMIT_MAX, remaining, resetAt: entry.resetAt };
}

// Periodically clean up stale entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000);

// --- Response cache (hash-based dedup for identical transcripts) ---
const CACHE_TTL_MS = 30_000; // 30 seconds
const responseCache = new Map(); // hash -> { data, expiresAt }

function getCacheKey(transcript, mode, context) {
  const raw = JSON.stringify({ transcript: transcript.trim().toLowerCase(), mode, context });
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

// Clean cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (now >= entry.expiresAt) responseCache.delete(key);
  }
}, 60_000);

const SYSTEM_PROMPT = `You are Effexiq, an AI sound director for tabletop RPG sessions.
Given a transcript of what's happening in the story, respond with a JSON object describing
the ideal sound to play. Include: action (play/stop/fade), type (music/sfx), name, mood,
intensity (0-1), and tags (array of keywords). Be concise and atmospheric.`;

export async function POST(request) {
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

  // Check response cache for identical recent requests
  const cacheKey = getCacheKey(transcript, mode, context);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    const res = NextResponse.json(cached.data);
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-Cache', 'HIT');
    return res;
  }

  const userMessage = [
    `Transcript: "${transcript.trim()}"`,
    mode ? `Mode: ${mode}` : '',
    context ? `Context: ${JSON.stringify(context)}` : '',
  ].filter(Boolean).join('\n');

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    const data = JSON.parse(raw);

    // Cache the response for dedup
    responseCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    const res = NextResponse.json(data);
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-Cache', 'MISS');
    return res;
  } catch (err) {
    console.error('[/api/analyze]', err);
    if (err.status === 429) {
      return NextResponse.json({ error: 'Rate limited by OpenAI' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
