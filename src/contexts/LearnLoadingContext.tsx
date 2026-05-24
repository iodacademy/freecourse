"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface LearnLoadingContextType {
  contentReady: boolean;
  signalReady: () => void;
}

const LearnLoadingContext = createContext<LearnLoadingContextType>({
  contentReady: false,
  signalReady: () => {},
});

export function useLearnLoading() {
  return useContext(LearnLoadingContext);
}

export function LearnLoadingProvider({ children }: { children: ReactNode }) {
  const [contentReady, setContentReady] = useState(false);
  const signalReady = useCallback(() => setContentReady(true), []);

  return (
    <LearnLoadingContext.Provider value={{ contentReady, signalReady }}>
      {children}
    </LearnLoadingContext.Provider>
  );
}
