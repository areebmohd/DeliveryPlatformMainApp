import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BusinessProductCard } from '../../components/BusinessProductCard';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const ManageProductsScreen = ({ route, navigation }: any) => {
  const { storeId } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const handleOpenModal = (product?: any) => {
    if (product) {
      setEditingId(product.id);
      setName(product.name);
      setDescription(product.description || '');
      setPrice(product.price.toString());
      setWeight(product.weight_kg?.toString() || '');
      setCategory(product.category || '');
    } else {
      setEditingId(null);
      setName('');
      setDescription('');
      setPrice('');
      setWeight('');
      setCategory('');
    }
    setModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!name || !price) {
      Alert.alert('Error', 'Name and price are required');
      return;
    }

    try {
      setSaving(true);
      const productData = {
        store_id: storeId,
        name,
        description,
        price: parseFloat(price),
        weight_kg: weight ? parseFloat(weight) : 0,
        category,
        in_stock: true,
      };

      if (editingId) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);
        if (error) throw error;
      }

      setModalVisible(false);
      fetchProducts();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
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
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);
              if (error) throw error;
              fetchProducts();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Icon 
          name="arrow-left" 
          size={24} 
          color={Colors.text} 
          onPress={() => navigation.goBack()} 
        />
        <Text style={styles.title}>Manage Products</Text>
        <TouchableOpacity onPress={() => handleOpenModal()}>
          <Icon name="plus-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <BusinessProductCard
              product={item}
              onToggleStock={handleToggleStock}
              onEdit={handleOpenModal}
              onDelete={handleDeleteProduct}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="package-variant" size={64} color={Colors.border} />
              <Text style={styles.emptyText}>No products added yet.</Text>
              <Button 
                title="Add Your First Product" 
                onPress={() => handleOpenModal()} 
                style={{ marginTop: 20 }}
              />
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Edit Product' : 'Add New Product'}
              </Text>
              <Icon name="close" size={24} onPress={() => setModalVisible(false)} />
            </View>

            <ScrollView>
              <Input
                label="Product Name"
                placeholder="e.g. Fresh Milk 1L"
                value={name}
                onChangeText={setName}
              />
              <Input
                label="Price (₹)"
                placeholder="0.00"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
              <Input
                label="Weight (kg)"
                placeholder="e.g. 0.5"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
              />
              <Input
                label="Category"
                placeholder="e.g. Dairy"
                value={category}
                onChangeText={setCategory}
              />
              <Input
                label="Description"
                placeholder="Product details..."
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Button
                title={editingId ? "Update Product" : "Add Product"}
                onPress={handleSaveProduct}
                loading={saving}
                style={{ marginTop: 20 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    padding: Spacing.lg,
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
    padding: Spacing.lg,
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
});
