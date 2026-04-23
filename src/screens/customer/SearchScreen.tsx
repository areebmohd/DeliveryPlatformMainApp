import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';
import { StoreCard } from '../../components/StoreCard';
import { CustomerProductCard } from '../../components/CustomerProductCard';
import { ProductOptionsModal } from '../../components/ui/ProductOptionsModal';
import { useCart } from '../../context/CartContext';
import { useAlert } from '../../context/AlertContext';
import { deduplicateProducts, parseWKT } from '../../utils/productUtils';

const { width } = Dimensions.get('window');

export const SearchScreen = ({ navigation, route }: any) => {
  const [searchQuery, setSearchQuery] = useState(route.params?.initialQuery || '');
  const [activeTab, setActiveTab] = useState<'products' | 'stores'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProductOptions, setSelectedProductOptions] = useState<any>(null);
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<TextInput>(null);
  const { addItem, updateQuantity, items, sessionAddress, getQuantity } = useCart();
  const { showAlert } = useAlert();



  const handleAddToCart = useCallback((product: any, store: any) => {
    if (!sessionAddress) {
      showAlert({
        title: 'Select Location',
        message: 'Please select a delivery location first to add products to your cart.',
        type: 'info',
        primaryAction: {
          text: 'Go Home',
          onPress: () => navigation.navigate('Home')
        }
      });
      return;
    }

    if (product.options && product.options.length > 0) {
      setSelectedProductOptions({ product, store });
    } else {
      addItem(product, store);
    }
  }, [addItem, sessionAddress, showAlert, navigation]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length >= 2) {
      handleSearch();
    } else {
      setProducts([]);
      setStores([]);
    }
  }, [searchQuery]);

  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) return;

    try {
      setLoading(true);
      
      const searchTerms = trimmedQuery.split(/\s+/).filter(Boolean);
      
      // Search Products (Name or Description)
      let productQuery = supabase
        .from('products')
        .select('*, stores:stores_view!inner(*)')
        .eq('stores.is_active', true)
        .eq('stores.is_approved', true)
        .eq('is_deleted', false)
        .eq('is_info_complete', true)
        .eq('in_stock', true)
        .limit(30);

      // Add a filter for each term (AND logic between terms)
      searchTerms.forEach((term: string) => {
        productQuery = productQuery.or(`name.ilike.%${term}%,description.ilike.%${term}%,tags_search_text.ilike.%${term}%`);
      });

      const { data: productData, error: productError } = await productQuery;

      // Search Stores (Name, City, Address, Category, or Description)
      let storeQuery = supabase
        .from('stores_view')
        .select('*')
        .eq('is_active', true)
        .eq('is_approved', true)
        .limit(30);

      // Add a filter for each term (AND logic between terms)
      searchTerms.forEach((term: string) => {
        storeQuery = storeQuery.or(`name.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%,category.ilike.%${term}%,description.ilike.%${term}%`);
      });

      const { data: storeData, error: storeError } = await storeQuery;

      if (productError) throw productError;
      if (storeError) throw storeError;

      const userCoords = sessionAddress ? (sessionAddress.location_wkt ? parseWKT(sessionAddress.location_wkt) : parseWKT(sessionAddress.location)) : null;
      setProducts(deduplicateProducts(productData || [], userCoords));
      setStores(storeData || []);
    } catch (e) {
      // Search error logged silently
    } finally {
      setLoading(false);
    }
  };

  const renderProduct = useCallback(({ item }: { item: any }) => (
    <View style={styles.productItemWrapper}>
      <CustomerProductCard
        product={item}
        onPress={() => navigation.navigate('ProductDetail', { product: item, store: item.stores, isFromStore: false })}
        onAdd={() => handleAddToCart(item, item.stores)}
        quantity={getQuantity(item, item.store_id)}
        onIncrease={() => updateQuantity(item, 1, undefined, item.store_id)}
        onDecrease={() => updateQuantity(item, -1, undefined, item.store_id)}
        width="100%"
      />
    </View>
  ), [navigation, handleAddToCart, getQuantity, updateQuantity]);

  const renderStore = useCallback(({ item }: { item: any }) => (
    <StoreCard
      store={item}
      onPress={() => navigation.navigate('StoreDetails', { store: item })}
    />
  ), [navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      {/* Search Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Icon name="magnify" size={22} color={Colors.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search products or stores..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            Products ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stores' && styles.activeTab]}
          onPress={() => setActiveTab('stores')}
        >
          <Text style={[styles.tabText, activeTab === 'stores' && styles.activeTabText]}>
            Stores ({stores.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'products' ? products : stores}
          renderItem={activeTab === 'products' ? renderProduct : renderStore}
          keyExtractor={(item) => item.id}
          numColumns={activeTab === 'products' ? 2 : 1}
          key={activeTab === 'products' ? 'products-grid' : 'stores-list'}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          ListEmptyComponent={
            searchQuery.length < 2 ? (
              <View style={styles.emptyContainer}>
                <Icon name="magnify" size={64} color={Colors.border} />
                <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="alert-circle-outline" size={64} color={Colors.border} />
                <Text style={styles.emptyText}>No results found for "{searchQuery}"</Text>
              </View>
            )
          }
        />
      )}

      <ProductOptionsModal
        visible={!!selectedProductOptions}
        product={selectedProductOptions?.product}
        onClose={() => setSelectedProductOptions(null)}
        onConfirm={(options) => addItem({ ...selectedProductOptions.product, selectedOptions: options }, selectedProductOptions.store)}
      />
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
    alignItems: 'center',
    padding: Spacing.md,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeTab: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.white,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  productItemWrapper: {
    width: '48.5%',
    marginBottom: 10,
    marginRight: '3%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
});
