import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { notifyAdmin } from '../data/adminNotifications';

type User = {
  fullName: string;
  email: string;
};

type StoredUser = User & {
  password: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = LoginPayload & {
  fullName: string;
};

type UserContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => { ok: boolean; message?: string };
  register: (payload: RegisterPayload) => { ok: boolean; message?: string };
  logout: () => void;
};

const SESSION_KEY = 'zoom-workspace-session-v2';
const USERS_KEY = 'zoom-workspace-users-v2';
const LEGACY_SESSION_KEY = 'zoom-workspace-session';
const LEGACY_USERS_KEY = 'zoom-workspace-users';

const UserContext = createContext<UserContextValue | undefined>(undefined);

function getStoredUsers() {
  const rawUsers = window.localStorage.getItem(USERS_KEY);
  if (!rawUsers) {
    return [];
  }

  try {
    return JSON.parse(rawUsers) as StoredUser[];
  } catch {
    window.localStorage.removeItem(USERS_KEY);
    return [];
  }
}

function persistUsers(users: StoredUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function persistSession(user: User | null) {
  if (!user) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
    window.localStorage.removeItem(LEGACY_USERS_KEY);
    const rawSession = window.localStorage.getItem(SESSION_KEY);
    if (rawSession) {
      try {
        setUser(JSON.parse(rawSession) as User);
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const value = useMemo<UserContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    login: ({ email, password }) => {
      const normalizedEmail = email.trim().toLowerCase();
      const matchedUser = getStoredUsers().find(
        (candidate) => candidate.email.toLowerCase() === normalizedEmail && candidate.password === password
      );

      if (!matchedUser) {
        return { ok: false, message: 'Email or password is incorrect.' };
      }

      const nextUser = { fullName: matchedUser.fullName, email: matchedUser.email };
      setUser(nextUser);
      persistSession(nextUser);
      notifyAdmin('user_registration', {
        title: 'New User Registered',
        description: `User: ${nextUser.fullName}.`,
        actionUrl: '/admin/subscribers',
      });
      return { ok: true };
    },
    register: ({ fullName, email, password }) => {
      const normalizedEmail = email.trim().toLowerCase();
      const users = getStoredUsers();

      if (users.some((candidate) => candidate.email.toLowerCase() === normalizedEmail)) {
        return { ok: false, message: 'An account with this email already exists.' };
      }

      const storedUser = { fullName: fullName.trim(), email: email.trim(), password };
      persistUsers([storedUser, ...users]);

      const nextUser = { fullName: storedUser.fullName, email: storedUser.email };
      setUser(nextUser);
      persistSession(nextUser);
      return { ok: true };
    },
    logout: () => {
      setUser(null);
      persistSession(null);
    },
  }), [user]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser must be used inside UserProvider');
  }

  return context;
}
