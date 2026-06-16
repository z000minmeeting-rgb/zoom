import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, CalendarCheck, CalendarClock, Check, ChevronLeft, ChevronRight, CreditCard, Crown, FileCheck2, ShieldCheck, Sparkles, UsersRound, Video, X } from 'lucide-react';
import { formatSubscriptionText, loadSubscriptionContent, refreshSubscriptionContentFromRemote } from '../data/subscriptionPackages';
import { FloatingVerificationChatButton } from './verification/FloatingVerificationChatButton';
import { getClientAvatarImage, refreshClientProfilesFromRemote } from '../data/clientProfiles';

const smoothEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0 },
};

const processSlideVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 80 : -80,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -80 : 80,
  }),
};

const CAPTION_DISPLAY_MS = 8000;
const CAPTION_TYPE_SPEED_MS = 28;
const REVIEW_POPUP_INTERVAL_MS = 22000;
const REVIEW_POPUP_VISIBLE_MS = 15000;
const PROCESS_STEP_INTERVAL_MS = 6500;
const LEGACY_PACKAGE_DURATION = 'Every package subscription lasts for 3 months.';
const TRUST_CLOSING_TEMPLATE = 'Your subscription is handled through a private verification process built for transparency, secure coordination, and reliable scheduling. Once payment is confirmed, our management team will guide the next steps and help arrange a professional, memorable video call experience with "{{hostName}}".';
const LEGACY_CLOSING_TEMPLATE = 'Thank you for your understanding and support. We look forward to creating a memorable experience with "{{hostName}}".';
const packageAccessDetails = [
  '1 month subscription with 3 video call sessions.',
  '3 month subscription with 8 video call sessions.',
  '6 month subscription with 15 video call sessions.',
];
const subscriptionSteps = [
  {
    icon: BadgeCheck,
    title: 'Select access',
    text: 'Choose the package that matches the level of private video call access you want.',
  },
  {
    icon: CreditCard,
    title: 'Register and pay',
    text: 'Complete the subscriber profile and continue to the secure verification chat.',
  },
  {
    icon: FileCheck2,
    title: 'Upload proof',
    text: 'Submit payment evidence so management can review and confirm your subscription.',
  },
  {
    icon: CalendarCheck,
    title: 'Call scheduling',
    text: 'After payment is verified, management coordinates your available call schedule.',
  },
];
const mockFanReviews = [
  {
    name: 'Emily Carter',
    country: 'United States',
    language: 'English',
    text: 'The verified chat made the whole process feel organized. The video session gave me advice I still think about every week.',
  },
  {
    name: 'James Wilson',
    country: 'Canada',
    language: 'English',
    text: 'I expected a basic fan call, but management handled scheduling clearly and the conversation felt genuinely personal.',
  },
  {
    name: 'Olivia Hughes',
    country: 'United Kingdom',
    language: 'English',
    text: 'I liked that every step was documented in chat. It made the private booking feel safer, calmer, and more premium.',
  },
  {
    name: 'Charlotte Evans',
    country: 'Australia',
    language: 'English',
    text: 'The subscription process was easy to follow and the video session started on time. The whole experience felt carefully managed.',
  },
  {
    name: 'Liam Thompson',
    country: 'New Zealand',
    language: 'English',
    text: 'The verification chat helped me know exactly what to do next. The call itself was relaxed, warm, and memorable.',
  },
  {
    name: 'Aoife Murphy',
    country: 'Ireland',
    language: 'English',
    text: 'I was able to ask questions before submitting proof, and management replied with clear instructions. The final call felt very genuine.',
  },
  {
    name: 'Rachel Lim',
    country: 'Singapore',
    language: 'English',
    text: 'The private booking felt structured and secure. I appreciated the written confirmation before the appointment was scheduled.',
  },
  {
    name: 'Maya Campbell',
    country: 'Jamaica',
    language: 'English',
    text: 'The team made the process simple and respectful. Getting the video call confirmed through chat made everything feel official.',
  },
  {
    name: 'Darren Lewis',
    country: 'Trinidad and Tobago',
    language: 'English',
    text: 'I knew what was happening at each stage, from registration to payment review. The session gave me a story I still talk about.',
  },
  {
    name: 'Sarah Attard',
    country: 'Malta',
    language: 'English',
    text: 'The booking felt premium without being confusing. The chat record made the payment and scheduling steps easy to trust.',
  },
  {
    name: 'Aisha Khan',
    country: 'Pakistan',
    language: 'English / Urdu',
    text: 'The subscription gave me a real chance to connect. The management team kept the timing and payment review transparent.',
  },
  {
    name: 'Priya Sharma',
    country: 'India',
    language: 'English / Hindi',
    text: 'I felt seen as a fan. The video call was warm, respectful, and the plan was easier to understand than other celebrity offers.',
  },
  {
    name: 'Kenji Tanaka',
    country: 'Japan',
    language: 'Japanese',
    text: '手続きがわかりやすく、ビデオ通話はとても特別な体験でした。管理チームの対応も丁寧でした。',
  },
  {
    name: 'Min-Ji Park',
    country: 'South Korea',
    language: 'Korean',
    text: '확인 과정이 깔끔했고 영상 통화는 정말 특별했습니다. 팬으로서 오래 기억될 경험이었습니다.',
  },
  {
    name: 'Thabo Mokoena',
    country: 'South Africa',
    language: 'English',
    text: 'The call gave me confidence and a story I still share with friends. The package felt more reasonable than most celebrity access.',
  },
  {
    name: 'Chiamaka Okafor',
    country: 'Nigeria',
    language: 'English',
    text: 'The verification chat kept everything clear. Speaking face to face after subscribing made the whole experience feel worth it.',
  },
  {
    name: 'Fatima Al-Farsi',
    country: 'United Arab Emirates',
    language: 'Arabic / English',
    text: 'التجربة كانت منظمة وواضحة. فريق الادارة تابع معي حتى تم تحديد موعد المكالمة بشكل احترافي.',
  },
  {
    name: 'Mehmet Yilmaz',
    country: 'Turkey',
    language: 'Turkish',
    text: 'Odeme dogrulamasi ve planlama cok netti. Video gorusmesi bekledigimden daha samimi ve ozel hissettirdi.',
  },
  {
    name: 'Camila Rodriguez',
    country: 'Mexico',
    language: 'Spanish',
    text: 'Me encanto tener el seguimiento por chat. La experiencia se sintio segura, ordenada y muy especial para una fan.',
  },
  {
    name: 'Emma de Vries',
    country: 'Netherlands',
    language: 'Dutch',
    text: 'De stappen waren duidelijk en professioneel. Het videogesprek voelde persoonlijk en de prijs was logisch voor de ervaring.',
  },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'H';
}

function isImageAvatarValue(value: string) {
  return /^(data:image\/|https?:\/\/|\/)/.test(value);
}

function ClientHeroImage({
  image,
  hostAvatarColor,
  hostInitials,
  hostName,
}: {
  image: string;
  hostAvatarColor: string;
  hostInitials: string;
  hostName: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(image) && !imageFailed;

  return (
    <div className="relative h-[52dvh] min-h-[360px] overflow-hidden rounded-[2rem] border border-white bg-[#EAF3FF] shadow-[0_30px_90px_rgba(11,92,255,0.16)] sm:min-h-[440px] md:h-[620px]">
      {showImage ? (
        <motion.img
          src={image}
          alt={hostName}
          className="absolute inset-0 h-full w-full object-cover object-center"
          initial={{ scale: 1.02 }}
          animate={{ scale: 1.08 }}
          transition={{ duration: 18, ease: 'easeOut' }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#DCEBFF,#F7FBFF)]"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1.04 }}
          transition={{ duration: 14, ease: 'easeOut' }}
        >
          <div
            className="flex h-36 w-36 items-center justify-center rounded-[2rem] border border-white/80 text-5xl text-white shadow-2xl"
            style={{ backgroundColor: hostAvatarColor }}
          >
            <span className="font-black">{hostInitials}</span>
          </div>
        </motion.div>
      )}

      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.38)_52%,#FFFFFF_100%)] md:bg-[linear-gradient(110deg,#FFFFFF_0%,rgba(255,255,255,0.56)_28%,rgba(255,255,255,0.12)_78%,rgba(255,255,255,0.42)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_top,#FFFFFF_0%,rgba(255,255,255,0.78)_44%,rgba(255,255,255,0)_100%)]" />

      <motion.div
        className="absolute left-5 top-5 rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-xl backdrop-blur-xl"
        initial={{ opacity: 0, x: -26, y: 16 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.35, duration: 0.8, ease: smoothEase }}
      >
        <p className="text-xs uppercase tracking-[0.16em] text-[#0B5CFF] font-black">Exclusive host</p>
        <p className="mt-1 max-w-[220px] truncate text-lg text-[#172033] font-black">{hostName}</p>
      </motion.div>
    </div>
  );
}

export function SubscriptionPackagesScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [content, setContent] = useState(() => loadSubscriptionContent());
  const clientId = searchParams.get('clientId')?.trim() || '';
  const hostName = searchParams.get('hostName')?.trim() || searchParams.get('clientName')?.trim() || 'the meeting host';
  const hostAvatar = searchParams.get('hostAvatar') || '#0B5CFF';
  const hostInitials = searchParams.get('hostInitials') || getInitials(hostName);
  const [clientAvatarImage, setClientAvatarImage] = useState(() => getClientAvatarImage(clientId));
  const heroAvatarImage = clientAvatarImage || (isImageAvatarValue(hostAvatar) ? hostAvatar : '');
  const hostAvatarColor = isImageAvatarValue(hostAvatar) ? '#0B5CFF' : hostAvatar;
  const hasGeneratedClientMeetingLink = Boolean(searchParams.get('meetingLink') && clientId);
  const captions = useMemo(() => [
    `Reserve a private video call with ${hostName} through a verified booking process built for serious fans.`,
    `Choose your access level, confirm your subscription, and let management secure your time with ${hostName}.`,
    `Every booking moves through payment review and scheduling support, so your session with ${hostName} stays organized and trusted.`,
    `Limited private call windows make early subscription the best way to secure a memorable experience with ${hostName}.`,
  ], [hostName]);
  const longestCaption = useMemo(
    () => captions.reduce((longest, caption) => (caption.length > longest.length ? caption : longest), captions[0] || ''),
    [captions]
  );
  const [activeCaptionIndex, setActiveCaptionIndex] = useState(0);
  const [typedCaption, setTypedCaption] = useState('');
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [isReviewVisible, setIsReviewVisible] = useState(false);
  const [activeProcessStepIndex, setActiveProcessStepIndex] = useState(0);
  const [processDirection, setProcessDirection] = useState(1);
  const displayPackages = useMemo(() => (
    content.packages.map((subscriptionPackage, index) => ({
      ...subscriptionPackage,
      duration: index < packageAccessDetails.length || subscriptionPackage.duration === LEGACY_PACKAGE_DURATION
        ? packageAccessDetails[index] || subscriptionPackage.duration
        : subscriptionPackage.duration,
    }))
  ), [content.packages]);
  const selectedPackage = displayPackages.find((subscriptionPackage) => subscriptionPackage.id === selectedPackageId);
  const closingTemplate = content.closingTemplate === LEGACY_CLOSING_TEMPLATE ? TRUST_CLOSING_TEMPLATE : content.closingTemplate;
  const activeProcessStep = subscriptionSteps[activeProcessStepIndex];
  const ActiveProcessIcon = activeProcessStep.icon;

  useEffect(() => {
    refreshSubscriptionContentFromRemote().then(setContent);
  }, []);

  useEffect(() => {
    setClientAvatarImage(getClientAvatarImage(clientId));
    refreshClientProfilesFromRemote().then(() => {
      setClientAvatarImage(getClientAvatarImage(clientId));
    });
  }, [clientId]);

  useEffect(() => {
    const caption = captions[activeCaptionIndex];
    let currentCharacterIndex = 0;
    let holdTimeoutId: number | null = null;
    setTypedCaption('');

    const typingIntervalId = window.setInterval(() => {
      currentCharacterIndex += 1;
      setTypedCaption(caption.slice(0, currentCharacterIndex));

      if (currentCharacterIndex >= caption.length) {
        window.clearInterval(typingIntervalId);
        holdTimeoutId = window.setTimeout(() => {
          setActiveCaptionIndex((currentIndex) => (currentIndex + 1) % captions.length);
        }, Math.max(1200, CAPTION_DISPLAY_MS - caption.length * CAPTION_TYPE_SPEED_MS));
      }
    }, CAPTION_TYPE_SPEED_MS);

    return () => {
      window.clearInterval(typingIntervalId);

      if (holdTimeoutId) {
        window.clearTimeout(holdTimeoutId);
      }
    };
  }, [activeCaptionIndex, captions]);

  useEffect(() => {
    let hideTimeoutId: number | null = null;

    const showReview = () => {
      setActiveReviewIndex((currentIndex) => (currentIndex + 1) % mockFanReviews.length);
      setIsReviewVisible(true);

      if (hideTimeoutId) {
        window.clearTimeout(hideTimeoutId);
      }

      hideTimeoutId = window.setTimeout(() => {
        setIsReviewVisible(false);
      }, REVIEW_POPUP_VISIBLE_MS);
    };

    const intervalId = window.setInterval(showReview, REVIEW_POPUP_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);

      if (hideTimeoutId) {
        window.clearTimeout(hideTimeoutId);
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setProcessDirection(1);
      setActiveProcessStepIndex((currentIndex) => (currentIndex + 1) % subscriptionSteps.length);
    }, PROCESS_STEP_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const switchProcessStep = (nextIndex: number) => {
    setProcessDirection(nextIndex >= activeProcessStepIndex ? 1 : -1);
    setActiveProcessStepIndex(nextIndex);
  };

  const moveProcessStep = (direction: number) => {
    setProcessDirection(direction);
    setActiveProcessStepIndex((currentIndex) => (
      currentIndex + direction + subscriptionSteps.length
    ) % subscriptionSteps.length);
  };

  const scrollToPackages = () => {
    document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openRegistration = (packageId: string) => {
    const registrationParams = new URLSearchParams(searchParams);
    registrationParams.set('packageId', packageId);
    navigate(`/subscription/register?${registrationParams.toString()}`);
  };

  const activeReview = mockFanReviews[activeReviewIndex];

  return (
    <div className="h-dvh w-full overflow-x-hidden overflow-y-auto bg-white text-[#172033] [-webkit-overflow-scrolling:touch]">
      <main className="w-full">
        <section className="relative overflow-hidden bg-white">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#FFFFFF_0%,#F4F8FF_48%,#EAF7FF_100%)]" />
          <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pb-12 pt-4 md:min-h-0 md:grid-cols-[0.92fr_1.08fr] md:items-center md:px-8 md:py-10 xl:gap-14">
            <motion.div
              className="order-first md:order-last"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: smoothEase }}
            >
              <ClientHeroImage
                image={heroAvatarImage}
                hostAvatarColor={hostAvatarColor}
                hostInitials={hostInitials}
                hostName={hostName}
              />

              <div className="relative z-10 -mt-36 hidden grid-cols-3 gap-3 px-6 pb-6 md:grid">
                {displayPackages.slice(0, 3).map((subscriptionPackage, index) => (
                  <motion.button
                    key={subscriptionPackage.id}
                    type="button"
                    onClick={() => {
                      setSelectedPackageId(subscriptionPackage.id);
                      scrollToPackages();
                    }}
                    className="rounded-2xl border border-white/70 bg-white/80 p-4 text-left shadow-xl backdrop-blur-xl transition-colors hover:bg-white"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.48 + index * 0.12, duration: 0.8, ease: smoothEase }}
                  >
                    <p className="text-xs text-[#0B5CFF] font-black">{subscriptionPackage.name}</p>
                    <p className="mt-1 text-2xl text-[#172033] font-black">{subscriptionPackage.price}</p>
                    <p className="mt-1 truncate text-xs text-[#6B7280]">{subscriptionPackage.summary}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="order-last md:order-first"
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.12 }}
            >
              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.8, ease: smoothEase }}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D8E4FF] bg-white/80 px-4 py-2 text-sm text-[#0B5CFF] shadow-sm backdrop-blur"
              >
                <Sparkles className="h-4 w-4 text-[#0B5CFF]" />
                {content.eyebrow}
              </motion.div>

              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.9, ease: smoothEase }}
                className="relative max-w-4xl"
              >
                <h1
                  aria-hidden="true"
                  className="invisible text-4xl leading-tight text-[#172033] sm:text-5xl lg:text-6xl font-black"
                >
                  {longestCaption}
                </h1>
                <h1
                  aria-live="polite"
                  className="absolute inset-x-0 top-0 text-4xl leading-tight text-[#172033] sm:text-5xl lg:text-6xl font-black"
                >
                  <span>{typedCaption || captions[activeCaptionIndex].slice(0, 1)}</span>
                  <span className="ml-1 inline-block h-[0.82em] w-1 translate-y-1 rounded-full bg-[#0B5CFF] align-baseline animate-pulse" />
                </h1>
              </motion.div>

              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.9, ease: smoothEase }}
                className="mt-5 max-w-2xl text-base leading-8 text-[#4B5563] lg:text-lg"
              >
                {formatSubscriptionText(content.introTemplate, hostName)}
              </motion.p>

              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.9, ease: smoothEase }}
                className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 md:max-w-2xl"
              >
                {[
                  { icon: CalendarClock, label: 'Priority booking' },
                  { icon: ShieldCheck, label: 'Reserved access' },
                  { icon: Video, label: 'Video sessions' },
                  { icon: Crown, label: 'Premium experience' },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="rounded-2xl border border-[#E5E9F2] bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                      <Icon className="mb-2 h-5 w-5 text-[#0B5CFF]" />
                      <p className="text-sm leading-5 text-[#4B5563] font-bold">{item.label}</p>
                    </div>
                  );
                })}
              </motion.div>

              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.9, ease: smoothEase }}
                className="mt-7"
              >
                <div className="mb-5 grid w-full gap-3 sm:max-w-md sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="flex items-center gap-3 rounded-2xl border border-[#D8E4FF] bg-white/86 px-4 py-3 shadow-sm backdrop-blur">
                    <UsersRound className="h-5 w-5 text-[#0B5CFF]" />
                    <span className="text-2xl text-[#172033] font-black">29,000+</span>
                  </div>
                  <p className="text-sm leading-6 text-[#4B5563]">
                    subscribed fans use verified access to request private video call scheduling.
                  </p>
                </div>

                <motion.button
                  type="button"
                  onClick={scrollToPackages}
                  className="premium-cta-glow w-full rounded-full bg-[linear-gradient(135deg,#0B5CFF,#25B7FF)] px-7 py-4 text-white shadow-[0_18px_45px_rgba(11,92,255,0.26)] sm:max-w-md font-black"
                  whileHover={{ scale: 1.02, boxShadow: '0 22px 58px rgba(11,92,255,0.32)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  View premium packages
                </motion.button>

                <button
                  type="button"
                  onClick={() => navigate(`/subscription/register?${searchParams.toString()}`)}
                  className="mt-3 w-full rounded-full border border-[#D8E4FF] bg-white/80 px-7 py-3 text-[#0B5CFF] shadow-sm backdrop-blur hover:bg-[#F4F8FF] sm:max-w-md font-black"
                >
                  Continue Verification Chat
                </button>

                {selectedPackage && (
                  <p className="mt-4 text-sm text-[#0B5CFF] font-extrabold">
                    Selected: {selectedPackage.name} - {selectedPackage.price}
                  </p>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section id="packages" className="scroll-mt-24 bg-[#F7FAFF] px-4 py-12 lg:px-8 lg:py-16">
          <motion.div
            className="mx-auto max-w-7xl"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, ease: smoothEase }}
          >
            <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-[#0B5CFF] font-black">Fan membership</p>
                <h2 className="mt-2 text-3xl text-[#172033] font-black">{content.availablePackagesTitle}</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-[#6B7280]">
                Choose a verified access plan for private booking with {hostName}. Each tier includes a defined subscription window and video call allowance.
              </p>
            </div>

            <div className="mb-8 overflow-hidden rounded-[1.75rem] border border-[#D8E4FF] bg-white shadow-[0_22px_70px_rgba(11,92,255,0.10)]">
              <div className="flex flex-col gap-2 border-b border-[#E5E9F2] p-5 md:flex-row md:items-end md:justify-between lg:p-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0B5CFF] font-black">Subscription process</p>
                  <h3 className="mt-2 text-2xl text-[#172033] font-black">From package selection to scheduled call</h3>
                </div>
                <p className="max-w-xl text-sm leading-6 text-[#6B7280]">
                  Management confirms payment first, then coordinates the available call schedule for the selected subscription.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]">
                <div className="relative min-h-[300px] overflow-hidden bg-[linear-gradient(135deg,#F7FAFF,#FFFFFF)] p-5 lg:p-7">
                  <AnimatePresence custom={processDirection} mode="wait">
                    <motion.article
                      key={activeProcessStep.title}
                      custom={processDirection}
                      variants={processSlideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.46, ease: smoothEase }}
                      className="flex min-h-[250px] flex-col justify-between rounded-[1.35rem] border border-[#D8E4FF] bg-white p-5 shadow-[0_18px_50px_rgba(11,92,255,0.10)]"
                    >
                      <div>
                        <div className="mb-6 flex items-center justify-between gap-4">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F1FF] text-[#0B5CFF]">
                            <ActiveProcessIcon className="h-7 w-7" />
                          </span>
                          <span className="rounded-full bg-[#F4F8FF] px-3 py-1 text-xs text-[#0B5CFF] font-black">
                            Step {activeProcessStepIndex + 1} of {subscriptionSteps.length}
                          </span>
                        </div>
                        <p className="text-2xl text-[#172033] font-black">{activeProcessStep.title}</p>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#4B5563]">{activeProcessStep.text}</p>
                      </div>

                      <div className="mt-8 h-2 overflow-hidden rounded-full bg-[#E8F1FF]">
                        <motion.div
                          key={activeProcessStepIndex}
                          className="h-full rounded-full bg-[linear-gradient(135deg,#0B5CFF,#25B7FF)]"
                          initial={{ width: '0%' }}
                          animate={{ width: `${((activeProcessStepIndex + 1) / subscriptionSteps.length) * 100}%` }}
                          transition={{ duration: 0.5, ease: smoothEase }}
                        />
                      </div>
                    </motion.article>
                  </AnimatePresence>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex gap-2">
                      {subscriptionSteps.map((step, index) => (
                        <button
                          key={step.title}
                          type="button"
                          onClick={() => switchProcessStep(index)}
                          className={`h-2.5 rounded-full transition-all ${
                            activeProcessStepIndex === index ? 'w-8 bg-[#0B5CFF]' : 'w-2.5 bg-[#C7D7FE] hover:bg-[#8DB3FF]'
                          }`}
                          aria-label={`Show process step ${index + 1}`}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveProcessStep(-1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E4FF] bg-white text-[#0B5CFF] hover:bg-[#F4F8FF]"
                        aria-label="Previous process step"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveProcessStep(1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B5CFF] text-white shadow-[0_12px_30px_rgba(11,92,255,0.22)] hover:bg-[#0056D2]"
                        aria-label="Next process step"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px bg-[#E5E9F2] lg:grid-cols-1">
                  {subscriptionSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = activeProcessStepIndex === index;

                    return (
                      <button
                        key={step.title}
                        type="button"
                        onClick={() => switchProcessStep(index)}
                        className={`flex items-center gap-3 bg-white p-4 text-left transition-colors ${
                          isActive ? 'text-[#0B5CFF]' : 'text-[#4B5563] hover:bg-[#F7FAFF]'
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          isActive ? 'bg-[#0B5CFF] text-white' : 'bg-[#E8F1FF] text-[#0B5CFF]'
                        }`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs uppercase tracking-[0.14em] font-black">0{index + 1}</span>
                          <span className="block truncate text-sm text-[#172033] font-black">{step.title}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {displayPackages.map((subscriptionPackage, index) => {
                const isSelected = selectedPackageId === subscriptionPackage.id;
                const featured = index === 1;
                const packageBadge = index === 0
                  ? 'Premium Package'
                  : index === 1
                    ? 'Gold Package'
                    : index === 2
                      ? 'VIP Elite Package'
                      : 'Premium Package';

                return (
                  <motion.article
                    key={subscriptionPackage.id}
                    className={`premium-package-card ${
                      isSelected ? 'premium-package-card--selected' : featured ? 'premium-package-card--featured' : ''
                    }`}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -70 : 70, filter: 'blur(10px)' }}
                    whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    animate={{ scale: isSelected ? 1.025 : 1 }}
                    whileHover={{ y: -8, scale: isSelected ? 1.04 : 1.02 }}
                    whileTap={{ scale: 0.99 }}
                    viewport={{ once: true, amount: 0.24 }}
                    transition={{ duration: 0.82, ease: smoothEase, delay: index * 0.08 }}
                  >
                    <div className="premium-package-card__inner flex h-full flex-col p-6">
                      <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
                            featured ? 'bg-[#EFF8FF] text-[#0B5CFF]' : 'bg-[#E8F1FF] text-[#0B5CFF]'
                          }`}>
                            {featured ? <Crown className="h-6 w-6" /> : <BadgeCheck className="h-6 w-6" />}
                          </div>
                          <p className="text-xs uppercase tracking-[0.16em] text-[#0B5CFF] font-black">{packageBadge}</p>
                          <h3 className="mt-2 text-2xl text-[#172033] font-black">{subscriptionPackage.name}</h3>
                        </div>
                        {isSelected && (
                          <span className="rounded-full bg-[#E8F1FF] px-3 py-1 text-xs text-[#0B5CFF] font-black">Active</span>
                        )}
                      </div>

                      <div className="mb-5 rounded-2xl bg-[linear-gradient(135deg,#FFFFFF,#F2F8FF)] p-4 shadow-inner">
                        <p className="text-sm text-[#6B7280]">{subscriptionPackage.summary}</p>
                        <p className="mt-3 text-4xl text-[#172033] font-black">{subscriptionPackage.price}</p>
                        <p className="mt-2 text-sm text-[#0B5CFF] font-extrabold">{subscriptionPackage.duration}</p>
                      </div>

                      <div className="mb-6 space-y-3">
                        {subscriptionPackage.highlights.map((highlight) => (
                          <div key={highlight} className="flex gap-3">
                            <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#12A150]" />
                            <p className="text-sm leading-6 text-[#4B5563]">{highlight}</p>
                          </div>
                        ))}
                      </div>

                      <motion.button
                        type="button"
                        onClick={() => {
                          setSelectedPackageId(subscriptionPackage.id);
                          openRegistration(subscriptionPackage.id);
                        }}
                        className="mt-auto w-full rounded-full bg-[linear-gradient(135deg,#0B5CFF,#25B7FF)] px-5 py-3 text-white shadow-[0_14px_34px_rgba(11,92,255,0.24)] font-black"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {isSelected ? 'Continue with package' : 'Select package'}
                      </motion.button>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
        </section>

        <motion.section
          className="border-y border-[#E5E9F2] bg-white px-4 py-12 lg:px-8 lg:py-16"
          initial={{ opacity: 0, x: -60, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.9, ease: smoothEase }}
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[#0B5CFF] font-black">Booking access</p>
              <h2 className="mt-2 text-3xl text-[#172033] font-black">{content.whyTitle}</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {content.whyItems.map((item, index) => (
                <motion.div
                  key={item}
                  className="rounded-2xl border border-[#E5E9F2] bg-[#F7F9FC] p-4 shadow-sm"
                  initial={{ opacity: 0, x: index % 2 === 0 ? 42 : -42 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.7, ease: smoothEase, delay: index * 0.06 }}
                >
                  <Check className="mb-3 h-5 w-5 text-[#12A150]" />
                  <p className="text-sm leading-6 text-[#4B5563]">{item}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          className="bg-[#F7FAFF] px-4 py-12 lg:px-8"
          initial={{ opacity: 0, x: 60, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.9, ease: smoothEase }}
        >
          <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-[#D8E4FF] bg-white/90 p-6 text-center shadow-[0_22px_70px_rgba(11,92,255,0.10)] backdrop-blur-xl lg:p-8">
            <p className="text-lg leading-8 text-[#172033]">
              {formatSubscriptionText(closingTemplate, hostName)}
            </p>
          </div>
        </motion.section>
      </main>
      {isReviewVisible && (
        <motion.div
          className="fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-40 mx-auto max-w-md rounded-[1.5rem] border border-[#D8E4FF] bg-white/95 p-4 shadow-[0_24px_70px_rgba(11,92,255,0.22)] backdrop-blur-xl sm:left-auto sm:right-6 sm:mx-0"
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.96 }}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#0B5CFF] font-black">Sample fan story</p>
              <p className="mt-1 text-[#172033] font-black">{activeReview.name}</p>
              <p className="text-xs text-[#6B7280]">{activeReview.country} - {activeReview.language}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsReviewVisible(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F4F8FF]"
              aria-label="Close fan story"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm leading-6 text-[#4B5563]">{activeReview.text}</p>
        </motion.div>
      )}
      {hasGeneratedClientMeetingLink && <FloatingVerificationChatButton />}
    </div>
  );
}
