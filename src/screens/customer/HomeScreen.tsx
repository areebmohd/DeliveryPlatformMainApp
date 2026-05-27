import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Animated,
  RefreshControl,
} from 'react-native';
const { width } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoreCard } from '../../components/StoreCard';
import { CustomerProductCard } from '../../components/CustomerProductCard';
import { ProductOptionsModal } from '../../components/ui/ProductOptionsModal';
import { supabase } from '../../api/supabase';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { PRODUCT_CATEGORIES } from '../../theme/categories';
import { deduplicateProducts, parseWKT, getHaversineDistance } from '../../utils/productUtils';

const CATEGORIES = PRODUCT_CATEGORIES;



const MemoizedProductItem = React.memo(({ item, onPress, onAdd, onIncrease, onDecrease, quantity, width }: any) => (
  <CustomerProductCard 
    product={item}
    onPress={onPress}
    onAdd={onAdd}
    quantity={quantity}
    onIncrease={onIncrease}
    onDecrease={onDecrease}
    width={width}
  />
));

const MemoizedStoreItem = React.memo(({ item, onPress }: any) => (
  <StoreCard 
    store={item} 
    onPress={onPress} 
    width={260}
    horizontal
  />
));

const HomeBanners = React.memo(({ banners, activeIndex, onBannerScroll, onTouchStart, onTouchEnd, scrollViewRef }: any) => {
  if (!banners || banners.length === 0) return null;

  return (
    <View style={styles.bannerContainer}>
      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          onBannerScroll(newIndex);
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        scrollEventThrottle={16}
      >
        {banners.map((banner: any) => (
          <View key={banner.id} style={styles.bannerWrapper}>
            <Image source={{ uri: banner.image_url }} style={styles.bannerImage} />
          </View>
        ))}
      </ScrollView>
      
      {/* Pagination Dots */}
      {banners.length > 1 && (
        <View style={styles.paginationContainer}>
          {banners.map((_: any, index: number) => (
            <View 
              key={index} 
              style={[
                styles.dot, 
                activeIndex === index ? styles.activeDot : styles.inactiveDot
              ]} 
            />
          ))}
        </View>
      )}
    </View>
  );
});

export const HomeScreen = ({ navigation }: any) => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [homeBanners, setHomeBanners] = useState<any[]>([]);
  const [categoryImages, setCategoryImages] = useState<{ [key: string]: string }>({});
  const [selectedProductOptions, setSelectedProductOptions] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { addItem, items, updateQuantity, sessionAddress, setSessionAddress, getQuantity } = useCart();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const activeBannerIndexRef = useRef(0);
  const bannerScrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<any>(null);
  const glowAnim = useRef(new Animated.Value(1)).current;
  const maintenanceShownRef = useRef(false);

  // Check maintenance mode and show alert
  const checkMaintenanceMode = useCallback(async () => {
    if (maintenanceShownRef.current) return;
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('maintenance_mode, maintenance_message')
        .single();

      if (!error && data?.maintenance_mode) {
        maintenanceShownRef.current = true;
        showAlert({
          title: 'System Under Maintenance',
          message: data.maintenance_message || 'Platform is currently undergoing scheduled maintenance. Ordering is temporarily disabled.',
          type: 'warning',
          primaryAction: {
            text: 'Got it',
            onPress: () => {},
          }
        });
      }
    } catch (err) {
      console.log('Error checking maintenance mode:', err);
    }
  }, [showAlert]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 2.2, // Increased scale to clearly cross boarders
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.8, // Decreased scale for better contrast
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnim]);



  const handleAddToCart = useCallback((product: any) => {
    const store = product.stores;
    if (!sessionAddress) {
      showAlert({
        title: 'Select Location',
        message: 'Please select a delivery location first to add products to your cart.',
        type: 'info',
        primaryAction: {
          text: 'Select Location',
          onPress: () => setAddressModalVisible(true)
        }
      });
      return;
    }

    if (product.options && product.options.length > 0) {
      setSelectedProductOptions({ product, store });
    } else {
      addItem(product, store);
    }
  }, [addItem, sessionAddress, showAlert]);

  const getLocalDateString = useCallback(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  }, []);

  const loadCachedHomeData = useCallback(async () => {
    try {
      setLoading(true);
      const cacheKey = `home_data_cache_${user?.id || 'guest'}_${sessionAddress?.id || 'default'}`;
      const today = getLocalDateString();

      // Retrieve cached data
      const cachedString = await AsyncStorage.getItem(cacheKey);
      if (cachedString) {
        try {
          const cache = JSON.parse(cachedString);
          if (cache.date === today) {
            setStores(cache.stores || []);
            setBestSellers(cache.bestSellers || []);
            setSuggestions(cache.suggestions || []);
            setLoading(false);
            return;
          }
        } catch (parseErr) {
          console.log('Error parsing cache:', parseErr);
        }
      }

      // 1. NEAREST STORES
      const { data: dbStores, error: storesError } = await supabase
        .from('stores_view')
        .select('*')
        .eq('is_active', true)
        .eq('is_approved', true);

      if (storesError) throw storesError;

      const userCoords = sessionAddress
        ? (sessionAddress.location_wkt ? parseWKT(sessionAddress.location_wkt) : parseWKT(sessionAddress.location))
        : null;

      let sortedStores = dbStores || [];
      if (userCoords) {
        sortedStores = sortedStores
          .map((store: any) => {
            const storeLoc = parseWKT(store.location_wkt);
            const distance = storeLoc
              ? getHaversineDistance(userCoords.lat, userCoords.lng, storeLoc.lat, storeLoc.lng)
              : Infinity;
            return { ...store, _distance: distance };
          })
          .sort((a: any, b: any) => a._distance - b._distance);
      }
      const nearest10Stores = sortedStores.slice(0, 10);
      const nearest10StoreIds = nearest10Stores.map((s: any) => s.id);

      if (nearest10Stores.length === 0) {
        setStores([]);
        setBestSellers([]);
        setSuggestions([]);
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          date: today,
          stores: [],
          bestSellers: [],
          suggestions: []
        }));
        setLoading(false);
        return;
      }

      // 2. BEST SELLERS
      const startOfYesterday = new Date();
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      startOfYesterday.setHours(0, 0, 0, 0);

      const endOfYesterday = new Date();
      endOfYesterday.setDate(endOfYesterday.getDate() - 1);
      endOfYesterday.setHours(23, 59, 59, 999);

      const { data: yesterdaySales, error: salesError } = await supabase
        .from('order_items')
        .select('product_id, quantity, orders!inner(created_at, status)')
        .gte('orders.created_at', startOfYesterday.toISOString())
        .lte('orders.created_at', endOfYesterday.toISOString())
        .neq('orders.status', 'cancelled');

      const yesterdaySalesMap = new Map<string, number>();
      if (!salesError && yesterdaySales) {
        yesterdaySales.forEach((item: any) => {
          if (item.product_id) {
            yesterdaySalesMap.set(item.product_id, (yesterdaySalesMap.get(item.product_id) || 0) + (item.quantity || 0));
          }
        });
      }

      const { data: storeProducts, error: productsError } = await supabase
        .from('products')
        .select('*, stores:stores_view!inner(*)')
        .in('store_id', nearest10StoreIds)
        .eq('is_deleted', false)
        .eq('is_info_complete', true)
        .eq('in_stock', true);

      const productsFromNearby = storeProducts || [];

      // Group products by store
      const storeProductsMap = new Map<string, any[]>();
      productsFromNearby.forEach((product: any) => {
        const storeId = product.store_id;
        if (!storeProductsMap.has(storeId)) {
          storeProductsMap.set(storeId, []);
        }
        product._salesCountYesterday = yesterdaySalesMap.get(product.id) || 0;
        storeProductsMap.get(storeId)?.push(product);
      });

      const finalBestSellers: any[] = [];
      nearest10Stores.forEach((store: any) => {
        const products = storeProductsMap.get(store.id) || [];
        if (products.length > 0) {
          products.sort((a: any, b: any) => {
            if (b._salesCountYesterday !== a._salesCountYesterday) {
              return b._salesCountYesterday - a._salesCountYesterday;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          finalBestSellers.push(products[0]);
        }
      });

      // 3. SUGGESTED PRODUCTS
      let user7DaySalesMap = new Map<string, number>();
      if (user?.id) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const { data: recentPurchases } = await supabase
          .from('order_items')
          .select('product_id, quantity, orders!inner(customer_id, status, created_at)')
          .eq('orders.customer_id', user.id)
          .gte('orders.created_at', sevenDaysAgo.toISOString())
          .neq('orders.status', 'cancelled')
          .eq('is_removed', false);

        (recentPurchases || []).forEach((item: any) => {
          if (item.product_id) {
            user7DaySalesMap.set(item.product_id, (user7DaySalesMap.get(item.product_id) || 0) + (item.quantity || 0));
          }
        });
      }

      const finalSuggestions: any[] = [];
      nearest10Stores.forEach((store: any) => {
        const products = storeProductsMap.get(store.id) || [];
        if (products.length > 0) {
          products.forEach((p: any) => {
            p._userBoughtCount = user7DaySalesMap.get(p.id) || 0;
          });

          const sortedStoreProducts = [...products].sort((a: any, b: any) => {
            if (b._userBoughtCount !== a._userBoughtCount) {
              return b._userBoughtCount - a._userBoughtCount;
            }
            if (b._salesCountYesterday !== a._salesCountYesterday) {
              return b._salesCountYesterday - a._salesCountYesterday;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

          const selected3 = sortedStoreProducts.slice(0, 3);
          finalSuggestions.push(...selected3);
        }
      });

      // Cache and save everything
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        date: today,
        stores: nearest10Stores,
        bestSellers: finalBestSellers,
        suggestions: finalSuggestions
      }));

      setStores(nearest10Stores);
      setBestSellers(finalBestSellers);
      setSuggestions(finalSuggestions);
    } catch (e) {
      console.log('Error calculating cached home data:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, sessionAddress?.id, sessionAddress?.address_line, getLocalDateString]);

  // Initial data fetch
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([
        loadCachedHomeData(),
        fetchHomeBanners(),
        fetchCategoryImages()
      ]);
      setLoading(false);
    };

    initData();
    checkMaintenanceMode();

    if (user) {
      fetchAddresses();
    }

    const unsubscribe = navigation.addListener('focus', () => {
      // Refresh notifications and potentially banners on focus
      if (user) {
        checkNotifications();
        fetchHomeBanners();
      }
      checkMaintenanceMode();
      loadCachedHomeData();
    });

    return unsubscribe;
  }, [user, navigation, loadCachedHomeData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadCachedHomeData(),
      fetchHomeBanners(),
      fetchCategoryImages(),
      user ? fetchAddresses() : Promise.resolve(),
      user ? checkNotifications() : Promise.resolve()
    ]);
    setRefreshing(false);
  }, [user, loadCachedHomeData]);

  // Refresh data when delivery address changes, but ONLY if we have an address
  useEffect(() => {
    if (sessionAddress) {
      loadCachedHomeData();
    }
  }, [sessionAddress?.id, sessionAddress?.address_line, loadCachedHomeData]);




  useEffect(() => {
    if (homeBanners.length > 1) {
      startAutoScroll();
    }
    return () => stopAutoScroll();
  }, [homeBanners]);

  useEffect(() => {
    activeBannerIndexRef.current = activeBannerIndex;
  }, [activeBannerIndex]);

  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    autoScrollTimer.current = setInterval(() => {
      if (homeBanners.length > 0) {
        const nextIndex = (activeBannerIndexRef.current + 1) % homeBanners.length;
        bannerScrollViewRef.current?.scrollTo({
          x: nextIndex * width,
          animated: true,
        });
        setActiveBannerIndex(nextIndex);
      }
    }, 5000);
  }, [homeBanners.length]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }
  }, []);

  const checkNotifications = async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from('notifications')
        .select('created_at')
        .or(`user_id.eq.${user.id},target_group.eq.customer`)
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
      // Error logged silently in production
    }
  };

  const fetchAddresses = async () => {
    try {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('addresses_view')
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
        if (!sessionAddress) {
          setSessionAddress(defaultAddr); // Set default if none active
        }
      } else {
        setSelectedAddress(null);
      }
    } catch (e) {
      // Silent in production
    }
  };



  const fetchHomeBanners = async () => {
    try {
      if (homeBanners.length > 0) return;
      const { data, error } = await supabase
        .from('home_banners')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setHomeBanners(data || []);
    } catch (e) {
      // Silent in production
    }
  };

  const fetchCategoryImages = async () => {
    try {
      if (Object.keys(categoryImages).length > 0) return;
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
      // Silent in production
    }
  };

  const renderCategory = useCallback(({ item }: { item: any }) => (
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
  ), [selectedCategory, categoryImages, navigation]);

  const handleProductPress = useCallback((product: any) => {
    navigation.navigate('ProductDetail', { product, store: product.stores, isFromStore: false });
  }, [navigation]);

  const handleProductIncrease = useCallback((product: any) => {
    updateQuantity(product, 1, undefined, product.store_id);
  }, [updateQuantity]);

  const handleProductDecrease = useCallback((product: any) => {
    updateQuantity(product, -1, undefined, product.store_id);
  }, [updateQuantity]);

  const renderBestSeller = useCallback(({ item }: { item: any }) => (
    <View style={styles.bestSellerWrapper}>
      <MemoizedProductItem 
        item={item}
        onPress={handleProductPress}
        onAdd={handleAddToCart}
        quantity={getQuantity(item, item.store_id)}
        onIncrease={handleProductIncrease}
        onDecrease={handleProductDecrease}
        width={140}
      />
    </View>
  ), [handleProductPress, handleAddToCart, getQuantity, handleProductIncrease, handleProductDecrease]);

  const renderSuggestion = useCallback(({ item }: { item: any }) => (
    <MemoizedProductItem 
      item={item}
      onPress={handleProductPress}
      onAdd={handleAddToCart}
      quantity={getQuantity(item, item.store_id)}
      onIncrease={handleProductIncrease}
      onDecrease={handleProductDecrease}
      width={(width - Spacing.md * 2 - 20) / 3 - 2}
    />
  ), [handleProductPress, handleAddToCart, getQuantity, handleProductIncrease, handleProductDecrease]);

  const handleStorePress = useCallback((store: any) => {
    navigation.navigate('StoreDetails', { store });
  }, [navigation]);

  const renderStore = useCallback(({ item }: { item: any }) => (
    <MemoizedStoreItem 
      item={item} 
      onPress={handleStorePress} 
    />
  ), [handleStorePress]);

  const insets = useSafeAreaInsets();

  const MemoizedHeader = useMemo(() => (
    <>
      <HomeBanners 
        banners={homeBanners}
        activeIndex={activeBannerIndex}
        onBannerScroll={setActiveBannerIndex}
        onTouchStart={stopAutoScroll}
        onTouchEnd={startAutoScroll}
        scrollViewRef={bannerScrollViewRef}
      />

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
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
          />
        </>
      )}

      {/* Featured Stores */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Nearby Stores</Text>
        <TouchableOpacity onPress={loadCachedHomeData}>
          <Text style={styles.seeAll}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loadingIndicator} />
      ) : stores.length > 0 ? (
        <FlatList
          data={stores}
          renderItem={renderStore}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storesList}
          initialNumToRender={3}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="store-off-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyText}>No stores found in your area yet.</Text>
          <Text style={styles.emptySubtext}>We're expanding fast! Check back soon.</Text>
        </View>
      )}

      {/* Suggestions Header */}
      {suggestions.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Suggested Products</Text>
        </View>
      )}
    </>
  ), [homeBanners, activeBannerIndex, bestSellers, loading, stores, suggestions.length, renderCategory, renderBestSeller, renderStore, stopAutoScroll, startAutoScroll, loadCachedHomeData]);

  const MemoizedFooter = useMemo(() => {
    if (suggestions.length === 0) return null;
    return (
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>Use search bar for other products</Text>
      </View>
    );
  }, [suggestions.length]);

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
                ? (() => {
                    const fullAddress = `${sessionAddress.address_line}${sessionAddress.city ? `, ${sessionAddress.city}` : ''}`;
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
          {hasNewNotifications && (
            <Animated.View 
              style={[
                styles.notificationGlow, 
                { 
                  transform: [{ scale: glowAnim }],
                  opacity: glowAnim.interpolate({
                    inputRange: [0.8, 2.2],
                    outputRange: [0, 0.6],
                  })
                }
              ]} 
            />
          )}
          <Icon name="bell-outline" size={24} color={Colors.white} />
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

      <FlatList
        data={suggestions}
        renderItem={renderSuggestion}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={MemoizedHeader}
        ListFooterComponent={MemoizedFooter}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingBottom: insets.bottom + 100 }
        ]}
        columnWrapperStyle={styles.suggestionsRow}
        ListEmptyComponent={loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loadingIndicator} />
        ) : null}
      />

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
                  navigation.navigate('AddAddress', { fromHome: true }); 
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
                  style={[styles.savedAddressItem, sessionAddress?.id === addr.id && styles.selectedAddressItem]}
                  onPress={() => {
                    setSelectedAddress(addr);
                    setSessionAddress(addr); // Sync with context for other screens
                    setAddressModalVisible(false);
                  }}
                >
                  <Icon 
                    name={addr.label.toLowerCase().includes('home') ? 'home-outline' : addr.label.toLowerCase().includes('work') ? 'briefcase-outline' : 'map-marker-outline'} 
                    size={20} 
                    color={sessionAddress?.id === addr.id ? Colors.primary : Colors.textSecondary} 
                  />
                  <View style={styles.savedAddressInfo}>
                    <Text style={styles.savedAddressLabel}>{addr.label}</Text>
                    <Text style={styles.savedAddressText} numberOfLines={1}>{addr.address_line}</Text>
                  </View>
                  {sessionAddress?.id === addr.id && (
                    <Icon name="check-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ProductOptionsModal
        visible={!!selectedProductOptions}
        product={selectedProductOptions?.product}
        onClose={() => setSelectedProductOptions(null)}
        onConfirm={(options, finalPrice) => addItem({ ...selectedProductOptions.product, price: finalPrice, selectedOptions: options }, selectedProductOptions.store)}
      />
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    position: 'relative',
    overflow: 'visible', // Ensure glow is visible if it scales out
  },
  notificationGlow: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
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
  storesList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  bestSellersList: {
    paddingHorizontal: Spacing.md,
  },
  suggestionsRow: {
    paddingHorizontal: Spacing.md,
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  footerContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
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
    width: width,
    aspectRatio: 2 / 1,
    position: 'relative',
  },
  bannerWrapper: {
    width: width,
    height: '100%',
    paddingHorizontal: Spacing.md,
  },
  bannerImage: {
    width: width - Spacing.md * 2,
    height: '100%',
    borderRadius: 16,
    resizeMode: 'cover',
  },
  paginationContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: Colors.white,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    resizeMode: 'cover',
  },
  bestSellerWrapper: {
    marginRight: Spacing.sm,
  },
  loadingIndicator: {
    marginTop: 40,
  },
});
