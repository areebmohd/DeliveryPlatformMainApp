import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase, uploadImage } from '../../api/supabase';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { PRODUCT_CATEGORIES } from '../../theme/categories';
import { Modal } from 'react-native';

export const ProductFormScreen = ({ route, navigation }: any) => {
  const { storeId, product, selectedType, initialType, mode } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Product Type state
  const [productType, setProductType] = useState<string>(product?.product_type || selectedType || initialType || mode || 'barcode');
  
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [weight, setWeight] = useState(product?.weight_kg?.toString() || '');
  const [category, setCategory] = useState(product?.category || '');
  const [imageUrl, setImageUrl] = useState(product?.image_url || '');
  const [stockQuantity, setStockQuantity] = useState(product?.stock_quantity?.toString() || '0');
  const [inStock, setInStock] = useState(product?.in_stock !== false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // Barcode & Stock states
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [isBarcodeMatched, setIsBarcodeMatched] = useState(false);
  const [searchingBarcode, setSearchingBarcode] = useState(false);
  const [hasSearchedBarcode, setHasSearchedBarcode] = useState(false);

  const { showAlert, showToast } = useAlert();
  
  // Logistics state
  const [isOversized, setIsOversized] = useState(product?.needs_large_vehicle || false);


  const isEditing = !!product;
  const isBarcodeMode = productType === 'barcode';
  const isCommonMode = productType === 'common';
  const isPersonalMode = productType === 'personal';

  // Update productType if it changes in params (initially)
  useEffect(() => {
    const passedType = route.params?.selectedType || route.params?.initialType || route.params?.type || route.params?.mode;
    if (passedType && !isEditing) {
      setProductType(passedType);
    }
  }, [route.params?.selectedType, route.params?.initialType, route.params?.type, route.params?.mode]);

  const getProductTypeDescription = () => {
    switch (productType) {
      case 'barcode':
        return 'For items with manufacturer barcodes. Speedy scanning for everyone.';
      case 'common':
        return 'Standard items like fruits, vegetables, etc. sold by many stores.';
      case 'personal':
        return 'Unique items made specifically by your store. You can add your own photos.';
      default:
        return '';
    }
  };

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
        showToast('Product Found', 'success');
      } else {
        setIsBarcodeMatched(false);
        // Look for common products by name if barcode not found (as a fallback or for common mode)
        showAlert({ title: 'Not Found', message: 'Generic product not found. You can enter details manually.', type: 'warning' });
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    } finally {
      setSearchingBarcode(false);
    }
  };

  const canEditDetails = isEditing || isPersonalMode || (isBarcodeMode && hasSearchedBarcode && !isBarcodeMatched) || isCommonMode;

  const pickImage = async () => {
    if (!isPersonalMode) return;
    
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.assets && result.assets[0].uri && user) {
      try {
        setUploading(true);
        const fileName = `products/${user.id}/${Date.now()}.jpg`;
        const publicUrl = await uploadImage('store-logos', fileName, result.assets[0].uri);
        setImageUrl(publicUrl);
        showToast('Image uploaded successfully!', 'success');
      } catch (error: any) {
        showAlert({ title: 'Error', message: error.message, type: 'error' });
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSaveProduct = async () => {
    if (!name || !price) {
      showAlert({ title: 'Required Fields', message: 'Please enter product name and price.', type: 'warning' });
      return;
    }

    try {
      setIsLoading(true);

      // Logistics Logic (Manual Toggle replaces AI)
      const manualWeight = parseFloat(weight) || 0;
      const needsLarge = manualWeight > 20 || isOversized;
      
      // We set nominal dimensions to satisfy existing cart logic if needed
      // (though Cart now primarily uses needs_large_vehicle flag)
      const dimValue = isOversized ? 41 : 20; 

      // 2. Check for duplicate name in the same store
      if (!isEditing) {
        const { data: duplicateProduct, error: duplicateError } = await supabase
          .from('products')
          .select('id')
          .eq('store_id', storeId)
          .eq('name', name.trim())
          .maybeSingle();
        
        if (duplicateProduct) {
          showAlert({ title: 'Duplicate Product', message: 'A product with this name already exists in your store.', type: 'warning' });
          return;
        }
        if (duplicateError) console.error('Error checking duplicates:', duplicateError);
      }

      if (!storeId) {
        showAlert({ title: 'Error', message: 'Store ID is missing. Please try again.', type: 'error' });
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
        weight_kg: manualWeight,
        category: category.trim(),
        image_url: finalImageUrl,
        barcode: barcode.trim() || null,
        product_type: productType,
        stock_quantity: parseInt(stockQuantity),
        in_stock: inStock,
        length_cm: dimValue,
        width_cm: dimValue,
        height_cm: dimValue,
        needs_large_vehicle: needsLarge,
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

      showToast(isEditing ? 'Product updated!' : 'Product added!', 'success');
      navigation.goBack();
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
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
          {isEditing ? 'Edit Product' : `Add ${productType.charAt(0).toUpperCase() + productType.slice(1)} Product`}
        </Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Product Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Type</Text>
          <View style={styles.typeSelectorContainer}>
            {['barcode', 'common', 'personal'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeChip,
                  productType === type && styles.activeTypeChip,
                  isEditing && styles.disabledChip
                ]}
                onPress={() => !isEditing && setProductType(type)}
                disabled={isEditing}
              >
                <Text style={[
                  styles.typeChipText,
                  productType === type && styles.activeTypeChipText
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.typeDescription}>{getProductTypeDescription()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identification</Text>
          {isBarcodeMode && (
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
            <TouchableOpacity 
              style={[
                styles.imagePreviewContainer, 
                !isPersonalMode && styles.disabledInput,
                uploading && styles.uploadingContainer
              ]}
              onPress={pickImage}
              disabled={!isPersonalMode || uploading}
            >
              {uploading ? (
                <ActivityIndicator size="large" color={Colors.primary} />
              ) : imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Icon 
                    name={isPersonalMode ? "camera-plus" : "image-search"} 
                    size={40} 
                    color={Colors.textSecondary} 
                  />
                  <Text style={styles.placeholderText}>
                    {isPersonalMode 
                      ? "Tap to upload product photo" 
                      : name ? `Searching library for "${name}"...` : "Image will be added by Admin"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.helperText}>
              {isPersonalMode 
                ? "Upload a clear photo of your unique product." 
                : "Images are managed globally. If a matching product image is found in our library, it will be added automatically."}
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
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity 
              style={[styles.dropdownTrigger, !canEditDetails && styles.disabledInput]}
              onPress={() => canEditDetails && setCategoryModalVisible(true)}
              disabled={!canEditDetails}
            >
              <Text style={[styles.dropdownValue, !category && { color: Colors.textSecondary }]}>
                {category || "Select a category"}
              </Text>
              <Icon name="chevron-down" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
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
            label="Weight (kg) *"
            placeholder="0.5"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            editable={canEditDetails}
          />

          <View style={styles.logisticsSection}>
            <Text style={styles.logisticsTitle}>Delivery Details</Text>
            <View style={styles.deliveryOptionsRow}>
              <TouchableOpacity 
                style={[styles.deliveryOptionCard, !isOversized && styles.deliveryOptionActive]}
                onPress={() => setIsOversized(false)}
                activeOpacity={0.7}
              >
                <Icon 
                  name="motorbike" 
                  size={32} 
                  color={!isOversized ? Colors.primary : Colors.textSecondary} 
                />
                <Text style={[styles.deliveryOptionLabel, !isOversized && { color: Colors.primary }]}>Standard Bike</Text>
                <Text style={styles.deliveryOptionSub}>Fits in 40x40x40cm bag</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.deliveryOptionCard, isOversized && styles.deliveryOptionActive]}
                onPress={() => setIsOversized(true)}
                activeOpacity={0.7}
              >
                <Icon 
                  name="truck-delivery" 
                  size={32} 
                  color={isOversized ? Colors.primary : Colors.textSecondary} 
                />
                <Text style={[styles.deliveryOptionLabel, isOversized && { color: Colors.primary }]}>Large Vehicle</Text>
                <Text style={styles.deliveryOptionSub}>Greater than 40cm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Button
          title={isEditing ? "Save Changes" : "Confirm Product"}
          onPress={handleSaveProduct}
          loading={isLoading}
          style={styles.submitButton}
        />
      </ScrollView>

      <Modal
        visible={categoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Category</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.categoryList}>
              {PRODUCT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryOption}
                  onPress={() => {
                    setCategory(cat.name);
                    setCategoryModalVisible(false);
                  }}
                >
                  <Icon name={cat.icon} size={24} color={Colors.primary} />
                  <Text style={styles.categoryOptionText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Global AlertModal handles alerts now */}
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
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
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
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  typeSelectorContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  activeTypeChip: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  disabledChip: {
    opacity: 0.6,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTypeChipText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  typeDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: Spacing.xs,
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
    opacity: 0.8,
  },
  uploadingContainer: {
    opacity: 0.6,
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
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    minHeight: 56,
  },
  dropdownValue: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
    paddingVertical: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  categoryModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
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
  categoryList: {
    padding: Spacing.md,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: Spacing.xs,
  },
  categoryOptionText: {
    fontSize: 16,
    color: Colors.text,
    marginLeft: 16,
    fontWeight: '500',
  },
  logisticsSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  logisticsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
    letterSpacing: 1,
  },
  deliveryOptionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  deliveryOptionCard: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  deliveryOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '15',
    borderWidth: 2,
  },
  deliveryOptionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  deliveryOptionSub: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
