import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAlert } from '../../context/AlertContext';
import { supabase, uploadImage } from '../../api/supabase';
import { launchCamera } from 'react-native-image-picker';

const RETURN_REASONS = [
  'Damaged or Defective product',
  'Incorrect item received',
  'Quality not as expected',
  'Item expired',
  'Missing parts/items',
  'Other',
];

export const ApplyReturnScreen = ({ route, navigation }: any) => {
  const { order } = route.params;
  const insets = useSafeAreaInsets();
  const { showAlert, showToast } = useAlert();

  const [existingReturns, setExistingReturns] = useState<string[]>([]);
  const [fetchingExisting, setFetchingExisting] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [selectedReturnType, setSelectedReturnType] = useState('');
  const [image, setImage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [isReasonModalVisible, setIsReasonModalVisible] = useState(false);
  const [isReturnTypeModalVisible, setIsReturnTypeModalVisible] = useState(false);

  const fetchExistingReturns = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('returns')
        .select('product_id')
        .eq('order_id', order.id);

      if (error) throw error;
      setExistingReturns(data?.map(r => r.product_id) || []);
    } catch (e) {
      console.error('Error fetching existing returns:', e);
    } finally {
      setFetchingExisting(false);
    }
  }, [order.id]);

  React.useEffect(() => {
    fetchExistingReturns();
  }, [fetchExistingReturns]);

  const handleSelectImage = async () => {
    const result = await launchCamera({
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.5,
      saveToPhotos: false,
    });

    if (result.assets && result.assets[0]) {
      setImage(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      return showAlert({ title: 'Error', message: 'Please select a product to return.', type: 'error' });
    }
    if (!selectedReturnType) {
      return showAlert({ title: 'Error', message: 'Please select a return type (Refund or Exchange).', type: 'error' });
    }
    if (!selectedReason) {
      return showAlert({ title: 'Error', message: 'Please select a reason for return.', type: 'error' });
    }
    if (!image) {
      return showAlert({ title: 'Error', message: 'Please upload a picture of the product.', type: 'error' });
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Upload image now on submit
      const fileName = `returns/${user.id}/${Date.now()}.jpg`;
      const imageUrl = await uploadImage('products', fileName, image.base64);

      // Insert return record
      const { error } = await supabase
        .from('returns')
        .insert({
          order_id: order.id,
          product_id: selectedProduct.product_id,
          user_id: user.id,
          reason: selectedReason,
          return_type: selectedReturnType,
          image_url: imageUrl,
          status: 'pending'
        });

      if (error) throw error;

      showToast('Return request applied successfully!', 'success');
      navigation.goBack();
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to submit return request.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderProductItem = ({ item }: { item: any }) => {
    const isAlreadyReturned = existingReturns.includes(item.product_id);
    const isAvailable = (item.products?.allow_refund || item.products?.allow_exchange) && !isAlreadyReturned;
    
    return (
      <TouchableOpacity
        style={[styles.modalItem, !isAvailable && styles.disabledItem]}
        onPress={() => {
          if (isAlreadyReturned) {
            return showAlert({ 
              title: 'Already Applied', 
              message: 'A return request for this product is already in progress.', 
              type: 'info' 
            });
          }
          if (!isAvailable) {
            return showAlert({ 
              title: 'Not Returnable', 
              message: 'This product is not available for return as per store policy.', 
              type: 'info' 
            });
          }
          setSelectedProduct(item);
          setSelectedReturnType(''); // Reset return type when product changes
          setIsProductModalVisible(false);
        }}
      >
        <View style={styles.modalItemContent}>
          <Text style={[styles.modalItemName, !isAvailable && styles.disabledText]}>{item.product_name}</Text>
          <View style={styles.availabilityRow}>
            <Text style={[styles.availabilityText, { color: isAlreadyReturned ? Colors.warning : isAvailable ? Colors.success : Colors.error }]}>
              {isAlreadyReturned ? 'Return In Progress' : isAvailable ? 'Return Available' : 'No Return Available'}
            </Text>
            <Text style={styles.modalItemQty}> • Qty: {item.quantity}</Text>
          </View>
        </View>
        {selectedProduct?.product_id === item.product_id && (
          <Icon name="check-circle" size={20} color={Colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const renderReturnTypeItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.modalItem}
      onPress={() => {
        setSelectedReturnType(item);
        setIsReturnTypeModalVisible(false);
      }}
    >
      <Text style={styles.modalItemText}>{item}</Text>
      {selectedReturnType === item && (
        <Icon name="check-circle" size={20} color={Colors.primary} />
      )}
    </TouchableOpacity>
  );

  const renderReasonItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.modalItem}
      onPress={() => {
        setSelectedReason(item);
        setIsReasonModalVisible(false);
      }}
    >
      <Text style={styles.modalItemText}>{item}</Text>
      {selectedReason === item && (
        <Icon name="check-circle" size={20} color={Colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Apply Return</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Order Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="receipt" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>Order Details</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID</Text>
            <Text style={styles.infoValue}>#{order.order_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          </View>
        </View>

        {/* Product Selection */}
        <Text style={styles.label}>Select Product to Return</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setIsProductModalVisible(true)}
        >
          <Text style={[styles.dropdownText, !selectedProduct && styles.placeholder]}>
            {selectedProduct ? selectedProduct.product_name : 'Choose a product'}
          </Text>
          <Icon name="chevron-down" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Return Type Selection - Only if product is selected */}
        {selectedProduct && (
          <>
            <Text style={styles.label}>Return Type</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setIsReturnTypeModalVisible(true)}
            >
              <Text style={[styles.dropdownText, !selectedReturnType && styles.placeholder]}>
                {selectedReturnType || 'Select return type'}
              </Text>
              <Icon name="chevron-down" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </>
        )}

        {/* Reason Selection */}
        <Text style={styles.label}>Reason for Return</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setIsReasonModalVisible(true)}
        >
          <Text style={[styles.dropdownText, !selectedReason && styles.placeholder]}>
            {selectedReason || 'Select reason'}
          </Text>
          <Icon name="chevron-down" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Image Upload */}
        <Text style={styles.label}>Upload Product Picture</Text>
        <TouchableOpacity 
          style={styles.imageUploadBox} 
          onPress={handleSelectImage}
        >
          {image ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              <View style={styles.changeImageOverlay}>
                <Icon name="camera" size={24} color={Colors.white} />
                <Text style={styles.changeImageText}>Change Photo</Text>
              </View>
            </View>
          ) : (
            <View style={styles.placeholderBox}>
              <Icon name="camera-outline" size={40} color={Colors.primary} />
              <Text style={styles.uploadText}>Tap to capture product photo</Text>
              <Text style={styles.uploadSubtext}>Real-time photo required</Text>
            </View>
          )}
        </TouchableOpacity>

        <Button
          title="Submit Return Request"
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitBtn}
        />
      </ScrollView>

      {/* Product Selection Modal */}
      <Modal visible={isProductModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Product</Text>
              <TouchableOpacity onPress={() => setIsProductModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={order.order_items}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.product_id}
              contentContainerStyle={styles.modalList}
            />
          </View>
        </View>
      </Modal>

      {/* Return Type Selection Modal */}
      <Modal visible={isReturnTypeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Return Type</Text>
              <TouchableOpacity onPress={() => setIsReturnTypeModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[
                ...(selectedProduct?.products?.allow_refund ? ['Refund'] : []),
                ...(selectedProduct?.products?.allow_exchange ? ['Exchange'] : []),
              ]}
              renderItem={renderReturnTypeItem}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.modalList}
            />
          </View>
        </View>
      </Modal>

      {/* Reason Selection Modal */}
      <Modal visible={isReasonModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Reason</Text>
              <TouchableOpacity onPress={() => setIsReasonModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={RETURN_REASONS}
              renderItem={renderReasonItem}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.modalList}
            />
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
    marginLeft: 4,
  },
  dropdown: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  dropdownText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  placeholder: {
    color: Colors.textSecondary,
  },
  imageUploadBox: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 40,
  },
  placeholderBox: {
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  uploadSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  changeImageText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  submitBtn: {
    height: 56,
    borderRadius: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Spacing.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  modalList: {
    paddingBottom: 20,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '50',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalItemQty: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  disabledItem: {
    opacity: 0.6,
  },
  disabledText: {
    color: Colors.textSecondary,
  },
});
