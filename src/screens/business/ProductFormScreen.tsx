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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';

export const ProductFormScreen = ({ route, navigation }: any) => {
  const { storeId, product } = route.params || {};
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

  const isEditing = !!product;

  const pickImage = async () => {
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
      Alert.alert('Upload Failed', error.message || 'Could not upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!name || !price) {
      Alert.alert('Error', 'Name and price are required');
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
        in_stock: product ? product.in_stock : true,
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

      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? 'Edit Product' : 'Add New Product'}
        </Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.inputLabel}>Product Image</Text>
        <TouchableOpacity 
          style={styles.imagePickerButton} 
          onPress={pickImage}
          disabled={isUploadingImage}
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
          numberOfLines={4}
        />

        <Button
          title={isEditing ? "Update Product" : "Add Product"}
          onPress={handleSaveProduct}
          loading={loading}
          style={styles.submitButton}
        />
      </ScrollView>
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
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  imagePickerButton: {
    width: '100%',
    height: 180,
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
  submitButton: {
    marginTop: Spacing.xl,
  },
});
