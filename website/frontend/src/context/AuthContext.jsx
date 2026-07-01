import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { jwtDecode } from 'jwt-decode';
import { setUnauthorizedHandler } from '../services/axios.js';

export const AuthContext = createContext(null);

// Per-tab storage so opening a second tab with a different role (e.g. therapist)
// does not overwrite the first tab's session (e.g. admin). sessionStorage is
// scoped to the tab; localStorage would be shared across every tab of the same
// origin and is what caused the cross-tab role swap bug.
const authStore = typeof window !== 'undefined' ? window.sessionStorage : null;

const decodeJwtPayload = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

const clearStoredAuth = () => {
  if (!authStore) return;
  authStore.removeItem('noumouw_token');
  authStore.removeItem('noumouw_user');
  authStore.removeItem('noumouw_admin');
};

const isTokenExpired = (token) => {
  try {
    const { exp } = jwtDecode(token);
    if (!exp) return false;
    return exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

const readStoredAuth = () => {
  if (!authStore) return null;
  const token = authStore.getItem('noumouw_token');
  if (token && isTokenExpired(token)) {
    clearStoredAuth();
    return null;
  }
  const storedUser = authStore.getItem('noumouw_user');
  const storedAdmin = authStore.getItem('noumouw_admin');

  let userData = null;
  if (storedUser) {
    try { userData = JSON.parse(storedUser); } catch { userData = null; }
  } else if (storedAdmin) {
    try { userData = { ...JSON.parse(storedAdmin), role: 'admin' }; } catch { userData = null; }
  }

  if (token && userData) {
    const payload = decodeJwtPayload(token);
    if (payload?.role && payload.role !== userData.role) {
      clearStoredAuth();
      return null;
    }
  }

  return userData;
};

const AUTH_HANDOFF_PREFIX = '#noumouw_auth=';

const persistSession = (token, userData) => {
  if (!authStore) return;
  authStore.setItem('noumouw_token', token);
  authStore.setItem('noumouw_user', JSON.stringify(userData));
  if (userData.role === 'admin') {
    authStore.setItem('noumouw_admin', JSON.stringify(userData));
  } else {
    authStore.removeItem('noumouw_admin');
  }
};

const consumeTokenFromQuery = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get('token');
  if (!queryToken) return null;
  try {
    if (isTokenExpired(queryToken)) {
      window.history.replaceState(null, '', window.location.pathname);
      return null;
    }
    const payload = decodeJwtPayload(queryToken);
    if (!payload?.role) return null;
    const userData = {
      role: payload.role,
      email: payload.email || '',
      ...(payload.role === 'admin'
        ? { admin_id: payload.admin_id }
        : payload.role === 'therapist'
          ? { therapist_id: payload.therapist_id }
          : { parent_user_id: payload.parent_user_id }),
    };
    persistSession(queryToken, userData);
    window.history.replaceState(null, '', window.location.pathname);
    return userData;
  } catch {
    window.history.replaceState(null, '', window.location.pathname);
    return null;
  }
};

const tryConsumeAuthHandoff = () => {
  if (typeof window === 'undefined') return null;
  const { hash } = window.location;
  if (!hash.startsWith(AUTH_HANDOFF_PREFIX)) return null;
  try {
    const encoded = hash.slice(AUTH_HANDOFF_PREFIX.length);
    const { token, user: userData } = JSON.parse(decodeURIComponent(encoded));
    if (!token || !userData?.role) return null;
    persistSession(token, userData);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return userData;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    });
  }, [logout]);

  useEffect(() => {
    const fromQuery = consumeTokenFromQuery();
    const fromHandoff = fromQuery ?? tryConsumeAuthHandoff();
    setUser(fromHandoff ?? readStoredAuth());
    setLoading(false);
  }, []);

  const login = useCallback((token, userData) => {
    persistSession(token, userData);
    setUser(userData);
  }, []);

  const patchUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (authStore) {
        authStore.setItem('noumouw_user', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      admin: user?.role === 'admin' ? user : null,
      therapist: user?.role === 'therapist' ? user : null,
      login,
      logout,
      patchUser,
      loading,
    }),
    [user, loading, login, logout, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

