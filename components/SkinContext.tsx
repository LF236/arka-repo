"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_SKIN,
  SKIN_STORAGE_KEY,
  isSkinId,
  type SkinId,
} from "@/lib/skins";

interface SkinContextValue {
  skin: SkinId;
  setSkin: (id: SkinId) => void;
}

const SkinContext = createContext<SkinContextValue>({
  skin: DEFAULT_SKIN,
  setSkin: () => {},
});

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [skin, setSkinState] = useState<SkinId>(DEFAULT_SKIN);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SKIN_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isSkinId(stored)) setSkinState(stored);
    } catch {}
  }, []);

  const setSkin = (id: SkinId) => {
    setSkinState(id);
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, id);
    } catch {}
  };

  return (
    <SkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </SkinContext.Provider>
  );
}

export function useSkin() {
  return useContext(SkinContext);
}
