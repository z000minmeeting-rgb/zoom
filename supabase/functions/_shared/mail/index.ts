import { optionalEnv } from '../env.ts';
import type { MailTransport, OutgoingMail, SendOutcome } from './transport.ts';
import { GoogleSmtpTransport } from './googleSmtpTransport.ts';

export type { MailTransport, OutgoingMail, SendOutcome };

/**
 * Transport selection. Adding a provider means adding a case here and a file
 * next to googleSmtpTransport.ts — nothing in the outbox, the triggers or the
 * templates changes.
 *
 * MAIL_TRANSPORT=log is the safe rehearsal mode: it exercises the whole
 * pipeline, marks rows sent, and prints only the recipient and subject.
 */
export function createTransport(): MailTransport {
  const choice = optionalEnv('MAIL_TRANSPORT', 'google-smtp');

  if (choice === 'log') {
    return {
      name: 'log',
      send(mail: OutgoingMail): Promise<SendOutcome> {
        console.log(`[mail:log] to=${mail.to} subject=${mail.subject}`);
        return Promise.resolve({ ok: true });
      },
      close: () => Promise.resolve(),
    };
  }

  return new GoogleSmtpTransport();
}
