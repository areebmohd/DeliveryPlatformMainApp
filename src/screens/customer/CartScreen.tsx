import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { useCart } from '../../context/CartContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AlertModal } from '../../components/ui/AlertModal';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import RNUpiPayment from 'react-native-upi-payment';
import Geolocation from '@react-native-community/geolocation';

const { width, height } = Dimensions.get('window');

export const CartScreen = ({ navigation }: any) => {
  const { items, updateQuantity, subtotal, totalItems, clearCart, sessionAddress, setSessionAddress } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [receiverInfoVisible, setReceiverInfoVisible] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [tempLocation, setTempLocation] = useState<any>(null);
  const [infoModal, setInfoModal] = useState<{ visible: boolean, title: string, content: string }>({
    visible: false,
    title: '',
    content: ''
  });

  const insets = useSafeAreaInsets();

  // Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    primaryAction?: any;
    showCancel?: boolean;
    onClose?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = (title: string, message: string, type: any = 'info', primaryAction?: any, showCancel: boolean = true) => {
    setAlertConfig({ visible: true, title, message, type, primaryAction, showCancel });
  };

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
    
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) {
        fetchAddresses();
      }
    });

    return unsubscribe;
  }, [user, navigation]);

  const fetchAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_deleted', false)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setSavedAddresses(data || []);
      if (data && data.length > 0 && !selectedAddress) {
        setSelectedAddress(data[0]);
      }
    } catch (e) {
      console.error('Error fetching addresses:', e);
    }
  };

  const handleUseCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        setTempLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setAddressModalVisible(false);
        setReceiverInfoVisible(true);
      },
      (error) => {
        showAlert('Location Error', 'Could not get your current location. Please check permissions.', 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleSaveReceiverInfo = async () => {
    if (!receiverName.trim() || !receiverPhone.trim()) {
      showAlert('Required', 'Please enter receiver name and phone number', 'warning');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('addresses')
        .insert({
          user_id: user?.id,
          address_line: 'Current Location', 
          city: 'Gurugram', 
          pincode: '122001',
          location: `SRID=4326;POINT(${tempLocation.longitude} ${tempLocation.latitude})`,
          label: `${receiverName} (${receiverPhone})`
        })
        .select()
        .single();

      if (error) throw error;
      
      setSelectedAddress(data);
      fetchAddresses();
      setReceiverInfoVisible(false);
      setReceiverName('');
      setReceiverPhone('');
    } catch (e: any) {
      showAlert('Error', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fees Logic
  const platformFee = subtotal >= 500 ? (subtotal * 0.01) : 5;
  const deliveryFee = totalItems > 0 ? 30 : 0; 
  const grandTotal = subtotal + deliveryFee + platformFee;

  const handleCheckout = async () => {
    if (items.length === 0) return;

    // Profile Info Validation
    const { profile } = useAuth();
    if (!profile?.full_name || !profile?.phone || !profile?.upi_id) {
      showAlert(
        'Profile Incomplete',
        'Please provide your Full Name, Phone, and UPI ID in the Account page before placing an order.',
        'warning',
        {
          text: 'Go to Account',
          onPress: () => navigation.navigate('Account'),
        }
      );
      return;
    }

    if (!selectedAddress && !sessionAddress) {
      showAlert('Address Required', 'Please select a delivery address', 'warning');
      return;
    }
    
    try {
      setLoading(true);

      let finalAddressId = selectedAddress?.id;

      // If use session address, save it temporarily to get an ID
      if (sessionAddress) {
        const { data: tempAddr, error: addrError } = await supabase
          .from('addresses')
          .insert({
            user_id: user?.id,
            address_line: sessionAddress.address_line,
            city: sessionAddress.city,
            state: sessionAddress.state,
            pincode: sessionAddress.pincode,
            location: sessionAddress.location,
            receiver_name: sessionAddress.receiver_name,
            receiver_phone: sessionAddress.receiver_phone,
            label: sessionAddress.label,
            is_deleted: true // Hide it from the user's address book
          })
          .select()
          .single();
        
        if (addrError) throw addrError;
        finalAddressId = tempAddr.id;
      }
      
      // Group items by store for orders
      const storesInCart = [...new Set(items.map(i => i.store_id))];
      
      for (const storeId of storesInCart) {
        const storeItems = items.filter(i => i.store_id === storeId);
        const storeSubtotal = storeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('upi_id, name')
          .eq('id', storeId)
          .single();
        
        if (storeError || !store.upi_id) {
          throw new Error(`Store ${storeId} UPI ID not found.`);
        }

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            customer_id: user?.id,
            store_id: storeId,
            delivery_address_id: finalAddressId,
            subtotal: storeSubtotal,
            total_amount: grandTotal, 
            delivery_fee: deliveryFee,
            platform_fee: platformFee,
            status: 'pending_verification',
            payment_method: 'pay_now',
            payment_status: 'pending'
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const orderItems = storeItems.map(item => ({
          order_id: order.id,
          product_id: item.id,
          product_name: item.name,
          product_price: item.price,
          quantity: item.quantity
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // UPI Payment
        if (RNUpiPayment && RNUpiPayment.initializePayment) {
          RNUpiPayment.initializePayment(
            {
              vpa: store.upi_id,
              payeeName: store.name,
              amount: grandTotal.toFixed(2),
              transactionNote: `Order #${order.order_number}`,
              transactionRef: order.id,
            },
            () => {
              clearCart();
              navigation.navigate('Orders');
            },
            () => {
              showAlert('Payment Failed', 'Order saved. Please pay on delivery or try again.', 'error');
            }
          );
        } else {
          clearCart();
          navigation.navigate('Orders');
        }
      }

    } catch (e: any) {
      showAlert('Error', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Group items by store
  const groupedItems = items.reduce((acc: any, item: any) => {
    if (!acc[item.store_id]) {
      acc[item.store_id] = {
        name: item.store_name,
        items: []
      };
    }
    acc[item.store_id].items.push(item);
    return acc;
  }, {});

  if (items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.emptyContainer}>
          <Icon name="cart-outline" size={80} color={Colors.border} />
          <Text style={styles.emptyTitle}>Cart is empty</Text>
          <Text style={styles.emptySubtitle}>Look around and add some items!</Text>
          <TouchableOpacity 
            style={styles.browseBtn}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.browseBtnText}>Browse Stores</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 150 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Cart</Text>
          <TouchableOpacity 
            style={styles.clearBtn} 
            onPress={() => showAlert(
              'Clear Cart?', 
              'Are you sure you want to remove all items from your cart?', 
              'warning',
              { text: 'Yes, Clear', onPress: clearCart, variant: 'destructive' }
            )}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Store-wise Items */}
        {Object.entries(groupedItems).map(([storeId, storeData]: [string, any]) => (
          <View key={storeId} style={styles.storeSection}>
            <View style={styles.storeHeader}>
              <Icon name="storefront-outline" size={20} color={Colors.text} />
              <Text style={styles.storeName}>{storeData.name}</Text>
            </View>
            {storeData.items.map((item: any) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₹{item.price}</Text>
                </View>
                <View style={styles.quantityControls}>
                  <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}>
                    <Icon name="minus" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}>
                    <Icon name="plus" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Address Selection */}
        <View style={styles.addressSection}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <TouchableOpacity 
            style={styles.addressBox} 
            onPress={() => setAddressModalVisible(true)}
          >
            <Icon 
              name={sessionAddress ? "crosshairs-gps" : (selectedAddress?.label.toLowerCase().includes('home') ? 'home-outline' : 'map-marker-outline')} 
              size={24} 
              color={Colors.primary} 
            />
            <View style={styles.addressInfo}>
              <Text style={styles.addressLabel}>
                {sessionAddress ? sessionAddress.label : (selectedAddress?.label || 'Select Address')}
              </Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {sessionAddress 
                  ? `${sessionAddress.address_line}, ${sessionAddress.city}`
                  : (selectedAddress ? selectedAddress.address_line : 'Where should we deliver?')}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Bill Details */}
        <View style={styles.billDetails}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.billRow}>
            <View style={styles.labelWithInfo}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <TouchableOpacity onPress={() => setInfoModal({
                visible: true,
                title: 'Delivery Fee',
                content: 'Pickup Fee: ₹20\nPer KM Fee: ₹5\n(Approximate based on distance)'
              })}>
                <Icon name="information-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.billValue}>₹{deliveryFee.toFixed(2)}</Text>
          </View>

          <View style={styles.billRow}>
            <View style={styles.labelWithInfo}>
              <Text style={styles.billLabel}>Platform Fee</Text>
              <TouchableOpacity onPress={() => setInfoModal({
                visible: true,
                title: 'Platform Fee',
                content: 'Orders below ₹500: ₹5\nOrders above ₹500: 1% of subtotal'
              })}>
                <Icon name="information-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.billValue}>₹{platformFee.toFixed(2)}</Text>
          </View>

          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order Box - Fixed Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.checkoutInfo}>
          <Text style={styles.checkoutTotal}>₹{grandTotal.toFixed(2)}</Text>
          <Text style={styles.checkoutLabel}>Total Payable</Text>
        </View>
        <Button 
          title="Place Order" 
          onPress={handleCheckout} 
          style={styles.checkoutBtn}
          loading={loading}
        />
      </View>

      {/* Address Selection Modal */}
      <Modal
        visible={addressModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Delivery Address</Text>
              <TouchableOpacity onPress={() => setAddressModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <TouchableOpacity 
                style={styles.modalOption} 
                onPress={() => {
                  setAddressModalVisible(false);
                  navigation.navigate('AddLiveLocation');
                }}
              >
                <Icon name="crosshairs-gps" size={24} color={sessionAddress ? Colors.primary : Colors.primary} />
                <Text style={[styles.modalOptionText, sessionAddress && { color: Colors.primary, fontWeight: '900' }]}>
                  {sessionAddress ? "Live Location Active" : "Live Location"}
                </Text>
                {sessionAddress && <Icon name="check-circle" size={20} color={Colors.primary} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalOption} 
                onPress={() => {
                  setAddressModalVisible(false);
                  navigation.navigate('AddAddress'); 
                }}
              >
                <Icon name="plus" size={24} color={Colors.primary} />
                <Text style={styles.modalOptionText}>Add new address</Text>
              </TouchableOpacity>

              <View style={styles.savedAddressesHeader}>
                <Text style={styles.savedAddressesTitle}>Saved Addresses</Text>
              </View>

              {savedAddresses.map((addr) => (
                <TouchableOpacity 
                  key={addr.id} 
                  style={[styles.savedAddressItem, !sessionAddress && selectedAddress?.id === addr.id && styles.selectedAddressItem]}
                  onPress={() => {
                    setSelectedAddress(addr);
                    setSessionAddress(null); // Clear session address if saved one is selected
                    setAddressModalVisible(false);
                  }}
                >
                  <Icon 
                    name={addr.label.toLowerCase().includes('home') ? 'home-outline' : 'map-marker-outline'} 
                    size={20} 
                    color={!sessionAddress && selectedAddress?.id === addr.id ? Colors.primary : Colors.textSecondary} 
                  />
                  <View style={styles.savedAddressInfo}>
                    <Text style={styles.savedAddressLabel}>{addr.label}</Text>
                    <Text style={styles.savedAddressText} numberOfLines={1}>{addr.address_line}</Text>
                  </View>
                  {!sessionAddress && selectedAddress?.id === addr.id && (
                    <Icon name="check-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Receiver Info Modal - using generic AlertModal for simplicity if possible, or another standard Modal */}
      <Modal
        visible={receiverInfoVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setReceiverInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.receiverModalContent}>
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Receiver Details</Text>
            <Text style={{ color: Colors.textSecondary, marginBottom: 20 }}>Enter details of the person receiving the order</Text>
            
            <Input
              placeholder="Receiver Name"
              value={receiverName}
              onChangeText={setReceiverName}
            />
            <View style={{ height: 12 }} />
            <Input
              placeholder="Phone Number"
              value={receiverPhone}
              onChangeText={setReceiverPhone}
              keyboardType="phone-pad"
            />
            
            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: Colors.surface }]} 
                onPress={() => setReceiverInfoVisible(false)}
              >
                <Text style={{ color: Colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: Colors.primary }]} 
                onPress={handleSaveReceiverInfo}
              >
                <Text style={{ color: Colors.white, fontWeight: '700' }}>Save & Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.content}
        type="info"
        onClose={() => setInfoModal({ ...infoModal, visible: false })}
        showCancel={true}
        cancelText="Close"
      />

      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        primaryAction={alertConfig.primaryAction}
        showCancel={alertConfig.showCancel}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  clearBtn: {
    backgroundColor: '#FFF1F2', // Very light red
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA', // Light red border
  },
  clearText: {
    color: Colors.error,
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  storeSection: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: 8,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  itemPrice: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '800',
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 2,
  },
  qtyBtn: {
    padding: 6,
  },
  quantity: {
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  addressSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  addressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  billDetails: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  billLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  billValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  totalRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.white,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  checkoutInfo: {
    flex: 1,
  },
  checkoutTotal: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  checkoutLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  checkoutBtn: {
    width: '55%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  browseBtn: {
    marginTop: 30,
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
  },
  browseBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
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
    maxHeight: height * 0.8,
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
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  modalScroll: {
    padding: Spacing.md,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  modalOptionText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  savedAddressesHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  savedAddressesTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  savedAddressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  selectedAddressItem: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  savedAddressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  savedAddressLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  savedAddressText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  receiverModalContent: {
    backgroundColor: Colors.white,
    margin: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: 24,
    elevation: 10,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  modalActionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
});
