import { isBrowserOffline, isSupabaseConfigured, supabase } from '../lib/supabase';
import { reportSupabaseSyncError } from './syncStatus';
import { deleteThread, readThreads } from './verificationChat';
import { ADMIN_NOTIFICATION_EVENT, ADMIN_NOTIFICATIONS_KEY, readAdminNotifications } from './adminNotifications';

export type ClientProfile = {
  id: string;
  name: string;
  category: string;
  email: string;
  avatarColor: string;
  avatarImage?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ClientProfileRow = {
  id: string;
  name: string;
  category: string;
  email: string;
  avatar_color: string;
  avatar_image_path: string | null;
  created_at?: string;
  updated_at?: string;
};

export const CLIENTS_KEY = 'zoom-admin-clients-v1';
export const CLIENTS_EVENT_NAME = 'zoom-admin-clients-updated';
export const avatarColors = ['#0B5CFF', '#7C3AED', '#059669', '#DC6803', '#D92D20', '#155EEF'];

let hasAttemptedClientBackfill = false;

export function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'C';
}

function rowToClient(row: ClientProfileRow): ClientProfile {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    email: row.email,
    avatarColor: row.avatar_color,
    avatarImage: row.avatar_image_path || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clientToRow(client: ClientProfile): ClientProfileRow {
  return {
    id: client.id,
    name: client.name,
    category: client.category,
    email: client.email,
    avatar_color: client.avatarColor,
    avatar_image_path: client.avatarImage || null,
    created_at: client.createdAt,
    updated_at: client.updatedAt || new Date().toISOString(),
  };
}

function clientSortTime(client: ClientProfile) {
  return new Date(client.createdAt || client.updatedAt || 0).getTime();
}

function clientUpdateTime(client: ClientProfile) {
  return new Date(client.updatedAt || client.createdAt || 0).getTime();
}

function sortClients(clients: ClientProfile[]) {
  return [...clients].sort((first, second) => clientSortTime(second) - clientSortTime(first));
}

function mergeClients(localClients: ClientProfile[], remoteClients: ClientProfile[]) {
  const clientsById = new Map<string, ClientProfile>();

  localClients.forEach((client) => clientsById.set(client.id, client));

  remoteClients.forEach((remoteClient) => {
    const localClient = clientsById.get(remoteClient.id);

    if (!localClient || clientUpdateTime(remoteClient) >= clientUpdateTime(localClient)) {
      clientsById.set(remoteClient.id, remoteClient);
    }
  });

  return sortClients(Array.from(clientsById.values()));
}

function shouldBackfillLocalClients(localClients: ClientProfile[], remoteClients: ClientProfile[]) {
  const remoteClientsById = new Map(remoteClients.map((client) => [client.id, client]));

  return localClients.some((localClient) => {
    const remoteClient = remoteClientsById.get(localClient.id);
    return !remoteClient || clientUpdateTime(localClient) > clientUpdateTime(remoteClient);
  });
}

function backfillLocalClients(localClients: ClientProfile[], remoteClients: ClientProfile[]) {
  if (hasAttemptedClientBackfill || localClients.length === 0 || !shouldBackfillLocalClients(localClients, remoteClients)) {
    return;
  }

  hasAttemptedClientBackfill = true;
  saveClientsRemote(mergeClients(localClients, remoteClients))
    .catch((error) => reportSupabaseSyncError('local client backfill', error));
}

function dispatchClientEvent() {
  window.dispatchEvent(new CustomEvent(CLIENTS_EVENT_NAME));

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CLIENTS_EVENT_NAME);
    channel.postMessage({ type: 'clients-updated' });
    channel.close();
  }
}

export function readClients(): ClientProfile[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawClients = window.localStorage.getItem(CLIENTS_KEY);

  if (!rawClients) {
    return [];
  }

  try {
    return sortClients(JSON.parse(rawClients) as ClientProfile[]);
  } catch {
    window.localStorage.removeItem(CLIENTS_KEY);
    return [];
  }
}

function writeClientsLocal(clients: ClientProfile[]) {
  window.localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  dispatchClientEvent();
}

async function saveClientsRemote(clients: ClientProfile[]) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase
    .from('client_profiles')
    .upsert(clients.map(clientToRow), { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

export function saveClientProfiles(clients: ClientProfile[]) {
  writeClientsLocal(clients);
  saveClientsRemote(clients).catch((error) => reportSupabaseSyncError('client profiles', error));
}

export async function refreshClientProfilesFromRemote() {
  if (!isSupabaseConfigured || !supabase || isBrowserOffline()) {
    return readClients();
  }

  const { data, error } = await supabase
    .from('client_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return readClients();
  }

  const localClients = readClients();
  const remoteClients = (data as ClientProfileRow[]).map(rowToClient);
  const clients = mergeClients(localClients, remoteClients);
  writeClientsLocal(clients);
  backfillLocalClients(localClients, remoteClients);
  return clients;
}

export function getClientAvatarImage(clientId: string) {
  if (!clientId || typeof window === 'undefined') {
    return '';
  }

  return readClients().find((client) => client.id === clientId)?.avatarImage || '';
}

export async function deleteClientProfile(clientId: string) {
  const relatedThreads = readThreads().filter((thread) => thread.clientId === clientId);
  relatedThreads.forEach((thread) => deleteThread(thread.id));
  writeClientsLocal(readClients().filter((client) => client.id !== clientId));

  const relatedThreadIds = new Set(relatedThreads.map((thread) => thread.id));
  const notifications = readAdminNotifications().filter((notification) => (
    !Array.from(relatedThreadIds).some((threadId) => notification.actionUrl.includes(`/admin/chats/${threadId}`))
  ));
  window.localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATION_EVENT));

  const email = readClients().find((client) => client.id === clientId)?.email.toLowerCase();
  if (email) {
    const users = JSON.parse(window.localStorage.getItem('zoom-workspace-users-v2') || '[]') as Array<{ email?: string }>;
    window.localStorage.setItem('zoom-workspace-users-v2', JSON.stringify(users.filter((user) => user.email?.toLowerCase() !== email)));
    const session = JSON.parse(window.localStorage.getItem('zoom-workspace-session-v2') || 'null') as { email?: string } | null;
    if (session?.email?.toLowerCase() === email) window.localStorage.removeItem('zoom-workspace-session-v2');
  }

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('client_profiles').delete().eq('id', clientId);
    if (error) throw error;
  }

  return relatedThreads.length;
}
