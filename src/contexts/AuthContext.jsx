import { useEffect, useState, useCallback } from 'react';
import { AuthContext, request } from './auth-api';
import { getAuthToken, saveAuthToken, clearAuthToken } from './auth-storage';
import { AUTH_EXPIRED_EVENT, tokenExpiresAt } from './auth-session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classMode, setClassMode] = useState(null);
  const [legacyAllowed, setLegacyAllowed] = useState(true);
  const userId = user?.id;

  useEffect(() => {
    let active = true;
    setClassMode(null);
    if (userId) request('/api/lms/config')
      .then(config => { if (active) { setLegacyAllowed(config.legacy_allowed !== false); setClassMode(config.class_mode); } })
      .catch(() => {
        // Never fall back to the unrestricted legacy curriculum when the
        // server-side LMS policy cannot be verified.
        if (active) { setLegacyAllowed(false); setClassMode(true); }
      });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const expired = () => { setUser(null); setLoading(false); };
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    const expiry = tokenExpiresAt(token || '');
    const expire = () => {
      if (getAuthToken() !== token) return;
      clearAuthToken(); setUser(null);
    };
    let timer;
    const schedule = () => {
      if (expiry === null) return;
      const remaining = expiry - Date.now();
      if (remaining <= 0) expire();
      else timer = setTimeout(schedule, Math.min(remaining, 2147483647));
    };
    schedule();
    const verify = () => {
      if (getAuthToken() !== token) { setUser(null); return; }
      if (expiry !== null && Date.now() >= expiry) { expire(); return; }
      request('/api/auth/me').then(current => {
        if (getAuthToken() === token) setUser(previous => previous &&
          (previous.role !== current.role || previous.full_name !== current.full_name) ? current : previous);
      }).catch(() => {}); // 401 invalidates the verified session centrally.
    };
    const poll = setInterval(verify, 60000);
    window.addEventListener('focus', verify);
    const storage = () => { if (getAuthToken() !== token) setUser(null); };
    window.addEventListener('storage', storage);
    return () => { clearTimeout(timer); clearInterval(poll); window.removeEventListener('focus', verify); window.removeEventListener('storage', storage); };
  }, [user]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    request('/api/auth/me')
      .then(currentUser => { if (active && getAuthToken() === token) setUser(currentUser); })
      .catch(error => { if (active && getAuthToken() === token && error.status === 401) clearAuthToken(); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email, password, remember = false) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveAuthToken(data.access_token, remember);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, password, fullName) => {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName || undefined }),
    });
    saveAuthToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const loginGoogle = useCallback(async (credential, remember = false) => {
    const data = await request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    saveAuthToken(data.access_token, remember);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const revoke = request('/api/auth/logout', { method: 'POST' });
    clearAuthToken();
    setUser(null); // Unmount services/USB immediately, even when the server is unavailable.
    try {
      await revoke;
    } catch {
      // Lỗi thu hồi token phía server không quan trọng bằng việc xoá phiên cục bộ
    }
  }, []);

  const changePassword = useCallback((currentPassword, newPassword) => {
    return request('/api/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }, []);

  const markVideoWatched = useCallback((labId) => {
    return request(`/api/progress/${labId}/video-watched`, { method: 'POST' });
  }, []);

  const markDocViewed = useCallback((labId) => {
    return request(`/api/progress/${labId}/doc-viewed`, { method: 'POST' });
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, login, loginGoogle, register, logout, isAuthenticated: !!user,
      classMode, legacyAllowed,
      changePassword, markVideoWatched, markDocViewed,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
