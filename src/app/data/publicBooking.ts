import { callEdgeFunction } from '../lib/edgeFunctions';
import { saveGuestToken } from './guestSession';
import type { RegistrationPayload } from './verificationChat';

/**
 * Booking submission for visitors without an account.
 *
 * The in-app data modules all route through `requireAdminWorkspace()`, which by
 * design throws for anyone who is not a signed-in administrator. A guest
 * booking therefore goes to the `public-booking` Edge Function, which validates
 * the submission server-side and writes it with the service role.
 *
 * The confirmation emails are a consequence of the committed database row, not
 * of this call, so a retried or duplicated request cannot produce a second set.
 */

export type BookingResult = {
  threadId: string;
  bookingReference: string;
  status: string;
  createdAt: string;
  guestToken: string;
};

export async function submitBooking(payload: RegistrationPayload & { dateOfBirth?: string }) {
  const result = await callEdgeFunction<BookingResult>('public-booking', {
    fullName: payload.fullName,
    username: payload.username,
    country: payload.country,
    dateOfBirth: payload.dateOfBirth ?? '',
    email: payload.email,
    phone: payload.phone,
    gender: payload.gender,
    packageId: payload.packageId,
    packageName: payload.packageName,
    packagePrice: payload.packagePrice,
    hostName: payload.hostName,
    hostAvatar: payload.hostAvatar,
    hostInitials: payload.hostInitials,
    clientId: payload.clientId,
    meetingLinkToken: payload.meetingLinkToken ?? '',
  });

  if (result?.guestToken) {
    saveGuestToken(result.threadId, result.guestToken);
  }

  return result;
}

/**
 * Recovery for a customer who no longer has their link. Nothing is returned to
 * the caller: a fresh access link is emailed to the address already on the
 * booking, so guessing a name and email reveals nothing and grants nothing.
 */
export async function requestChatAccessLink(fullName: string, email: string) {
  await callEdgeFunction<{ ok: boolean }>('guest-chat', {
    action: 'request-access-link',
    fullName,
    email,
  });
}
