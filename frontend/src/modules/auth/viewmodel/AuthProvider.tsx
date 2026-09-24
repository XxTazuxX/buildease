import { useNavigate } from "react-router-dom";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as client from "@/shared/api/client";
import { getProfile, changePassword, type Profile } from "../model/auth";
interface ImpersonationTokens {
  accessToken: string;
  refreshToken: string;
  targetEmail: string;
  targetDisplayName: string;
}
interface Auth {
  profile: Profile | null;
  ready: boolean;
  mustChange: boolean;
  impersonating: boolean;
  impersonationTarget: { email: string; displayName: string } | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  change: (old: string, next: string) => Promise<void>;
  reload: () => Promise<void>;
  startImpersonation: (tokens: ImpersonationTokens) => Promise<void>;
  exitImpersonation: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [impersonationTarget, setImpersonationTarget] = useState<{
    email: string;
    displayName: string;
  } | null>(null);
  const adminProfile = useRef<Profile | null>(null);
  const query = useQueryClient();
  const navigate = useNavigate();
  const reset = () => {
    setProfile(null);
    setMustChange(false);
    client.clearToken();
    query.clear();
  };
  const load = async () => {
    setProfile(await getProfile());
  };
  useEffect(() => {
    let active = true;
    client.setUnauthorized(() => {
      if (active) {
        setProfile(null);
        setMustChange(false);
        query.clear();
      }
    });
    void client
      .refresh()
      .then(async (tokens) => {
        if (!active) return;
        setMustChange(tokens.mustChangePassword);
        if (!tokens.mustChangePassword) {
          const p = await getProfile();
          if (active) setProfile(p);
        }
      })
      .catch(() => {
        client.clearToken();
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [query]);
  const signIn = async (email: string, password: string) => {
    const tokens = await client.login(email, password);
    query.clear();
    setMustChange(tokens.mustChangePassword);
    if (!tokens.mustChangePassword) await load();
    navigate("/");
  };
  const signOut = async () => {
    try {
      await client.logout();
    } finally {
      reset();
    }
  };
  const change = async (old: string, next: string) => {
    await changePassword(old, next);
    reset();
    navigate("/");
  };
  const startImpersonation = async (tokens: ImpersonationTokens) => {
    adminProfile.current = profile;
    client.beginImpersonation({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    query.clear();
    await load();
    setImpersonationTarget({
      email: tokens.targetEmail,
      displayName: tokens.targetDisplayName,
    });
    navigate("/");
  };
  const exitImpersonation = async () => {
    await client.exitImpersonation();
    setProfile(adminProfile.current);
    adminProfile.current = null;
    setImpersonationTarget(null);
    query.clear();
    navigate("/admin");
  };
  return (
    <Context.Provider
      value={{
        profile,
        ready,
        mustChange,
        impersonating: impersonationTarget !== null,
        impersonationTarget,
        signIn,
        signOut,
        change,
        reload: load,
        startImpersonation,
        exitImpersonation,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider required");
  return auth;
}
