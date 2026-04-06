/**
 * POST /api/analyze
 * Analyzes a story transcript via OpenAI and returns a sound decision.
 * The API key lives server-side only — never exposed to the browser.
 *
 * TODO: Add auth middleware — validate Bearer token / Stripe subscription.
 * TODO: Add per-user rate limiting via Upstash/Redis.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

let _openai;
function getOpenAI() {
  return (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

const SYSTEM_PROMPT = `You are SoundGoblin, an AI sound director for tabletop RPG sessions.
Given a transcript of what's happening in the story, respond with a JSON object describing
the ideal sound to play. Include: action (play/stop/fade), type (music/sfx), name, mood,
intensity (0-1), and tags (array of keywords). Be concise and atmospheric.`;

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
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

    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/analyze]', err);
    if (err.status === 429) {
      return NextResponse.json({ error: 'Rate limited by OpenAI' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
