import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, BadgeCheck, ShieldCheck, UserRound } from 'lucide-react';
import { loadSubscriptionContent, refreshSubscriptionContentFromRemote } from '../data/subscriptionPackages';
import { FloatingVerificationChatButton } from './verification/FloatingVerificationChatButton';
import { fetchPublicClientDisplay, getClientAvatarImage } from '../data/clientProfiles';
import { requestChatAccessLink, submitBooking } from '../data/publicBooking';
import { emailFormatError } from '../lib/emailValidation';
import { EdgeFunctionError } from '../lib/edgeFunctions';

const subscriberInputClassName = 'relative z-10 w-full rounded-[1.35rem] bg-[#F7F9FC] px-4 py-3 text-[#172033] shadow-[inset_0_0_0_1px_rgba(216,228,255,0.95)] outline-none transition-colors placeholder:text-[#8A94A6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]';
const emptyRegistrationForm = {
  fullName: '',
  username: '',
  country: '',
  email: '',
  phone: '',
  gender: '',
};

function SubscriberFieldFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`subscriber-input-frame ${className}`}>
      {children}
    </div>
  );
}

function isImageAvatarValue(value: string) {
  return /^(data:image\/|https?:\/\/|\/)/.test(value);
}

export function SubscriptionRegistrationScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [content, setContent] = useState(() => loadSubscriptionContent());
  const clientId = searchParams.get('clientId')?.trim() || '';
  const meetingLinkToken = searchParams.get('meetingLink')?.trim() || '';
  const packageId = searchParams.get('packageId') || content.packages[0]?.id || '';
  const selectedPackage = content.packages.find((subscriptionPackage) => subscriptionPackage.id === packageId) || content.packages[0];
  const hostName = searchParams.get('hostName')?.trim() || searchParams.get('clientName')?.trim() || 'the meeting host';
  const hostAvatar = searchParams.get('hostAvatar') || '#0B5CFF';
  const hostInitials = searchParams.get('hostInitials') || hostName.slice(0, 2).toUpperCase() || 'H';
  const [clientAvatarImage, setClientAvatarImage] = useState(() => getClientAvatarImage(clientId));
  const heroAvatarImage = clientAvatarImage || (isImageAvatarValue(hostAvatar) ? hostAvatar : '');
  const hostAvatarColor = isImageAvatarValue(hostAvatar) ? '#0B5CFF' : hostAvatar;
  const hasGeneratedClientMeetingLink = Boolean(searchParams.get('meetingLink') && clientId);
  const registrationFormRef = useRef<HTMLFormElement | null>(null);
  const returningFormRef = useRef<HTMLFormElement | null>(null);

  const [form, setForm] = useState(emptyRegistrationForm);
  const [emailError, setEmailError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returningName, setReturningName] = useState('');
  const [returningContact, setReturningContact] = useState('');
  const [returningError, setReturningError] = useState('');
  const [accessLinkSent, setAccessLinkSent] = useState(false);
  const [isRequestingLink, setIsRequestingLink] = useState(false);

  useEffect(() => {
    refreshSubscriptionContentFromRemote().then(setContent);
  }, []);

  useEffect(() => {
    // The admin cache first, so an admin previewing their own link renders
    // immediately; then the public projection, which is the only source a
    // visitor is allowed to read.
    setClientAvatarImage(getClientAvatarImage(clientId));

    let active = true;

    fetchPublicClientDisplay(clientId).then((profile) => {
      if (active && profile?.avatarImage) {
        setClientAvatarImage(profile.avatarImage);
      }
    });

    return () => {
      active = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (searchParams.get('focus') !== 'returning') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      returningFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));

    if (key === 'email') {
      setEmailError('');
    }

    setSubmitError('');
  };

  const resetRegistrationForm = () => {
    setForm(emptyRegistrationForm);
    setEmailError('');
    setSubmitError('');
    setReturningError('');
    registrationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedPackage || isSubmitting) {
      return;
    }

    // Format only. Whether the mailbox exists is decided by the mail server
    // afterwards, and is reported separately as a delivery failure.
    const formatError = emailFormatError(form.email);

    if (formatError) {
      setEmailError(formatError);
      setSubmitError('');
      return;
    }

    setEmailError('');
    setSubmitError('');
    setIsSubmitting(true);

    try {
      const booking = await submitBooking({
        ...form,
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        packagePrice: selectedPackage.price,
        hostName,
        hostAvatar,
        hostInitials,
        clientId,
        meetingLinkToken,
      });
      navigate(`/verification-chat/${booking.threadId}`);
    } catch (error) {
      if (error instanceof EdgeFunctionError && error.field === 'email') {
        setEmailError(error.message);
      } else {
        setSubmitError(error instanceof Error ? error.message : 'Unable to submit your booking.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Recovery never returns a chat link to whoever asked for it. A fresh secure
   * link is emailed to the address already on the booking, so a thread ID or a
   * guessed name grants nothing.
   */
  const handleReturningAccess = async (event: FormEvent) => {
    event.preventDefault();

    if (isRequestingLink) {
      return;
    }

    const formatError = emailFormatError(returningContact);

    if (formatError) {
      setReturningError(formatError);
      return;
    }

    setReturningError('');
    setIsRequestingLink(true);

    try {
      await requestChatAccessLink(returningName, returningContact);
      setAccessLinkSent(true);
    } catch (error) {
      setReturningError(error instanceof Error ? error.message : 'Unable to send an access link right now.');
    } finally {
      setIsRequestingLink(false);
    }
  };

  return (
    <div className="h-dvh overflow-y-auto bg-[linear-gradient(135deg,#FFFFFF,#F4F8FF)] text-[#172033]">
      <main className="mx-auto grid min-h-0 max-w-7xl grid-cols-1 gap-8 px-4 py-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-10">
        <motion.section
          className="flex flex-col justify-between overflow-hidden rounded-[2rem] border border-white/20 bg-[radial-gradient(circle_at_18%_12%,rgba(37,183,255,0.92)_0%,rgba(37,183,255,0)_34%),linear-gradient(145deg,#063A9E_0%,#0B5CFF_52%,#082A72_100%)] p-6 text-white shadow-[0_28px_90px_rgba(11,92,255,0.26)] backdrop-blur-xl"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div>
            <button
              type="button"
              onClick={() => navigate(`/subscription?${searchParams.toString()}`)}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/14 px-3 py-2 text-sm text-white shadow-sm backdrop-blur hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to packages
            </button>

            <div
              className="mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-white/60 bg-white/15 text-2xl text-white shadow-xl"
              style={{ backgroundColor: heroAvatarImage ? undefined : hostAvatarColor }}
            >
              {heroAvatarImage ? (
                <img src={heroAvatarImage} alt={hostName} className="h-full w-full object-cover" />
              ) : (
                <span className="font-black">{hostInitials}</span>
              )}
            </div>

            <p className="text-sm uppercase tracking-[0.18em] text-[#D9EEFF] font-black">Premium onboarding</p>
            <h1 className="mt-3 text-4xl leading-tight text-white font-black">
              Register for verification with {hostName}
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#EAF3FF]">
              Complete this secure subscriber profile so management can verify your payment, save your chat history, and reconnect you if you return later.
            </p>

            {selectedPackage && (
              <div className="mt-6 rounded-3xl border border-white/25 bg-white/14 p-5 shadow-xl backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-5 w-5 text-white" />
                  <p className="text-sm text-white font-black">Selected package</p>
                </div>
                <p className="mt-3 text-2xl text-white font-black">{selectedPackage.name}</p>
                <p className="mt-1 text-sm text-[#EAF3FF]">{selectedPackage.summary}</p>
                <p className="mt-3 text-3xl text-white font-black">{selectedPackage.price}</p>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-3xl border border-white/20 bg-white/12 p-4 shadow-xl backdrop-blur-xl">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#B7F7D0]" />
              <p className="text-sm leading-6 text-[#EAF3FF]">
                Returning users regain access through name plus email or phone verification.
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          className="space-y-5"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.08 }}
        >
          <form ref={registrationFormRef} onSubmit={handleSubmit} className="rounded-[2rem] border border-[#D8E4FF] bg-white/90 p-5 shadow-[0_28px_90px_rgba(11,92,255,0.10)] backdrop-blur-xl lg:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F1FF]">
                <UserRound className="h-5 w-5 text-[#0B5CFF]" />
              </div>
              <div>
                <h2 className="text-2xl text-[#172033] font-black">Subscription registration</h2>
                <p className="text-sm text-[#6B7280]">Required before entering payment verification chat.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SubscriberFieldFrame>
                <input required value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder="Full Name" className={subscriberInputClassName} />
              </SubscriberFieldFrame>
              <SubscriberFieldFrame>
                <input required value={form.username} onChange={(event) => updateForm('username', event.target.value)} placeholder="Username/Nickname" className={subscriberInputClassName} />
              </SubscriberFieldFrame>
              <SubscriberFieldFrame>
                <input required value={form.country} onChange={(event) => updateForm('country', event.target.value)} placeholder="Country/Location" className={subscriberInputClassName} />
              </SubscriberFieldFrame>
              <div>
                <SubscriberFieldFrame>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    onBlur={(event) => setEmailError(event.target.value ? emailFormatError(event.target.value) : '')}
                    placeholder="Email Address"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? 'subscriber-email-error' : undefined}
                    className={`${subscriberInputClassName} ${emailError ? 'shadow-[inset_0_0_0_1px_#FEE4E2] focus:ring-[#B42318]' : ''}`}
                  />
                </SubscriberFieldFrame>
                {emailError && (
                  <p id="subscriber-email-error" role="alert" className="mt-2 px-1 text-xs text-[#B42318] font-extrabold">
                    {emailError}
                  </p>
                )}
                <p className="mt-2 px-1 text-xs text-[#6B7280]">
                  Your booking confirmation and every management update are sent here.
                </p>
              </div>
              <SubscriberFieldFrame>
                <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="Phone Number (optional)" className={subscriberInputClassName} />
              </SubscriberFieldFrame>
              <div className="md:col-span-2">
                <label htmlFor="subscriber-gender" className="mb-2 block px-1 text-sm text-[#4B5563] font-extrabold">
                  Gender
                </label>
                <SubscriberFieldFrame>
                  <select
                    id="subscriber-gender"
                    value={form.gender}
                    onChange={(event) => updateForm('gender', event.target.value)}
                    className={`${subscriberInputClassName} text-[#6B7280]`}
                    aria-describedby="subscriber-gender-help"
                  >
                    <option value="">Gender (optional)</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </SubscriberFieldFrame>
                <p id="subscriber-gender-help" className="mt-2 px-1 text-xs text-[#6B7280]">
                  Select your gender preference.
                </p>
              </div>
            </div>

            {submitError && (
              <p role="alert" className="mt-5 rounded-2xl border border-[#FEE4E2] bg-[#FFF5F4] p-4 text-sm text-[#B42318]">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-full bg-[linear-gradient(135deg,#0B5CFF,#25B7FF)] px-6 py-4 text-white shadow-[0_18px_45px_rgba(11,92,255,0.24)] font-black disabled:bg-[#B6C2D6] disabled:bg-none disabled:shadow-none"
            >
              {isSubmitting ? 'Submitting your booking...' : 'Continue to Payment Verification Chat'}
            </button>
          </form>

          <form ref={returningFormRef} onSubmit={handleReturningAccess} className="rounded-[2rem] border border-[#E5E9F2] bg-white/90 p-5 shadow-sm backdrop-blur lg:p-7">
            <h2 className="text-xl text-[#172033] font-black">Continue Verification Chat</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              We email a secure link to the address on your booking. Chat links are private, so we never show one here.
            </p>

            {accessLinkSent ? (
              <div className="mt-5 rounded-2xl border border-[#BFE7D1] bg-[#EEFBF4] p-4 text-sm text-[#157347]">
                <p className="font-extrabold">Check your email</p>
                <p className="mt-1 leading-6">
                  If a booking matches those details, a secure chat link is on its way. The link opens your conversation
                  and expires after 30 days.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SubscriberFieldFrame>
                    <input required value={returningName} onChange={(event) => setReturningName(event.target.value)} placeholder="Full Name" className={subscriberInputClassName} />
                  </SubscriberFieldFrame>
                  <SubscriberFieldFrame>
                    <input
                      required
                      type="email"
                      value={returningContact}
                      onChange={(event) => {
                        setReturningContact(event.target.value);
                        setReturningError('');
                      }}
                      placeholder="Email address on your booking"
                      className={subscriberInputClassName}
                    />
                  </SubscriberFieldFrame>
                </div>

                {returningError && <p role="alert" className="mt-3 text-sm text-[#B42318]">{returningError}</p>}

                <button
                  type="submit"
                  disabled={isRequestingLink}
                  className="mt-5 rounded-full border border-[#D8E4FF] bg-white px-6 py-3 text-[#0B5CFF] hover:bg-[#F4F8FF] font-black disabled:text-[#B6C2D6]"
                >
                  {isRequestingLink ? 'Sending link...' : 'Email me a chat link'}
                </button>
              </>
            )}
          </form>
        </motion.section>
      </main>
      {hasGeneratedClientMeetingLink && <FloatingVerificationChatButton onStartNew={resetRegistrationForm} />}
    </div>
  );
}
