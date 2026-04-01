import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAlert } from './AlertContext';

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
}

export type OfferType = 'free_cash' | 'discount' | 'free_delivery' | 'free_product' | 'cheap_product' | 'combo';

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
  };
  created_at: string;
  store_name?: string; // Opt-in for display
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: any, store: any) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, delta: number, selectedOptions?: Record<string, string>) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  sessionAddress: any | null;
  setSessionAddress: (address: any | null) => void;
  appliedOffers: Record<string, Offer>;
  setAppliedOffers: (offers: Record<string, Offer>) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [sessionAddress, setSessionAddress] = useState<any | null>(null);
  const [appliedOffers, setAppliedOffers] = useState<Record<string, Offer>>({});
  const { showAlert } = useAlert();

  const addItem = (product: any, store: any) => {
    // 1. Parse store location from WKT
    let storeLat = 0;
    let storeLng = 0;
    if (store.location_wkt) {
      const match = store.location_wkt.match(/POINT\(([-\d.]+) ([-\d.]+)\)/i);
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
                selected_options: product.selectedOptions || {}
              }]);
            }
          }
        });
        return;
      }
    }

    const selectedOptions = product.selectedOptions || {};

    setItems(prev => {
      // 3. Normal Add Logic (Differentiate by ID + Selected Options)
      const existingIdx = prev.findIndex(item => 
        item.id === product.id && 
        JSON.stringify(item.selected_options) === JSON.stringify(selectedOptions)
      );

      if (existingIdx > -1) {
        const newItems = [...prev];
        newItems[existingIdx] = { 
          ...newItems[existingIdx], 
          quantity: newItems[existingIdx].quantity + 1 
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
        selected_options: selectedOptions
      }];
    });
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number, selectedOptions?: Record<string, string>) => {
    setItems(prev => {
      return prev.map(item => {
        const isMatch = item.id === productId && 
          (!selectedOptions || JSON.stringify(item.selected_options) === JSON.stringify(selectedOptions));
        
        if (isMatch) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter((item): item is CartItem => item !== null);
    });
  };

  const clearCart = () => {
    setItems([]);
    setAppliedOffers({});
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ 
      items, 
      addItem, 
      removeItem, 
      updateQuantity, 
      clearCart,
      totalItems,
      subtotal,
      sessionAddress,
      setSessionAddress,
      appliedOffers,
      setAppliedOffers
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
