import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase, uploadImage } from '../../api/supabase';
import { AlertModal } from '../../components/ui/AlertModal';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';

export const ProductFormScreen = ({ route, navigation }: any) => {
  const { storeId, product, mode } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [weight, setWeight] = useState(product?.weight_kg?.toString() || '');
  const [category, setCategory] = useState(product?.category || '');
  const [imageUrl, setImageUrl] = useState(product?.image_url || '');
  const [stockQuantity, setStockQuantity] = useState(product?.stock_quantity?.toString() || '0');
  const [inStock, setInStock] = useState(product?.in_stock !== false);
  const [isLoading, setIsLoading] = useState(false);

  // Barcode & Stock states
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [isBarcodeMatched, setIsBarcodeMatched] = useState(false);
  const [searchingBarcode, setSearchingBarcode] = useState(false);
  const [hasSearchedBarcode, setHasSearchedBarcode] = useState(false);

  // Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertConfig({ visible: true, title, message, type, onConfirm });
  };

  const isEditing = !!product;
  const isBarcodeMode = mode === 'barcode';

  const handleBarcodeLookup = async () => {
    if (!barcode) return;
    try {
      setSearchingBarcode(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setHasSearchedBarcode(true);
      if (data) {
        setName(data.name);
        setDescription(data.description || '');
        setPrice(data.price.toString());
        setWeight(data.weight_kg?.toString() || '');
        setCategory(data.category || '');
        setImageUrl(data.image_url || '');
        setIsBarcodeMatched(true);
        showAlert('Product Found', 'Product details have been pre-filled and locked.', 'success');
      } else {
        setIsBarcodeMatched(false);
        showAlert('Not Found', 'Generic product not found. You can enter details manually.', 'warning');
      }
    } catch (e: any) {
      showAlert('Error', e.message, 'error');
    } finally {
      setSearchingBarcode(false);
    }
  };

  const canEditDetails = isEditing || !isBarcodeMode || (hasSearchedBarcode && !isBarcodeMatched);

  // Removed pickImage function

  const handleSaveProduct = async () => {
    if (!name || !price) {
      showAlert('Required Fields', 'Please enter product name and price.', 'warning');
      return;
    }

    try {
      setIsLoading(true);

      // 0. Check for duplicate name in the same store
      if (!isEditing) {
        const { data: duplicateProduct, error: duplicateError } = await supabase
          .from('products')
          .select('id')
          .eq('store_id', storeId)
          .eq('name', name.trim())
          .maybeSingle();
        
        if (duplicateProduct) {
          showAlert('Duplicate Product', 'A product with this name already exists in your store.', 'warning');
          return;
        }
        if (duplicateError) console.error('Error checking duplicates:', duplicateError);
      }

      if (!storeId) {
        showAlert('Error', 'Store ID is missing. Please try again.', 'error');
        return;
      }

      // 1. Search for existing image by name if current imageUrl is empty
      let finalImageUrl = imageUrl;
      if (!finalImageUrl && name) {
        const { data: existingProducts } = await supabase
          .from('products')
          .select('image_url')
          .eq('name', name.trim())
          .not('image_url', 'is', null)
          .limit(1);
        
        if (existingProducts && existingProducts.length > 0) {
          finalImageUrl = existingProducts[0].image_url;
        }
      }

      const productData = {
        store_id: storeId,
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        weight_kg: weight ? parseFloat(weight) : 0,
        category: category.trim(),
        image_url: finalImageUrl,
        barcode: barcode.trim() || null,
        stock_quantity: parseInt(stockQuantity),
        in_stock: inStock,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);
        if (error) throw error;
      }

      showAlert('Success', isEditing ? 'Product updated!' : 'Product added!', 'success', () => {
        navigation.goBack();
      });
      
      // Auto-navigate after a brief delay if user doesn't interact
      setTimeout(() => {
        if (navigation.canGoBack()) navigation.goBack();
      }, 1500);
    } catch (e: any) {
      showAlert('Error', e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit Product' : 'Add Product'}
        </Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identification</Text>
          {(isBarcodeMode || barcode) && (
            <View style={styles.barcodeWrapper}>
              <Input
                label="Barcode"
                placeholder="Scan or enter barcode"
                value={barcode}
                onChangeText={setBarcode}
                keyboardType="numeric"
                editable={!isEditing && !isBarcodeMatched}
              />
              {!isEditing && !isBarcodeMatched && (
                <Button 
                  title="Search Barcode" 
                  onPress={handleBarcodeLookup} 
                  loading={searchingBarcode}
                  variant="outline"
                  style={styles.lookupButton}
                />
              )}
            </View>
          )}

          <View style={styles.inputContainer}>
          <Text style={styles.label}>Product Image</Text>
          <View style={[styles.imagePreviewContainer, !canEditDetails && styles.disabledInput]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.previewImage} />
            ) : (
              <View style={styles.placeholderContainer}>
                <Icon name="image-search" size={40} color={Colors.textSecondary} />
                <Text style={styles.placeholderText}>
                  {name ? `Searching library for "${name}"...` : "Image will be added by Admin"}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.helperText}>
            Images are managed globally. If a matching product image is found in our library, it will be added automatically.
          </Text>
        </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Details</Text>
          <Input
            label="Name"
            placeholder="e.g. Milk 1L"
            value={name}
            onChangeText={setName}
            editable={canEditDetails}
          />
          <Input
            label="Category"
            placeholder="Dairy, Snacks, etc."
            value={category}
            onChangeText={setCategory}
            editable={canEditDetails}
          />
          <Input
            label="Description"
            placeholder="Details..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            editable={canEditDetails}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing & Inventory</Text>
          <View style={styles.row}>
            <Input
              label="Price (₹)"
              placeholder="0.00"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginRight: Spacing.sm }}
              editable={canEditDetails}
            />
            <Input
              label="Stock"
              placeholder="0"
              value={stockQuantity}
              onChangeText={setStockQuantity}
              keyboardType="numeric"
              containerStyle={{ flex: 1 }}
            />
          </View>
          <Input
            label="Weight (kg)"
            placeholder="0.5"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            editable={canEditDetails}
          />
        </View>

        <Button
          title={isEditing ? "Save Changes" : "Confirm Product"}
          onPress={handleSaveProduct}
          loading={isLoading}
          style={styles.submitButton}
        />
      </ScrollView>

      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          if (alertConfig.type === 'success' && alertConfig.onConfirm) {
            alertConfig.onConfirm();
          }
        }}
        showCancel={alertConfig.type !== 'success'}
        primaryAction={alertConfig.onConfirm ? {
          text: alertConfig.type === 'success' ? 'OK' : 'Confirm',
          onPress: alertConfig.onConfirm,
        } : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  imagePreviewContainer: {
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  placeholderText: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  disabledInput: {
    backgroundColor: '#F1F3F5',
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
  },
  barcodeWrapper: {
    marginBottom: Spacing.md,
  },
  lookupButton: {
    height: 44,
    marginTop: 3,
  },
  submitButton: {
    marginTop: Spacing.md,
    elevation: 4,
  },
});
