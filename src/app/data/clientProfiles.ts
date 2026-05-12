import { isBrowserOffline, isSupabaseConfigured, supabase } from '../lib/supabase';

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
  if (!isSupabaseConfigured || !supabase || isBrowserOffline()) {
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
  saveClientsRemote(clients).catch(() => undefined);
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

  const clients = mergeClients(readClients(), (data as ClientProfileRow[]).map(rowToClient));
  writeClientsLocal(clients);
  return clients;
}

export function getClientAvatarImage(clientId: string) {
  if (!clientId || typeof window === 'undefined') {
    return '';
  }

  return readClients().find((client) => client.id === clientId)?.avatarImage || '';
}
