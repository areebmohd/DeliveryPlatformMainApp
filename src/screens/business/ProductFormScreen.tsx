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
  
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [weight, setWeight] = useState(product?.weight_kg?.toString() || '');
  const [category, setCategory] = useState(product?.category || '');
  const [imageUrl, setImageUrl] = useState(product?.image_url || '');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Barcode & Stock states
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [stockQuantity, setStockQuantity] = useState(product?.stock_quantity?.toString() || '0');
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

  const pickImage = async () => {
    if (!canEditDetails) return;
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.7,
    });

    if (result.didCancel || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) return;

    try {
      setIsUploadingImage(true);
      const fileName = `${user?.id}_p_${Date.now()}.jpg`;
      const publicUrl = await uploadImage('products', fileName, base64);
      setImageUrl(publicUrl);
    } catch (error: any) {
      showAlert('Upload Failed', error.message || 'Could not upload image', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!name || !price) {
      showAlert('Required Fields', 'Please enter product name and price.', 'warning');
      return;
    }

    try {
      setLoading(true);
      const productData = {
        store_id: storeId,
        name,
        description,
        price: parseFloat(price),
        weight_kg: weight ? parseFloat(weight) : 0,
        category,
        image_url: imageUrl,
        in_stock: parseInt(stockQuantity) > 0,
        barcode: barcode || null,
        stock_quantity: parseInt(stockQuantity) || 0,
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
    } catch (e: any) {
      showAlert('Error', e.message, 'error');
    } finally {
      setLoading(false);
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

          <View style={styles.imageSection}>
            <TouchableOpacity 
              style={[styles.imagePicker, !canEditDetails && styles.disabledPicker]} 
              onPress={pickImage}
              disabled={isUploadingImage || !canEditDetails}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.pickedImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Icon name="camera-plus" size={32} color={Colors.textSecondary} />
                  <Text style={styles.imagePlaceholderText}>Upload Product Image</Text>
                </View>
              )}
              {isUploadingImage && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
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
          loading={loading}
          style={styles.submitButton}
        />
      </ScrollView>

      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        primaryAction={alertConfig.onConfirm ? {
          text: 'Confirm',
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
  imageSection: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  imagePicker: {
    width: 140,
    height: 140,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  disabledPicker: {
    backgroundColor: '#F1F3F5',
    borderColor: Colors.border,
  },
  pickedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 4,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  barcodeWrapper: {
    marginBottom: Spacing.md,
  },
  lookupButton: {
    height: 44,
    marginTop: -8,
  },
  submitButton: {
    marginTop: Spacing.md,
    elevation: 4,
  },
});
