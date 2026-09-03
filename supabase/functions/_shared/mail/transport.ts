/**
 * Mail transport boundary.
 *
 * Business events, the outbox and the templates all sit above this interface.
 * Nothing below `MailTransport` knows what a booking is, and nothing above it
 * knows what SMTP is — so replacing Gmail with a transactional API later is a
 * change to one file, not to booking, chat or scheduling logic.
 */

export type OutgoingMail = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
};

export type SendOutcome =
  | { ok: true; providerMessage?: string }
  | { ok: false; error: string; permanent: boolean };

export interface MailTransport {
  readonly name: string;
  send(mail: OutgoingMail): Promise<SendOutcome>;
  close(): Promise<void>;
}
