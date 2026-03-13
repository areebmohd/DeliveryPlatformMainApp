import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { useCart } from '../../context/CartContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import RNUpiPayment from 'react-native-upi-payment';

export const CartScreen = ({ navigation }: any) => {
  const { items, updateQuantity, subtotal, totalItems, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');
  
  const deliveryFee = totalItems > 0 ? 25 : 0; 
  const platformFee = totalItems > 0 ? 2 : 0;
  const total = subtotal + deliveryFee + platformFee;

  const handleCheckout = async () => {
    if (items.length === 0) return;
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please enter your delivery address');
      return;
    }
    
    try {
      setLoading(true);
      
      // 1. Fetch store's UPI ID
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('upi_id, name')
        .eq('id', items[0].store_id)
        .single();
      
      if (storeError || !store.upi_id) {
        throw new Error('Store UPI ID not found. Please contact support.');
      }

      // 2. Save Address first
      const { data: addrData, error: addrError } = await supabase
        .from('addresses')
        .insert({
          user_id: user?.id,
          address_line: address,
          city: 'Gurugram',
          pincode: '122001', // Default for MVP
          // Dummy point for MVP
          location: 'SRID=4326;POINT(77.0266 28.4595)' 
        })
        .select()
        .single();

      if (addrError) throw addrError;

      // 3. Create Order with address_id
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user?.id,
          store_id: items[0].store_id,
          delivery_address_id: addrData.id,
          subtotal: subtotal,
          total_amount: total,
          delivery_fee: deliveryFee,
          platform_fee: platformFee,
          status: 'pending_verification',
          payment_method: 'pay_now',
          payment_status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 4. Create Order Items
      const orderItems = items.map(item => ({
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

      // 5. Trigger UPI Payment
      if (!RNUpiPayment || !RNUpiPayment.initializePayment) {
        Alert.alert(
          'Note', 
          'UPI Payment module not linked. If you just installed it, please restart the app with "npm run android".\n\nOrder saved as Pending.',
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
        );
        clearCart();
        return;
      }

      RNUpiPayment.initializePayment(
        {
          vpa: store.upi_id,
          payeeName: store.name,
          amount: total.toFixed(2),
          transactionNote: `Order #${order.order_number} for ${store.name}`,
          transactionRef: order.id,
        },
        (success) => {
          Alert.alert('Success', 'Payment initiated! We will verify and process your order.');
          clearCart();
          navigation.navigate('Home');
        },
        (error) => {
          Alert.alert('Payment Failed', 'If money was deducted, please contact support with Order ID.');
          navigation.navigate('Home');
        }
      );

    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Icon name="cart-off" size={80} color={Colors.border} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add some items from your favorite store!</Text>
          <Button 
            title="Browse Stores" 
            onPress={() => navigation.navigate('Home')} 
            style={styles.browseBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review Cart</Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.storeHeader}>
          <Icon name="storefront" size={20} color={Colors.primary} />
          <Text style={styles.storeName}>{items[0]?.store_name}</Text>
        </View>

        {items.map((item) => (
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

        <View style={styles.addressSection}>
          <Text style={styles.billTitle}>Delivery Address</Text>
          <Input
            placeholder="Enter your full address in Gurugram"
            value={address}
            onChangeText={setAddress}
            multiline
            style={styles.addressInput}
          />
        </View>

        <View style={styles.billDetails}>
          <Text style={styles.billTitle}>Bill Details</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={styles.billValue}>₹{deliveryFee.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform Fee</Text>
            <Text style={styles.billValue}>₹{platformFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.paymentNotice}>
          <Icon name="shield-check" size={20} color={Colors.secondary} />
          <Text style={styles.noticeText}>
            Secure payments via Google Pay, PhonePe, or Paytm.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.checkoutInfo}>
          <Text style={styles.checkoutTotal}>₹{total.toFixed(2)}</Text>
          <Text style={styles.checkoutLabel}>Total Payable</Text>
        </View>
        <Button 
          title="Place Order" 
          onPress={handleCheckout} 
          style={styles.checkoutBtn}
          loading={loading}
        />
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  clearText: {
    color: Colors.error,
    fontWeight: '600',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: borderRadius.md,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  itemPrice: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: borderRadius.sm,
    padding: 2,
  },
  qtyBtn: {
    padding: 4,
  },
  quantity: {
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  addressSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addressInput: {
    marginTop: Spacing.sm,
  },
  billDetails: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: borderRadius.md,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  billLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  billValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: Colors.secondary + '10',
    borderRadius: borderRadius.md,
  },
  noticeText: {
    fontSize: 13,
    color: Colors.secondary,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  checkoutInfo: {
    flex: 1,
  },
  checkoutTotal: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  checkoutLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  checkoutBtn: {
    width: '60%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  browseBtn: {
    marginTop: 30,
    width: '100%',
  },
});
