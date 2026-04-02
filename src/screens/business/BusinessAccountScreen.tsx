import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';

export const BusinessAccountScreen = ({ navigation }: any) => {
  const { profile, signOut, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<any>(null);

  const { showAlert } = useAlert();

  const handleSignOut = () => {
    showAlert({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of your business account?',
      type: 'warning',
      showCancel: true,
      primaryAction: {
        text: 'Sign Out',
        onPress: signOut,
        variant: 'destructive',
      },
    });
  };

  useEffect(() => {
    fetchStore();

    const unsubscribe = navigation.addListener('focus', () => {
      fetchStore();
    });

    if (!user?.id) return unsubscribe;

    // Subscribe to store changes (to update name/category instantly)
    const channel = supabase
      .channel(`account-store-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stores',
          filter: `owner_id=eq.${user.id}`,
        },
        () => {
          fetchStore();
        }
      )
      .subscribe();

    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [navigation, user?.id]);

  const fetchStore = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user?.id)
        .order('is_active', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) setStore(data);
    } catch (e) {
      console.error('Error fetching store info', e);
    }
  };

  const OptionItem = ({ icon, label, onPress, isLast }: { icon: string; label: string; onPress?: () => void; isLast?: boolean }) => (
    <TouchableOpacity 
      style={[styles.optionItem, isLast && styles.noBorder]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.optionLeft}>
        <Icon name={icon} size={22} color={Colors.primary} />
        <Text style={styles.optionLabel}>{label}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Business Account</Text>

        {/* Store Info Box */}
        <View style={[styles.box, { paddingVertical: Spacing.lg }]}>
          <View style={styles.storeHeader}>
            <View style={styles.userCircle}>
              <Icon name="store" size={30} color={Colors.primary} />
            </View>
            <View style={styles.storeText}>
              <Text style={styles.storeName} numberOfLines={1}>{store?.name || 'Your Store'}</Text>
              <Text style={styles.storeCategory}>{store?.category || 'No Category'}</Text>
            </View>
          </View>
        </View>

        {/* Options Box */}
        <View style={styles.box}>
          <OptionItem 
            icon="credit-card-outline" 
            label="Payments" 
            onPress={() => navigation.navigate('Payments')} 
          />
          <OptionItem 
            icon="bell-outline" 
            label="Notifications" 
            onPress={() => navigation.navigate('Notifications')} 
          />
          <OptionItem 
            icon="crown-outline" 
            label="Premium" 
            onPress={() => navigation.navigate('Premium')} 
          />
          <OptionItem 
            icon="chart-areaspline" 
            label="Dashboard" 
            onPress={() => navigation.navigate('Dashboard')} 
          />
          <OptionItem 
            icon="bullhorn-outline" 
            label="Advertise" 
            onPress={() => navigation.navigate('Advertise')} 
          />
          <OptionItem 
            icon="chat-question-outline" 
            label="Business Support" 
            onPress={() => {
              // Explicit navigation
              navigation.navigate('Support');
            }} 
            isLast={true}
          />
        </View>

        {/* Sign Out Box */}
        <View style={styles.box}>
          <View style={styles.signOutHeader}>
            <View style={styles.userCircle}>
              <Icon name="store" size={30} color={Colors.primary} />
            </View>
            <View style={styles.signOutText}>
              <Text style={styles.loggedInAs}>Logged in as</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.signOutBtnPremium} 
            onPress={handleSignOut}
          >
            <View style={styles.signOutBtnContent}>
              <Icon name="logout-variant" size={24} color={Colors.error} />
              <Text style={styles.signOutBtnText}>Sign Out from Business</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.error + '50'} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  box: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  boxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  boxTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeText: {
    flex: 1,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  storeCategory: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  infoList: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '700',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '50',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  signOutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  userCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: Colors.white,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  signOutText: {
    flex: 1,
  },
  loggedInAs: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  signOutBtnPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  signOutBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signOutBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.error,
  },
});
