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
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import RNUpiPayment from 'react-native-upi-payment';
import Geolocation from '@react-native-community/geolocation';

const { width, height } = Dimensions.get('window');

export const CartScreen = ({ navigation }: any) => {
  const { items, updateQuantity, subtotal, totalItems, clearCart, sessionAddress, setSessionAddress } = useCart();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [tempLocation, setTempLocation] = useState<any>(null);
  const [infoModal, setInfoModal] = useState<{ visible: boolean, title: string, content: string }>({
    visible: false,
    title: '',
    content: ''
  });

  const [paymentMethod, setPaymentMethod] = useState<'pay_now' | 'pay_on_delivery'>('pay_now');
  const insets = useSafeAreaInsets();

  const { showAlert, showToast } = useAlert();

  const [distance, setDistance] = useState(0);
  const [isLargeVehicle, setIsLargeVehicle] = useState(false);
  const [hasHelper, setHasHelper] = useState(false);

  // Distance helper
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
        handleSaveLiveLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        showAlert({ title: 'Location Error', message: 'Could not get your current location. Please check permissions.', type: 'error' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleSaveLiveLocation = async (loc: any) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('addresses')
        .insert({
          user_id: user?.id,
          address_line: 'Current Location', 
          city: 'Gurugram', 
          pincode: '122001',
          location: `SRID=4326;POINT(${loc.longitude} ${loc.latitude})`,
          label: `${profile?.full_name || 'My'}'s Live Location`,
          receiver_name: profile?.full_name || '',
          receiver_phone: profile?.phone || '',
        })
        .select()
        .single();

      if (error) throw error;
      
      setSelectedAddress(data);
      setSessionAddress(null);
      fetchAddresses();
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const calculateFees = async () => {
    if (items.length === 0 || (!selectedAddress && !sessionAddress)) {
      setDistance(0);
      setIsLargeVehicle(false);
      return;
    }

    try {
      // 1. Check for vehicle type
      let totalWeight = 0;
      let oversized = false;
      let forcedLarge = false;

      items.forEach(item => {
        totalWeight += (item.weight_kg || 0) * item.quantity;
        if (item.length_cm > 40 || item.width_cm > 40 || item.height_cm > 40) {
          oversized = true;
        }
        if (item.needs_large_vehicle) {
          forcedLarge = true;
        }
      });

      const needsLarge = totalWeight > 20 || oversized || forcedLarge;
      setIsLargeVehicle(needsLarge);
      if (!needsLarge) setHasHelper(false); // Reset if not large vehicle

      // 2. Fetch Store location
      const storeId = items[0].store_id;
      const { data: store } = await supabase
        .from('stores')
        .select('location')
        .eq('id', storeId)
        .single();
      
      if (!store?.location) return;

      // Parse store location POINT(lng lat)
      const storeMatch = store.location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
      if (!storeMatch) return;
      const sLng = parseFloat(storeMatch[1]);
      const sLat = parseFloat(storeMatch[2]);

      // Parse user location
      const userLoc = sessionAddress?.location || selectedAddress?.location;
      if (!userLoc) return;
      const userMatch = userLoc.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
      if (!userMatch) return;
      const uLng = parseFloat(userMatch[1]);
      const uLat = parseFloat(userMatch[2]);

      const d = calculateDistance(sLat, sLng, uLat, uLng);
      setDistance(d);

    } catch (e) {
      console.error('Error calculating fees:', e);
    }
  };

  useEffect(() => {
    calculateFees();
  }, [items, selectedAddress, sessionAddress]);

  // Fees Logic
  const platformFee = subtotal >= 500 ? (subtotal * 0.01) : 5;
  const deliveryFee = items.length === 0 ? 0 : (
    isLargeVehicle 
      ? 300 + (distance * 30)
      : 20 + (distance * 5)
  );
  const helperFee = hasHelper ? 400 : 0;
  const grandTotal = subtotal + deliveryFee + platformFee + helperFee;
  const totalWeight = items.reduce((sum, i) => sum + (i.weight_kg * i.quantity), 0);

  const handleCheckout = async () => {
    if (items.length === 0) return;

    try {
      setLoading(true);
      const storeId = items[0].store_id;
      const { data: store, error: storeError } = await supabase
        .from('stores_view')
        .select('is_currently_open, opening_hours, name')
        .eq('id', storeId)
        .single();
      
      if (storeError) throw storeError;

      // 1. Check manual toggle
      if (!store.is_currently_open) {
        setLoading(false);
        showAlert({
          title: 'Store Unavailable',
          message: `${store.name} is currently not accepting online orders. Please try again later.`,
          type: 'error'
        });
        return;
      }

      // 2. Check opening hours
      if (store.opening_hours) {
        try {
          const slots = JSON.parse(store.opening_hours);
          if (Array.isArray(slots) && slots.length > 0) {
            const now = new Date();
            const currentTotalMins = now.getHours() * 60 + now.getMinutes();

            const timeToMinutes = (timeStr: string) => {
              const [time, period] = timeStr.split(' ');
              let [h, m] = time.split(':').map(Number);
              if (period === 'PM' && h !== 12) h += 12;
              if (period === 'AM' && h === 12) h = 0;
              return h * 60 + m;
            };

            const isOpen = slots.some(slot => {
              const startMins = timeToMinutes(slot.start);
              const endMins = timeToMinutes(slot.end);
              // Handle midnight crossover (e.g. 10 PM to 2 AM)
              if (endMins < startMins) {
                return currentTotalMins >= startMins || currentTotalMins <= endMins;
              }
              return currentTotalMins >= startMins && currentTotalMins <= endMins;
            });

            if (!isOpen) {
              setLoading(false);
              showAlert({
                title: 'Store Closed',
                message: `${store.name} is currently closed. Please check their operating hours.`,
                type: 'warning'
              });
              return;
            }
          }
        } catch (e) {
          console.error('Error parsing opening hours during checkout:', e);
        }
      }
      
      setLoading(false);

      if (!profile?.full_name || !profile?.phone || !profile?.upi_id) {
        setLoading(false);
        showAlert({
          title: 'Profile Incomplete',
          message: 'Please fill your User Info (Name, Phone, and UPI ID) in the Account page before placing an order.',
          type: 'warning',
          primaryAction: {
            text: 'Go to Account',
            onPress: () => navigation.navigate('Account'),
          },
          showCancel: true,
          cancelText: 'Maybe Later'
        });
        return;
      }

      if (!selectedAddress && !sessionAddress) {
        showAlert({ title: 'Address Required', message: 'Please select a delivery address', type: 'warning' });
        return;
      }
      
      showAlert({
        title: 'Place Order?',
        message: `Are you sure you want to place this order for ₹${grandTotal.toFixed(2)}?`,
        type: 'info',
        primaryAction: {
          text: 'Place',
          onPress: () => processOrder(),
        }
      });
    } catch (e: any) {
      setLoading(false);
      showAlert({ title: 'Error', message: 'Unable to verify store availability. Please try again.', type: 'error' });
      console.error('Checkout validation error:', e);
    }
  };

  const processOrder = async () => {
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
            payment_method: paymentMethod,
            payment_status: 'pending',
            transport_type: isLargeVehicle ? 'heavy' : 'standard',
            total_weight_kg: totalWeight,
            has_helper: hasHelper,
            helper_fee: helperFee
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

        // UPI Payment (only if Pay Now is selected)
        if (paymentMethod === 'pay_now') {
          if (RNUpiPayment && RNUpiPayment.initializePayment) {
            RNUpiPayment.initializePayment(
              {
                vpa: 'aashu9105628720-1@okicici', // Standard VPA for testing
                payeeName: 'Ashu',
                amount: grandTotal.toFixed(2),
                transactionNote: `Order #${order.order_number}`,
                transactionRef: order.id,
              },
              async () => {
                // Payment Success - Update status to verified
                await supabase
                  .from('orders')
                  .update({ payment_status: 'verified' })
                  .eq('id', order.id);
                
                clearCart();
                navigation.navigate('Account', { screen: 'CustomerOrders' });
              },
              async () => {
                // Payment Failed/Cancelled - The order was created but should be cancelled or deleted
                // The user said: "order will only place if he pay on the app"
                await supabase
                  .from('orders')
                  .update({ status: 'cancelled', payment_status: 'failed' })
                  .eq('id', order.id);
                
                showAlert({ title: 'Payment Failed', message: 'Order was not placed. Please try again or choose Pay on Delivery.', type: 'error' });
              }
            );
          } else {
            // Mock success if logic is missing (for local testing without UPI library active)
            await supabase
              .from('orders')
              .update({ payment_status: 'verified' })
              .eq('id', order.id);
            clearCart();
            navigation.navigate('Account', { screen: 'CustomerOrders' });
          }
        } else {
          // Pay on Delivery - Success immediately
          clearCart();
          navigation.navigate('Account', { screen: 'CustomerOrders' });
        }
      }

    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
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
            onPress={() => showAlert({
              title: 'Clear Cart?', 
              message: 'Are you sure you want to remove all items from your cart?', 
              type: 'warning',
              primaryAction: { text: 'Yes, Clear', onPress: clearCart, variant: 'destructive' }
            })}
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
              <Text style={styles.billLabel}>Delivery Fee ({isLargeVehicle ? 'Large Vehicle' : 'Bike'})</Text>
              <TouchableOpacity onPress={() => setInfoModal({
                visible: true,
                title: 'Delivery Fee',
                content: isLargeVehicle 
                  ? `Large Vehicle Delivery\nPickup Fee: ₹300\nPer KM Fee: ₹30\nDistance: ${distance.toFixed(2)} km`
                  : `Standard Bike Delivery\nPickup Fee: ₹20\nPer KM Fee: ₹5\nDistance: ${distance.toFixed(2)} km`
              })}>
                <Icon name="information-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.billValue}>₹{deliveryFee.toFixed(2)}</Text>
          </View>

          {isLargeVehicle && (
            <View style={styles.vehicleAlertContainer}>
              <View style={styles.vehicleAlert}>
                <Icon name="truck-delivery" size={20} color={Colors.error} />
                <Text style={styles.vehicleAlertText}>
                  Large vehicle is needed due to item weight or oversized dimensions.
                </Text>
              </View>
              
              <TouchableOpacity 
                style={[styles.helperToggle, hasHelper && styles.helperToggleActive]}
                onPress={() => setHasHelper(!hasHelper)}
              >
                <View style={styles.helperInfo}>
                  <Text style={styles.helperTitle}>Add Helper (₹400)</Text>
                  <Text style={styles.helperSubtitle}>A professional to help load/unload large items.</Text>
                </View>
                <Icon 
                  name={hasHelper ? "checkbox-marked" : "checkbox-blank-outline"} 
                  size={24} 
                  color={hasHelper ? Colors.primary : Colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          )}

          {hasHelper && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Helper Fee</Text>
              <Text style={styles.billValue}>₹{helperFee.toFixed(2)}</Text>
            </View>
          )}

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

        {/* Payment Method Selection */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            <TouchableOpacity 
              style={[
                styles.paymentOption, 
                paymentMethod === 'pay_now' && styles.paymentOptionSelected
              ]}
              onPress={() => setPaymentMethod('pay_now')}
            >
              <View style={styles.paymentOptionHeader}>
                <Icon 
                  name="flash-outline" 
                  size={24} 
                  color={paymentMethod === 'pay_now' ? Colors.primary : Colors.textSecondary} 
                />
                <View style={[
                  styles.radioOuter, 
                  paymentMethod === 'pay_now' && styles.radioOuterSelected
                ]}>
                  {paymentMethod === 'pay_now' && <View style={styles.radioInner} />}
                </View>
              </View>
              <Text style={[
                styles.paymentOptionTitle,
                paymentMethod === 'pay_now' && styles.paymentOptionTitleSelected
              ]}>Pay Now</Text>
              <Text style={styles.paymentOptionSub}>Pay instantly via UPI</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.paymentOption, 
                paymentMethod === 'pay_on_delivery' && styles.paymentOptionSelected
              ]}
              onPress={() => setPaymentMethod('pay_on_delivery')}
            >
              <View style={styles.paymentOptionHeader}>
                <Icon 
                  name="truck-delivery-outline" 
                  size={24} 
                  color={paymentMethod === 'pay_on_delivery' ? Colors.primary : Colors.textSecondary} 
                />
                <View style={[
                  styles.radioOuter, 
                  paymentMethod === 'pay_on_delivery' && styles.radioOuterSelected
                ]}>
                  {paymentMethod === 'pay_on_delivery' && <View style={styles.radioInner} />}
                </View>
              </View>
              <Text style={[
                styles.paymentOptionTitle,
                paymentMethod === 'pay_on_delivery' && styles.paymentOptionTitleSelected
              ]}>Pay on Delivery</Text>
              <Text style={styles.paymentOptionSub}>Cash or UPI at your door</Text>
            </TouchableOpacity>
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

      {/* Receiver Info Modal removed as user info is used directly */}

      {/* No local AlertModals needed anymore as they are handled globally */}
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
  paymentSection: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentOption: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  paymentOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '20', // Very subtle tint
  },
  paymentOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  paymentOptionTitleSelected: {
    color: Colors.primary,
  },
  paymentOptionSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
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
  vehicleAlertContainer: {
    marginBottom: Spacing.md,
  },
  vehicleAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FED7D7',
    gap: 10,
  },
  helperToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'space-between',
  },
  helperToggleActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  helperInfo: {
    flex: 1,
    marginRight: 10,
  },
  helperTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  helperSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  vehicleAlertText: {
    flex: 1,
    fontSize: 13,
    color: '#C53030',
    fontWeight: '700',
    lineHeight: 18,
  },
});
