/**
 * GET /api/health
 * Health-check that verifies connectivity to all services.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase.js';

export async function GET() {
  const checks = { supabase: 'unknown', r2: 'unknown' };

  // Supabase
  try {
    const { error } = await supabaseAdmin.from('sounds').select('name').limit(1);
    checks.supabase = error ? `error: ${error.message}` : 'ok';
  } catch (e) { checks.supabase = `error: ${e.message}`; }

  // Cloudflare R2 — optional; only check if credentials are configured
  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
    try {
      const { listFiles } = await import('../../../lib/r2.js');
      const files = await listFiles('');
      checks.r2 = `ok (${files.length} files)`;
    } catch (e) { checks.r2 = `error: ${e.message}`; }
  } else {
    checks.r2 = 'skipped (no credentials)';
  }

  return NextResponse.json({
    status: 'ok',
    service: 'Effexiq',
    timestamp: new Date().toISOString(),
    checks,
  });
}
