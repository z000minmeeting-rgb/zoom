import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AdminLoginPayload = {
  pin: string;
};

type AdminLoginResult = {
  ok: boolean;
  message?: string;
};

type AdminAuthContextValue = {
  isAdminConfigured: boolean;
  isAdminAuthenticated: boolean;
  isCheckingAdmin: boolean;
  loginAdmin: (payload: AdminLoginPayload) => Promise<AdminLoginResult>;
  logoutAdmin: () => void;
};

const ADMIN_PIN = '1688';
const ADMIN_PIN_SESSION_KEY = 'zoom-admin-pin-session-v1';

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const isAdminConfigured = true;

  useEffect(() => {
    setIsAdminAuthenticated(window.localStorage.getItem(ADMIN_PIN_SESSION_KEY) === 'true');
    setIsCheckingAdmin(false);
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => ({
    isAdminConfigured,
    isAdminAuthenticated,
    isCheckingAdmin,
    loginAdmin: async ({ pin }) => {
      if (pin.trim() !== ADMIN_PIN) {
        return { ok: false, message: 'Admin PIN is incorrect.' };
      }

      window.localStorage.setItem(ADMIN_PIN_SESSION_KEY, 'true');
      setIsAdminAuthenticated(true);
      return { ok: true };
    },
    logoutAdmin: () => {
      window.localStorage.removeItem(ADMIN_PIN_SESSION_KEY);
      setIsAdminAuthenticated(false);
    },
  }), [isAdminAuthenticated, isAdminConfigured, isCheckingAdmin]);

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  }

  return context;
}
