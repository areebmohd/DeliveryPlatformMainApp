import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { AlertModal } from '../../components/ui/AlertModal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BusinessProductCard } from '../../components/BusinessProductCard';
import { SafeTopBackground } from '../../components/ui/SafeTopBackground';

const { width } = Dimensions.get('window');

type TabType = 'products' | 'info';

export const StoreScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    primaryAction?: any;
    secondaryAction?: any;
    tertiaryAction?: any;
    verticalButtons?: boolean;
    showCancel?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = (config: any) => {
    setAlertConfig({ visible: true, ...config });
  };

  const closeAlert = () =>
    setAlertConfig(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    fetchStore();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchStore();
      fetchProducts();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!store?.id) return;

    if (activeTab === 'products') {
      fetchProducts();
    }

    // Subscribe to store changes
    const storeChannel = supabase
      .channel(`store-updates-${store.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stores',
          filter: `id=eq.${store.id}`,
        },
        payload => {
          if (payload.new) setStore(payload.new);
        },
      )
      .subscribe();

    // Subscribe to product changes for this store
    const productsChannel = supabase
      .channel(`product-updates-${store.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${store.id}`,
        },
        () => {
          fetchProducts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(storeChannel);
      supabase.removeChannel(productsChannel);
    };
  }, [store?.id, activeTab]);

  const fetchStore = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores_view')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) setStore(data);
    } catch (e) {
      console.error('Error fetching store:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    await Promise.all([fetchStore(), fetchProducts()]);
  };

  const fetchProducts = async () => {
    if (!store?.id) return;
    try {
      setProductsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleNavigateToStoreForm = () => {
    navigation.navigate('StoreDetailsForm', { store });
  };

  const handleNavigateToProductForm = (product?: any) => {
    navigation.navigate('ProductForm', {
      storeId: store.id,
      product,
      initialType: 'barcode',
    });
  };

  const handleToggleStock = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ in_stock: !currentStatus })
        .eq('id', id);
      if (error) throw error;

      setProducts(
        products.map(p =>
          p.id === id ? { ...p, in_stock: !currentStatus } : p,
        ),
      );
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    }
  };

  const handleDeleteProduct = (id: string) => {
    showAlert({
      title: 'Delete Product',
      message:
        'Are you sure you want to remove this item from your inventory? This cannot be undone.',
      type: 'warning',
      primaryAction: {
        text: 'Delete',
        onPress: async () => {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
          if (!error) fetchProducts();
          else
            showAlert({
              title: 'Error',
              message: 'Could not delete product.',
              type: 'error',
            });
        },
        variant: 'destructive',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: Spacing.sm }]}>
      <View style={styles.headerContent}>
        <Text style={styles.headerName}>{store?.name || 'Your Store'}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.headerCategoryBadge}>
            <Text style={styles.headerCategoryText}>
              {store?.category || 'General Store'}
            </Text>
          </View>
          {store?.sector_area && (
            <View style={styles.headerCategoryBadge}>
              <Text style={styles.headerCategoryText}>
                {store.sector_area}
              </Text>
            </View>
          )}
          {store?.city && (
            <View style={styles.headerCategoryBadge}>
              <Text style={styles.headerCategoryText}>
                {store.city}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const renderBanner = () => (
    <View style={styles.bannerContainer}>
      {store?.banner_url ? (
        <Image source={{ uri: store.banner_url }} style={styles.banner} />
      ) : (
        <View style={[styles.banner, styles.bannerPlaceholder]}>
          <Icon name="store" size={60} color={Colors.border} />
          <Text style={styles.placeholderText}>Design your storefront</Text>
        </View>
      )}
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabWrapper}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Icon
            name={
              activeTab === 'products'
                ? 'package-variant-closed'
                : 'package-variant-closed'
            }
            size={20}
            color={activeTab === 'products' ? Colors.white : Colors.primary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'products' && styles.activeTabText,
            ]}
          >
            Products
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'info' && styles.activeTab]}
          onPress={() => setActiveTab('info')}
        >
          <Icon
            name={activeTab === 'info' ? 'information' : 'information-outline'}
            size={20}
            color={activeTab === 'info' ? Colors.white : Colors.primary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'info' && styles.activeTabText,
            ]}
          >
            Store Info
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeTopBackground />
      <ScrollView
        stickyHeaderIndices={[store && !store.is_active ? 4 : 3]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {renderHeader()}
        {renderBanner()}
        
        {store && !store.is_active && (
          (() => {
            const isPending = 
              !!store.name && 
              !!store.category && 
              !!store.address_line_1 && 
              !!store.city && 
              !!store.state && 
              !!store.pincode && 
              (!!store.location_wkt || !!store.location) && 
              !!store.phone && 
              !!store.upi_id && 
              !!store.owner_name && 
              !!store.owner_number && 
              (store.verification_images?.length > 0) &&
              store.is_approved === false;

            return (
              <TouchableOpacity 
                style={[styles.inactiveAlert, isPending && styles.pendingAlert]} 
                onPress={handleNavigateToStoreForm}
                activeOpacity={0.8}
              >
                <View style={[styles.alertIconBg, isPending && styles.pendingIconBg]}>
                  <Icon 
                    name={isPending ? "clock-check-outline" : "alert-circle"} 
                    size={24} 
                    color={isPending ? Colors.success : Colors.error} 
                  />
                </View>
                <View style={styles.alertTextContainer}>
                  <Text style={[styles.alertTitle, isPending && styles.pendingTitle]}>
                    {isPending ? 'Verification Pending' : 'Verification Required'}
                  </Text>
                  <Text style={[styles.alertSubtitle, isPending && styles.pendingSubtitle]}>
                    {isPending 
                      ? 'You have submitted all the verifications details and your request is still pending please wait for some time.'
                      : 'Your store is inactive and hidden from users. Please fill necessary details to verify your store and activate it.'
                    }
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={isPending ? Colors.success : Colors.error} />
              </TouchableOpacity>
            );
          })()
        )}

        <View style={{ height: 10 }} />

        {renderTabs()}

        <View style={styles.tabContent}>
          {activeTab === 'products' ? (
            <View style={styles.productsContainer}>
              {productsLoading ? (
                <View style={styles.centered}>
                  <ActivityIndicator color={Colors.primary} size="large" />
                </View>
              ) : products.length > 0 ? (
                products.map(item => (
                  <BusinessProductCard
                    key={item.id}
                    product={item}
                    onToggleStock={handleToggleStock}
                    onEdit={handleNavigateToProductForm}
                    onDelete={handleDeleteProduct}
                  />
                ))
              ) : (
                <View style={styles.emptyProducts}>
                  <View style={styles.emptyIconContainer}>
                    <Icon
                      name="package-variant"
                      size={60}
                      color={Colors.border}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>No Products Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Start adding store items to begin selling.
                  </Text>
                  <Button
                    title="Add Your First Product"
                    onPress={() => handleNavigateToProductForm()}
                    style={styles.emptyButton}
                  />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.infoContainer}>
              <View style={styles.infoCard}>
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>About the Store</Text>
                  <Text style={styles.infoValue}>
                    {store?.description ||
                      'Build your store profile to attract more customers.'}
                  </Text>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Operating Hours</Text>
                  <View style={styles.hoursRow}>
                    <Icon
                      name="clock-outline"
                      size={18}
                      color={Colors.primary}
                    />
                    <Text style={styles.infoValue}>
                      {store?.opening_hours || 'Schedule not set'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Pickup Address</Text>
                  <View style={styles.hoursRow}>
                    <Icon
                      name="map-marker-radius"
                      size={18}
                      color={Colors.error}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoValue}>
                        {store?.address_line_1 ||
                          store?.address ||
                          'Location required for deliveries'}
                        {store?.sector_area ? `\n${store.sector_area}` : ''}
                        {store?.pincode ? ` - ${store.pincode}` : ''}
                        {store?.city ? `\n${store.city}` : ''}
                        {store?.state ? `, ${store.state}` : ''}
                      </Text>
                    </View>
                  </View>

                  {store?.location_wkt && (
                    <TouchableOpacity
                      style={styles.mapLink}
                      onPress={() => {
                        const match = store.location_wkt.match(
                          /POINT\(([-\d.]+) ([-\d.]+)\)/,
                        );
                        if (match) {
                          const lng = match[1];
                          const lat = match[2];
                          const url = Platform.select({
                            ios: `maps:0,0?q=${store.name}@${lat},${lng}`,
                            android: `geo:0,0?q=${lat},${lng}(${store.name})`,
                          });
                          if (url) Linking.openURL(url);
                        }
                      }}
                    >
                      <Icon
                        name="google-maps"
                        size={16}
                        color={Colors.primary}
                      />
                      <Text style={styles.mapLinkText}>
                        View GPS Coordinates
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {(store?.phone || store?.email || store?.whatsapp_number) && (
                  <>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Contact Information</Text>
                      {store?.phone && (
                        <View style={styles.hoursRow}>
                          <Icon
                            name="phone-outline"
                            size={18}
                            color={Colors.primary}
                          />
                          <Text style={styles.infoValue}>{store.phone}</Text>
                        </View>
                      )}
                      {store?.email && (
                        <View style={[styles.hoursRow, { marginTop: 8 }]}>
                          <Icon
                            name="email-outline"
                            size={18}
                            color={Colors.primary}
                          />
                          <Text style={styles.infoValue}>{store.email}</Text>
                        </View>
                      )}
                      {store?.whatsapp_number && (
                        <View style={[styles.hoursRow, { marginTop: 8 }]}>
                          <Icon
                            name="whatsapp"
                            size={18}
                            color={Colors.success}
                          />
                          <Text style={styles.infoValue}>
                            {store.whatsapp_number}
                          </Text>
                        </View>
                      )}
                    </View>
                  </>
                )}

                {(store?.instagram_url || store?.facebook_url) && (
                  <>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Social Media</Text>
                      {store?.instagram_url && (
                        <View style={styles.hoursRow}>
                          <Icon name="instagram" size={18} color="#E4405F" />
                          <Text style={styles.infoValue}>
                            {store.instagram_url}
                          </Text>
                        </View>
                      )}
                      {store?.facebook_url && (
                        <View style={[styles.hoursRow, { marginTop: 8 }]}>
                          <Icon name="facebook" size={18} color="#1877F2" />
                          <Text style={styles.infoValue}>
                            {store.facebook_url}
                          </Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: 20 + insets.bottom }]}
        onPress={() =>
          activeTab === 'products'
            ? handleNavigateToProductForm()
            : handleNavigateToStoreForm()
        }
        activeOpacity={0.9}
      >
        <View style={styles.fabGradient}>
          <Icon
            name={activeTab === 'products' ? 'plus' : 'pencil-outline'}
            size={activeTab === 'products' ? 30 : 24}
            color={Colors.white}
          />
          <Text style={styles.fabText}>
            {activeTab === 'products' ? 'Add Product' : 'Edit Info'}
          </Text>
        </View>
      </TouchableOpacity>

      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={closeAlert}
        primaryAction={alertConfig.primaryAction}
        secondaryAction={alertConfig.secondaryAction}
        verticalButtons={alertConfig.verticalButtons}
        showCancel={alertConfig.showCancel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centered: {
    marginTop: 50,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 7,
  },
  headerCategoryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  headerCategoryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scrollContent: {
    flexGrow: 1,
  },
  bannerContainer: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  banner: {
    width: '100%',
    height: 180,
    borderRadius: 24,
    backgroundColor: Colors.surface,
  },
  bannerPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  inactiveAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFDADA',
  },
  alertIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#D32F2F',
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 12,
    color: '#D32F2F',
    lineHeight: 16,
    fontWeight: '600',
  },
  pendingAlert: {
    backgroundColor: '#F0FFF4',
    borderColor: '#C6F6D5',
  },
  pendingIconBg: {
    backgroundColor: '#C6F6D5',
  },
  pendingTitle: {
    color: Colors.success,
  },
  pendingSubtitle: {
    color: Colors.success,
  },
  placeholderText: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  storeAddress: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 4,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabWrapper: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  activeTabText: {
    color: Colors.white,
  },
  tabContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  productsContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
  },
  emptyProducts: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    width: '80%',
  },
  infoContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoSection: {
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    fontWeight: '500',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 28,
    gap: 4,
  },
  mapLinkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F1F3F5',
    marginVertical: Spacing.lg,
  },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: Colors.primary,
    borderRadius: 30,
    height: 60,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
});
