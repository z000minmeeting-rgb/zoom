import { isBrowserOffline, isSupabaseConfigured, supabase } from '../lib/supabase';
import { reportSupabaseSyncError } from './syncStatus';
import { deleteThread, readThreads } from './verificationChat';
import { readCloudCache, writeCloudCache } from './adminCache';
import { requireAdminWorkspace } from './adminWorkspace';

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
  admin_account_id: string;
};

export const CLIENTS_KEY = 'zoom-admin-clients-v1';
export const CLIENTS_EVENT_NAME = 'zoom-admin-clients-updated';
export const avatarColors = ['#0B5CFF', '#7C3AED', '#059669', '#DC6803', '#D92D20', '#155EEF'];


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

function clientToRow(client: ClientProfile, adminAccountId: string): ClientProfileRow {
  return {
    id: client.id,
    name: client.name,
    category: client.category,
    email: client.email,
    avatar_color: client.avatarColor,
    avatar_image_path: client.avatarImage || null,
    created_at: client.createdAt,
    updated_at: client.updatedAt || new Date().toISOString(),
    admin_account_id: adminAccountId,
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


function dispatchClientEvent() {
  window.dispatchEvent(new CustomEvent(CLIENTS_EVENT_NAME));

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CLIENTS_EVENT_NAME);
    channel.postMessage({ type: 'clients-updated' });
    channel.close();
  }
}

export function readClients(): ClientProfile[] {
  return readCloudCache<ClientProfile[]>('clients', []);
}

/** Used only by the legacy importer; never by normal admin reads. */
export function readLegacyClients(): ClientProfile[] {
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
    return [];
  }
}

function writeClientsLocal(clients: ClientProfile[]) {
  writeCloudCache('clients', clients);
  dispatchClientEvent();
}

async function saveClientsRemote(clients: ClientProfile[]) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }
  const workspace = await requireAdminWorkspace();

  const { error } = await supabase
    .from('client_profiles')
    .upsert(clients.map((client) => clientToRow(client, workspace.id)), { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

export async function saveClientProfiles(clients: ClientProfile[]) {
  try {
    await saveClientsRemote(clients);
    writeClientsLocal(clients);
  } catch (error) {
    reportSupabaseSyncError('client profiles', error);
    throw error;
  }
}

export async function refreshClientProfilesFromRemote() {
  if (!isSupabaseConfigured || !supabase || isBrowserOffline()) {
    throw new Error('Cloud client data is unavailable while Supabase is offline or unconfigured.');
  }
  let workspace;
  try {
    workspace = await requireAdminWorkspace();
  } catch {
    return readClients();
  }

  const { data, error } = await supabase
    .from('client_profiles')
    .select('*')
    .eq('admin_account_id', workspace.id)
    .order('created_at', { ascending: false });

  if (error || !data) {
    throw error || new Error('Unable to load client profiles.');
  }
  const remoteClients = (data as ClientProfileRow[]).map(rowToClient);
  const clients = sortClients(remoteClients);
  writeClientsLocal(clients);
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
  await Promise.all(relatedThreads.map((thread) => deleteThread(thread.id)));
  writeClientsLocal(readClients().filter((client) => client.id !== clientId));

  if (isSupabaseConfigured && supabase) {
    const workspace = await requireAdminWorkspace();
    const { error } = await supabase.from('client_profiles').delete().eq('id', clientId).eq('admin_account_id', workspace.id);
    if (error) throw error;
  }

  return relatedThreads.length;
}
