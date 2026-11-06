'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@/lib/data';

interface UserContextValue {
  user: User | null;
  login: (u: User) => void;
  signOut: () => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  login: () => {},
  signOut: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('av_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const login = (u: User) => {
    setUser(u);
    localStorage.setItem('av_user', JSON.stringify(u));
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('av_user');
  };

  return (
    <UserContext.Provider value={{ user, login, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
