import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
const { width } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoreCard } from '../../components/StoreCard';
import { CustomerProductCard } from '../../components/CustomerProductCard';
import { supabase } from '../../api/supabase';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { PRODUCT_CATEGORIES } from '../../theme/categories';

const CATEGORIES = PRODUCT_CATEGORIES;

export const HomeScreen = ({ navigation }: any) => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [bestSellersLoading, setBestSellersLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [homeBanners, setHomeBanners] = useState<any[]>([]);
  const [categoryImages, setCategoryImages] = useState<{[key: string]: string}>({});
  const { addItem, updateQuantity, items, sessionAddress, setSessionAddress } = useCart();
  const { user } = useAuth();

  const getQuantity = (productId: string) => {
    const item = items.find(i => i.id === productId);
    return item ? item.quantity : 0;
  };

  useEffect(() => {
    fetchStores();
    fetchBestSellers();
    fetchSuggestions();
    fetchHomeBanners();
    fetchCategoryImages();
    if (user) {
      fetchAddresses();
    }

    const unsubscribe = navigation.addListener('focus', () => {
      if (user) {
        fetchAddresses();
        checkNotifications();
        fetchHomeBanners();
        fetchCategoryImages();
      }
    });

    return unsubscribe;
  }, [user, navigation]);

  const checkNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('target_group', 'customer')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const latestTime = data[0].created_at;
        const lastSeenTime = await AsyncStorage.getItem('last_seen_notification_time');
        
        if (!lastSeenTime || new Date(latestTime) > new Date(lastSeenTime)) {
          setHasNewNotifications(true);
        } else {
          setHasNewNotifications(false);
        }
      }
    } catch (e) {
      console.error('Error checking notifications:', e);
    }
  };

  const fetchAddresses = async () => {
    try {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setSavedAddresses(data || []);
      
      // Select default or first available
      if (data && data.length > 0) {
        const defaultAddr = data.find((a: any) => a.is_default) || data[0];
        setSelectedAddress(defaultAddr);
      } else {
        setSelectedAddress(null);
      }
    } catch (e) {
      console.error('Error fetching addresses:', e);
    }
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores_view')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setStores(data || []);
    } catch (e) {
      console.error('Error fetching stores:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBestSellers = async () => {
    try {
      setBestSellersLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*, stores:stores_view!inner(*)')
        .eq('stores.is_active', true)
        .eq('is_deleted', false)
        .eq('in_stock', true)
        .limit(10);

      if (error) throw error;
      setBestSellers(data || []);
    } catch (e) {
      console.error('Error fetching best sellers:', e);
    } finally {
      setBestSellersLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*, stores:stores_view!inner(*)')
        .eq('stores.is_active', true)
        .eq('is_deleted', false)
        .eq('in_stock', true)
        .order('id', { ascending: false })
        .limit(12);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (e) {
      console.error('Error fetching suggestions:', e);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const fetchHomeBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('home_banners')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHomeBanners(data || []);
    } catch (e) {
      console.error('Error fetching home banners:', e);
    }
  };

  const fetchCategoryImages = async () => {
    try {
      const { data, error } = await supabase
        .from('category_images')
        .select('*');
      if (error) throw error;
      const mapping: { [key: string]: string } = {};
      data?.forEach((item: any) => {
        mapping[item.category_name] = item.image_url;
      });
      setCategoryImages(mapping);
    } catch (e) {
      console.error('Error fetching category images:', e);
    }
  };

  const renderCategory = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategory === item.name && styles.categoryItemActive,
      ]}
      onPress={() => navigation.navigate('Category', { categoryName: item.name })}
    >
      <View style={[
        styles.categoryIconContainer,
        selectedCategory === item.name ? styles.categoryIconActive : styles.inactiveCategoryBg
      ]}>
        {categoryImages[item.name] ? (
          <Image source={{ uri: categoryImages[item.name] }} style={styles.categoryImage} />
        ) : (
          <Icon 
            name={item.icon} 
            size={24} 
            color={selectedCategory === item.name ? Colors.white : Colors.primary} 
          />
        )}
      </View>
      <Text style={[
        styles.categoryText,
        selectedCategory === item.name ? styles.activeCategoryText : styles.inactiveCategoryText
      ]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderBestSeller = ({ item }: { item: any }) => (
    <View style={{ marginRight: Spacing.sm }}>
      <CustomerProductCard 
        product={item}
        onPress={() => navigation.navigate('ProductDetail', { product: item, store: item.stores })}
        onAdd={() => addItem(item, item.stores)}
        quantity={getQuantity(item.id)}
        onIncrease={() => updateQuantity(item.id, 1)}
        onDecrease={() => updateQuantity(item.id, -1)}
        width={140}
      />
    </View>
  );

  const renderSuggestion = (item: any) => (
    <CustomerProductCard 
      key={item.id}
      product={item}
      onPress={() => navigation.navigate('ProductDetail', { product: item, store: item.stores })}
      onAdd={() => addItem(item, item.stores)}
      quantity={getQuantity(item.id)}
      onIncrease={() => updateQuantity(item.id, 1)}
      onDecrease={() => updateQuantity(item.id, -1)}
      width={(width - Spacing.md * 2 - 20) / 3 - 2}
    />
  );

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <LinearGradient 
        colors={[Colors.primary, Colors.primary + 'CC', Colors.background]} 
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.locationContainer} 
          onPress={() => setAddressModalVisible(true)}
          activeOpacity={0.7}
        >
            <View style={styles.locationRow}>
              <Icon name="map-marker" size={18} color={Colors.white} />
              <Text style={styles.locationLabel}>Delivering to</Text>
            </View>
          <View style={styles.addressRow}>
            <Text style={styles.locationTitle} numberOfLines={1}>
              {sessionAddress 
                ? (sessionAddress.label.length > 25 ? `${sessionAddress.label.substring(0, 30)}...` : sessionAddress.label)
                : selectedAddress 
                  ? (() => {
                      const fullAddress = `${selectedAddress.address_line}${selectedAddress.city ? `, ${selectedAddress.city}` : ''}`;
                      return fullAddress.length > 25 ? `${fullAddress.substring(0, 30)}...` : fullAddress;
                    })()
                  : 'Select Address'}
            </Text>
            <Icon name="chevron-down" size={20} color={Colors.white} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Icon name="bell-outline" size={24} color={Colors.white} />
          {hasNewNotifications && <View style={styles.notificationBadge} />}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <TouchableOpacity 
        style={styles.searchContainer}
        onPress={() => navigation.navigate('Search')}
        activeOpacity={0.9}
      >
        <View style={styles.searchBar}>
          <Icon name="magnify" size={24} color={Colors.textSecondary} />
          <Text style={styles.searchPlaceholder}>Search for stores or products...</Text>
        </View>
      </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingBottom: insets.bottom + 100 }
        ]}
      >
        {/* Home Banners */}
        {homeBanners.length > 0 && (
          <View style={styles.bannerContainer}>
            <ScrollView 
              horizontal 
              pagingEnabled 
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                // Could implement pagination dot update here
              }}
            >
              {homeBanners.map((banner) => (
                <View key={banner.id} style={styles.bannerWrapper}>
                  <Image source={{ uri: banner.image_url }} style={styles.bannerImage} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
        </View>
        <FlatList
          data={CATEGORIES}
          renderItem={renderCategory}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />

        {/* Best Sellers */}
        {bestSellers.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Best Sellers</Text>
            </View>
            <FlatList
              data={bestSellers}
              renderItem={renderBestSeller}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bestSellersList}
            />
          </>
        )}

        {/* Featured Stores */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Stores</Text>
          <TouchableOpacity onPress={fetchStores}>
            <Text style={styles.seeAll}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : stores.length > 0 ? (
          <View style={styles.storesContainer}>
            {stores.map((store) => (
              <StoreCard 
                key={store.id} 
                store={store} 
                onPress={() => (navigation as any).navigate('StoreDetails', { store })} 
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="store-off-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyText}>No stores found in your area yet.</Text>
            <Text style={styles.emptySubtext}>We're expanding fast! Check back soon.</Text>
          </View>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Suggested Products</Text>
              </View>
              <View style={styles.suggestionsGrid}>
                {suggestions.map((item) => renderSuggestion(item))}
              </View>
            </>
          )}
        </ScrollView>

      {/* Address Selection Modal */}
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
                  {sessionAddress ? "Live Location Active" : "Use Live Location"}
                </Text>
                {sessionAddress && <Icon name="check-circle" size={20} color={Colors.primary} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalOption} 
                onPress={() => {
                  setAddressModalVisible(false);
                  navigation.navigate('AddAddress'); 
                }}
              >
                <Icon name="plus" size={24} color={Colors.primary} />
                <Text style={styles.modalOptionText}>Add New Address</Text>
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
                    setSessionAddress(null); // Clear session address if saved one is selected
                    setAddressModalVisible(false);
                  }}
                >
                  <Icon 
                    name={addr.label.toLowerCase().includes('home') ? 'home-outline' : addr.label.toLowerCase().includes('work') ? 'briefcase-outline' : 'map-marker-outline'} 
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    paddingBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  locationContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginLeft: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    marginLeft: 2,
    maxWidth: '85%',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 9,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF0000',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  searchContainer: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchPlaceholder: {
    marginLeft: Spacing.sm,
    fontSize: 16,
    color: Colors.textSecondary,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  seeAll: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
  categoriesList: {
    paddingHorizontal: Spacing.md,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  categoryIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryIconActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  inactiveCategoryBg: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  categoryText: {
    width: 80,
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  inactiveCategoryText: {
    color: Colors.primary,
  },
  activeCategoryText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  categoryItemActive: {
    // optional styling for active item
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  storesContainer: {
    paddingHorizontal: Spacing.md,
  },
  bestSellersList: {
    paddingHorizontal: Spacing.md,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    justifyContent: 'flex-start',
    gap: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
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
    fontSize: 18,
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: Spacing.md,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 12,
  },
  savedAddressesHeader: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  savedAddressesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  savedAddressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  selectedAddressItem: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '05',
    borderWidth: 2,
  },
  savedAddressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  savedAddressLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  savedAddressText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bannerContainer: {
    marginTop: Spacing.sm,
    height: 160,
    width: width,
  },
  bannerWrapper: {
    width: width,
    paddingHorizontal: Spacing.md,
  },
  bannerImage: {
    width: width - Spacing.md * 2,
    height: '100%',
    borderRadius: 16,
    resizeMode: 'cover',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    resizeMode: 'cover',
  },
});
