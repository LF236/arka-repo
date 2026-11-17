"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";

interface UserContextValue {
  user: User | null;
  loading: boolean; // true hasta resolver la sesión inicial
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function toAppUser(u: SupabaseUser): User {
  const m = u.user_metadata ?? {};
  const email = u.email ?? null;
  const name =
    str(m.username) ??
    str(m.full_name) ??
    str(m.name) ??
    str(m.user_name) ??
    (email ? email.split("@")[0] : null) ??
    "PLAYER";
  return {
    id: u.id,
    name,
    email,
    avatarUrl: str(m.avatar_url) ?? str(m.picture),
  };
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      localStorage.removeItem("av_user");
    } catch {}

    const supabase = createClient();
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user ? toAppUser(data.user) : null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAppUser(session.user) : null);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    setUser(null);
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
