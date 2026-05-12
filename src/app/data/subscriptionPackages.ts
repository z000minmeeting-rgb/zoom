import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type SubscriptionPackage = {
  id: string;
  name: string;
  summary: string;
  price: string;
  duration: string;
  highlights: string[];
};

export type SubscriptionPageContent = {
  eyebrow: string;
  titleTemplate: string;
  introTemplate: string;
  availablePackagesTitle: string;
  whyTitle: string;
  whyItems: string[];
  closingTemplate: string;
  packages: SubscriptionPackage[];
};

export const SUBSCRIPTION_CONTENT_KEY = 'zoom-subscription-packages-v1';
export const SUBSCRIPTION_EVENT_NAME = 'zoom-subscription-packages-updated';
export const HOST_NAME_TOKEN = '{{hostName}}';

export const defaultSubscriptionContent: SubscriptionPageContent = {
  eyebrow: 'Private fan booking',
  titleTemplate: `Private verified video call access with "${HOST_NAME_TOKEN}"`,
  introTemplate: `Thank you for your interest in an exclusive one-on-one video call experience with ${HOST_NAME_TOKEN}. Due to high demand, limited availability, and the personalized nature of each session, premium access fees apply to secure your private booking.`,
  availablePackagesTitle: 'Available Packages',
  packages: [
    {
      id: 'premium-access',
      name: 'Premium Access',
      summary: '30 Minutes Private Video Call',
      price: '$350',
      duration: '1 month subscription with 3 video call sessions.',
      highlights: [
        'Includes personal interaction, casual conversation, and fan appreciation moments.',
      ],
    },
    {
      id: 'gold-access',
      name: 'Gold Access',
      summary: '1 Hour Exclusive Video Call',
      price: '$520',
      duration: '3 month subscription with 8 video call sessions.',
      highlights: [
        'Extended conversation time, personalized discussion, deeper engagement, and exclusive interaction opportunities.',
      ],
    },
    {
      id: 'vip-elite-access',
      name: 'VIP Elite Access',
      summary: 'Important Conversation / Special Meet & Greet Ticket',
      price: '$1,200',
      duration: '6 month subscription with 15 video call sessions.',
      highlights: [
        'Priority booking access',
        'VIP personalized session',
        'Exclusive meet-and-greet privileges',
        'Confidential or important discussions',
        'Limited availability reserved for serious bookings only',
      ],
    },
  ],
  whyTitle: 'Why the Premium Fee Applies',
  whyItems: [
    'Priority scheduling and reserved private time',
    'High-demand celebrity availability',
    'Personalized one-on-one engagement',
    'Security, management, and booking coordination',
    'Exclusive fan experience and limited access opportunities',
  ],
  closingTemplate: `Your subscription is handled through a private verification process built for transparency, secure coordination, and reliable scheduling. Once payment is confirmed, our management team will guide the next steps and help arrange a professional, memorable video call experience with "${HOST_NAME_TOKEN}".`,
};

function cloneContent(content: SubscriptionPageContent): SubscriptionPageContent {
  return {
    ...content,
    whyItems: [...content.whyItems],
    packages: content.packages.map((subscriptionPackage) => ({
      ...subscriptionPackage,
      highlights: [...subscriptionPackage.highlights],
    })),
  };
}

function asText(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function asTextList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const nextValue = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  return nextValue.length > 0 ? nextValue : [...fallback];
}

function normalizePackage(value: unknown, fallback: SubscriptionPackage, index: number): SubscriptionPackage {
  const packageValue = value && typeof value === 'object' ? value as Partial<SubscriptionPackage> : {};

  return {
    id: asText(packageValue.id, fallback.id || `package-${index + 1}`),
    name: asText(packageValue.name, fallback.name),
    summary: asText(packageValue.summary, fallback.summary),
    price: asText(packageValue.price, fallback.price),
    duration: asText(packageValue.duration, fallback.duration),
    highlights: asTextList(packageValue.highlights, fallback.highlights),
  };
}

function normalizeLoadedContent(parsedContent: Partial<SubscriptionPageContent>): SubscriptionPageContent {
  const defaultContent = cloneContent(defaultSubscriptionContent);
  const packageFallbacks = defaultContent.packages;
  const parsedPackages = Array.isArray(parsedContent.packages) ? parsedContent.packages : [];
  const packages = parsedPackages.length > 0
    ? parsedPackages.map((subscriptionPackage, index) => normalizePackage(
      subscriptionPackage,
      packageFallbacks[index] || packageFallbacks[packageFallbacks.length - 1],
      index
    ))
    : packageFallbacks;

  return {
    eyebrow: asText(parsedContent.eyebrow, defaultContent.eyebrow),
    titleTemplate: asText(parsedContent.titleTemplate, defaultContent.titleTemplate),
    introTemplate: asText(parsedContent.introTemplate, defaultContent.introTemplate),
    availablePackagesTitle: asText(parsedContent.availablePackagesTitle, defaultContent.availablePackagesTitle),
    whyTitle: asText(parsedContent.whyTitle, defaultContent.whyTitle),
    whyItems: asTextList(parsedContent.whyItems, defaultContent.whyItems),
    closingTemplate: asText(parsedContent.closingTemplate, defaultContent.closingTemplate),
    packages,
  };
}

function dispatchSubscriptionEvent() {
  window.dispatchEvent(new CustomEvent(SUBSCRIPTION_EVENT_NAME));

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(SUBSCRIPTION_EVENT_NAME);
    channel.postMessage({ type: 'subscription-content-updated' });
    channel.close();
  }
}

function writeSubscriptionContentLocal(content: SubscriptionPageContent) {
  window.localStorage.setItem(SUBSCRIPTION_CONTENT_KEY, JSON.stringify(content));
  dispatchSubscriptionEvent();
}

async function saveSubscriptionContentRemote(content: SubscriptionPageContent) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase
    .from('subscription_content')
    .upsert({
      id: 'default',
      content,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

export function loadSubscriptionContent(): SubscriptionPageContent {
  if (typeof window === 'undefined') {
    return cloneContent(defaultSubscriptionContent);
  }

  const rawContent = window.localStorage.getItem(SUBSCRIPTION_CONTENT_KEY);

  if (!rawContent) {
    return cloneContent(defaultSubscriptionContent);
  }

  try {
    const parsedContent = JSON.parse(rawContent) as Partial<SubscriptionPageContent>;
    return normalizeLoadedContent(parsedContent);
  } catch {
    window.localStorage.removeItem(SUBSCRIPTION_CONTENT_KEY);
    return cloneContent(defaultSubscriptionContent);
  }
}

export function saveSubscriptionContent(content: SubscriptionPageContent) {
  writeSubscriptionContentLocal(content);
  saveSubscriptionContentRemote(content).catch(() => undefined);
}

export async function refreshSubscriptionContentFromRemote() {
  if (!isSupabaseConfigured || !supabase) {
    return loadSubscriptionContent();
  }

  const { data, error } = await supabase
    .from('subscription_content')
    .select('content')
    .eq('id', 'default')
    .maybeSingle();

  if (error || !data?.content) {
    return loadSubscriptionContent();
  }

  const content = normalizeLoadedContent(data.content as Partial<SubscriptionPageContent>);
  writeSubscriptionContentLocal(content);
  return content;
}

export function resetSubscriptionContent() {
  const defaultContent = cloneContent(defaultSubscriptionContent);
  saveSubscriptionContent(defaultContent);
  return defaultContent;
}

export function createSubscriptionPackage(): SubscriptionPackage {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `package-${Date.now()}`;

  return {
    id,
    name: 'New Access Package',
    summary: 'Private video call package',
    price: '$0',
    duration: 'Custom subscription duration.',
    highlights: ['Personalized private booking access.'],
  };
}

export function formatSubscriptionText(template: string, hostName: string) {
  const resolvedHostName = hostName.trim() || 'the meeting host';

  return template
    .replaceAll(HOST_NAME_TOKEN, resolvedHostName)
    .replace(/\(host client name\)/gi, resolvedHostName);
}
