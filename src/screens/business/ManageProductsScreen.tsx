import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAlert } from '../../context/AlertContext';
import { BusinessProductCard } from '../../components/BusinessProductCard';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const ManageProductsScreen = ({ route, navigation }: any) => {
  const { storeId } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const { showAlert, showToast } = useAlert();

  useEffect(() => {
    fetchProducts();
    
    // Add focus listener
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProducts();
    });

    // Subscribe to product changes for this store
    const channel = supabase
      .channel(`manage-products-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [navigation, storeId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToForm = (product?: any) => {
    navigation.navigate('ProductForm', { 
      storeId,
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
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    }
  };

  const handleDeleteProduct = (product: any) => {
    showAlert({
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product? All its data will be removed permanently.',
      type: 'warning',
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
                const { error: updateError } = await supabase
                  .from('products')
                  .update({ is_deleted: true, in_stock: false })
                  .eq('id', product.id);
                if (updateError) throw updateError;
              }
            } else {
              // Common/Barcode: always soft delete to preserve for other stores
              const { error } = await supabase
                .from('products')
                .update({ is_deleted: true, in_stock: false })
                .eq('id', product.id);
              if (error) throw error;
            }
            
            // Remove from local state immediately for better UX
            setProducts(prev => prev.filter(p => p.id !== product.id));
            showToast('Product removed successfully', 'success');
          } catch (e: any) {
            showAlert({ title: 'Error', message: e.message, type: 'error' });
          }
        },
        variant: 'destructive',
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Products</Text>
        <TouchableOpacity onPress={() => handleNavigateToForm()}>
          <Icon name="plus-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item }) => (
            <BusinessProductCard
              product={item}
              onToggleStock={handleToggleStock}
              onEdit={handleNavigateToForm}
              onDelete={() => handleDeleteProduct(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="package-variant" size={64} color={Colors.border} />
              <Text style={styles.emptyText}>No products added yet.</Text>
              <Button 
                title="Add Your First Product" 
                onPress={() => handleNavigateToForm()} 
                style={{ marginTop: 20 }}
              />
            </View>
          }
        />
      )}

      {/* Global AlertModal handles alerts now */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  loader: {
    marginTop: 100,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
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
    marginTop: 12,
  },
});
