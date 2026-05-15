import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';

import { useBusinessStore } from '../../context/BusinessStoreContext';

export const BusinessAccountScreen = ({ navigation }: any) => {
  const { profile, signOut, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { stores, activeStore, setActiveStore, loading: storeLoading, refreshStores } = useBusinessStore();
  const [refreshing, setRefreshing] = useState(false);

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
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await refreshStores();
              setRefreshing(false);
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <Text style={styles.headerTitle}>Business Account</Text>

        {/* Store Selection / Info Box */}
        <View style={[styles.box, { paddingVertical: Spacing.lg }]}>
          <View style={styles.storeHeader}>
            <View style={styles.userCircle}>
              <Icon name="store" size={30} color={Colors.primary} />
            </View>
            <View style={styles.storeText}>
              <Text style={styles.storeName} numberOfLines={1}>{activeStore?.name || 'Your Store'}</Text>
              <Text style={styles.storeCategory}>{activeStore?.category || 'No Category'}</Text>
            </View>
          </View>
          
          {stores.length > 1 && (
            <View style={styles.switchStoreSection}>
              <View style={styles.divider} />
              <Text style={styles.switchTitle}>Switch Store</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storesScroll}>
                {stores.map((s) => (
                  <TouchableOpacity 
                    key={s.id} 
                    style={[
                      styles.storeBadge, 
                      activeStore?.id === s.id && styles.activeStoreBadge
                    ]}
                    onPress={() => setActiveStore(s)}
                  >
                    <Text style={[
                      styles.storeBadgeText, 
                      activeStore?.id === s.id && styles.activeStoreBadgeText
                    ]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Options Box */}
        <View style={[styles.box, { paddingVertical: Spacing.sm }]}>
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
            icon="keyboard-return" 
            label="Returns" 
            onPress={() => navigation.navigate('Returns')} 
          />
          <OptionItem 
            icon="chart-areaspline" 
            label="Dashboard" 
            onPress={() => navigation.navigate('Dashboard')} 
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
  switchStoreSection: {
    marginTop: Spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
    opacity: 0.5,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  storesScroll: {
    paddingVertical: 4,
    gap: 10,
  },
  storeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeStoreBadge: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  storeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  activeStoreBadgeText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
