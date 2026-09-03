import { optionalEnv, redact, requireEnv } from '../env.ts';
import { cleanHeaderValue } from '../validation.ts';
import type { MailTransport, OutgoingMail, SendOutcome } from './transport.ts';

type SmtpClient = {
  send(mail: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
};

/**
 * Google SMTP transport.
 *
 * The only place in this repository where a mail credential exists. It is read
 * from Supabase function secrets at call time and never logged, never returned
 * to a caller, and never written to email_outbox.last_error — see redact().
 */

/**
 * 5xx replies are the sender's fault and will fail identically forever, so they
 * are marked permanent and skip the remaining retry budget. 4xx and connection
 * errors are transient.
 */
function isPermanentFailure(message: string): boolean {
  return /\b5\d{2}\b/.test(message)
    || /invalid (recipient|address)/i.test(message)
    || /no such user/i.test(message)
    || /address rejected/i.test(message);
}

export class GoogleSmtpTransport implements MailTransport {
  readonly name = 'google-smtp';
  #client: SmtpClient | null = null;

  async #connect(): Promise<SmtpClient> {
    if (this.#client) return this.#client;

    // Keep the SMTP dependency off the function boot path. A bad or
    // temporarily unavailable mail dependency must not make the protected
    // dispatcher health endpoint fail while dispatch is disabled.
    const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts');
    const port = Number(optionalEnv('SMTP_PORT', '465'));
    this.#client = new SMTPClient({
      connection: {
        hostname: optionalEnv('SMTP_HOST', 'smtp.gmail.com'),
        port,
        // 465 is implicit TLS; 587 upgrades via STARTTLS.
        tls: port === 465,
        auth: {
          username: requireEnv('SMTP_USER'),
          password: requireEnv('SMTP_APP_PASSWORD'),
        },
      },
    });
    return this.#client;
  }

  async send(mail: OutgoingMail): Promise<SendOutcome> {
    const fromEmail = requireEnv('SMTP_FROM_EMAIL');
    const fromName = cleanHeaderValue(optionalEnv('SMTP_FROM_NAME', 'Zoom Workplace'), 78);

    try {
      const client = await this.#connect();
      await client.send({
        from: `${fromName} <${fromEmail}>`,
        to: mail.toName
          ? `${cleanHeaderValue(mail.toName, 78)} <${mail.to}>`
          : mail.to,
        // Subjects are built from stored values, so CR/LF is stripped here as a
        // last line of defence against header injection.
        subject: cleanHeaderValue(mail.subject, 200),
        content: mail.text,
        html: mail.html,
      });
      return { ok: true };
    } catch (cause) {
      const error = redact(cause);
      return { ok: false, error, permanent: isPermanentFailure(error) };
    }
  }

  async close(): Promise<void> {
    if (!this.#client) return;
    try {
      await this.#client.close();
    } catch {
      // A transport that fails to close cleanly must not fail the run.
    }
    this.#client = null;
  }
}
