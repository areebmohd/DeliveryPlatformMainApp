import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  PermissionsAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase, uploadImage, deleteFile } from '../../api/supabase';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { PRODUCT_CATEGORIES } from '../../theme/categories';
import { Modal } from 'react-native';
import { BarcodeScannerModal } from '../../components/ui/BarcodeScannerModal';

export const ProductFormScreen = ({ route, navigation }: any) => {
  const { storeId, product, selectedType, initialType, mode } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Product Type state
  const [productType, setProductType] = useState<string>(product?.product_type || selectedType || initialType || mode || 'barcode');
  
  const [name, setName] = useState(product?.name || '');
  
  // Description as key-value pairs (title/text)
  const getInitialDescription = () => {
    try {
      if (!product?.description) return [{ title: '', text: '' }];
      const parsed = JSON.parse(product.description);
      if (Array.isArray(parsed)) return parsed;
      return [{ title: 'Description', text: product.description }];
    } catch (e) {
      return [{ title: 'Description', text: product.description || '' }];
    }
  };
  const [descriptionPairs, setDescriptionPairs] = useState<any[]>(getInitialDescription());
  
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [weight, setWeight] = useState(product?.weight_kg?.toString() || '');
  const [category, setCategory] = useState(product?.category || '');
  const [imageUrl, setImageUrl] = useState(product?.image_url || '');
  const [stockQuantity, setStockQuantity] = useState(product?.stock_quantity?.toString() || '0');
  const [productOptions, setProductOptions] = useState<any[]>(
    product?.options?.length 
      ? product.options.map((opt: any) => ({ 
          ...opt, 
          values: opt.values?.length 
            ? opt.values.map((v: any) => typeof v === 'string' ? { value: v, price_adjustment: 0 } : v) 
            : [{ value: '', price_adjustment: 0 }], 
          currentInput: '' 
        }))
      : [{ title: '', values: [{ value: '', price_adjustment: 0 }], currentInput: '' }]
  );
  const [tags, setTags] = useState<string[]>(product?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [inStock, setInStock] = useState(product?.in_stock !== false);
  const [preparationTime, setPreparationTime] = useState(product?.preparation_time?.toString() || '0');
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [masterSuggestions, setMasterSuggestions] = useState<any[]>([]);
  const [isSearchingMaster, setIsSearchingMaster] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(product?.master_product_id || null);
  const [hasMadeCommonChoice, setHasMadeCommonChoice] = useState(!!product);

  // Mode calculations (moved up before state usage)
  // Mode calculations
  const isEditing = !!product;
  const isBarcode = productType === 'barcode';
  const isCommon = productType === 'common';
  const isPersonal = productType === 'personal';
  
  // For backward compatibility with existing code using 'Mode' suffix
  const isBarcodeMode = isBarcode;
  const isCommonMode = isCommon;
  const isPersonalMode = isPersonal;

  // Barcode & Stock states
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [isBarcodeMatched, setIsBarcodeMatched] = useState(!!product?.name);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(product?.raw_image_url || null);
  const showAllFields = !isBarcodeMode || isBarcodeMatched || !!category;
  
  const [capturingRaw, setCapturingRaw] = useState(false);
  const [searchingBarcode, setSearchingBarcode] = useState(false);
  const [hasSearchedBarcode, setHasSearchedBarcode] = useState(false);

  const { showAlert, showToast } = useAlert();
  
  // Logistics state
  const [isOversized, setIsOversized] = useState(product?.needs_large_vehicle || false);
  const setIsOversizedValue = (val: boolean) => setIsOversized(val);

  // Update productType if it changes in params (initially)
  useEffect(() => {
    const passedType = route.params?.selectedType || route.params?.initialType || route.params?.type || route.params?.mode;
    if (passedType && !isEditing) {
      setProductType(passedType);
    }
  }, [route.params?.selectedType, route.params?.initialType, route.params?.type, route.params?.mode]);

  // FRESH FETCH STRATEGY: If editing, fetch the latest data from DB to avoid staleness
  useEffect(() => {
    const fetchFreshProduct = async () => {
      if (isEditing && product?.id) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', product.id)
            .single();
          
          if (error) throw error;
          if (data) {
            setName(data.name || '');
            setPrice(data.price?.toString() || '');
            setWeight(data.weight_kg?.toString() || '');
            setCategory(data.category || '');
            setImageUrl(data.image_url || '');
            setStockQuantity(data.stock_quantity?.toString() || '0');
            setInStock(data.in_stock !== false);
            setPreparationTime(data.preparation_time?.toString() || '0');
            setRawImageUrl(data.raw_image_url || null);
            setIsOversized(data.needs_large_vehicle || false);
            
            // Re-initialize lists with fresh data
            if (data.description) {
              try {
                const parsed = JSON.parse(data.description);
                setDescriptionPairs(Array.isArray(parsed) ? parsed : [{ title: 'Description', text: data.description }]);
              } catch {
                setDescriptionPairs([{ title: 'Description', text: data.description }]);
              }
            }
            
            if (data.options) {
              setProductOptions(data.options.map((opt: any) => ({
                ...opt,
                values: opt.values?.length 
                  ? opt.values.map((v: any) => typeof v === 'string' ? { value: v, price_adjustment: 0 } : v)
                  : [{ value: '', price_adjustment: 0 }],
                currentInput: ''
              })));
            }
            if (data.tags) {
              setTags(data.tags);
            }
          }
        } catch (err) {
          console.error('Error fetching fresh product:', err);
        }
      }
    };

    fetchFreshProduct();
  }, [isEditing, product?.id]);

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
        setHasSearchedBarcode(true);
        setName(data.name);
        
        // Handle description pairs from barcode lookup
        try {
          if (data.description) {
            const parsed = JSON.parse(data.description);
            if (Array.isArray(parsed)) {
              setDescriptionPairs(parsed);
            } else {
              setDescriptionPairs([{ title: 'Description', text: data.description }]);
            }
          } else {
            setDescriptionPairs([{ title: '', text: '' }]);
          }
        } catch (e) {
          setDescriptionPairs([{ title: 'Description', text: data.description || '' }]);
        }

        setPrice(data.price?.toString() || '');
        setWeight(data.weight_kg?.toString() || '');
        setCategory(data.category || '');
        setImageUrl(data.image_url || '');
        setRawImageUrl(data.raw_image_url || null);
        setIsBarcodeMatched(true);
        showToast('Product Found', 'success');
      } else {
        setHasSearchedBarcode(true);
        setIsBarcodeMatched(false);
        showAlert({ 
          title: 'Product Not Found', 
          message: 'We will soon add product details. Please submit a clear picture of product from front side.', 
          type: 'info',
          showCancel: false,
          primaryAction: {
            text: 'OK',
            onPress: () => {
              // Delay camera trigger slightly to ensure modal is closed
              setTimeout(takeRawPhoto, 500);
            },
          }
        });
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    } finally {
      setSearchingBarcode(false);
    }
  };

  const searchMasterCatalog = async (text: string) => {
    if (text.length < 2) {
      setMasterSuggestions([]);
      return;
    }

    try {
      setIsSearchingMaster(true);
      console.log('Searching catalog for:', text);
      
      // Search for products that are "common" and have been "accepted" by admin
      // Search for products that are "common" and have been "accepted" by admin
      // Using PostgREST syntax for .or() - searching name, description and tags_search_text
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, image_url, tags')
        .eq('product_type', 'common')
        .eq('is_info_complete', true)
        .eq('is_deleted', false)
        .or(`name.ilike.*${text}*,description.ilike.*${text}*,tags_search_text.ilike.*${text}*`)
        .limit(30);

      if (error) {
        console.error('Supabase error searching catalog:', error);
        throw error;
      }
      
      // Filter unique products by name to avoid duplicates from different stores
      const uniqueResults = data ? data.reduce((acc: any[], curr: any) => {
        if (!acc.find(item => item.name.toLowerCase() === curr.name.toLowerCase())) {
          acc.push(curr);
        }
        return acc;
      }, []).slice(0, 8) : [];

      console.log(`Found ${uniqueResults.length} unique suggestions for "${text}"`);
      setMasterSuggestions(uniqueResults);
    } catch (e) {
      console.error('Catch error searching catalog:', e);
    } finally {
      setIsSearchingMaster(false);
    }
  };

  const handleSelectMasterProduct = (master: any) => {
    setSelectedMasterId(master.id);
    setName(master.name);
    setCategory(master.category);
    setTags(master.tags || []);
    setImageUrl(master.image_url || '');
    setMasterSuggestions([]);
    setHasMadeCommonChoice(true);
    showToast('Master product selected', 'success');
  };

  const handleAddNewCommonProduct = () => {
      // Check for an exact name match
      const hasExact = masterSuggestions.some(m => 
        m.name.toLowerCase() === name.trim().toLowerCase()
      );

      if (hasExact) {
        showAlert({
          title: 'Product Already Exists',
          message: 'A product with this exact name is already available in our catalog. Please select it from the suggestions above to avoid duplicate entries.',
          type: 'info'
        });
        return;
      }
    
    setSelectedMasterId(null);
    setMasterSuggestions([]);
    setHasMadeCommonChoice(true);
  };


  // Admin details: category, image, tags, delivery vehicle
  const canEditAdminDetails = isPersonal;
  
  // Name field
  const canEditName = isPersonal || (isBarcode && !isBarcodeMatched) || (isCommon && !hasMadeCommonChoice);
  
  // Store specific fields: price, weight, description, options
  const canEditPriceWeight = isPersonal || (isCommon && hasMadeCommonChoice);
  
  // Stock field
  const canEditStock = isPersonal || isBarcode || (isCommon && hasMadeCommonChoice);

  // Visibility flags
  const showAdminDetails = isPersonal || (isBarcode && (isBarcodeMatched || !!category)) || (isCommon && hasMadeCommonChoice);

  const takeRawPhoto = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "Camera Permission",
            message: "App needs access to your camera to take product photos.",
            buttonPositive: "OK"
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showAlert({ title: 'Permission Denied', message: 'Camera permission is required to take product photos.', type: 'warning' });
          return;
        }
      }

      showToast('Opening camera...', 'info');
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
        saveToPhotos: false,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        showAlert({ title: 'Camera Error', message: result.errorMessage || 'Unknown camera error', type: 'error' });
        return;
      }

      if (result.assets && result.assets[0].uri && user) {
        setCapturingRaw(true);
        const fileName = `raw_images/${user.id}/${barcode || 'unknown'}_${Date.now()}.jpg`;
        
        const publicUrl = await uploadImage('products', fileName, result.assets[0].base64!);
        
        if (rawImageUrl) {
          await deleteFile('products', rawImageUrl);
        }
        
        setRawImageUrl(publicUrl);
        showToast('Raw image captured successfully!', 'success');
      }
    } catch (error: any) {
      showAlert({ title: 'Camera Error', message: error.message, type: 'error' });
    } finally {
      setCapturingRaw(false);
    }
  };

  const pickImage = async () => {
    if (!canEditAdminDetails) {
      showToast('Images for this product type are managed by Admin', 'info');
      return;
    }
    
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: true,
    });

    if (result.assets && result.assets[0].uri && user) {
      try {
        setUploading(true);
        const fileName = `products/${user.id}/${Date.now()}.jpg`;
        // Passing base64 data instead of URI
        const publicUrl = await uploadImage('products', fileName, result.assets[0].base64!);
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
    // For barcode products, name and price are not strictly required from store
    // Validation for Personal and Common products
    if (isPersonal || isCommon) {
      if (!name.trim()) {
        showAlert({ title: 'Required Fields', message: 'Please enter product name.', type: 'warning' });
        return;
      }
      if (!price || parseFloat(price) <= 0) {
        showAlert({ title: 'Required Fields', message: 'Please enter a valid price.', type: 'warning' });
        return;
      }
      if (!weight || parseFloat(weight) <= 0) {
        showAlert({ title: 'Required Fields', message: 'Please enter a valid weight.', type: 'warning' });
        return;
      }
      if (stockQuantity === '' || isNaN(parseInt(stockQuantity))) {
        showAlert({ title: 'Required Fields', message: 'Please enter a valid stock amount.', type: 'warning' });
        return;
      }
    }
    
    if (isBarcodeMode) {
      if (!barcode) {
        showAlert({ title: 'Required Fields', message: 'Please enter a barcode.', type: 'warning' });
        return;
      }
      if (!isBarcodeMatched && !rawImageUrl) {
        showAlert({ title: 'Required Fields', message: 'Please capture a raw photo of the product.', type: 'warning' });
        return;
      }
      if (!stockQuantity || parseInt(stockQuantity) <= 0) {
        showAlert({ title: 'Required Fields', message: 'Please enter a valid stock quantity.', type: 'warning' });
        return;
      }
    }

    try {
      setIsLoading(true);

      // Logistics Logic (Manual Toggle replaces AI)
      const manualWeight = parseFloat(weight) || 0;
      const needsLarge = manualWeight > 20 || isOversized;
      

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

      // Final Sanitization before sending
      const sanitizedDescription = descriptionPairs
        .filter(p => p.title.trim() || p.text.trim())
        .map(p => ({ title: p.title.trim(), text: p.text.trim() }));
      
      const sanitizedOptions = productOptions
        .map(o => ({
          title: o.title.trim(),
          values: o.values
            .filter((v: any) => v.value.trim() !== '')
            .map((v: any) => ({
              value: v.value.trim(),
              price_adjustment: parseFloat(v.price_adjustment) || 0
            }))
        }))
        .filter(o => o.title !== '' || o.values.length > 0);

      // Ensure completion status (Required for customer app visibility)
      const isComplete = !!(name.trim() && (parseFloat(price) > 0));

      const productData: any = {
        store_id: storeId,
        name: name.trim() || `Product ${barcode}`,
        description: JSON.stringify(sanitizedDescription),
        options: sanitizedOptions,
        tags: tags,
        price: parseFloat(price) || 0,
        weight_kg: manualWeight,
        category: category.trim(),
        image_url: finalImageUrl,
        barcode: barcode.trim() || null,
        product_type: productType,
        stock_quantity: parseInt(stockQuantity),
        in_stock: inStock,
        needs_large_vehicle: needsLarge,
        is_info_complete: isComplete, // Mark as complete once saved with details
        raw_image_url: rawImageUrl,
        preparation_time: parseInt(preparationTime) || 0,
        master_product_id: selectedMasterId,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { data: updatedData, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id)
          .select();
        
        if (error) {
          throw error;
        }
        
        if (!updatedData || updatedData.length === 0) {
          throw new Error('Product could not be updated. Please ensure you have permission to edit this item.');
        }
        
      } else {
        // INSERT MODE
        const { error } = await supabase
          .from('products')
          .insert(productData);
        
        if (error) {
          throw error;
        }
      }
      
      showToast(isEditing ? 'Product updated!' : 'Product added!', 'success');
      
      // Detailed confirmation for the user
      const descCount = sanitizedDescription.length;
      const optCount = sanitizedOptions.length;
      
      showAlert({
        title: isEditing ? 'Changes Saved' : 'Product Created',
        message: `Successfully confirmed on server.\n- ${descCount} description field(s)\n- ${optCount} option group(s)`,
        type: 'success',
        primaryAction: {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      });
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNeedChanges = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('products')
        .update({ needs_changes: true })
        .eq('id', product.id);
      
      if (error) throw error;
      showToast('Admin notified. Changes will be reviewed.', 'success');
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      <View style={[styles.header, { paddingTop: Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit Product' : `Add ${productType.charAt(0).toUpperCase() + productType.slice(1)} Product`}
        </Text>
        <View style={{ width: 40 }} /> 
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
                editable={!isEditing}
                rightIcon={
                  !isEditing && (
                    <TouchableOpacity onPress={() => setIsScannerVisible(true)}>
                      <Icon name="barcode-scan" size={24} color={Colors.primary} />
                    </TouchableOpacity>
                  )
                }
              />
              {!isEditing && (
                <Button 
                  title="Search Barcode"
                  onPress={handleBarcodeLookup}
                  loading={searchingBarcode}
                  variant="outline"
                  style={styles.searchBarcodeStatusBtn}
                />
              )}
            </View>
          )}

          {isBarcode && !isBarcodeMatched && (
            <View style={[styles.inputContainer, { marginTop: Spacing.md }]}>
              <Text style={styles.label}>Raw Image</Text>
              <TouchableOpacity 
                style={styles.imagePreviewContainer}
                onPress={takeRawPhoto}
              >
                {capturingRaw ? (
                  <ActivityIndicator size="large" color={Colors.primary} />
                ) : rawImageUrl ? (
                  <>
                    <Image source={{ uri: rawImageUrl }} style={styles.previewImage} />
                    <View style={styles.retakeOverlay}>
                      <Icon name="camera-retake" size={18} color={Colors.white} />
                      <Text style={styles.retakeLabel}>Retake Photo</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.placeholderContainer}>
                    <Icon name="camera-plus" size={40} color={Colors.textSecondary} />
                    <Text style={styles.placeholderText}>Tap to capture front-side product photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.helperText}>A clear photo of the product front side helps us identify it correctly.</Text>
            </View>
          )}


          {showAdminDetails && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Product Image</Text>
              <TouchableOpacity 
                style={[
                  styles.imagePreviewContainer, 
                  !canEditAdminDetails && styles.disabledInput,
                  uploading && styles.uploadingContainer
                ]}
                onPress={pickImage}
                disabled={!canEditAdminDetails || uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="large" color={Colors.primary} />
                ) : imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.previewImage} />
                ) : (
                  <View style={styles.placeholderContainer}>
                    <Icon 
                      name={isPersonal ? "camera-plus" : "image-search"} 
                      size={40} 
                      color={Colors.textSecondary} 
                    />
                    <Text style={styles.placeholderText}>
                      {isPersonal 
                        ? "Tap to upload product photo" 
                        : isCommon ? "Image will be added by Admin" : "No image available"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.helperText}>
                {isPersonalMode 
                  ? "Upload a clear photo of your unique product." 
                  : "Images for this product type are managed by Administrators."}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Details</Text>
          {isBarcodeMode && (
            <Text style={styles.barcodeHelperText}>
              {isBarcodeMatched 
                ? "You can only set stock amount and rest will be filled by admin."
                : "Product details and image will be added by admin. You can only add stock amount."
              }
            </Text>
          )}
          {isCommon && !isEditing && (
            <Text style={styles.barcodeHelperText}>
              You can only fill some details and rest will be filled by admin.
            </Text>
          )}
          {showAllFields && (
            <>
              <View style={{ zIndex: 1000 }}>
                <Input
                  label="Product Name"
                  placeholder="Type product name (e.g. Tomato)"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (isCommon) {
                      setHasMadeCommonChoice(false);
                      searchMasterCatalog(text);
                    }
                  }}
                  editable={canEditName}
                  containerStyle={styles.inputSpacing}
                  rightIcon={
                    (selectedMasterId || (isCommon && hasMadeCommonChoice)) ? (
                      <TouchableOpacity onPress={() => {
                        setSelectedMasterId(null);
                        setHasMadeCommonChoice(false);
                      }}>
                        <Icon name="close-circle" size={20} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    ) : null
                  }
                />
                
                {isCommon && name.length >= 2 && !hasMadeCommonChoice && (
                  <View style={[styles.suggestionsContainer, { zIndex: 9999 }]}>
                    {isSearchingMaster && masterSuggestions.length === 0 ? (
                      <View style={{ padding: 15, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                      </View>
                    ) : (
                      <>
                        {masterSuggestions.map((master) => (
                          <TouchableOpacity 
                            key={master.id} 
                            style={styles.suggestionItem}
                            onPress={() => handleSelectMasterProduct(master)}
                          >
                            {master.image_url && (
                              <Image source={{ uri: master.image_url }} style={styles.suggestionImage} />
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.suggestionName}>{master.name}</Text>
                              <Text style={styles.suggestionCategory}>{master.category}</Text>
                            </View>
                            <Icon name="plus-circle" size={20} color={Colors.primary} />
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity 
                          style={[styles.suggestionItem, { borderBottomWidth: 0 }]}
                          onPress={handleAddNewCommonProduct}
                        >
                          <View style={styles.addNewIconContainer}>
                            <Icon name="plus" size={20} color={Colors.white} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.suggestionName, { color: Colors.primary, fontWeight: '700' }]}>Add New Product</Text>
                            <Text style={styles.suggestionCategory}>Click here if product is not in list</Text>
                          </View>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </View>

              {showAdminDetails && (
                <TouchableOpacity 
                  style={styles.categoryTrigger}
                  onPress={() => !isBarcode && setCategoryModalVisible(true)}
                  activeOpacity={0.7}
                  disabled={isBarcode}
                >
                  <Text style={styles.label}>Category</Text>
                  <View style={styles.categoryValueRow}>
                    <Text style={[styles.categoryValueText, !category && { color: Colors.textSecondary }]}>
                      {category || 'Select a category'}
                    </Text>
                    <Icon name="chevron-down" size={20} color={Colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              )}

              {category === 'Food' && (isCommon || isPersonal) && (
                <Input
                  label="Preparation Time (minutes)"
                  placeholder="0"
                  value={preparationTime}
                  onChangeText={setPreparationTime}
                  keyboardType="numeric"
                  containerStyle={styles.inputSpacing}
                  editable={canEditPriceWeight}
                  leftIcon={<Icon name="clock-outline" size={20} color={Colors.textSecondary} style={{marginRight: 8}} />}
                />
              )}

              <View style={styles.descriptionSection}>
                <View style={styles.specHeader}>
                  <Text style={styles.label}>Description</Text>
                </View>
                {descriptionPairs.map((pair, index) => (
                  <View key={index} style={styles.pairContainer}>
                    <View style={styles.pairInputs}>
                      <View style={styles.pairTitleCol}>
                        <TextInput
                          placeholder="e.g. Material"
                          placeholderTextColor={Colors.textSecondary}
                          value={pair.title}
                          onChangeText={(val) => {
                            const next = [...descriptionPairs];
                            next[index] = { ...next[index], title: val };
                            setDescriptionPairs(next);
                          }}
                          style={styles.pairInput}
                          editable={canEditPriceWeight}
                        />
                      </View>
                      <View style={styles.pairTextCol}>
                        <TextInput
                          placeholder="e.g. Cotton"
                          placeholderTextColor={Colors.textSecondary}
                          value={pair.text}
                          onChangeText={(val) => {
                            const next = [...descriptionPairs];
                            next[index] = { ...next[index], text: val };
                            setDescriptionPairs(next);
                          }}
                          multiline
                          editable={canEditPriceWeight}
                        />
                      </View>
                    </View>
                    {canEditPriceWeight && descriptionPairs.length > 1 && (
                      <TouchableOpacity 
                        onPress={() => setDescriptionPairs(descriptionPairs.filter((_, i) => i !== index))}
                        style={styles.removePairBtn}
                      >
                        <Icon name="delete-outline" size={20} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {canEditPriceWeight && (
                  <TouchableOpacity 
                    style={styles.addPairBtn}
                    onPress={() => setDescriptionPairs([...descriptionPairs, { title: '', text: '' }])}
                  >
                    <Icon name="plus-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.addPairText}>Add More Details</Text>
                  </TouchableOpacity>
                )}

                {/* Sub-section: Options */}
                <View style={styles.optionsSubSection}>
                  <Text style={styles.label}>Options</Text>
                  <View style={styles.optionsList}>
                    {productOptions.map((opt, oIdx) => (
                      <View key={oIdx} style={styles.optionEntry}>
                        <View style={styles.optionMainRow}>
                          <View style={styles.optionTitleField}>
                            <Text style={styles.tinyLabel}>Title</Text>
                          <View style={styles.optionInputWithAction}>
                            <TextInput
                              placeholder="e.g. Color, Size, etc."
                              placeholderTextColor={Colors.textSecondary + '70'}
                              value={opt.title}
                              onChangeText={(val) => {
                                setProductOptions(prev => {
                                  const next = [...prev];
                                  next[oIdx].title = val;
                                  return next;
                                });
                              }}
                              style={styles.optionTitleInput}
                              editable={canEditPriceWeight}
                            />
                            {canEditPriceWeight && productOptions.length > 1 && (
                              <TouchableOpacity 
                                onPress={() => setProductOptions(prev => prev.filter((_, i) => i !== oIdx))}
                                style={styles.deleteOptionBtn}
                              >
                                <Icon name="trash-can-outline" size={20} color={Colors.error} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        </View>
                        <View style={styles.optionValuesField}>
                          <Text style={styles.tinyLabel}>Values</Text>
                          <View style={styles.valuesList}>
                            {opt.values.map((valObj: any, vIdx: number) => (
                              <View key={vIdx} style={[styles.optionInputWithAction, { marginBottom: 12, alignItems: 'center' }]}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <TextInput
                                    placeholder={vIdx === 0 ? "Base Option (e.g. S)" : "Value (e.g. M)"}
                                    placeholderTextColor={Colors.textSecondary + '70'}
                                    value={valObj.value}
                                    onChangeText={(newVal) => {
                                      setProductOptions(prev => {
                                        const next = [...prev];
                                        const updatedValues = [...next[oIdx].values];
                                        updatedValues[vIdx] = { ...updatedValues[vIdx], value: newVal };
                                        next[oIdx] = { ...next[oIdx], values: updatedValues };
                                        return next;
                                      });
                                    }}
                                    style={[styles.optionValueInput, { width: '100%' }]}
                                    editable={canEditPriceWeight}
                                  />
                                </View>
                                <View style={{ width: 85, marginRight: 4 }}>
                                  {vIdx === 0 ? (
                                    <View style={[styles.optionValueInput, { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderColor: Colors.border, borderStyle: 'dashed' }]}>
                                      <Text style={{ fontSize: 10, color: Colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>Base Price</Text>
                                    </View>
                                  ) : (
                                    <TextInput
                                      placeholder="+₹0"
                                      placeholderTextColor={Colors.textSecondary + '70'}
                                      value={valObj.price_adjustment?.toString() === '0' ? '' : valObj.price_adjustment?.toString()}
                                      onChangeText={(newPrice) => {
                                        setProductOptions(prev => {
                                          const next = [...prev];
                                          const updatedValues = [...next[oIdx].values];
                                          updatedValues[vIdx] = { ...updatedValues[vIdx], price_adjustment: newPrice.replace(/[^0-9]/g, '') };
                                          next[oIdx] = { ...next[oIdx], values: updatedValues };
                                          return next;
                                        });
                                      }}
                                      keyboardType="numeric"
                                      style={[styles.optionValueInput, { textAlign: 'center' }]}
                                      editable={canEditPriceWeight}
                                    />
                                  )}
                                </View>
                                {canEditPriceWeight && opt.values.length > 1 && (
                                  <TouchableOpacity 
                                    onPress={() => {
                                      setProductOptions(prev => {
                                        const next = [...prev];
                                        next[oIdx].values = next[oIdx].values.filter((_: any, i: number) => i !== vIdx);
                                        return next;
                                      });
                                    }}
                                    style={styles.deleteValueBtn}
                                  >
                                    <Icon name="trash-can-outline" size={20} color={Colors.error} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            ))}
                          </View>
                          {canEditPriceWeight && (
                            <View style={{ alignItems: 'flex-end' }}>
                              <TouchableOpacity 
                                onPress={() => {
                                  setProductOptions(prev => {
                                    const next = [...prev];
                                    next[oIdx].values = [...next[oIdx].values, { value: '', price_adjustment: 0 }];
                                    return next;
                                  });
                                }}
                                style={styles.addValueSmallBtn}
                              >
                                <Icon name="plus-circle-outline" size={16} color="#0284C7" />
                                <Text style={styles.addValueSmallText}>Add Value</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>

                  {canEditPriceWeight && (
                    <TouchableOpacity 
                      style={styles.addPairBtn}
                      onPress={() => setProductOptions(prev => [...prev, { title: '', values: [{ value: '', price_adjustment: 0 }], currentInput: '' }])}
                    >
                      <Icon name="plus-circle-outline" size={20} color={Colors.primary} />
                      <Text style={styles.addPairText}>Add More Options</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing & Inventory</Text>
          {showAllFields && (
            <Input
              label="Price (₹)"
              placeholder="0.00"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              containerStyle={styles.inputSpacing}
              editable={canEditPriceWeight}
              leftIcon={<Text style={{fontSize: 16, color: Colors.textSecondary, fontWeight: '700'}}>₹</Text>}
            />
          )}
          
          <View style={styles.row}>
            {showAllFields && (
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input
                  label="Weight (kg)"
                  placeholder="0.00"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  editable={canEditPriceWeight}
                  leftIcon={<Icon name="weight-kilogram" size={20} color={Colors.textSecondary} />}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Input
                label="Stock"
                placeholder="0"
                value={stockQuantity}
                onChangeText={setStockQuantity}
                editable={canEditStock}
                keyboardType="numeric"
              />
            </View>
          </View>

          {showAdminDetails && (
            <View style={styles.logisticsSection}>
              <Text style={styles.logisticsTitle}>Delivery Details</Text>
              <View style={styles.deliveryOptionsRow}>
                <TouchableOpacity 
                  style={[styles.deliveryOptionCard, !isOversized && styles.deliveryOptionActive]}
                  onPress={() => canEditAdminDetails && setIsOversized(false)}
                  activeOpacity={0.7}
                  disabled={!canEditAdminDetails}
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
                  onPress={() => canEditAdminDetails && setIsOversized(true)}
                  activeOpacity={0.7}
                  disabled={!canEditAdminDetails}
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
          )}
        </View>

        {isEditing && isBarcodeMode && (
          <Button
            title="Need Changes"
            onPress={handleNeedChanges}
            variant="outline"
            style={styles.needChangesBtn}
            textStyle={styles.needChangesText}
            leftIcon={<Icon name="alert-circle-outline" size={18} color={Colors.error} />}
          />
        )}

        {/* Tags Section */}
        {showAdminDetails && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags (Synonyms)</Text>
            <Text style={styles.helperText}>
              Add synonyms to help customers find this product. e.g. "kela" for "Banana".
            </Text>
            
            <Input
              placeholder="Type a tag..."
              value={tagInput}
              onChangeText={setTagInput}
              editable={canEditAdminDetails}
              onSubmitEditing={() => {
                if (tagInput.trim() && canEditAdminDetails) {
                  setTags(prev => [...new Set([...prev, tagInput.trim().toLowerCase()])]);
                  setTagInput('');
                }
              }}
              rightIcon={
                <TouchableOpacity 
                  onPress={() => {
                    if (tagInput.trim() && canEditAdminDetails) {
                      setTags(prev => [...new Set([...prev, tagInput.trim().toLowerCase()])]);
                      setTagInput('');
                    }
                  }}
                  disabled={!canEditAdminDetails}
                  style={[styles.inlineAddBtn, !canEditAdminDetails && { opacity: 0.5 }]}
                >
                  <Text style={styles.inlineAddBtnText}>Add</Text>
                </TouchableOpacity>
              }
            />

            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View key={index} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                  {canEditAdminDetails && (
                    <TouchableOpacity 
                      onPress={() => setTags(prev => prev.filter((_, i) => i !== index))}
                      style={styles.removeTagBtn}
                    >
                      <Icon name="close-circle" size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        <Button
          title={isEditing ? "Save Changes" : "Confirm Product"}
          onPress={handleSaveProduct}
          loading={isLoading}
          style={styles.submitButton}
        />
      </ScrollView>
      </KeyboardAvoidingView>

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

      <BarcodeScannerModal
        isVisible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScan={(code) => {
          setBarcode(code);
        }}
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
    paddingBottom: 120,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
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
    width: '100%',
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
  barcodeHelperText: {
    fontSize: 13,
    color: Colors.primary,
    marginBottom: Spacing.md,
    fontWeight: '600',
    backgroundColor: Colors.primary + '08',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
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
  needChangesBtn: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
    borderWidth: 1.5,
  },
  needChangesText: {
    color: Colors.error,
    fontWeight: '700',
  },
  searchBarcodeStatusBtn: {
    marginTop: Spacing.sm,
    borderColor: Colors.primary,
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
  pairContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: borderRadius.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    overflow: 'hidden',
  },
  pairInputs: {
    flex: 1,
    flexDirection: 'row',
  },
  pairTitleCol: {
    width: '35%',
    borderRightWidth: 1,
    borderRightColor: '#D1D1D6',
    backgroundColor: Colors.surface,
  },
  pairTextCol: {
    flex: 1,
  },
  pairInput: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  removePairBtn: {
    padding: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#D1D1D6',
    backgroundColor: Colors.white,
  },
  specHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addSmallText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  optionsSubSection: {
    marginTop: 20,
    paddingTop: 0,
  },
  optionsSubTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputSpacing: {
    marginBottom: Spacing.md,
  },
  categoryTrigger: {
    marginBottom: Spacing.md,
  },
  categoryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  categoryValueText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  descriptionSection: {
    marginTop: 12,
  },
  optionsList: {
    marginTop: Spacing.xs,
  },
  optionEntry: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D1D1D6',
    marginBottom: 12,
  },
  optionMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionTitleField: {
    flex: 1,
  },
  deleteOptionBtn: {
    padding: 8,
    marginLeft: 8,
  },
  tinyLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  optionTitleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text,
    padding: 8,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D1D6',
  },
  optionInputWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionValueInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    padding: 8,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D1D6',
    fontWeight: '400',
  },
  optionValuesField: {
    paddingTop: 5,
  },
  valuesList: {
    marginTop: 4,
  },
  addValueSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  addValueSmallText: {
    color: '#0284C7',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  emptyOptionsPlaceholder: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E5EA',
    borderRadius: 16,
  },
  emptyOptionsText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 10,
  },
  emptyOptionsSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  addPairBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: Colors.primary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
  },
  addPairText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  retakeOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  retakeLabel: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineAddBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: -4, // Adjust for Input component padding
  },
  inlineAddBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  addTagBtn: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addTagBtnText: {
    color: Colors.white,
    fontWeight: '700',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.border + '50',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  removeTagBtn: {
    marginLeft: 6,
  },
  returnOptionsContainer: {
    marginTop: Spacing.md,
    gap: 12,
  },
  returnOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  returnOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  returnOptionActiveNoReturn: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '08',
  },
  returnOptionContent: {
    flex: 1,
    marginLeft: 12,
  },
  returnOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  returnOptionSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxCheckedNoReturn: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  addNewIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 75,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    marginRight: Spacing.md,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  suggestionCategory: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  catalogBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  catalogBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
    textTransform: 'uppercase',
  },
  masterNoticeCard: {
    backgroundColor: '#EFF6FF', // Light blue background
    borderRadius: 20,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#BFDBFE', // Soft blue border
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  masterNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  masterNoticeTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1E40AF', // Deep blue
    letterSpacing: -0.3,
  },
  masterNoticeDescription: {
    fontSize: 14,
    color: '#1E3A8A', // Dark blue text
    lineHeight: 20,
    opacity: 0.85,
    marginBottom: 14,
  },
  masterNoticeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
  },
  masterNoticeFooterText: {
    fontSize: 12,
    color: '#3B82F6', // Vibrant blue
    fontWeight: '700',
    flex: 1,
  },
});
