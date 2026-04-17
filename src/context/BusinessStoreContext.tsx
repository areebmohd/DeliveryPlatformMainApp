import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from './AuthContext';

interface Store {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  [key: string]: any;
}

interface BusinessStoreContextType {
  stores: Store[];
  activeStore: Store | null;
  loading: boolean;
  refreshStores: () => Promise<void>;
  setActiveStore: (store: Store) => void;
}

const BusinessStoreContext = createContext<BusinessStoreContextType | undefined>(undefined);

export const BusinessStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = async () => {
    if (!user?.id || !['business', 'store'].includes(profile?.role)) {
      setStores([]);
      setActiveStore(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores_view')
        .select('*')
        .eq('owner_id', user.id)
        .order('is_active', { ascending: false });

      if (error) throw error;

      setStores(data || []);
      
      // Keep the current active store if it still exists in the list, otherwise pick the first one
      if (data && data.length > 0) {
        if (!activeStore || !data.find(s => s.id === activeStore.id)) {
          setActiveStore(data[0]);
        }
      } else {
        setActiveStore(null);
      }
    } catch (e) {
      console.error('Error fetching stores in context:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, [user?.id, profile?.role]);

  return (
    <BusinessStoreContext.Provider value={{ 
      stores, 
      activeStore, 
      loading, 
      refreshStores: fetchStores, 
      setActiveStore 
    }}>
      {children}
    </BusinessStoreContext.Provider>
  );
};

export const useBusinessStore = () => {
  const context = useContext(BusinessStoreContext);
  if (context === undefined) {
    throw new Error('useBusinessStore must be used within a BusinessStoreProvider');
  }
  return context;
};
