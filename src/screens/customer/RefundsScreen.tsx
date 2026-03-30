import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator, 
  ScrollView, 
  RefreshControl 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

export const RefundsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refunds, setRefunds] = useState<any[]>([]);

  const fetchRefunds = async () => {
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select(`
            *,
            order:order_id (order_number)
        `)
        .eq('recipient_id', user?.id)
        .eq('recipient_type', 'customer')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setRefunds(data || []);
    } catch (e: any) {
      console.error('Error fetching refunds:', e);
      showAlert({ title: 'Error', message: 'Could not load your refund history.', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRefunds();
  };

  const groupRefundsByDate = (data: any[]) => {
    return data.reduce((groups: any, refund: any) => {
      const date = new Date(refund.payment_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(refund);
      return groups;
    }, {});
  };

  const groupedRefunds = groupRefundsByDate(refunds);
  const sortedDates = Object.keys(groupedRefunds);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      <View style={[styles.header, { paddingTop: Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refund History</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {sortedDates.length > 0 ? sortedDates.map(date => (
            <View key={date} style={styles.dateSection}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateTitle}>{date}</Text>
                <View style={styles.dateLine} />
              </View>
              {groupedRefunds[date].map((refund: any) => (
                <View key={refund.id} style={styles.payoutCard}>
                  <View style={styles.payoutRow}>
                    <View style={styles.iconCircle}>
                      <Icon name="cash-refund" size={24} color={Colors.primary} />
                    </View>
                    <View style={styles.payoutInfo}>
                      <Text style={styles.payoutStatus}>{refund.status === 'sent' ? 'Paid' : 'Refund Pending'}</Text>
                      {refund.order && <Text style={styles.payoutRef}>Order #{refund.order.order_number}</Text>}
                    </View>
                    <View style={styles.amountContainer}>
                      <Text style={styles.amountText}>₹{refund.amount}</Text>
                    </View>
                  </View>
                  
                  {refund.status === 'sent' && refund.upi_transaction_id && (
                      <View style={styles.utrContainer}>
                          <Icon name="check-circle" size={12} color={Colors.success} />
                          <Text style={styles.utrText}>UTR: {refund.upi_transaction_id}</Text>
                      </View>
                  )}
                </View>
              ))}
            </View>
          )) : (
            <View style={styles.emptyContainer}>
              <Icon name="cash-remove" size={80} color={Colors.border} />
              <Text style={styles.placeholderTitle}>No Refunds Yet</Text>
              <Text style={styles.placeholderSubtitle}>
                Refunds for cancelled online payments will appear here once processed by our team.
              </Text>
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  backBtn: { backgroundColor: Colors.white, padding: 8, borderRadius: 25, marginRight: Spacing.md, elevation: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: Spacing.md },
  dateSection: { marginTop: Spacing.md },
  dateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 12 },
  dateTitle: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase' },
  dateLine: { flex: 1, height: 1, backgroundColor: Colors.border + '50' },
  payoutCard: { backgroundColor: Colors.white, borderRadius: borderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5 },
  payoutRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  payoutInfo: { flex: 1 },
  payoutStatus: { fontSize: 16, fontWeight: '700', color: Colors.text },
  payoutRef: { fontSize: 12, color: Colors.primary, fontWeight: '700', marginTop: 1 },
  amountContainer: { alignItems: 'flex-end' },
  amountText: { fontSize: 18, fontWeight: '900', color: Colors.text },
  utrContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: Colors.success + '10', borderRadius: borderRadius.md, gap: 6 },
  utrText: { fontSize: 12, fontWeight: '700', color: Colors.success },
  emptyContainer: { marginTop: 100, justifyContent: 'center', alignItems: 'center', padding: 40 },
  placeholderTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 20 },
  placeholderSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 22 },
});
