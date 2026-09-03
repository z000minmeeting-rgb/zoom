/**
 * Server-side configuration. Every name here is a Supabase function secret.
 *
 * None of these may ever be given a VITE_ prefix, written to a .env file that
 * Vite reads, or referenced from src/. They exist only inside the Edge runtime.
 */

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    // The name is safe to surface; the value never is.
    throw new Error(`Missing required server configuration: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

export function appUrl(): string {
  return optionalEnv('APP_URL').replace(/\/+$/, '');
}

/**
 * Values that must never appear in a log line, an error message, or an
 * email_outbox.last_error. Used by redact() below.
 */
function secretValues(): string[] {
  return [
    'SMTP_APP_PASSWORD',
    'SMTP_USER',
    'OUTBOX_DRAIN_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]
    .map((name) => Deno.env.get(name))
    .filter((value): value is string => Boolean(value && value.length >= 8));
}

/**
 * SMTP servers habitually echo the login back in error text, so anything headed
 * for storage or stdout goes through here first.
 */
export function redact(input: unknown): string {
  let text = input instanceof Error ? input.message : String(input ?? '');
  for (const secret of secretValues()) {
    text = text.split(secret).join('[redacted]');
  }
  // Catch inline credential shapes the substring pass cannot know about.
  text = text.replace(/\b(AUTH|LOGIN|PASS(?:WORD)?)\s+\S+/gi, '$1 [redacted]');
  return text.slice(0, 1800);
}
