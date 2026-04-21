/**
 * GET /api/pixabay
 * Server-side proxy for Pixabay Audio API.
 * Keeps the API key secret on the server — clients never see it.
 *
 * Query params (forwarded to Pixabay):
 *   q        – search query (required)
 *   category – 'music' or '' (optional)
 *   min_duration – int seconds (optional)
 *   max_duration – int seconds (optional)
 *   per_page – int (optional, default 5)
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/api-auth.js';

const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

export async function GET(request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  if (!PIXABAY_KEY) {
    return NextResponse.json(
      { error: 'Pixabay API key not configured on server' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
  }

  // Build safe param set — only forward allowed keys
  const allowed = ['q', 'category', 'min_duration', 'max_duration', 'per_page'];
  const params = new URLSearchParams({ key: PIXABAY_KEY, safesearch: 'true' });
  for (const key of allowed) {
    const val = searchParams.get(key);
    if (val !== null && val !== '') params.set(key, val);
  }

  try {
    const res = await fetch(`https://pixabay.com/api/audio/?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const status = res.status === 401 ? 503 : res.status;
      return NextResponse.json(
        { error: `Pixabay upstream error (${res.status})` },
        { status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/pixabay]', err);
    return NextResponse.json({ error: 'Pixabay request failed' }, { status: 502 });
  }
}
