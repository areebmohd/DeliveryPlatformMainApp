import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { useCart } from '../../context/CartContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';
import { getOfferDescription, getOfferConditionList, getTheme } from '../../utils/offerUtils';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Geolocation from '@react-native-community/geolocation';
import { notificationService } from '../../utils/notificationService';

const { width, height } = Dimensions.get('window');

export const CartScreen = ({ navigation }: any) => {
  const { items, updateQuantity, subtotal, totalItems, clearCart, sessionAddress, setSessionAddress, appliedOffers, setAppliedOffers } = useCart();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [tempLocation, setTempLocation] = useState<any>(null);
  const [infoModal, setInfoModal] = useState<{ visible: boolean, title: string, content: string }>({
    visible: false,
    title: '',
    content: ''
  });

  const [paymentMethod] = useState<'pay_on_delivery'>('pay_on_delivery');
  const insets = useSafeAreaInsets();

  const { showAlert, showToast } = useAlert();

  const [distance, setDistance] = useState(0);
  const [isLargeVehicle, setIsLargeVehicle] = useState(false);
  const [hasHelper, setHasHelper] = useState(false);
  const [isOffersModalVisible, setIsOffersModalVisible] = useState(false);
  const [activeStoreOffers, setActiveStoreOffers] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [isAutoApplyInProgress, setIsAutoApplyInProgress] = useState(false);
  const [lastAutoAppliedId, setLastAutoAppliedId] = useState<string | null>(null);
  const [storeDistances, setStoreDistances] = useState<Record<string, number>>({});
  const [manuallyRemovedStores, setManuallyRemovedStores] = useState<string[]>([]);
  const [storeDeliveryFees, setStoreDeliveryFees] = useState<Record<string, number>>({});
  const [totalStoreFees, setTotalStoreFees] = useState(0);
  const [offerProductNames, setOfferProductNames] = useState<Record<string, string>>({});

  // Background fetch for reward product details (if missing)
  useEffect(() => {
    const fetchRewardDetails = async () => {
      const updatedOffers = { ...appliedOffers };
      let changed = false;

      for (const [storeId, offer] of Object.entries(appliedOffers)) {
        if (offer.type === 'free_product') {
          const rewardData = (offer.reward_data as any) || {};
          const productId = rewardData.product_ids?.[0];

          if (productId && (!rewardData.product_name || !rewardData.product_price)) {
            try {
              const { data: product, error } = await supabase
                .from('products')
                .select('name, price')
                .eq('id', productId)
                .single();

              if (!error && product) {
                updatedOffers[storeId] = {
                  ...offer,
                  reward_data: {
                    ...rewardData,
                    product_name: product.name,
                    product_price: product.price,
                  }
                };
                changed = true;
              }
            } catch (e) {
              console.error('Error fetching reward product details:', e);
            }
          }
        }
      }

      if (changed) {
        setAppliedOffers(updatedOffers);
      }
    };

    if (Object.keys(appliedOffers).length > 0) {
      fetchRewardDetails();
    }
  }, [appliedOffers]);

  // Sync manuallyRemovedStores with cart items
  useEffect(() => {
    const storesInCart = [...new Set(items.map(i => i.store_id))];
    const stillInCart = manuallyRemovedStores.filter(id => storesInCart.includes(id));
    if (stillInCart.length !== manuallyRemovedStores.length) {
      setManuallyRemovedStores(stillInCart);
    }
  }, [items.length]);

  // Distance helper
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getCoordinates = (location: any) => {
    if (!location) return null;
    if (typeof location === 'string') {
      const match = location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/i);
      if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
    }
    if (typeof location === 'object' && location.coordinates) {
      return { lng: location.coordinates[0], lat: location.coordinates[1] };
    }
    return null;
  };

  const fetchStoreOffers = async (storeId: string) => {
    try {
      setModalLoading(true);
      setSelectedStoreId(storeId);
      setIsOffersModalVisible(true);

      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          store:stores(name, location)
        `)
        .eq('store_id', storeId)
        .eq('status', 'active');

      if (error) throw error;
      
      const formatted = (data || []).map((o: any) => ({
        ...o,
        store_name: o.store?.name,
        store_location: o.store?.location
      }));
      
      setActiveStoreOffers(formatted);

      // Extract all product IDs needed for names
      const productIds = new Set<string>();
      (data || []).forEach((o: any) => {
        if (o.conditions?.product_ids) {
          o.conditions.product_ids.forEach((id: string) => productIds.add(id));
        }
        if (o.reward_data?.product_ids) {
          o.reward_data.product_ids.forEach((id: string) => productIds.add(id));
        }
      });

      if (productIds.size > 0) {
        const { data: pData, error: pError } = await supabase
          .from('products')
          .select('id, name')
          .in('id', Array.from(productIds));
        
        if (!pError && pData) {
          const mapping = { ...offerProductNames };
          pData.forEach(p => {
            mapping[p.id] = p.name;
          });
          setOfferProductNames(mapping);
        }
      }
    } catch (e) {
      console.error('Error fetching store offers:', e);
      showAlert({ title: 'Error', message: 'Unable to load offers for this store.', type: 'error' });
    } finally {
      setModalLoading(false);
    }
  };

  const navigateToStore = async (storeId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores_view')
        .select('*')
        .eq('id', storeId)
        .single();
      
      if (error) throw error;
      if (data) {
        navigation.navigate('StoreDetails', { store: data });
      }
    } catch (e) {
      console.error('Error navigating to store:', e);
      showAlert({ title: 'Error', message: 'Unable to open store details.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const checkOfferConditions = (offer: any) => {
    const { conditions } = offer;
    const errors: string[] = [];

    // Store specific subtotal check
    const storeItems = items.filter(i => i.store_id === offer.store_id);
    const storeSubtotal = storeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    if (conditions.min_price && storeSubtotal < conditions.min_price) {
      errors.push(`Minimum order ₹${conditions.min_price} required from ${offer.store_name || 'this store'}. (Current subtotal: ₹${storeSubtotal.toFixed(2)})`);
    }

    if (conditions.max_distance) {
      const userCoords = getCoordinates(profile?.location);
      const storeCoords = getCoordinates(offer.store_location);
      if (userCoords && storeCoords) {
        const dist = calculateDistance(userCoords.lat, userCoords.lng, storeCoords.lat, storeCoords.lng);
        if (dist > conditions.max_distance) {
          errors.push(`Maximum distance: ${conditions.max_distance}km. (Your location is ${dist.toFixed(1)}km from store)`);
        }
      }
    }

    if (conditions.start_time && conditions.end_time) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const parseTimeToMinutes = (timeStr: string) => {
        const [time, period] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const startMin = parseTimeToMinutes(conditions.start_time);
      const endMin = parseTimeToMinutes(conditions.end_time);

      if (currentMinutes < startMin || currentMinutes > endMin) {
        errors.push(`Offer valid only between ${conditions.start_time} and ${conditions.end_time}. (Current time: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`);
      }
    }

    if (conditions.product_ids && conditions.product_ids.length > 0) {
      const missingIds = conditions.product_ids.filter((pid: string) => 
        !items.some(item => item.id === pid)
      );
      if (missingIds.length > 0) {
        const missingNames = missingIds.map((id: string) => offerProductNames[id] || 'Unknown Product').join(', ');
        errors.push(`Required products missing from cart: ${missingNames}`);
      }
    }

    if (conditions.applicable_orders && profile?.order_count !== undefined) {
      const orderCount = profile.order_count || 0;
      if (conditions.applicable_orders === 'first' && orderCount > 0) {
        errors.push('Offer is only valid for your first order.');
      } else if (typeof conditions.applicable_orders === 'number' && orderCount >= conditions.applicable_orders) {
        errors.push(`Offer is only for first ${conditions.applicable_orders} orders. (Your orders: ${orderCount})`);
      }
    }

    return errors;
  };

  const autoApplyBestOffer = async () => {
    if (isAutoApplyInProgress || items.length === 0) return;

    try {
      setIsAutoApplyInProgress(true);
      const storesInCart = [...new Set(items.map(i => i.store_id))];
      if (storesInCart.length === 0) return;

      const newAppliedOffers = { ...appliedOffers };
      let appliedCount = 0;

      for (const storeId of storesInCart) {
        if (manuallyRemovedStores.includes(storeId)) continue;
        
        const standardKey = storeId as string;
        const deliveryKey = `${storeId}_delivery`;
        
        const { data, error } = await supabase
          .from('offers')
          .select(`
            *,
            store:stores(name, location)
          `)
          .eq('store_id', storeId)
          .eq('status', 'active');

        if (error || !data || data.length === 0) continue;

        const validOffers = data.filter(o => {
          const formattedOffer = {
            ...o,
            store_location: o.store?.location,
            store_name: o.store?.name
          };
          return checkOfferConditions(formattedOffer).length === 0;
        });

        if (validOffers.length === 0) {
          // If a previously auto-applied offer became invalid, we should remove it? 
          // Actually, let's keep it for now unless it causes bugs. 
          // But to be clean, if it was auto-applied, we should clear it if no longer valid.
          continue;
        }

        // Separate and Rank
        const standardOffers = validOffers.filter(o => o.type !== 'free_delivery').sort((a, b) => {
          const typeOrder = { free_cash: 0, discount: 1 };
          const aOrder = (typeOrder as any)[a.type] ?? 99;
          const bOrder = (typeOrder as any)[b.type] ?? 99;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (b.amount || 0) - (a.amount || 0);
        });

        const deliveryOffers = validOffers.filter(o => o.type === 'free_delivery');

        // Apply best standard if changed
        if (standardOffers.length > 0) {
          const best = standardOffers[0];
          const current = newAppliedOffers[standardKey];
          if (!current) {
            newAppliedOffers[standardKey] = {
              ...best,
              store_name: best.store?.name,
              store_location: best.store?.location
            };
            appliedCount++;
          }
        }

        // Apply best delivery if changed
        if (deliveryOffers.length > 0) {
          const best = deliveryOffers[0];
          const current = newAppliedOffers[deliveryKey];
          if (!current) {
            newAppliedOffers[deliveryKey] = {
              ...best,
              store_name: best.store?.name,
              store_location: best.store?.location
            };
            appliedCount++;
          }
        }
      }

      if (appliedCount > 0) {
        setAppliedOffers(newAppliedOffers);
        showToast(`${appliedCount} offer(s) applied automatically!`, 'success');
      }
    } catch (e) {
      console.error('Auto-apply error:', e);
    } finally {
      setIsAutoApplyInProgress(false);
    }
  };

  const handleApplyOffer = (offer: any) => {
    const errors = checkOfferConditions(offer);
    if (errors.length > 0) {
      showAlert({
        title: 'Conditions Not Met',
        message: errors.join('\n'),
        type: 'warning'
      });
      return;
    }

    const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
    setAppliedOffers({
      ...appliedOffers,
      [offerKey]: offer
    });
    setIsOffersModalVisible(false);
    showToast('Offer applied successfully!', 'success');
  };

  const renderConditionLine = (offer: any) => {
    const list = getOfferConditionList(offer);
    const maxVisible = 3;
    const hasMore = list.length > maxVisible;
    const visibleList = hasMore ? list.slice(0, maxVisible - 1) : list;

    return (
      <View style={styles.conditionsLine}>
        <View style={{ flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' }}>
          {visibleList.map((c, i) => (
            <View key={i} style={styles.offerTabCondPill}>
              <Text style={styles.offerTabCondText} numberOfLines={1}>{c}</Text>
            </View>
          ))}
          {hasMore && (
            <TouchableOpacity 
              style={styles.offerTabCondPill} 
              onPress={() => {
                showAlert({
                  title: 'Offer Conditions',
                  message: list.map(c => `• ${c}`).join('\n\n'),
                  type: 'info'
                });
              }}
            >
              <Text style={styles.offerTabCondText}>+ More</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const getOfferColor = (type: string) => {
    switch(type) {
      case 'free_delivery': return '#E0F2FE';
      case 'free_cash': return '#DCFCE7';
      case 'discount': return '#FEF3C7';
      case 'fixed_price': return '#CFFAFE';
      default: return '#F3F4F6';
    }
  };

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
    
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) {
        fetchAddresses();
      }
    });

    return unsubscribe;
  }, [user, navigation]);

  useEffect(() => {
    if (items.length > 0) {
      const timer = setTimeout(() => {
        autoApplyBestOffer();
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [items.length, subtotal, appliedOffers]);


  const fetchAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('addresses_view')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_deleted', false)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setSavedAddresses(data || []);
      if (data && data.length > 0 && !selectedAddress) {
        setSelectedAddress(data[0]);
      }
    } catch (e) {
      console.error('Error fetching addresses:', e);
    }
  };

  const calculateFees = async () => {
    if (items.length === 0 || (!selectedAddress && !sessionAddress)) {
      setDistance(0);
      setIsLargeVehicle(false);
      return;
    }

    try {
      let totalWeight = 0;
      let oversized = false;
      let forcedLarge = false;

      items.forEach(item => {
        totalWeight += (item.weight_kg || 0) * item.quantity;
        if (item.length_cm > 40 || item.width_cm > 40 || item.height_cm > 40) {
          oversized = true;
        }
        if (item.needs_large_vehicle) {
          forcedLarge = true;
        }
      });

      const needsLarge = totalWeight > 20 || oversized || forcedLarge;
      setIsLargeVehicle(needsLarge);
      if (!needsLarge) setHasHelper(false);

      const userLocObj = sessionAddress || selectedAddress;
      if (!userLocObj) return;
      
      const userLocWkt = userLocObj.location_wkt || userLocObj.location; 
      if (!userLocWkt) return;

      const userMatch = userLocWkt.match(/POINT\(([-\d.]+) ([-\d.]+)\)/i);
      if (!userMatch) return;
      const uLng = parseFloat(userMatch[1]);
      const uLat = parseFloat(userMatch[2]);

      const uniqueStores = Array.from(new Map(items.map(item => [item.store_id, { lat: item.store_lat, lng: item.store_lng }])).entries());
      
      if (uniqueStores.length === 0) return;

      const storesWithUserDist = uniqueStores.map(([id, loc]) => ({
        id,
        lat: loc.lat,
        lng: loc.lng,
        distToUser: calculateDistance(loc.lat, loc.lng, uLat, uLng)
      }));

      storesWithUserDist.sort((a, b) => b.distToUser - a.distToUser);

      let totalRouteDist = 0;
      for (let i = 0; i < storesWithUserDist.length; i++) {
        if (i === storesWithUserDist.length - 1) {
          totalRouteDist += storesWithUserDist[i].distToUser;
        } else {
          const distBetween = calculateDistance(
            storesWithUserDist[i].lat, storesWithUserDist[i].lng,
            storesWithUserDist[i+1].lat, storesWithUserDist[i+1].lng
          );
          totalRouteDist += distBetween;
        }
      }

      const distancesMap: Record<string, number> = {};
      storesWithUserDist.forEach(s => {
        distancesMap[s.id] = s.distToUser;
      });
      setStoreDistances(distancesMap);
      setDistance(totalRouteDist);

    } catch (e) {
      console.error('Error calculating fees:', e);
    }
  };

  useEffect(() => {
    calculateFees();
    validateAppliedOffers();
  }, [items, selectedAddress, sessionAddress]);

  const validateAppliedOffers = () => {
    if (Object.keys(appliedOffers).length === 0) return;

    const newOffers = { ...appliedOffers };
    let changed = false;

    Object.entries(newOffers).forEach(([offerKey, offer]) => {
      const storeId = offer.store_id;
      // 1. Min Price check (on store specific subtotal)
      const storeItems = items.filter(i => i.store_id === storeId);
      const storeSubtotal = storeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      if (offer.conditions.min_price && storeSubtotal < offer.conditions.min_price) {
        delete newOffers[offerKey];
        changed = true;
        showToast(`Offer for ${offer.store_name} removed: Subtotal too low.`, 'info');
        return;
      }

      // 2. Existence check
      if (storeItems.length === 0) {
        delete newOffers[offerKey];
        changed = true;
        return;
      }

      // 3. Product check
      if (offer.conditions.product_ids && offer.conditions.product_ids.length > 0) {
        const allPresent = offer.conditions.product_ids.every((pid: string) => 
          items.some(item => item.id === pid)
        );
        if (!allPresent) {
          delete newOffers[offerKey];
          changed = true;
          showToast(`Offer removed: All required products must be in cart.`, 'info');
        }
      }
    });

    if (changed) {
      setAppliedOffers(newOffers);
    }
  };

  const platformFee = subtotal >= 1000 ? 20 : (subtotal >= 500 ? 10 : 5);
  const baseDeliveryFee = items.length === 0 ? 0 : (
    isLargeVehicle 
      ? 300 + (distance * 30)
      : 10 + (distance * 5)
  );
  const helperFee = hasHelper ? 400 : 0;
  const baseGrandTotal = subtotal + baseDeliveryFee + platformFee + helperFee;

  let deliveryFee = baseDeliveryFee;
  let totalOfferDiscount = 0;
  let storeContributions: Record<string, number> = {};
  let totalStoreContribution = 0;

  Object.values(appliedOffers).forEach(offer => {
    let offerDiscount = 0;
    if (offer.type === 'free_delivery') {
      const dist = storeDistances[offer.store_id] || 0;
      const storeFee = isLargeVehicle 
        ? 300 + (dist * 30)
        : 10 + (dist * 5);
      
      storeContributions[offer.store_id] = storeFee;
      totalStoreContribution += storeFee;
    } else if (offer.type === 'free_cash') {
      offerDiscount = offer.amount;
    } else if (offer.type === 'discount') {
      const storeItems = items.filter(i => i.store_id === offer.store_id);
      const storeSubtotal = storeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      offerDiscount = (storeSubtotal * offer.amount) / 100;
    } else if (offer.type === 'cheap_product') {
      const eligibleItems = items.filter(item => offer.conditions.product_ids?.includes(item.id));
      const eligibleSubtotal = eligibleItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      offerDiscount = (eligibleSubtotal * offer.amount) / 100;
    } else if (offer.type === 'combo') {
      const comboItems = items.filter(item => offer.reward_data?.product_ids?.includes(item.id));
      const comboSubtotal = comboItems.reduce((sum, i) => sum + i.price, 0);
      offerDiscount = Math.max(0, comboSubtotal - offer.amount);
    } else if (offer.type === 'fixed_price') {
      const eligibleItems = items.filter(item => offer.reward_data?.product_ids?.includes(item.id));
      offerDiscount = eligibleItems.reduce((sum, item) => {
        const diff = item.price - offer.amount;
        return sum + (diff > 0 ? diff * item.quantity : 0);
      }, 0);
    }
    totalOfferDiscount += offerDiscount;
  });

  deliveryFee = Math.max(0, baseDeliveryFee - totalStoreContribution);

  // Sync state for use in checkout
  useEffect(() => {
    setStoreDeliveryFees(storeContributions);
    setTotalStoreFees(totalStoreContribution);
  }, [JSON.stringify(storeContributions), totalStoreContribution]);

  const grandTotal = Math.max(0, subtotal + deliveryFee + platformFee + helperFee - totalOfferDiscount);

  const handleCheckout = async () => {
    if (items.length === 0) return;

    try {
      setLoading(true);
      const storesInCart = [...new Set(items.map(i => i.store_id))];
      
      for (const stId of storesInCart) {
        const { data: store, error: storeError } = await supabase
          .from('stores_view')
          .select('is_currently_open, opening_hours, name')
          .eq('id', stId)
          .single();
        
        if (storeError) throw storeError;

        if (!store.is_currently_open) {
          setLoading(false);
          showAlert({
            title: 'Store Unavailable',
            message: `${store.name} is currently not accepting online orders.`,
            type: 'error'
          });
          return;
        }

        if (store.opening_hours) {
          try {
            const slots = JSON.parse(store.opening_hours);
            if (Array.isArray(slots) && slots.length > 0) {
              const now = new Date();
              const currentTotalMins = now.getHours() * 60 + now.getMinutes();

              const timeToMinutes = (timeStr: string) => {
                const [time, period] = timeStr.split(' ');
                let [h, m] = time.split(':').map(Number);
                if (period === 'PM' && h !== 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
                return h * 60 + m;
              };

              const isOpen = slots.some(slot => {
                const startMins = timeToMinutes(slot.start);
                const endMins = timeToMinutes(slot.end);
                if (endMins < startMins) return currentTotalMins >= startMins || currentTotalMins <= endMins;
                return currentTotalMins >= startMins && currentTotalMins <= endMins;
              });

              if (!isOpen) {
                setLoading(false);
                showAlert({
                  title: 'Store Closed',
                  message: `${store.name} is currently closed.`,
                  type: 'warning'
                });
                return;
              }
            }
          } catch (e) {}
        }
      }
      
      setLoading(false);

      if (!profile?.full_name || !profile?.phone || !profile?.upi_id) {
        setLoading(false);
        showAlert({
          title: 'Profile Incomplete',
          message: 'Please fill your User Info (Name, Phone, and UPI ID) in the Account page before placing an order.',
          type: 'warning',
          primaryAction: {
            text: 'Go to Account',
            onPress: () => navigation.navigate('Account'),
          },
          showCancel: true,
          cancelText: 'Maybe Later'
        });
        return;
      }

      if (!selectedAddress && !sessionAddress) {
        showAlert({ title: 'Address Required', message: 'Please select a delivery address', type: 'warning' });
        return;
      }

      showAlert({
        title: 'Place Order?',
        message: `Are you sure you want to place this order for ₹${grandTotal.toFixed(2)}?`,
        type: 'info',
        primaryAction: {
          text: 'Place',
          onPress: () => processOrder(),
        }
      });
    } catch (e: any) {
      setLoading(false);
      showAlert({ title: 'Error', message: 'Unable to verify store availability. Please try again.', type: 'error' });
      console.error('Checkout validation error:', e);
    }
  };

  const finalizeOrderCreation = async (payment_status: string, utr_number: string | null = null, reservedOrderNumber: string | null = null) => {
    try {
      setLoading(true);

      let finalAddressId = selectedAddress?.id;
      if (sessionAddress) {
        const { data: tempAddr, error: addrError } = await supabase
          .from('addresses')
          .insert({
            user_id: user?.id,
            address_line: sessionAddress.address_line,
            city: sessionAddress.city,
            state: sessionAddress.state,
            pincode: '',
            location: sessionAddress.location,
            label: sessionAddress.label,
            is_deleted: true
          })
          .select()
          .single();
        if (addrError) throw addrError;
        finalAddressId = tempAddr.id;
      }
      
      const storesInCart = [...new Set(items.map(i => i.store_id))];
      const isMultiStore = storesInCart.length > 1;
      const maxPrepTime = Math.max(0, ...items.map(i => i.preparation_time || 0));
      const readyAt = maxPrepTime > 0 ? new Date(Date.now() + maxPrepTime * 60000).toISOString() : null;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user?.id,
          store_id: isMultiStore ? null : storesInCart[0],
          delivery_address_id: finalAddressId,
          subtotal: subtotal,
          total_amount: grandTotal, 
          delivery_fee: deliveryFee,
          rider_delivery_fee: baseDeliveryFee,
          platform_fee: platformFee,
          status: 'waiting_for_pickup',
          payment_method: paymentMethod,
          payment_status: payment_status,
          utr_number: utr_number,
          order_number: reservedOrderNumber, // Use reserved ID if provided
          transport_type: isLargeVehicle ? 'heavy' : 'standard',
          total_weight_kg: items.reduce((sum, i) => sum + (i.weight_kg * i.quantity), 0),
          has_helper: hasHelper,
          helper_fee: helperFee,
          applied_offers: appliedOffers,
          total_store_delivery_fees: totalStoreFees,
          store_delivery_fees: storeDeliveryFees,
          ready_at: readyAt
        })
        .select()
        .single();

      if (orderError) throw orderError;
      await postOrderActions(order);
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const postOrderActions = async (order: any) => {
    try {
      const storesInCart = [...new Set(items.map(i => i.store_id))];
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_price: item.price,
        quantity: item.quantity,
        selected_options: item.selected_options || {}
      }));

      Object.entries(appliedOffers).forEach(([_, offer]: [string, any]) => {
        if (offer.type === 'free_product' && checkOfferConditions(offer).length === 0) {
          orderItems.push({
            order_id: order.id,
            product_id: offer.reward_data?.product_ids?.[0] || 'GIFT',
            product_name: offer.reward_data?.product_name || 'Gift Item',
            product_price: 0,
            quantity: 1,
            selected_options: { gift: 'true' }
          });
        }
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      if (itemsError) throw itemsError;

      const appliedOfferIds = Object.values(appliedOffers as Record<string, any>).map(o => o.id).filter(Boolean);
      if (appliedOfferIds.length > 0) {
        await Promise.all(appliedOfferIds.map(oid => supabase.rpc('increment_offer_used_count', { offer_id: oid })));
      }

      clearCart();
      navigation.navigate('Account', { screen: 'CustomerOrders' });
      showToast('Order placed successfully!', 'success');
    } catch (e: any) {
      console.error('Post-order action error:', e);
      throw e;
    }
  };

  const processOrder = async () => {
    try {
      finalizeOrderCreation('pending');
    } catch (e: any) {
      setLoading(false);
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    }
  };

  const groupedItems = items.reduce((acc: any, item: any) => {
    if (!acc[item.store_id]) {
      acc[item.store_id] = {
        name: item.store_name,
        items: []
      };
    }
    acc[item.store_id].items.push(item);
    return acc;
  }, {});

  if (items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.emptyContainer}>
          <Icon name="cart-outline" size={80} color={Colors.border} />
          <Text style={styles.emptyTitle}>Cart is empty</Text>
          <Text style={styles.emptySubtitle}>Look around and add some items!</Text>
          <TouchableOpacity 
            style={styles.browseBtn}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.browseBtnText}>Browse Stores</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 150 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Cart</Text>
          <TouchableOpacity 
            style={styles.clearBtn} 
            onPress={() => showAlert({
              title: 'Clear Cart?', 
              message: 'Are you sure you want to remove all items from your cart?', 
              type: 'warning',
              primaryAction: { text: 'Yes, Clear', onPress: clearCart, variant: 'destructive' }
            })}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {Object.entries(groupedItems).map(([storeId, storeData]: [string, any]) => (
          <View key={storeId} style={styles.storeSection}>
            <View style={styles.storeHeader}>
              <TouchableOpacity 
                style={styles.storeHeaderLeft}
                onPress={() => navigateToStore(storeId)}
              >
                <Icon name="storefront-outline" size={20} color={Colors.primary} />
                <Text style={styles.storeName} numberOfLines={1} ellipsizeMode="tail">{storeData.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.viewOffersBtn}
                onPress={() => fetchStoreOffers(storeId)}
              >
                <Text style={styles.viewOffersText}>View Offers</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.storeItemsList}>
              {storeData.items.map((item: any) => {
                const standardOffer = appliedOffers[storeId];
                let discountedPrice = item.price;
                let hasDiscount = false;

                if (standardOffer && checkOfferConditions(standardOffer).length === 0) {
                  const storeItems = items.filter(i => i.store_id === storeId);
                  const storeSubtotal = storeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

                  if (standardOffer.type === 'free_cash') {
                    const discountPercent = standardOffer.amount / storeSubtotal;
                    discountedPrice = item.price * (1 - discountPercent);
                    hasDiscount = true;
                  } else if (standardOffer.type === 'discount') {
                    discountedPrice = item.price * (1 - standardOffer.amount / 100);
                    hasDiscount = true;
                  } else if (standardOffer.type === 'cheap_product') {
                    if (standardOffer.conditions.product_ids?.includes(item.id)) {
                      discountedPrice = item.price * (1 - standardOffer.amount / 100);
                      hasDiscount = true;
                    }
                  } else if (standardOffer.type === 'combo') {
                    if (standardOffer.reward_data?.product_ids?.includes(item.id)) {
                      hasDiscount = true;
                    }
                  } else if (standardOffer.type === 'fixed_price') {
                    if (standardOffer.reward_data?.product_ids?.includes(item.id)) {
                      discountedPrice = standardOffer.amount;
                      hasDiscount = true;
                    }
                  }
                }

                return (
                  <View key={item.id} style={{ marginBottom: Spacing.md }}>
                    <View style={styles.itemCard}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>
                          {item.name}
                          {item.selected_options && Object.keys(item.selected_options).length > 0 && (
                            <Text style={styles.itemOptionsText}>
                              {` (${Object.entries(item.selected_options).map(([k, v]) => k === 'gift' ? 'Gift' : v).join(', ')})`}
                            </Text>
                          )}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {hasDiscount && discountedPrice < item.price ? (
                            <>
                              <Text style={styles.itemPrice}>₹{discountedPrice.toFixed(2)}</Text>
                              <Text style={styles.itemPriceStrikethrough}>₹{item.price}</Text>
                            </>
                          ) : (
                            <Text style={styles.itemPrice}>₹{item.price}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}>
                          <Icon name="minus" size={18} color={Colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.quantity}>{item.quantity}</Text>
                        <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}>
                          <Icon name="plus" size={18} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {item.preparation_time > 0 && (
                      <Text style={styles.prepTimeText}>
                        This product has {item.preparation_time} minutes preparing time so order will be picked up when it is prepared.
                      </Text>
                    )}
                  </View>
                );
              })}

              {/* Free Product Reward */}
              {(() => {
                const offer = appliedOffers[storeId];
                if (offer?.type === 'free_product' && checkOfferConditions(offer).length === 0) {
                  return (
                    <View style={[styles.itemCard, styles.freeItemCard, { marginBottom: Spacing.md }]}>
                      {(() => {
                        const rewardId = (offer.reward_data as any)?.product_ids?.[0];
                        const manualItem = storeData.items.find((i: any) => i.id === rewardId);
                        const pName = (offer.reward_data as any)?.product_name || manualItem?.name || 'Gift Item';
                        const pPrice = (offer.reward_data as any)?.product_price || manualItem?.price;

                        return (
                          <>
                            <View style={styles.itemInfo}>
                              <Text style={styles.itemName} numberOfLines={1}>
                                {pName}
                              </Text>
                              {pPrice && (
                                <Text style={[styles.itemPriceStrikethrough, { marginTop: 2 }]}>₹{pPrice}</Text>
                              )}
                            </View>
                            <View style={[styles.freeBadge, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                              <Icon name="gift" size={14} color={Colors.white} />
                              <Text style={styles.freeBadgeText}>Free</Text>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  );
                }
                return null;
              })()}
            </View>

            {/* Applied Offers for this store */}
            {(() => {
              const standardKey = storeId;
              const deliveryKey = `${storeId}_delivery`;
              const offers = [appliedOffers[standardKey], appliedOffers[deliveryKey]].filter(Boolean);

              if (offers.length === 0) return null;

              return (
                <View style={styles.storeAppliedOffers}>
                  {offers.map((offer: any) => (
                    <View key={offer.id} style={styles.storeOfferTag}>
                      <View style={styles.storeOfferIcon}>
                        <Icon name={offer.type === 'free_delivery' ? "truck-fast" : "tag-heart"} size={16} color={offer.type === 'free_delivery' ? Colors.primary : "#059669"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.storeOfferName}>
                          {offer.name || 'Special Offer'}
                        </Text>
                        <Text style={styles.storeOfferDesc}>
                          {(() => {
                            const getNames = (ids?: string[]) => {
                              if (!ids || ids.length === 0) return '';
                              const names = ids.map(id => offerProductNames[id]).filter(Boolean);
                              return names.join(', ');
                            };
                            const resolvedName = getNames(offer.reward_data?.product_ids || offer.conditions?.product_ids);
                            return getOfferDescription(offer, resolvedName);
                          })()}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => {
                          const newOffers = { ...appliedOffers };
                          const key = offer.type === 'free_delivery' ? deliveryKey : standardKey;
                          delete newOffers[key];
                          setAppliedOffers(newOffers);
                          // Stop auto-apply for this store in this session
                          if (!manuallyRemovedStores.includes(storeId)) {
                            setManuallyRemovedStores(prev => [...prev, storeId]);
                          }
                        }} 
                        style={styles.storeOfferRemove}
                      >
                        <Icon name="close-circle" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        ))}

        <View style={styles.addressSection}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <TouchableOpacity 
            style={styles.addressBox} 
            onPress={() => setAddressModalVisible(true)}
          >
            <Icon 
              name={sessionAddress ? "crosshairs-gps" : (selectedAddress?.label.toLowerCase().includes('home') ? 'home-outline' : 'map-marker-outline')} 
              size={24} 
              color={Colors.primary} 
            />
            <View style={styles.addressInfo}>
              <Text style={styles.addressLabel}>
                {sessionAddress ? sessionAddress.label : (selectedAddress?.label || 'Select Address')}
              </Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {sessionAddress 
                  ? `${sessionAddress.address_line}, ${sessionAddress.city}`
                  : (selectedAddress ? selectedAddress.address_line : 'Where should we deliver?')}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.billDetails}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.billValue}>₹{(subtotal - (Object.values(appliedOffers).reduce((sum, o: any) => {
                if (o.type === 'free_delivery') return sum;
                let d = 0;
                if (o.type === 'free_cash') d = o.amount;
                else if (o.type === 'discount') {
                  const sItems = items.filter(i => i.store_id === o.store_id);
                  d = (sItems.reduce((s, i) => s + (i.price * i.quantity), 0) * o.amount) / 100;
                } else if (o.type === 'cheap_product') {
                  const eItems = items.filter(i => o.conditions.product_ids?.includes(i.id));
                  d = (eItems.reduce((s, i) => s + (i.price * i.quantity), 0) * o.amount) / 100;
                } else if (o.type === 'combo') {
                  const cItems = items.filter(i => o.reward_data?.product_ids?.includes(i.id));
                  d = Math.max(0, cItems.reduce((s, i) => s + i.price, 0) - o.amount);
                } else if (o.type === 'fixed_price') {
                  const fItems = items.filter(i => o.reward_data?.product_ids?.includes(i.id));
                  d = fItems.reduce((s, i) => s + (Math.max(0, i.price - o.amount) * i.quantity), 0);
                }
                return sum + d;
              }, 0))).toFixed(2)}</Text>
              {totalOfferDiscount > 0 && (
                <Text style={styles.originalTotalText}>₹{subtotal.toFixed(2)}</Text>
              )}
            </View>
          </View>

          <View style={styles.billRow}>
            <View style={styles.labelWithInfo}>
              <Text style={styles.billLabel}>Delivery Fee ({isLargeVehicle ? 'Truck' : 'Bike'})</Text>
              <TouchableOpacity onPress={() => setInfoModal({
                visible: true,
                title: 'Delivery Fee',
                content: isLargeVehicle 
                  ? `₹300 pickup fee + ₹30 per km\n(Large Vehicle / Truck)\n\nDistance: ${distance.toFixed(2)} km`
                  : `₹10 pickup fee + ₹5 per km\n(Standard Bike)\n\nDistance: ${distance.toFixed(2)} km`
              })}>
                <Icon name="information-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.billValue}>₹{deliveryFee.toFixed(2)}</Text>
              {totalStoreFees > 0 && deliveryFee < baseDeliveryFee && (
                <Text style={styles.originalTotalText}>₹{baseDeliveryFee.toFixed(2)}</Text>
              )}
            </View>
          </View>
          {totalStoreFees > 0 && deliveryFee > 0 && (
            <Text style={styles.deliveryDisclaimer}>
              This delivery fee is only from store not having Free Delivery offer.
            </Text>
          )}

          {isLargeVehicle && (
            <View style={styles.vehicleAlertContainer}>
              <TouchableOpacity 
                style={[styles.helperToggle, hasHelper && styles.helperToggleActive]}
                onPress={() => setHasHelper(!hasHelper)}
              >
                <View style={styles.helperInfo}>
                  <Text style={styles.helperTitle}>Add Helper (₹400)</Text>
                  <Text style={styles.helperSubtitle}>A professional to help load/unload large items.</Text>
                </View>
                <Icon 
                  name={hasHelper ? "checkbox-marked" : "checkbox-blank-outline"} 
                  size={24} 
                  color={hasHelper ? Colors.primary : Colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          )}

          {hasHelper && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Helper Fee</Text>
              <Text style={styles.billValue}>₹{helperFee.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.billRow}>
            <View style={styles.labelWithInfo}>
              <Text style={styles.billLabel}>Platform Fee</Text>
              <TouchableOpacity onPress={() => setInfoModal({
                visible: true,
                title: 'Platform Fee',
                content: '• Orders below ₹500: ₹5 platform fee\n• Orders below ₹1000: ₹10 platform fee\n• Orders above ₹1000: ₹20 platform fee'
              })}>
                <Icon name="information-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.billValue}>₹{platformFee.toFixed(2)}</Text>
          </View>

          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
              {totalOfferDiscount > 0 && (
                <Text style={styles.originalTotalText}>₹{baseGrandTotal.toFixed(2)}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            <View 
              style={[
                styles.paymentOption, 
                styles.paymentOptionSelected
              ]}
            >
              <View style={styles.paymentOptionHeader}>
                <Icon 
                  name="truck-delivery-outline" 
                  size={24} 
                  color={Colors.primary} 
                />
                <View style={[
                  styles.radioOuter, 
                  styles.radioOuterSelected
                ]}>
                  <View style={styles.radioInner} />
                </View>
              </View>
              <Text style={[
                styles.paymentOptionTitle,
                styles.paymentOptionTitleSelected
              ]}>Pay on Delivery</Text>
              <Text style={styles.paymentOptionSub}>Cash or UPI at your door</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.checkoutInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.checkoutTotal}>₹{grandTotal.toFixed(2)}</Text>
            {(totalOfferDiscount > 0 || totalStoreFees > 0) && (
              <Text style={[styles.originalTotalText, { marginBottom: 0 }]}>₹{baseGrandTotal.toFixed(2)}</Text>
            )}
          </View>
          <Text style={styles.checkoutLabel}>Total Payable</Text>
        </View>
        <Button 
          title="Place Order" 
          onPress={handleCheckout}
          loading={loading}
          style={{ width: 140 }}
        />
      </View>

      <Modal
        visible={addressModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Delivery Address</Text>
              <TouchableOpacity onPress={() => setAddressModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <TouchableOpacity 
                style={styles.modalOption} 
                onPress={() => {
                  setAddressModalVisible(false);
                  navigation.navigate('AddLiveLocation');
                }}
              >
                <Icon name="crosshairs-gps" size={24} color={sessionAddress ? Colors.primary : Colors.primary} />
                <Text style={[styles.modalOptionText, sessionAddress && { color: Colors.primary, fontWeight: '900' }]}>
                  {sessionAddress ? "Live Location Active" : "Live Location"}
                </Text>
                {sessionAddress && <Icon name="check-circle" size={20} color={Colors.primary} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalOption} 
                onPress={() => {
                  setAddressModalVisible(false);
                  navigation.navigate('AddAddress', { fromCart: true }); 
                }}
              >
                <Icon name="plus" size={24} color={Colors.primary} />
                <Text style={styles.modalOptionText}>Add new address</Text>
              </TouchableOpacity>

              <View style={styles.savedAddressesHeader}>
                <Text style={styles.savedAddressesTitle}>Saved Addresses</Text>
              </View>

              {savedAddresses.map((addr) => (
                <TouchableOpacity 
                  key={addr.id} 
                  style={[styles.savedAddressItem, !sessionAddress && selectedAddress?.id === addr.id && styles.selectedAddressItem]}
                  onPress={() => {
                    setSelectedAddress(addr);
                    setSessionAddress(null);
                    setAddressModalVisible(false);
                  }}
                >
                  <Icon 
                    name={addr.label.toLowerCase().includes('home') ? 'home-outline' : 'map-marker-outline'} 
                    size={20} 
                    color={!sessionAddress && selectedAddress?.id === addr.id ? Colors.primary : Colors.textSecondary} 
                  />
                  <View style={styles.savedAddressInfo}>
                    <Text style={styles.savedAddressLabel}>{addr.label}</Text>
                    <Text style={styles.savedAddressText} numberOfLines={1}>{addr.address_line}</Text>
                  </View>
                  {!sessionAddress && selectedAddress?.id === addr.id && (
                    <Icon name="check-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isOffersModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsOffersModalVisible(false)}
      >
        <View style={styles.offerModalOverlay}>
          <View style={styles.offerModalContainer}>
            <View style={styles.offerModalHeader}>
              <Text style={styles.offerModalTitle}>Store Offers</Text>
              <TouchableOpacity onPress={() => setIsOffersModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {modalLoading ? (
              <View style={styles.offerModalContentCenter}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : activeStoreOffers.length === 0 ? (
              <View style={styles.offerModalContentCenter}>
                <Icon name="tag-off-outline" size={48} color={Colors.border} />
                <Text style={styles.emptyModalText}>No active offers from this store.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.offerModalList}>
                {activeStoreOffers.map((offer) => {
                  const theme = getTheme(offer.type);
                  const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
                  const isApplied = appliedOffers[offerKey]?.id === offer.id;
                  const conditionErrors = isApplied ? [] : checkOfferConditions(offer);
                  const canApply = conditionErrors.length === 0;

                  return (
                    <View key={offer.id} style={[styles.modalOfferCard, isApplied && styles.activeModalOfferCard]}>
                      <View style={styles.modalOfferHeader}>
                        <View style={[styles.offerTabBadge, { backgroundColor: theme.bg }]}>
                          <Text style={[styles.offerTabBadgeText, { color: theme.color }]}>
                            {offer.type === 'cheap_product' ? 'PRICE DROP' : offer.type.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                        {isApplied && (
                          <View style={styles.appliedBadge}>
                            <Icon name="check-circle" size={14} color="#059669" />
                            <Text style={styles.appliedBadgeText}>ACTIVE</Text>
                          </View>
                        )}
                      </View>
                      
                      <Text style={styles.offerTabTitle} numberOfLines={1}>{offer.name || 'Special Offer'}</Text>
                      <Text style={styles.offerTabDesc} numberOfLines={2}>
                        {(() => {
                          const getNames = (ids?: string[]) => {
                            if (!ids || ids.length === 0) return '';
                            const names = ids.map(id => offerProductNames[id]).filter(Boolean);
                            if (names.length === 0) return '';
                            return names.join(', ');
                          };
                          const resolvedName = getNames(offer.reward_data?.product_ids || offer.conditions?.product_ids);
                          return getOfferDescription(offer, resolvedName);
                        })()}
                      </Text>

                      {renderConditionLine(offer)}

                      <TouchableOpacity 
                        style={[
                          styles.offerModalSingleBtn, 
                          isApplied && styles.offerModalAppliedBtn,
                          !canApply && !isApplied && styles.offerModalDisabledBtn
                        ]}
                        onPress={() => {
                          if (isApplied) return;
                          if (!canApply) {
                            showAlert({
                              title: 'Conditions Not Met',
                              message: conditionErrors.map(err => `• ${err}`).join('\n\n'),
                              type: 'warning'
                            });
                            return;
                          }
                          handleApplyOffer(offer);
                        }}
                      >
                        <Text style={[
                          styles.offerModalSingleBtnText, 
                          isApplied && styles.offerModalAppliedText,
                          !canApply && !isApplied && styles.offerModalDisabledText
                        ]}>
                          {isApplied ? 'Applied' : canApply ? 'Apply Offer' : 'Conditions Not Met'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={infoModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setInfoModal({ ...infoModal, visible: false })}
      >
        <TouchableOpacity 
          style={styles.centeredModalOverlay} 
          activeOpacity={1} 
          onPress={() => setInfoModal({ ...infoModal, visible: false })}
        >
          <View style={styles.infoModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{infoModal.title}</Text>
              <TouchableOpacity onPress={() => setInfoModal({ ...infoModal, visible: false })}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.infoModalBody}>
              <Text style={styles.infoModalText}>{infoModal.content}</Text>
            </View>
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setInfoModal({ ...infoModal, visible: false })}
            >
              <Text style={styles.modalCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* No local AlertModals needed anymore as they are handled globally */}

      {/* No local AlertModals needed anymore as they are handled globally */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  clearBtn: {
    backgroundColor: '#FFF1F2', // Very light red
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA', // Light red border
  },
  clearText: {
    color: Colors.error,
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  storeSection: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: 8,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  prepTimeText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.primary,
    marginTop: 2,
    marginBottom: 4,
  },
  itemOptionsText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  optionsBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  optionBadge: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  optionBadgeLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '700',
    marginRight: 4,
  },
  optionBadgeValue: {
    fontSize: 10,
    color: Colors.text,
    fontWeight: '800',
  },
  storeItemsList: {
    paddingLeft: Spacing.md,
  },
  itemPrice: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '800',
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 2,
  },
  qtyBtn: {
    padding: 6,
  },
  quantity: {
    paddingHorizontal: 2,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  addressSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  addressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  billDetails: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  billLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  billValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  totalRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.white,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  checkoutInfo: {
    flex: 1,
  },
  checkoutTotal: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  checkoutLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  checkoutBtn: {
    width: '55%',
  },
  paymentSection: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentOption: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  paymentOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '20', // Very subtle tint
  },
  paymentOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  paymentOptionTitleSelected: {
    color: Colors.primary,
  },
  paymentOptionSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  browseBtn: {
    marginTop: 30,
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
  },
  browseBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.8,
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  modalScroll: {
    padding: Spacing.md,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  modalOptionText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  savedAddressesHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  savedAddressesTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  savedAddressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  selectedAddressItem: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  savedAddressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  savedAddressLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  savedAddressText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  receiverModalContent: {
    backgroundColor: Colors.white,
    margin: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: 24,
    elevation: 10,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  modalActionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  vehicleAlertContainer: {
    marginBottom: Spacing.md,
  },
  vehicleAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FED7D7',
    gap: 10,
  },
  helperToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'space-between',
  },
  helperToggleActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  helperInfo: {
    flex: 1,
    marginRight: 10,
  },
  helperTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  helperSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  infoModalCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    width: '90%',
    alignSelf: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  infoModalBody: {
    padding: 24,
  },
  infoModalText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
    fontWeight: '500',
  },
  modalCloseBtn: {
    backgroundColor: Colors.primary,
    margin: 20,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  vehicleAlertText: {
    flex: 1,
    fontSize: 13,
    color: '#C53030',
    fontWeight: '700',
    lineHeight: 18,
  },
  removeOfferText: {
    fontSize: 12,
    color: '#DC2626', 
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  appliedOfferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#10B981',
    width: '100%',
    overflow: 'hidden',
  },
  storeAppliedOffers: {
    marginTop: 3,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  storeOfferTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    gap: 10,
  },
  storeOfferIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeOfferName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  storeOfferDesc: {
    fontSize: 11,
    color: '#166534',
    opacity: 0.8,
    marginTop: 1,
  },
  storeOfferRemove: {
    padding: 2,
  },
  offerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    marginRight: 4,
  },
  removeOfferBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    flexShrink: 0,
  },
  offerTagContent: {
    flex: 1,
    marginRight: 4,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  appliedOfferName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#064E3B',
  },
  storeNameSmall: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '700',
    marginTop: 1,
  },
  deliveryDisclaimer: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: -5,
    marginBottom: 10,
  },
  savingsText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '800',
  },
  freeItemCard: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 4,
    borderStyle: 'dashed',
  },
  freeBadge: {
    backgroundColor: '#DB2777', // Pink/Gift theme
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  freeBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  freeBadgeTextSub: {
    fontSize: 11,
    color: '#DB2777',
    fontWeight: '700',
    marginTop: 1,
  },
  itemPriceStrikethrough: {
    fontSize: 13,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
    marginTop: 2,
    fontWeight: '600',
  },
  billingSection: {
  },
  originalTotalText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
    fontWeight: '600',
    marginBottom: -4,
  },
  storeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  viewOffersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  viewOffersText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  offerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  offerModalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: height * 0.5,
    maxHeight: height * 0.8,
    padding: 20,
  },
  offerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  offerModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  offerModalContentCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyModalText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  offerModalList: {
    paddingVertical: 10,
  },
  modalOfferCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeModalOfferCard: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  modalOfferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  offerTabCondPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  offerTabCondText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '800',
  },
  offerTabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  offerTabBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  offerTabTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  offerTabDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 5,
    fontWeight: '500',
  },
  offerModalSingleBtn: {
    backgroundColor: '#059669', // Modern green
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerModalDisabledBtn: {
    backgroundColor: '#F1F5F9',
  },
  offerModalDisabledText: {
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  offerModalSingleBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  offerModalAppliedBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  offerModalAppliedText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '800',
  },
  conditionsLine: {
    marginBottom: 8,
    height: 28,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  appliedBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
  },
});
