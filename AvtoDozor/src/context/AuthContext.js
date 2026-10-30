import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setBaseUrl, setToken, setUnauthorizedHandler, getBaseUrl } from '../lib/api';
import { load, save } from '../lib/storage';
import { DEFAULT_SERVER } from '../config';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null); // { token, userId, fullName, position, email }
  const [server, setServerState] = useState(DEFAULT_SERVER);

  const logout = useCallback(async () => {
    setToken(null);
    setSession(null);
    await save('session', null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  // восстановление сессии при запуске
  useEffect(() => {
    (async () => {
      const savedServer = await load('server', DEFAULT_SERVER);
      setBaseUrl(savedServer);
      setServerState(getBaseUrl());
      const saved = await load('session', null);
      if (saved?.token) {
        setToken(saved.token);
        try {
          await api.me(); // проверяем, что токен ещё действует
          setSession(saved);
        } catch {
          setToken(null);
          await save('session', null);
        }
      }
      setReady(true);
    })();
  }, []);

  const changeServer = useCallback(async (url) => {
    setBaseUrl(url);
    const normalized = getBaseUrl();
    setServerState(normalized);
    await save('server', normalized);
  }, []);

  const login = useCallback(async (loginValue, password) => {
    const r = await api.login(loginValue.trim(), password);
    const s = {
      token: r.access_token,
      userId: r.user_id,
      fullName: r.full_name,
      position: r.position,
      email: r.email,
    };
    setToken(s.token);
    setSession(s);
    await save('session', s);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, session, server, changeServer, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
