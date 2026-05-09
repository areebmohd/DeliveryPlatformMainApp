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
  Dimensions,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCart, Offer, OfferType } from '../../context/CartContext';
import { useAlert } from '../../context/AlertContext';
import { Button } from '../../components/ui/Button';
import { getOfferDescription, getOfferConditionList, validateOffer, getTheme } from '../../utils/offerUtils';
import Geolocation from '@react-native-community/geolocation';

const { width } = Dimensions.get('window');

export const CustomerOffersScreen = ({ navigation }: any) => {
  const [offers, setOffers] = useState<any[]>([]);
  const [groupedOffers, setGroupedOffers] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  
  const { user, profile } = useAuth();
  const { items, subtotal, setAppliedOffers, appliedOffers } = useCart();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const [conditionModal, setConditionModal] = useState<{ visible: boolean; offer: any | null }>({
    visible: false,
    offer: null
  });

  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [favouriteOfferIds, setFavouriteOfferIds] = useState<string[]>([]);

  const filters = [
    { id: 'all', label: 'All', icon: 'auto-fix' },
    { id: 'favourite', label: 'Favourites', icon: 'heart' },
    { id: 'trending', label: 'Trending', icon: 'fire' },
    { id: 'best_value', label: 'Best Value', icon: 'star-circle' },
    { id: 'most_used', label: 'Most Used', icon: 'history' },
    { id: 'most_favourite', label: 'Most Favourite', icon: 'heart-multiple' },
    { id: 'nearby', label: 'Nearby Stores', icon: 'map-marker-radius' },
    { id: 'no_condition', label: 'No Condition', icon: 'tag-off-outline' },
    { id: 'free_cash', label: 'Free Cash', icon: 'cash' },
    { id: 'free_delivery', label: 'Free Delivery', icon: 'truck-delivery' },
    { id: 'free_product', label: 'Free Products', icon: 'gift' },
    { id: 'cheap_product', label: 'Price Drop', icon: 'tag-outline' },
    { id: 'fixed_price', label: 'Fixed Price', icon: 'tag-multiple-outline' },
    { id: 'discount', label: 'Instant Discount', icon: 'percent' },
    { id: 'combo', label: 'Combo', icon: 'layers-outline' },
  ];

  useEffect(() => {
    fetchOffers();
    fetchFavouriteOfferIds();
  }, []);

  const fetchFavouriteOfferIds = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('favourites')
        .select('offer_id')
        .eq('user_id', user.id)
        .not('offer_id', 'is', null);
      
      if (error) throw error;
      setFavouriteOfferIds((data || []).map(f => f.offer_id));
    } catch (e) {
      console.error('Error fetching favorite offers:', e);
    }
  };

  const toggleOfferFavourite = async (offerId: string) => {
    if (!user) {
      showAlert({ title: 'Authentication Required', message: 'Please sign in to favorite offers', type: 'info' });
      return;
    }

    const isFav = favouriteOfferIds.includes(offerId);
    
    try {
      if (isFav) {
        const { error } = await supabase
          .from('favourites')
          .delete()
          .eq('user_id', user.id)
          .eq('offer_id', offerId);
        if (error) throw error;
        setFavouriteOfferIds(prev => prev.filter(id => id !== offerId));
      } else {
        const { error } = await supabase
          .from('favourites')
          .insert({ user_id: user.id, offer_id: offerId });
        if (error) throw error;
        setFavouriteOfferIds(prev => [...prev, offerId]);
      }
    } catch (e) {
      console.error('Error toggling offer favorite:', e);
    }
  };

  const fetchOffers = async () => {
    try {
      setLoading(true);
      
      // Get location for Nearby sort
      Geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Location error:', error),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );

      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          store:stores_view!inner(*)
        `)
        .eq('status', 'active')
        .eq('store.is_approved', true)
        .eq('store.is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Also fetch all products for all stores mentioned in offers to resolve "Product" conditions later
      const storeIds = [...new Set((data || []).map(o => o.store_id))];
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, store_id')
        .in('store_id', storeIds)
        .eq('is_deleted', false);

      setStoreProducts(productsData || []);

      // Fetch all favourites for these offers to count them
      const { data: globalFavs } = await supabase
        .from('favourites')
        .select('offer_id')
        .not('offer_id', 'is', null);

      const favCounts: Record<string, number> = {};
      (globalFavs || []).forEach(f => {
        if (f.offer_id) favCounts[f.offer_id] = (favCounts[f.offer_id] || 0) + 1;
      });

      const formatted = (data || []).map((o: any) => ({
        ...o,
        store_name: o.store?.name || 'Unknown Store',
        store_location: o.store?.location,
        store_full: o.store,
        favourite_count: favCounts[o.id] || 0,
        distance: 0 // Will compute below
      }));

      setOffers(formatted);
    } catch (e: any) {
      console.error('Error fetching offers:', e);
      showAlert({ title: 'Error', message: 'Failed to fetch offers', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getFilteredOffers = () => {
    let result = [...offers];

    // Compute distances if location is available
    if (userLocation) {
      result = result.map(o => {
        const storeCoords = getCoordinates(o.store_location);
        if (storeCoords) {
          const dist = calculateDistance(userLocation.lat, userLocation.lng, storeCoords.lat, storeCoords.lng);
          return { ...o, distance: dist };
        }
        return { ...o, distance: 999 };
      });
    }

    // Apply Filter
    if (activeFilter === 'favourite') {
      result = result.filter(o => favouriteOfferIds.includes(o.id));
    } else if (activeFilter === 'all' || activeFilter === 'nearby') {
      // Grouping handled in render
      if (activeFilter === 'nearby') {
        result.sort((a, b) => a.distance - b.distance);
      }
    } else if (activeFilter === 'trending') {
      // Prioritize newest offers from various stores
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (activeFilter === 'best_value') {
      result.sort((a, b) => {
        const getScore = (o: any) => {
          const amt = Number(o.amount) || 0;
          switch(o.type) {
            case 'free_cash': return amt * 1.5;
            case 'free_product': return amt * 1.3;
            case 'discount': return amt;
            case 'free_delivery': return amt || 50;
            case 'cheap_product': return amt * 1.1;
            case 'fixed_price': return amt * 1.2;
            default: return amt * 0.9;
          }
        };
        return getScore(b) - getScore(a);
      });
    } else if (activeFilter === 'most_used') {
      result.sort((a, b) => (Number(b.used_count) || 0) - (Number(a.used_count) || 0));
    } else if (activeFilter === 'most_favourite') {
      result.sort((a, b) => (Number(b.favourite_count) || 0) - (Number(a.favourite_count) || 0));
    } else if (activeFilter === 'no_condition') {
      result = result.filter(o => {
        const conds = getOfferConditionList(o);
        return conds.length === 1 && conds[0] === 'No Condition';
      });
    } else {
      // Specific type filters
      result = result.filter(o => o.type === activeFilter);
    }

    return result;
  };

  const getGroupedOffers = (filtered: any[]) => {
    const groups: any = {};
    filtered.forEach((offer: any) => {
      if (!groups[offer.store_id]) {
        groups[offer.store_id] = {
          ...offer.store_full,
          id: offer.store_id,
          name: offer.store_name,
          distance: offer.distance,
          offers: []
        };
      }
      groups[offer.store_id].offers.push(offer);
    });
    
    const array = Object.values(groups);
    if (activeFilter === 'nearby') {
      array.sort((a: any, b: any) => a.distance - b.distance);
    }
    return array;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOffers();
  };

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
    
    // Handle WKT string format: POINT(lng lat)
    if (typeof location === 'string') {
      const match = location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/i);
      if (match) {
        return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    }
    
    // Handle GeoJSON object format: { type: 'Point', coordinates: [lng, lat] }
    if (typeof location === 'object' && location.coordinates) {
      return { lng: location.coordinates[0], lat: location.coordinates[1] };
    }
    
    return null;
  };

  const checkConditions = async (offer: Offer) => {
    if (!user) {
      showAlert({ title: 'Login Required', message: 'Please login to use offers.', type: 'info' });
      return;
    }

    const { conditions } = offer;
    const errors: string[] = [];

    // 1. Store Match
    const storeInCart = items.some(item => item.store_id === offer.store_id);
    if (!storeInCart) {
      errors.push(`Please add items from ${offer.store_name} to your cart.`);
    }

    // 2. Min Price (Store Specific)
    const storeItems = items.filter(i => i.store_id === offer.store_id);
    const storeSubtotal = storeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    if (conditions.min_price && storeSubtotal < conditions.min_price) {
      errors.push(`Minimum order from ${offer.store_name} ₹${conditions.min_price} required. (Current: ₹${storeSubtotal.toFixed(2)})`);
    }

    // 3. Distance
    if (conditions.max_distance) {
      const userCoords = getCoordinates(profile?.location);
      const storeCoords = getCoordinates((offer as any).store_location);
      
      if (userCoords && storeCoords) {
        const dist = calculateDistance(userCoords.lat, userCoords.lng, storeCoords.lat, storeCoords.lng);
        if (dist > conditions.max_distance) {
          errors.push(`Store is too far for this offer. Max distance: ${conditions.max_distance}km. (Your distance: ${dist.toFixed(1)}km)`);
        }
      }
    }

    // 4. Time
    if (conditions.start_time && conditions.end_time) {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();

      const parseTime = (t: string) => {
        const [time, period] = t.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };

      const start = parseTime(conditions.start_time);
      const end = parseTime(conditions.end_time);

      if (end < start) {
        if (!(currentMin >= start || currentMin <= end)) {
          errors.push(`This offer is only valid between ${conditions.start_time} and ${conditions.end_time}.`);
        }
      } else {
        if (!(currentMin >= start && currentMin <= end)) {
          errors.push(`This offer is only valid between ${conditions.start_time} and ${conditions.end_time}.`);
        }
      }
    }

    // 5. Order Count
    if (conditions.applicable_orders && conditions.applicable_orders !== 'all') {
      try {
        const { count, error } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', user.id)
          .eq('store_id', offer.store_id)
          .not('status', 'eq', 'cancelled');

        if (!error && count !== null && count >= (conditions.applicable_orders as number)) {
          errors.push(`This offer is only for the first ${conditions.applicable_orders} orders from this store.`);
        }
      } catch (e) {}
    }

    // 6. Specific Products
    if (conditions.product_ids && conditions.product_ids.length > 0) {
      const hasProduct = items.some(item => conditions.product_ids?.includes(item.id));
      if (!hasProduct) {
        errors.push("Your cart doesn't contain the eligible products for this offer.");
      }
    }

    return errors;
  };

  const handleApplyOffer = async (offer: any) => {
    if (!user) {
        showAlert({ title: 'Login Required', message: 'Please login to use offers.', type: 'info' });
        return;
    }

    const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
    const isApplied = appliedOffers[offerKey]?.id === offer.id;

    if (isApplied) {
      const newOffers = { ...appliedOffers };
      delete newOffers[offerKey];
      setAppliedOffers(newOffers);
      return;
    }

    // Comprehensive Validation
    const storeInCart = items.some(item => item.store_id === offer.store_id);
    if (!storeInCart) {
        showAlert({ title: 'Add Items First', message: `Please add items from ${offer.store_name} to your cart to apply this offer.`, type: 'warning' });
        return;
    }

    const storeItems = items.filter(i => i.store_id === offer.store_id);
    const storeSubtotal = storeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    // Check if ALL required products are in cart
    if (offer.conditions.product_ids && offer.conditions.product_ids.length > 0) {
        const allPresent = offer.conditions.product_ids.every((pid: string) => 
            items.some(item => item.id === pid)
        );
        if (!allPresent) {
            showAlert({ 
                title: 'Missing Products', 
                message: `This offer requires all ${offer.conditions.product_ids.length} specific products in your cart. Click "View" to see the list.`, 
                type: 'warning' 
            });
            return;
        }
    }

    const validation = validateOffer(offer, storeSubtotal, offer.distance, profile?.order_count || 0, items);
    
    if (!validation.valid) {
      showAlert({
        title: 'Conditions Not Met',
        message: validation.errors.join('\n\n'),
        type: 'warning'
      });
      return;
    }

    setAppliedOffers({
      ...appliedOffers,
      [offerKey]: offer
    });
    
    showAlert({ title: 'Offer Applied!', message: 'The offer has been applied to your cart.', type: 'success' });
    navigation.navigate('Cart');
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
              onPress={() => setConditionModal({ visible: true, offer })}
            >
              <Text style={styles.offerTabCondText}>+ More</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderOfferCard = (offer: any, isFullWidth: boolean = false) => {
    const theme = getTheme(offer.type);
    const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
    const isApplied = appliedOffers[offerKey]?.id === offer.id;

    return (
      <View key={offer.id} style={[styles.offerCard, { 
        width: isFullWidth ? width - Spacing.md * 2 : width - 80, 
        marginRight: isFullWidth ? 0 : 16 
      }]}>
        <View style={styles.offerTabHeader}>
          <View style={styles.badgeStoreRow}>
            <View style={[styles.offerTabBadge, { backgroundColor: theme.bg }]}>
              <Text style={[styles.offerTabBadgeText, { color: theme.color }]}>
                {offer.type === 'cheap_product' ? 'PRICE DROP' : offer.type.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.offerTabTitle} numberOfLines={1}>{offer.name || 'Special Offer'}</Text>
        <Text style={styles.offerTabDesc} numberOfLines={2}>
          {(() => {
            const getNames = (ids?: string[]) => {
              if (!ids || ids.length === 0) return '';
              const names = ids.map(id => storeProducts.find(p => String(p.id) === String(id))?.name).filter(Boolean);
              if (names.length === 0) return '';
              return names.join(', ');
            };
            const resolvedName = getNames(offer.reward_data?.product_ids);
            return getOfferDescription(offer, resolvedName);
          })()}
        </Text>

        {renderConditionLine(offer)}

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.viewBtn}
            onPress={() => setConditionModal({ visible: true, offer })}
          >
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.applyBtn, isApplied && styles.appliedBtn]}
            onPress={() => handleApplyOffer(offer)}
          >
            <Text style={[styles.applyBtnText, isApplied && styles.appliedBtnText]}>
              {isApplied ? "Remove" : "Apply"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStoreSection = (store: any) => (
    <View key={store.id} style={styles.storeSection}>
      <TouchableOpacity 
        style={styles.storeHeader}
        onPress={() => navigation.navigate('StoreDetails', { store })}
      >
        <Icon name="storefront" size={20} color={Colors.primary} />
        <Text style={styles.storeName}>{store.name}</Text>
        {store.distance > 0 && store.distance < 999 && (
          <Text style={styles.storeDistance}>{store.distance.toFixed(1)}km</Text>
        )}
        <Icon name="chevron-right" size={18} color={Colors.border} />
      </TouchableOpacity>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScrollContent}
        decelerationRate="fast"
      >
        {store.offers.map((o: any) => renderOfferCard(o, store.offers.length === 1))}
      </ScrollView>
    </View>
  );

  const filtered = getFilteredOffers();
  const displayData = getGroupedOffers(filtered);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Store Offers</Text>
        <Text style={styles.disclaimerText}>Only one standard offer is applicable along with a Free Delivery offer from each store in every order.</Text>
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filters.map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                activeFilter === filter.id && styles.activeFilterChip
              ]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Icon 
                name={filter.icon} 
                size={16} 
                color={activeFilter === filter.id ? Colors.white : Colors.textSecondary} 
              />
              <Text style={[
                styles.filterLabel,
                activeFilter === filter.id && styles.activeFilterLabel
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
        ) : displayData.length > 0 ? (
          <View style={styles.offersList}>
            {(displayData as any[]).map(renderStoreSection)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="tag-off-outline" size={80} color={Colors.border} />
            <Text style={styles.emptyTitle}>No Offers Available</Text>
            <Text style={styles.emptySubtitle}>Check back later for new deals and discounts.</Text>
          </View>
        )}
      </ScrollView>

      <Modal 
        visible={conditionModal.visible} 
        transparent 
        animationType="slide"
        onRequestClose={() => setConditionModal({ visible: false, offer: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={[styles.offerTabBadge, { 
                  backgroundColor: getTheme(conditionModal.offer?.type || '').bg,
                  alignSelf: 'flex-start',
                  marginBottom: 8
                }]}>
                  <Text style={[styles.offerTabBadgeText, { color: getTheme(conditionModal.offer?.type || '').color }]}>
                    {conditionModal.offer?.type === 'cheap_product' ? 'PRICE DROP' : (conditionModal.offer?.type || '').replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.modalTitle}>{conditionModal.offer?.name || 'Offer Details'}</Text>
              </View>
              <TouchableOpacity onPress={() => setConditionModal({ visible: false, offer: null })}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {conditionModal.offer && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalDesc}>
                  {(() => {
                    const getNames = (ids?: string[]) => {
                      if (!ids || ids.length === 0) return '';
                      const names = ids.map(id => storeProducts.find(p => String(p.id) === String(id))?.name).filter(Boolean);
                      if (names.length === 0) return '';
                      return names.join(', ');
                    };
                    const resolvedName = getNames(conditionModal.offer.reward_data?.product_ids);
                    return getOfferDescription(conditionModal.offer, resolvedName);
                  })()}
                </Text>
                
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Complete Offer Details</Text>
                  
                  <View style={styles.fullCondItem}>
                     <View style={styles.condBullet} />
                     <Text style={styles.fullCondText}>
                       <Text style={{ fontWeight: '800' }}>Eligibility: </Text>
                       {conditionModal.offer.conditions.applicable_orders === 'all' 
                         ? 'Open for all existing and new customers.' 
                         : `Valid only for your first ${conditionModal.offer.conditions.applicable_orders} orders from this store.`}
                     </Text>
                  </View>

                  {conditionModal.offer.conditions.min_price && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <Text style={styles.fullCondText}>
                         <Text style={{ fontWeight: '800' }}>Minimum Purchase: </Text>
                         You need to buy products worth ₹{conditionModal.offer.conditions.min_price} or more to apply this offer.
                       </Text>
                    </View>
                  )}

                  {conditionModal.offer.conditions.start_time && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <Text style={styles.fullCondText}>
                         <Text style={{ fontWeight: '800' }}>Offer Timing: </Text>
                         This offer is only available between {conditionModal.offer.conditions.start_time} and {conditionModal.offer.conditions.end_time}.
                       </Text>
                    </View>
                  )}

                  {conditionModal.offer.conditions.max_distance && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <Text style={styles.fullCondText}>
                         <Text style={{ fontWeight: '800' }}>Distance Limit: </Text>
                         Your delivery address must be within {conditionModal.offer.conditions.max_distance}km from {conditionModal.offer.store_name}.
                       </Text>
                    </View>
                  )}

                  {conditionModal.offer.conditions.product_ids && conditionModal.offer.conditions.product_ids.length > 0 && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <View style={{ flex: 1 }}>
                         <Text style={styles.fullCondText}>
                           <Text style={{ fontWeight: '800' }}>Required Products: </Text>
                           To apply this offer, you must have at least one of these items in your cart:
                         </Text>
                         <View style={styles.productNamesList}>
                            {conditionModal.offer.conditions.product_ids.map((pid: string) => {
                               const product = storeProducts.find(p => p.id === pid);
                               return (
                                 <Text key={pid} style={styles.productNameItem}>• {product?.name || 'Specific Product'}</Text>
                               );
                            })}
                         </View>
                       </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 12 }}>
              <Button 
                title={appliedOffers[conditionModal.offer?.type === 'free_delivery' ? `${conditionModal.offer.store_id}_delivery` : conditionModal.offer?.store_id]?.id === conditionModal.offer?.id ? "Remove Offer" : "Apply Offer"} 
                onPress={() => {
                  const off = conditionModal.offer;
                  setConditionModal({ visible: false, offer: null });
                  handleApplyOffer(off);
                }} 
                style={{ flex: 1, marginVertical: 0 }}
              />
              <TouchableOpacity 
                onPress={() => toggleOfferFavourite(conditionModal.offer?.id)}
                style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: 16, 
                  backgroundColor: Colors.white,
                  borderWidth: 1.5,
                  borderColor: favouriteOfferIds.includes(conditionModal.offer?.id) ? Colors.error : Colors.border,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Icon 
                  name={favouriteOfferIds.includes(conditionModal.offer?.id) ? "heart" : "heart-outline"} 
                  size={28} 
                  color={favouriteOfferIds.includes(conditionModal.offer?.id) ? Colors.error : Colors.border} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 3,
    lineHeight: 15,
  },
  filterWrapper: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  filterScroll: {
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  activeFilterChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  activeFilterLabel: {
    color: Colors.white,
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 40,
  },
  offersList: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  storeSection: {
    marginBottom: Spacing.md,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    marginBottom: 4,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  storeDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  horizontalScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  offerCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  offerTabHeader: {
    marginBottom: 12,
  },
  badgeStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offerTabBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  offerTabBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  offerTabTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 4,
  },
  offerTabDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
    lineHeight: 20,
  },
  conditionsLine: {
    marginBottom: 16,
    height: 28,
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
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  applyBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  appliedBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  appliedBtnText: {
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  modalDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 24,
    lineHeight: 20,
  },
  modalSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fullCondItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  condBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 8,
  },
  fullCondText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    flex: 1,
  },
  productNamesList: {
    marginTop: 8,
    gap: 4,
  },
  productNameItem: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    paddingLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});
