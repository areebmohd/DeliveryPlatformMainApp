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
import { AlertModal } from '../../components/ui/AlertModal';
import { BusinessProductCard } from '../../components/BusinessProductCard';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const ManageProductsScreen = ({ route, navigation }: any) => {
  const { storeId } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  // Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    primaryAction?: any;
    secondaryAction?: any;
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

  const closeAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

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
    if (product) {
      navigation.navigate('ProductForm', { 
        storeId,
        product 
      });
      return;
    }

    showAlert({
      title: 'Add Product',
      message: 'Choose how to add your product. Scanning a barcode is faster!',
      type: 'info',
      verticalButtons: true,
      primaryAction: {
        text: 'Barcode Product',
        onPress: () => navigation.navigate('ProductForm', { storeId, mode: 'barcode' }),
      },
      secondaryAction: {
        text: 'Manual Product',
        onPress: () => navigation.navigate('ProductForm', { storeId, mode: 'manual' }),
        variant: 'outline',
      },
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

  const handleDeleteProduct = (id: string) => {
    showAlert({
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product? All its data will be removed permanently.',
      type: 'warning',
      primaryAction: {
        text: 'Delete',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('products')
              .delete()
              .eq('id', id);
            if (error) throw error;
            fetchProducts();
          } catch (e: any) {
            showAlert({ title: 'Error', message: e.message, type: 'error' });
          }
        },
        variant: 'destructive',
      }
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Icon 
          name="arrow-left" 
          size={24} 
          color={Colors.text} 
          onPress={() => navigation.goBack()} 
        />
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
              onDelete={handleDeleteProduct}
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

      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={closeAlert}
        primaryAction={alertConfig.primaryAction}
        secondaryAction={alertConfig.secondaryAction}
        verticalButtons={alertConfig.verticalButtons}
      />
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
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
