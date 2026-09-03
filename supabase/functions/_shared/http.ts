/**
 * Request plumbing shared by the public endpoints.
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-guest-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Deliberately terse: public endpoints should not narrate why they refused. */
export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function preflight(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

/**
 * Fixed-window limiter keyed by client IP. In-memory, so it is per-instance and
 * best-effort — enough to blunt a scripted flood of bookings or token guesses,
 * not a substitute for a real WAF.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(request: Request, key: string, limit: number, windowMs: number): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
