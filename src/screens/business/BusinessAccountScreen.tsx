import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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

  const AccountOption = ({ icon, title, onPress, color = Colors.text }: any) => (
    <TouchableOpacity style={styles.optionItem} onPress={onPress}>
      <View style={styles.optionLeft}>
        <View style={[styles.iconContainer, { backgroundColor: Colors.primaryLight }]}>
          <Icon name={icon} size={22} color={color === Colors.primary || color === Colors.secondary ? Colors.black : color} />
        </View>
        <Text style={[styles.optionTitle, { color: Colors.text }]}>{title}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.title}>Business Account</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Box 1: Profile */}
        <View style={styles.card}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Icon name="store" size={30} color={Colors.primary} />
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.storeName}>{store?.name || 'Your Store'}</Text>
              <Text style={styles.categoryValue}>{store?.category || 'General Store'}</Text>
            </View>
          </View>
        </View>

        {/* Box 2: Features */}
        <View style={styles.card}>
          <AccountOption 
            icon="bell-outline" 
            title="Notifications" 
            onPress={() => navigation.navigate('Notifications')} 
            color={Colors.primary}
          />
          <View style={styles.separator} />
          <AccountOption 
            icon="crown-outline" 
            title="Premium" 
            onPress={() => navigation.navigate('Premium')} 
            color="#FFD700"
          />
          <View style={styles.separator} />
          <AccountOption 
            icon="chart-areaspline" 
            title="Dashboard" 
            onPress={() => navigation.navigate('Dashboard')} 
            color={Colors.secondary}
          />
          <View style={styles.separator} />
          <AccountOption 
            icon="credit-card-outline" 
            title="Payments" 
            onPress={() => navigation.navigate('Payments')} 
            color="#4CAF50"
          />
          <View style={styles.separator} />
          <AccountOption 
            icon="chat-question-outline" 
            title="Business Support" 
            onPress={() => navigation.navigate('Support')} 
            color="#2196F3"
          />
          <View style={styles.separator} />
          <AccountOption 
            icon="bullhorn-outline" 
            title="Advertise" 
            onPress={() => navigation.navigate('Advertise')} 
            color="#FF5722"
          />
        </View>

        {/* Box 3: Account */}
        <View style={styles.card}>
          <View style={styles.emailContainer}>
            <View style={styles.optionLeft}>
              <View style={[styles.iconContainer, { backgroundColor: Colors.textSecondary + '15' }]}>
                <Icon name="email-outline" size={22} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.emailLabel}>Logged in as</Text>
                <Text style={styles.emailValue}>{user?.email}</Text>
              </View>
            </View>
          </View>
          <View style={styles.separator} />
          <AccountOption 
            icon="logout" 
            title="Sign Out" 
            onPress={handleSignOut} 
            color={Colors.error}
          />
        </View>
      </ScrollView>

      {/* Global AlertModal handles alerts now */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xs,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  profileDetails: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  categoryValue: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emailValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  emailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emailContainer: {
    paddingVertical: Spacing.sm,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F3F5',
    marginLeft: 56,
    marginVertical: 4,
  },
});
