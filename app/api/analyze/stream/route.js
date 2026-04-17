/**
 * POST /api/analyze/stream
 * Streaming variant of /api/analyze. Emits Server-Sent Events (SSE)
 * so the client can start reacting to early tokens instead of waiting
 * for the full JSON. Falls back gracefully to non-streaming on error.
 *
 * Event format:
 *   event: delta    data: "{partial json chunk}"
 *   event: done     data: "{final merged decision}"
 *   event: error    data: "{reason}"
 */

import OpenAI from 'openai';
import { MODE_CONTEXTS, MODE_RULES } from '../../../../lib/modules/ai-director.js';
import { requireAuth } from '../../../../lib/api-auth.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let _openai;
function getOpenAI() {
    return (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

function sseEncoder() {
    const encoder = new TextEncoder();
    return (event, data) => encoder.encode(`event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
}

const BASE_SYSTEM = `You are Effexiq, a streaming sound director. Emit valid JSON only, matching the shape used by /api/analyze. Be concise.`;

export async function POST(request) {
    const denied = requireAuth(request);
    if (denied) return denied;

    if (!process.env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: 'OpenAI not configured' }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
        });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } }); }

    const { transcript, mode, context } = body || {};
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
        return new Response(JSON.stringify({ error: 'transcript is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const encode = sseEncoder();
    const modeCtx = MODE_CONTEXTS[mode] || MODE_CONTEXTS.auto;
    const modeRule = MODE_RULES[mode] || MODE_RULES.auto;
    const user = `Transcript: "${transcript.trim()}"\nMode: ${mode || 'auto'} (${modeCtx})\n${modeRule}${context ? `\nContext: ${JSON.stringify(context).slice(0, 600)}` : ''}`;

    const stream = new ReadableStream({
        async start(controller) {
            let buf = '';
            try {
                const completion = await getOpenAI().chat.completions.create({
                    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                    max_tokens: 400,
                    temperature: 0.4,
                    stream: true,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: BASE_SYSTEM },
                        { role: 'user', content: user },
                    ],
                });

                for await (const chunk of completion) {
                    const delta = chunk?.choices?.[0]?.delta?.content;
                    if (delta) {
                        buf += delta;
                        controller.enqueue(encode('delta', delta));
                    }
                }

                let parsed = null;
                try { parsed = JSON.parse(buf); } catch {}
                controller.enqueue(encode('done', parsed || { _raw: buf, _parseError: true }));
            } catch (err) {
                const reason = err?.status === 429 ? 'rate_limit' : 'openai_error';
                controller.enqueue(encode('error', { reason, message: String(err?.message || err) }));
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            'connection': 'keep-alive',
            'x-accel-buffering': 'no',
        },
    });
}
