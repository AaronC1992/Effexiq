/**
 * POST /api/tts — Text-to-Speech via ElevenLabs
 *
 * Accepts: { text: string, voice?: string }
 * Returns: audio/mpeg stream
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'PPzYpIqttlTYA83688JI';

export async function POST(request) {
    if (!ELEVENLABS_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'ElevenLabs API key not configured' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const { text, voice } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return new Response(
            JSON.stringify({ error: 'Missing or empty "text" field' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Cap input length to prevent abuse (ElevenLabs limit is ~5000 chars)
    if (text.length > 5000) {
        return new Response(
            JSON.stringify({ error: 'Text exceeds 5000 character limit' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const voiceId = voice || DEFAULT_VOICE_ID;

    try {
        const resp = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg',
                },
                body: JSON.stringify({
                    text: text.trim(),
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.55,
                        similarity_boost: 0.7,
                        style: 0.35,
                        use_speaker_boost: true,
                    },
                }),
            }
        );

        if (!resp.ok) {
            const errText = await resp.text().catch(() => 'Unknown error');
            console.error('[TTS] ElevenLabs error:', resp.status, errText);
            return new Response(
                JSON.stringify({ error: `ElevenLabs API error: ${resp.status}` }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Stream the audio straight back to the client
        return new Response(resp.body, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        console.error('[TTS] Fetch failed:', err);
        return new Response(
            JSON.stringify({ error: 'TTS service unavailable' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
