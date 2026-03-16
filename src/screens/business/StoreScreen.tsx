import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BusinessProductCard } from '../../components/BusinessProductCard';

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = width * (9 / 16); // 16:9 Aspect ratio

type TabType = 'products' | 'info';

export const StoreScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const insets = useSafeAreaInsets();

  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    fetchStore();
    
    // Add focus listener to refresh data when returning from form
    const unsubscribe = navigation.addListener('focus', () => {
      fetchStore();
      fetchProducts();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (store?.id && activeTab === 'products') {
      fetchProducts();
    }
  }, [store?.id, activeTab]);

  const fetchStore = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
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
      product 
    });
  };

  const handleToggleStock = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ in_stock: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      
      setProducts(products.map(p => 
        p.id === id ? { ...p, in_stock: !currentStatus } : p
      ));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteProduct = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (!error) fetchProducts();
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>My Store</Text>
      <TouchableOpacity 
        style={styles.editButton}
        onPress={handleNavigateToStoreForm}
      >
        <Icon name="pencil-outline" size={20} color={Colors.text} />
        <Text style={styles.editButtonText}>Edit Details</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBanner = () => (
    <View style={styles.bannerContainer}>
      {store?.banner_url ? (
        <Image source={{ uri: store.banner_url }} style={styles.banner} />
      ) : (
        <View style={[styles.banner, styles.bannerPlaceholder]}>
          <Icon name="store-outline" size={60} color={Colors.textSecondary} />
          <Text style={styles.placeholderText}>No Banner Set</Text>
        </View>
      )}
      <View style={styles.storeBasicInfo}>
        <Text style={styles.storeName}>{store?.name || 'Your Store'}</Text>
        <Text style={styles.storeCategory}>{store?.category || 'No Category'}</Text>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'products' && styles.activeTab]}
        onPress={() => setActiveTab('products')}
      >
        <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>Products</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'info' && styles.activeTab]}
        onPress={() => setActiveTab('info')}
      >
        <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>Info</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}
      
      <ScrollView stickyHeaderIndices={[2]}>
        {renderBanner()}
        
        {renderTabs()}

        <View style={styles.tabContent}>
          {activeTab === 'products' ? (
            <View style={styles.productsContainer}>
              <View style={styles.productsHeader}>
                <Text style={styles.sectionTitle}>All Products</Text>
                <TouchableOpacity onPress={() => handleNavigateToProductForm()}>
                  <Icon name="plus-circle" size={32} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              
              {productsLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
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
                  <Icon name="package-variant" size={48} color={Colors.border} />
                  <Text style={styles.emptyText}>No products yet</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.infoContainer}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Description</Text>
                <Text style={styles.infoValue}>{store?.description || 'No description provided'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{store?.address}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Opening Hours</Text>
                <Text style={styles.infoValue}>{store?.opening_hours || 'Not specified'}</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  bannerContainer: {
    width: '100%',
  },
  banner: {
    width: '100%',
    height: BANNER_HEIGHT,
    backgroundColor: Colors.surface,
  },
  bannerPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  placeholderText: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  storeBasicInfo: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
  },
  storeName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  storeCategory: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.text,
    fontWeight: '700',
  },
  tabContent: {
    padding: Spacing.lg,
  },
  productsContainer: {
    flex: 1,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyProducts: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
  infoContainer: {
    flex: 1,
  },
  infoItem: {
    marginBottom: Spacing.xl,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
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
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  imagePickerButton: {
    width: '100%',
    height: BANNER_HEIGHT * 0.7,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  pickedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
