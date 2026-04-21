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
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { useAlert } from '../../context/AlertContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BusinessProductCard } from '../../components/BusinessProductCard';

const { width } = Dimensions.get('window');

type TabType = 'products' | 'info';

const formatOpeningHours = (hoursJson: string) => {
  try {
    if (!hoursJson) return 'Schedule not set';
    const parsed = JSON.parse(hoursJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((slot: any) => `${slot.start} - ${slot.end}`).join('\n');
    }
    return hoursJson;
  } catch (e) {
    return hoursJson || 'Schedule not set';
  }
};

import { useBusinessStore } from '../../context/BusinessStoreContext';

export const StoreScreen = ({ navigation }: any) => {
  const { user, profile } = useAuth();
  const { activeStore: store, loading: storeLoading, refreshStores, setActiveStore: setStore } = useBusinessStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const { showAlert, showToast } = useAlert();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshStores();
      fetchProducts();
    });
    return unsubscribe;
  }, [navigation, store?.id]);

  useEffect(() => {
    if (!store?.id) return;

    if (activeTab === 'products') {
      fetchProducts();
    }

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
      supabase.removeChannel(productsChannel);
    };
  }, [store?.id, activeTab]);

  const onRefresh = async () => {
    try {
      setLoading(true);
      await Promise.all([
        refreshStores(),
        fetchProducts()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!store?.id) return;
    try {
      const nextStatus = !store.is_currently_open;
      
      // Optimistic Update
      const previousStore = { ...store };
      setStore({ ...store, is_currently_open: nextStatus });

      const { error } = await supabase
        .from('stores')
        .update({ is_currently_open: nextStatus })
        .eq('id', store.id);
      
      if (error) {
        setStore(previousStore);
        throw error;
      }
    } catch (e) {
      console.error('Error toggling availability:', e);
      showAlert({
        title: 'Error',
        message: 'Could not update availability',
        type: 'error',
      });
    }
  };

  const calculateDaysRemaining = (createdAt: string) => {
    if (!createdAt) return 5;
    const creationDate = new Date(createdAt);
    const currentDate = new Date();
    const diffTime = currentDate.getTime() - creationDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, 5 - diffDays);
  };

  const isStorePending = (s: any) => {
    if (!s) return false;
    return (
      !!s.name && 
      !!s.category && 
      !!s.address_line_1 && 
      !!s.city && 
      !!s.state && 
      !!s.pincode && 
      (!!s.location_wkt || !!s.location) && 
      !!s.phone && 
      !!s.upi_id && 
      !!s.owner_name && 
      !!s.owner_number && 
      (s.verification_images?.length > 0) &&
      s.is_approved === false
    );
  };

  const fetchProducts = async () => {
    if (!store?.id) return;
    try {
      setProductsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', store.id)
        .eq('is_deleted', false)
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
    if (!store?.id) {
      handleNavigateToStoreForm();
      return;
    }
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

  const handleDeleteProduct = (product: any) => {
    showAlert({
      title: 'Delete Product',
      message:
        'Are you sure you want to remove this item from your inventory? This cannot be undone.',
      type: 'warning',
      showCancel: true,
      primaryAction: {
        text: 'Delete',
        onPress: async () => {
          try {
            if (product.product_type === 'personal') {
              // Try hard delete first
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', product.id);
              
              if (error) {
                // If ordered (FK constraint), fallback to soft delete
                console.log('Ordered product, falling back to soft delete');
                const { error: updateError } = await supabase
                  .from('products')
                  .update({ is_deleted: true, in_stock: false })
                  .eq('id', product.id);
                if (updateError) throw updateError;
              }
            } else {
              // Common/Barcode: always soft delete
              const { error } = await supabase
                .from('products')
                .update({ is_deleted: true, in_stock: false })
                .eq('id', product.id);
              if (error) throw error;
            }
            
            fetchProducts();
            showToast('Product deleted successfully', 'success');
          } catch (e: any) {
            showAlert({
              title: 'Error',
              message: e.message || 'Could not delete product.',
              type: 'error',
            });
          }
        },
        variant: 'destructive',
      },
    });
  };


  if (loading || storeLoading) {
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
          {store?.category && (
            <View style={styles.headerCategoryBadge}>
              <Text style={styles.headerCategoryText}>
                {store.category}
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

  const renderVerificationAlert = () => {
    if (store?.is_active) return null;
    
    const isPending = isStorePending(store);
    const creationDate = store?.created_at || profile?.created_at;
    const remaining = calculateDaysRemaining(creationDate);

    return (
      <TouchableOpacity 
        style={[styles.inactiveAlert, isPending && styles.pendingAlert, !isPending && { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7', marginHorizontal: Spacing.md, marginTop: Spacing.md }]} 
        onPress={handleNavigateToStoreForm}
        activeOpacity={0.8}
      >
        <View style={[styles.alertIconBg, isPending && styles.pendingIconBg, !isPending && { backgroundColor: '#FEF3C7' }]}>
          <Icon 
            name={isPending ? "clock-check-outline" : "clock-alert-outline"} 
            size={24} 
            color={isPending ? Colors.success : "#D97706"} 
          />
        </View>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, isPending && styles.pendingTitle, !isPending && { color: '#D97706' }]}>
            {isPending ? 'Verification Pending' : 'Action Required'}
          </Text>
          <Text style={[styles.alertSubtitle, isPending && styles.pendingSubtitle, !isPending && { color: '#92400E' }]}>
            {isPending 
              ? 'You have submitted all the verifications details and your request is still pending please wait for some time.'
              : `Please fill all necessary details for verification otherwise this account will be deleted in ${remaining} days.`
            }
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color={isPending ? Colors.success : "#D97706"} />
      </TouchableOpacity>
    );
  };

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
            Info
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      <ScrollView
        stickyHeaderIndices={[store && !store.is_active ? 5 : 4]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {renderHeader()}
        {renderBanner()}
        {renderVerificationAlert()}
        
        {store && store.is_active && store.has_pending_changes && (
          <View style={[styles.inactiveAlert, styles.pendingAlert]}>
            <View style={[styles.alertIconBg, styles.pendingIconBg]}>
              <Icon name="information-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.alertTextContainer}>
              <Text style={[styles.alertTitle, styles.pendingTitle]}>
                Changes Under Review
              </Text>
              <Text style={[styles.alertSubtitle, styles.pendingSubtitle]}>
                You have changed details in store which will be verified by admin but the store will still be active.
              </Text>
            </View>
          </View>
        )}

        {store && store.is_active && !store.is_currently_open && (
          <TouchableOpacity 
            style={[styles.inactiveAlert, { backgroundColor: '#FFF4F4', borderColor: '#FFE2E2' }]} 
            onPress={handleToggleAvailability}
            activeOpacity={0.8}
          >
            <View style={[styles.alertIconBg, { backgroundColor: '#FFE2E2' }]}>
              <Icon name="store-off-outline" size={24} color={Colors.error} />
            </View>
            <View style={styles.alertTextContainer}>
              <Text style={[styles.alertTitle, { color: Colors.error }]}>
                Store is Offline
              </Text>
              <Text style={[styles.alertSubtitle, { color: '#666' }]}>
                Your store is manually closed for online orders. Customers cannot see your products or place orders.
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={Colors.error} />
          </TouchableOpacity>
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
                    onDelete={() => handleDeleteProduct(item)}
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
                      {formatOpeningHours(store?.opening_hours)}
                    </Text>
                  </View>

                  {store?.is_approved && (
                    <View style={styles.availabilityToggle}>
                      <View>
                        <Text style={styles.availabilityTitle}>Available for Orders</Text>
                        <Text style={styles.availabilitySubtitle}>
                          {store?.is_currently_open 
                            ? 'Customers can place orders now' 
                            : 'Store is manually closed for orders'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={handleToggleAvailability}
                        style={[
                          styles.toggleBtn,
                          store?.is_currently_open ? styles.toggleBtnActive : styles.toggleBtnInactive
                        ]}
                      >
                        <View style={[
                          styles.toggleSwitch,
                          store?.is_currently_open ? styles.switchRight : styles.switchLeft
                        ]} />
                      </TouchableOpacity>
                    </View>
                  )}
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
                        <TouchableOpacity 
                          style={styles.hoursRow}
                          onPress={() => {
                            const url = store.instagram_url.startsWith('http') 
                              ? store.instagram_url 
                              : `https://${store.instagram_url}`;
                            Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
                          }}
                        >
                          <Icon name="instagram" size={18} color="#E4405F" />
                          <Text style={[styles.infoValue, { color: Colors.primary, textDecorationLine: 'underline' }]}>
                            Instagram
                          </Text>
                        </TouchableOpacity>
                      )}
                      {store?.facebook_url && (
                        <TouchableOpacity 
                          style={[styles.hoursRow, { marginTop: 8 }]}
                          onPress={() => {
                            const url = store.facebook_url.startsWith('http') 
                              ? store.facebook_url 
                              : `https://${store.facebook_url}`;
                            Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
                          }}
                        >
                          <Icon name="facebook" size={18} color="#1877F2" />
                          <Text style={[styles.infoValue, { color: Colors.primary, textDecorationLine: 'underline' }]}>
                            Facebook
                          </Text>
                        </TouchableOpacity>
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
        onPress={() => {
          if (!store) {
            handleNavigateToStoreForm();
          } else if (activeTab === 'products') {
            handleNavigateToProductForm();
          } else {
            handleNavigateToStoreForm();
          }
        }}
        activeOpacity={0.9}
      >
        <View style={styles.fabGradient}>
          <Icon
            name={!store ? 'store-plus' : (activeTab === 'products' ? 'plus' : 'pencil-outline')}
            size={(!store || activeTab === 'products') ? 30 : 24}
            color={Colors.white}
          />
          <Text style={styles.fabText}>
            {!store ? 'Setup Store' : (activeTab === 'products' ? 'Add Product' : 'Edit Info')}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Global AlertModal handles alerts now */}
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
    aspectRatio: 2 / 1,
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
  availabilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E1E4E8',
  },
  availabilityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  availabilitySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  toggleBtn: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.success,
  },
  toggleBtnInactive: {
    backgroundColor: Colors.border,
  },
  toggleSwitch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchLeft: {
    alignSelf: 'flex-start',
  },
  switchRight: {
    alignSelf: 'flex-end',
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
