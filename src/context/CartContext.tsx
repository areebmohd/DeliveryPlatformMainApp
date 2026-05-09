import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from './AlertContext';
import { useAuth } from './AuthContext';
import { parseWKT, getHaversineDistance } from '../utils/productUtils';

const STORAGE_KEYS = {
  CART_ITEMS: '@cart_items',
  CART_OFFERS: '@cart_offers',
  CART_ADDRESS: '@cart_address',
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  store_id: string;
  store_name: string;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  needs_large_vehicle: boolean;
  store_lat: number;
  store_lng: number;
  selected_options: Record<string, string>;
  preparation_time: number;
  barcode?: string;
  product_type?: string;
  is_store_specific?: boolean;
  description?: string;
}

export type OfferType = 'free_cash' | 'discount' | 'free_delivery' | 'free_product' | 'cheap_product' | 'combo' | 'fixed_price';

export interface OfferCondition {
  min_price?: number;
  product_ids?: string[];
  max_distance?: number;
  applicable_orders?: number | 'all';
  start_time?: string;
  end_time?: string;
}

export interface Offer {
  id: string;
  name?: string;
  store_id: string;
  type: OfferType;
  status: 'active' | 'inactive';
  amount: number;
  conditions: OfferCondition;
  reward_data?: {
    product_ids?: string[];
    product_name?: string;
  };
  created_at: string;
  store_name?: string; // Opt-in for display
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: any, store: any, isStoreSpecific?: boolean) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (product: any, delta: number, selectedOptions?: Record<string, string>, storeId?: string) => void;
  getQuantity: (product: any, storeId?: string) => number;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  sessionAddress: any | null;
  setSessionAddress: (address: any | null) => void;
  appliedOffers: Record<string, Offer>;
  setAppliedOffers: (offers: Record<string, Offer>) => void;
  setItems: (items: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void;
  clearSessionAddress: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [sessionAddress, setSessionAddress] = useState<any | null>(null);
  const [appliedOffers, setAppliedOffers] = useState<Record<string, Offer>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const { showAlert } = useAlert();
  const { user } = useAuth();

  // Clear data on logout
  useEffect(() => {
    if (isLoaded && !user) {
      clearCart();
      setSessionAddress(null);
    }
  }, [user, isLoaded]);

  // Load cart data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedItems, savedOffers, savedAddress] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.CART_ITEMS),
          AsyncStorage.getItem(STORAGE_KEYS.CART_OFFERS),
          AsyncStorage.getItem(STORAGE_KEYS.CART_ADDRESS),
        ]);

        if (savedItems) setItems(JSON.parse(savedItems));
        if (savedOffers) setAppliedOffers(JSON.parse(savedOffers));
        if (savedAddress) setSessionAddress(JSON.parse(savedAddress));
      } catch (e) {
        console.error('Error loading cart data:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Save cart data to storage on change
  useEffect(() => {
    if (!isLoaded) return; // Prevent overwriting with empty defaults before load

    const saveData = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.CART_ITEMS, JSON.stringify(items)),
          AsyncStorage.setItem(STORAGE_KEYS.CART_OFFERS, JSON.stringify(appliedOffers)),
          AsyncStorage.setItem(STORAGE_KEYS.CART_ADDRESS, JSON.stringify(sessionAddress)),
        ]);
      } catch (e) {
        console.error('Error saving cart data:', e);
      }
    };
    saveData();
  }, [items, appliedOffers, sessionAddress, isLoaded]);

  const addItem = (product: any, store: any, isStoreSpecific: boolean = false) => {
    // 1. Parse store location
    let storeLat = 0;
    let storeLng = 0;
    
    const storeWKT = store.location_wkt || (typeof store.location === 'string' ? store.location : null);
    if (storeWKT) {
      const match = storeWKT.match(/POINT\(([-\d.]+) ([-\d.]+)\)/i);
      if (match) {
        storeLng = parseFloat(match[1]);
        storeLat = parseFloat(match[2]);
      }
    }

    // 2. Vehicle Consistency Check
    const productNeedsLarge = !!product.needs_large_vehicle;
    if (items.length > 0) {
      const cartIsLarge = items[0].needs_large_vehicle;
      if (cartIsLarge !== productNeedsLarge) {
        showAlert({
          title: 'Vehicle Mismatch',
          message: `You cannot mix ${cartIsLarge ? 'Large Vehicle' : 'Bike'} items with ${productNeedsLarge ? 'Large Vehicle' : 'Bike'} items in the same cart.\n\nWould you like to clear your cart to add this item?`,
          type: 'warning',
          showCancel: true,
          primaryAction: {
            text: 'Clear & Add',
            onPress: () => {
              setItems([{
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                store_id: store.id,
                store_name: store.name,
                weight_kg: product.weight_kg || 0,
                length_cm: product.length_cm || 0,
                width_cm: product.width_cm || 0,
                height_cm: product.height_cm || 0,
                needs_large_vehicle: productNeedsLarge,
                store_lat: storeLat,
                store_lng: storeLng,
                selected_options: product.selectedOptions || {},
                preparation_time: product.preparation_time || 0,
                barcode: product.barcode,
                product_type: product.product_type,
                is_store_specific: isStoreSpecific,
                description: product.description
              }]);
            }
          }
        });
        return;
      }
    }

    const selectedOptions = product.selectedOptions || {};

    setItems(prev => {
      // 3. Identification of "Equivalent" product
      const findExistingIdx = () => {
        return prev.findIndex(item => {
          // Exact match (ID + Store + Options)
          return item.id === product.id && 
            item.store_id === store.id &&
            JSON.stringify(item.selected_options) === JSON.stringify(selectedOptions);
        });
      };

      const existingIdx = findExistingIdx();

      if (existingIdx > -1) {
        const existing = prev[existingIdx];
        const newItems = [...prev];
        newItems[existingIdx] = { 
          ...existing, 
          quantity: existing.quantity + (quantity || 1) 
        };
        return newItems;
      }

      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1, 
        store_id: store.id,
        store_name: store.name,
        weight_kg: product.weight_kg || 0,
        length_cm: product.length_cm || 0,
        width_cm: product.width_cm || 0,
        height_cm: product.height_cm || 0,
        needs_large_vehicle: productNeedsLarge,
        store_lat: storeLat,
        store_lng: storeLng,
        selected_options: selectedOptions,
        preparation_time: product.preparation_time || 0,
        barcode: product.barcode,
        product_type: product.product_type,
        is_store_specific: isStoreSpecific,
        description: product.description
      }];
    });
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const getQuantity = (product: any, storeId?: string) => {
    // 1. Exact match (ID + Store + Options)
    const exact = items.find(i => 
      i.id === product.id && 
      (!storeId || i.store_id === storeId)
    );
    if (exact) return exact.quantity;

    return 0;
  };

  const updateQuantity = (productOrId: any, delta: number, selectedOptions?: Record<string, string>, storeId?: string) => {
    setItems(prev => {
      const productId = typeof productOrId === 'string' ? productOrId : productOrId.id;
      const targetStoreId = storeId || (typeof productOrId === 'object' ? productOrId.store_id : undefined);

      // 1. Try to find an exact match first
      const exactIdx = prev.findIndex(item => 
        item.id === productId && 
        (!targetStoreId || item.store_id === targetStoreId) &&
        (!selectedOptions || JSON.stringify(item.selected_options) === JSON.stringify(selectedOptions))
      );

      if (exactIdx > -1) {
        const newItems = [...prev];
        const item = newItems[exactIdx];
        const newQty = item.quantity + delta;
        if (newQty > 0) {
          newItems[exactIdx] = { ...item, quantity: newQty };
        } else {
          newItems.splice(exactIdx, 1);
        }
        return newItems;
      }

      return prev;
    });
  };

  const clearCart = async () => {
    setItems([]);
    setAppliedOffers({});
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CART_ITEMS);
      await AsyncStorage.removeItem(STORAGE_KEYS.CART_OFFERS);
    } catch (e) {
      console.error('Error clearing cart storage:', e);
    }
  };

  const clearSessionAddress = async () => {
    setSessionAddress(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CART_ADDRESS);
    } catch (e) {
      console.error('Error clearing address storage:', e);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ 
      items, 
      addItem, 
      removeItem, 
      updateQuantity, 
      getQuantity,
      clearCart,
      totalItems,
      subtotal,
      sessionAddress,
      setSessionAddress,
      appliedOffers,
      setAppliedOffers,
      setItems,
      clearSessionAddress
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
