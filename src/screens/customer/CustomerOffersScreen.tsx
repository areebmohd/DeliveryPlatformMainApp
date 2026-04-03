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
import { getOfferDescription } from '../../utils/offerUtils';

const { width } = Dimensions.get('window');

export const CustomerOffersScreen = ({ navigation }: any) => {
  const [groupedOffers, setGroupedOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, profile } = useAuth();
  const { items, subtotal, setAppliedOffers, appliedOffers } = useCart();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const [conditionModal, setConditionModal] = useState<{ visible: boolean; offer: Offer | null }>({
    visible: false,
    offer: null
  });

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          store:stores(name, location)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOffers = (data || []).map((o: any) => ({
        ...o,
        store_name: o.store?.name || 'Unknown Store',
        store_location: o.store?.location
      }));

      // Group by store
      const groups: any = {};
      formattedOffers.forEach((offer: any) => {
        if (!groups[offer.store_id]) {
          groups[offer.store_id] = {
            id: offer.store_id,
            name: offer.store_name,
            offers: []
          };
        }
        groups[offer.store_id].offers.push(offer);
      });

      setGroupedOffers(Object.values(groups));
    } catch (e: any) {
      console.error('Error fetching offers:', e);
      showAlert({
        title: 'Query Error',
        message: 'There was a problem fetching the offers. Please try again later.',
        type: 'error'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  const handleApplyOffer = async (offer: Offer) => {
    const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
    const isApplied = appliedOffers[offerKey]?.id === offer.id;

    if (isApplied) {
      const newOffers = { ...appliedOffers };
      delete newOffers[offerKey];
      setAppliedOffers(newOffers);
      return;
    }

    const errors = await checkConditions(offer);
    
    if (errors && errors.length > 0) {
      showAlert({
        title: 'Conditions Not Met',
        message: errors.join('\n\n'),
        type: 'warning'
      });
      return;
    }

    setAppliedOffers({
      ...appliedOffers,
      [offerKey]: offer
    });
    navigation.navigate('Cart');
  };

  const getTheme = (type: OfferType) => {
    switch (type) {
      case 'free_cash': return { color: '#10B981', bg: '#D1FAE5', icon: 'cash' };
      case 'discount': return { color: '#2563EB', bg: '#DBEAFE', icon: 'percent' };
      case 'free_delivery': return { color: '#D97706', bg: '#FEF3C7', icon: 'truck-delivery' };
      case 'free_product': return { color: '#DB2777', bg: '#FCE7F3', icon: 'gift' };
      case 'cheap_product': return { color: '#7C3AED', bg: '#EDE9FE', icon: 'tag-outline' };
      case 'combo': return { color: '#EA580C', bg: '#FFEDD5', icon: 'layers-outline' };
      default: return { color: Colors.primary, bg: Colors.primaryLight, icon: 'cash' };
    }
  };

  const renderOfferCard = (offer: Offer) => {
    const theme = getTheme(offer.type);
    const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
    const isApplied = appliedOffers[offerKey]?.id === offer.id;

    return (
      <View key={offer.id} style={styles.offerCard}>
        <View style={styles.offerTabHeader}>
          <View style={[styles.offerTabBadge, { backgroundColor: theme.bg }]}>
            <Icon 
              name={theme.icon} 
              size={12} 
              color={theme.color} 
            />
            <Text style={[styles.offerTabBadgeText, { color: theme.color }]}>
              {offer.type.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.offerTabTitle} numberOfLines={1}>{offer.name || 'Special Offer'}</Text>
        <Text style={styles.offerTabDesc} numberOfLines={2}>
          {getOfferDescription(offer)}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.offerTabConditions}>
            {offer.conditions.min_price && (
              <View style={styles.offerTabCondPill}>
                <Text style={styles.offerTabCondText}>Min. ₹{offer.conditions.min_price}</Text>
              </View>
            )}
            {offer.conditions.max_distance && (
              <View style={styles.offerTabCondPill}>
                <Text style={styles.offerTabCondText}>{offer.conditions.max_distance}km</Text>
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.miniApplyBtn, isApplied && styles.miniAppliedBtn]}
            onPress={() => handleApplyOffer(offer)}
          >
            <Text style={[styles.miniApplyBtnText, isApplied && styles.miniAppliedBtnText]}>
              {isApplied ? "Remove" : "Apply"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStoreSection = (store: any) => (
    <View key={store.id} style={styles.storeSection}>
      <View style={styles.storeHeader}>
        <Icon name="storefront" size={20} color={Colors.text} />
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.storeOfferCount}>{store.offers.length} Deals</Text>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScrollContent}
        snapToInterval={width}
        decelerationRate="fast"
      >
        {store.offers.map(renderOfferCard)}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Store Offers</Text>
          <Text style={styles.disclaimerText}>Only one standard offer with free delivery offer is applicable in every order for each store.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
        ) : groupedOffers.length > 0 ? (
          <View style={styles.offersList}>
            {groupedOffers.map(renderStoreSection)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="tag-off-outline" size={80} color={Colors.border} />
            <Text style={styles.emptyTitle}>No Offers Available</Text>
            <Text style={styles.emptySubtitle}>Check back later for new deals and discounts.</Text>
          </View>
        )}
      </ScrollView>

      {/* Conditions Modal */}
      <Modal visible={conditionModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Offer Conditions</Text>
              <TouchableOpacity onPress={() => setConditionModal({ visible: false, offer: null })}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {conditionModal.offer && (
              <ScrollView>
                <View style={styles.condItem}>
                  <Icon name="storefront-outline" size={20} color={Colors.primary} />
                  <Text style={styles.condLabel}>Applicable at: {conditionModal.offer.store_name}</Text>
                </View>
                
                {conditionModal.offer.conditions.min_price && (
                  <View style={styles.condItem}>
                    <Icon name="cash-multiple" size={20} color={Colors.primary} />
                    <Text style={styles.condLabel}>Min. Order Value: ₹{conditionModal.offer.conditions.min_price}</Text>
                  </View>
                )}

                {conditionModal.offer.conditions.max_distance && (
                  <View style={styles.condItem}>
                    <Icon name="map-marker-distance" size={20} color={Colors.primary} />
                    <Text style={styles.condLabel}>Max Distance: {conditionModal.offer.conditions.max_distance}km</Text>
                  </View>
                )}

                {conditionModal.offer.conditions.start_time && (
                  <View style={styles.condItem}>
                    <Icon name="clock-outline" size={20} color={Colors.primary} />
                    <Text style={styles.condLabel}>Valid Hours: {conditionModal.offer.conditions.start_time} - {conditionModal.offer.conditions.end_time}</Text>
                  </View>
                )}

                {conditionModal.offer.conditions.applicable_orders && (
                  <View style={styles.condItem}>
                    <Icon name="numeric-1-box-outline" size={20} color={Colors.primary} />
                    <Text style={styles.condLabel}>
                      Valid for: {conditionModal.offer.conditions.applicable_orders === 'all' ? 'All Orders' : `First ${conditionModal.offer.conditions.applicable_orders} orders`}
                    </Text>
                  </View>
                )}

                {conditionModal.offer.conditions.product_ids && conditionModal.offer.conditions.product_ids.length > 0 && (
                  <View style={styles.condItem}>
                    <Icon name="package-variant-closed" size={20} color={Colors.primary} />
                    <Text style={styles.condLabel}>Only for specific products</Text>
                  </View>
                )}
              </ScrollView>
            )}
            
            <Button 
              title="Close" 
              onPress={() => setConditionModal({ visible: false, offer: null })} 
              style={{ marginTop: 24 }}
            />
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
    paddingHorizontal: 0,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 8,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 0,
    paddingBottom: 40,
  },
  offersList: {
    paddingBottom: 20,
  },
  storeSection: {
    marginBottom: 24,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  storeOfferCount: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  horizontalScrollContent: {
    paddingRight: 0,
    paddingLeft: 0,
  },
  offerCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    width: width,
    marginRight: 0,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    padding: 20,
  },
  offerTabHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  offerTabBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  offerTabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  offerTabTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  offerTabDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
    height: 40, // Two lines roughly
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  offerTabConditions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  offerTabCondPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  offerTabCondText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  miniApplyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  miniApplyBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  miniAppliedBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  miniAppliedBtnText: {
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  condItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  condLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
