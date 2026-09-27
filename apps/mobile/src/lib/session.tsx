import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, onSessionExpired, setToken } from "./api";
import type { MeResponse } from "./types";

interface SessionState {
  ready: boolean;
  user: MeResponse | null;
  expiredNotice: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  dismissExpired: () => void;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const me = await api<MeResponse>("/auth/me");
          if (!cancelled) setUser(me);
        } catch {
          // 401 already cleared the token; network failures keep the user logged out until retry.
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setExpiredNotice(true);
      }),
    [],
  );

  const signIn = useCallback(async (token: string) => {
    await setToken(token);
    const me = await api<MeResponse>("/auth/me");
    setUser(me);
    setExpiredNotice(false);
  }, []);

  const signOut = useCallback(async () => {
    const token = await getToken();
    if (token) {
      try {
        await api("/auth/logout", { method: "POST", body: { token } });
      } catch {
        // Token still expires server-side; local session is cleared regardless.
      }
    }
    await setToken(null);
    setUser(null);
  }, []);

  const signOutEverywhere = useCallback(async () => {
    try {
      await api("/auth/revoke-all", { method: "POST" });
    } catch {
      // Same as above.
    }
    await setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<SessionState>(
    () => ({ ready, user, expiredNotice, signIn, signOut, signOutEverywhere, dismissExpired: () => setExpiredNotice(false) }),
    [ready, user, expiredNotice, signIn, signOut, signOutEverywhere],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}
