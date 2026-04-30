'use client';

import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react';
import type { Store } from '@/services/api/storesApi';

export type AppTab =
  | 'Dashboard'
  | 'Catering'
  | 'Formulas'
  | 'Audit'
  | 'Stores'
  | 'Equipments'
  | 'Maintenance';

interface AppContextValue {
  activeTab:       AppTab;
  setActiveTab:    (tab: AppTab) => void;
  showNewOrder:    boolean;
  openNewOrder:    (stores: Store[]) => void;
  closeNewOrder:   () => void;
  stores:          Store[];
  setStores:       (stores: Store[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab]     = useState<AppTab>('Dashboard');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [stores, setStores]           = useState<Store[]>([]);

  const openNewOrder = useCallback((storeList: Store[]) => {
    setStores(storeList);
    setShowNewOrder(true);
  }, []);

  const closeNewOrder = useCallback(() => {
    setShowNewOrder(false);
  }, []);

  return (
    <AppContext.Provider value={{
      activeTab,
      setActiveTab,
      showNewOrder,
      openNewOrder,
      closeNewOrder,
      stores,
      setStores,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}