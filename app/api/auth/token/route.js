/**
 * GET /api/auth/token
 * Issues a short-lived HMAC-signed token for authenticating API calls.
 * The client fetches this on page load and sends it as a Bearer token.
 */

import { NextResponse } from 'next/server';
import { generateToken } from '../../../../lib/api-auth.js';

export async function GET() {
  try {
    const token = generateToken();
    return NextResponse.json({ token, expiresIn: 3600 });
  } catch {
    // API_AUTH_SECRET not configured — auth is disabled
    return NextResponse.json(
      { token: null, expiresIn: 0, message: 'Auth not configured' },
      { status: 200 }
    );
  }
}
