'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { AppContextType } from '../_types';
import { useAppManager } from '../_hooks/useAppManager';

// Create the context with undefined as default
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const appState = useAppManager();
  
  return (
    <AppContext.Provider value={appState}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  
  return context;
}