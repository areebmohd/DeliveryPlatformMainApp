import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from './Button';
import { calculateProductPrice, getPriceAdjustmentLabel } from '../../utils/priceUtils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ProductOptionsModalProps {
  visible: boolean;
  product: any;
  onClose: () => void;
  onConfirm: (selectedOptions: Record<string, string>, finalPrice: number) => void;
}

export const ProductOptionsModal = ({
  visible,
  product,
  onClose,
  onConfirm,
}: ProductOptionsModalProps) => {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset selections when opening
      setSelectedOptions({});
      
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!product) return null;

  const currentPrice = calculateProductPrice(product, selectedOptions);

  const handleConfirm = () => {
    // Validate all options are selected
    const missing = product.options?.find((opt: any) => !selectedOptions[opt.title]);
    if (missing) {
      // We could show a tiny internal shake or alert here
      return;
    }
    onConfirm(selectedOptions, currentPrice);
    onClose();
  };

  const isAllSelected = !product.options?.find((opt: any) => !selectedOptions[opt.title]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[styles.backdrop, { opacity: backdropAnim }]} 
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.sheet, 
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View style={styles.productInfo}>
              {product.image_url ? (
                <Image source={{ uri: product.image_url }} style={styles.productImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Icon name="package-variant" size={24} color={Colors.border} />
                </View>
              )}
              <View style={styles.titleInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productPrice}>₹{currentPrice}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.optionsScroll}
            showsVerticalScrollIndicator={false}
          >
            {product.options?.map((opt: any, idx: number) => (
              <View key={idx} style={styles.optionGroup}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>{opt.title}</Text>
                  {!selectedOptions[opt.title] && (
                    <Text style={styles.requiredLabel}>Required</Text>
                  )}
                </View>
                <View style={styles.chipsContainer}>
                  {opt.values.map((val: string | any, vIdx: number) => {
                    const isSelected = selectedOptions[opt.title] === (typeof val === 'string' ? val : val.value);
                    return (
                      <TouchableOpacity
                        key={vIdx}
                        style={[
                          styles.chip,
                          isSelected && styles.chipSelected
                        ]}
                        onPress={() => setSelectedOptions({ ...selectedOptions, [opt.title]: (typeof val === 'string' ? val : (val as any).value) })}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected
                        ]}>
                          {(typeof val === 'string' ? val : (val as any).value)}
                          {getPriceAdjustmentLabel(val)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Add to Cart"
              onPress={handleConfirm}
              disabled={!isAllSelected}
              style={!isAllSelected ? { backgroundColor: '#999', opacity: 0.7 } : undefined}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  optionsScroll: {
    marginBottom: Spacing.xs,
  },
  optionGroup: {
    marginBottom: Spacing.lg,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  requiredLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.error,
    textTransform: 'uppercase',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Colors.white,
    fontWeight: '700',
  },
  footer: {
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
