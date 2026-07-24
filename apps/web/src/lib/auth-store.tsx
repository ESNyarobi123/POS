"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AuthUserDto,
  LoginResponse,
  OrganizationContextResponse,
} from "@gulio/contracts";
import {
  apiFetch,
  getStoredToken,
  setStoredToken,
} from "./api";
import {
  clearShiftSession,
  loadShiftSession,
  saveShiftSession,
  type PosShiftSession,
} from "./pos-session";

type AuthState = {
  ready: boolean;
  token: string | null;
  user: AuthUserDto | null;
  orgContext: OrganizationContextResponse | null;
  shift: PosShiftSession | null;
  online: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<AuthUserDto>;
  logout: () => void;
  refreshOrgContext: () => Promise<OrganizationContextResponse>;
  setShift: (session: PosShiftSession | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [orgContext, setOrgContext] =
    useState<OrganizationContextResponse | null>(null);
  const [shift, setShiftState] = useState<PosShiftSession | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    const existing = getStoredToken();
    const savedShift = loadShiftSession();
    if (!existing) {
      setShiftState(savedShift);
      setReady(true);
      return;
    }

    setToken(existing);
    setShiftState(savedShift);

    void (async () => {
      try {
        const me = await apiFetch<{ user: AuthUserDto }>("/auth/me");
        setUser(me.user);
        const ctx = await apiFetch<OrganizationContextResponse>(
          "/organization/context",
        );
        setOrgContext(ctx);
      } catch {
        setStoredToken(null);
        setToken(null);
        setUser(null);
        setOrgContext(null);
        clearShiftSession();
        setShiftState(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const refreshOrgContext = useCallback(async () => {
    const ctx = await apiFetch<OrganizationContextResponse>(
      "/organization/context",
    );
    setOrgContext(ctx);
    return ctx;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    setStoredToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    clearShiftSession();
    setShiftState(null);
    const ctx = await apiFetch<OrganizationContextResponse>(
      "/organization/context",
    );
    setOrgContext(ctx);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setOrgContext(null);
    clearShiftSession();
    setShiftState(null);
  }, []);

  const setShift = useCallback((session: PosShiftSession | null) => {
    if (session) saveShiftSession(session);
    else clearShiftSession();
    setShiftState(session);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      token,
      user,
      orgContext,
      shift,
      online,
      login,
      logout,
      refreshOrgContext,
      setShift,
    }),
    [
      ready,
      token,
      user,
      orgContext,
      shift,
      online,
      login,
      logout,
      refreshOrgContext,
      setShift,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
