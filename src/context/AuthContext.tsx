import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { UserProfile, UserRole } from '../types/smartcity';
import {
  apiRequest,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '../services/api';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info';
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  demoLogin: (role: UserRole) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    organisation: string;
    designation: string;
    role: UserRole;
  }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  notify: (title: string, message?: string, type?: ToastItem['type']) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('smartcity_theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [selectedCity, setSelectedCity] = useState('Mumbai');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('smartcity_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const notify = useCallback((title: string, message?: string, type: ToastItem['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: UserProfile }>('/api/profile');
      setUser(data.user);
    } catch {
      clearStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(res.token, remember);
      setUser(res.user);
      notify(`Welcome back, ${res.user.fullName}`, `${res.user.role} · ${res.user.organisation}`, 'success');
    },
    [notify]
  );

  const demoLogin = useCallback(
    async (role: UserRole) => {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      setStoredToken(res.token, true);
      setUser(res.user);
      notify(`Signed in as ${res.user.role}`, `${res.user.fullName} · Mumbai Demo Environment`, 'success');
    },
    [notify]
  );

  const register = useCallback(
    async (payload: {
      fullName: string;
      email: string;
      password: string;
      organisation: string;
      designation: string;
      role: UserRole;
    }) => {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStoredToken(res.token, true);
      setUser(res.user);
      notify('Account created', `Logged in as ${res.user.role}`, 'success');
    },
    [notify]
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    notify('Signed out', 'Your SmartCity AI session has ended.', 'info');
  }, [notify]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        theme,
        toggleTheme,
        selectedCity,
        setSelectedCity,
        login,
        demoLogin,
        register,
        logout,
        refreshProfile,
        notify,
      }}
    >
      {children}

      {/* Global Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[#82AAD2]/25 bg-[#101D2D]/95 backdrop-blur-md p-3.5 shadow-2xl text-[#F4F7FC]"
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#00D69A] shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertTriangle className="w-5 h-5 text-[#FF5263] shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-[#00C8FF] shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug">{t.title}</p>
              {t.message && <p className="text-xs text-[#91A2B8] mt-0.5 leading-relaxed">{t.message}</p>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-[#91A2B8] hover:text-[#F4F7FC] p-0.5"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
