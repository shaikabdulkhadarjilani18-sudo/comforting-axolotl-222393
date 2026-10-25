import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "./api";
import type { Profile } from "./types";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: (afterSignOut?: () => void) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const result = await apiRequest<{ user: AuthUser | null; profile: Profile | null }>("/api/auth/me");
    if (!result.user || !result.profile) {
      setUser(null);
      setProfile(null);
      setProfileError(null);
      return;
    }
    setUser(result.user);
    setProfile(result.profile);
    setProfileError(null);
  }, []);

  const signOut = useCallback(async (afterSignOut?: () => void) => {
    await apiRequest<void>("/api/auth/logout", { method: "POST", body: "{}" });
    afterSignOut?.();
    setUser(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  useEffect(() => {
    let active = true;
    void refreshProfile()
      .catch((error: unknown) => {
        console.error("Could not restore the FarmBridge session.", error);
        if (active) setProfileError("Your account could not be loaded. Check that the FarmBridge server is running.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshProfile]);

  const value = useMemo(
    () => ({ user, profile, loading, profileError, refreshProfile, signOut }),
    [user, profile, loading, profileError, refreshProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
