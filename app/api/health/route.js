/**
 * GET /api/health
 * Health-check that verifies connectivity to all services.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase.js';
import { listFiles } from '../../../lib/r2.js';

export async function GET() {
  const checks = { supabase: 'unknown', r2: 'unknown' };

  // Supabase
  try {
    const { error } = await supabaseAdmin.from('sounds').select('name').limit(1);
    checks.supabase = error ? `error: ${error.message}` : 'ok';
  } catch (e) { checks.supabase = `error: ${e.message}`; }

  // Cloudflare R2
  try {
    const files = await listFiles('');
    checks.r2 = `ok (${files.length} files)`;
  } catch (e) { checks.r2 = `error: ${e.message}`; }

  return NextResponse.json({
    status: 'ok',
    service: 'soundgoblin',
    timestamp: new Date().toISOString(),
    checks,
  });
}
