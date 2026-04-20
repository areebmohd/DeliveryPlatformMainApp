import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const AccountScreen = ({ navigation }: any) => {
  const { profile, signOut, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit states
  const [editName, setEditName] = useState(profile?.full_name || '');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');

  const { showAlert, showToast } = useAlert();

  const handleSignOut = useCallback(() => {
    showAlert({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      type: 'warning',
      primaryAction: {
        text: 'Sign Out',
        onPress: signOut,
        variant: 'destructive',
      },
      showCancel: true
    });
  }, [signOut, showAlert]);

  const handleUpdateProfile = useCallback(async () => {
    const result = await updateProfile({
      full_name: editName,
      phone: editPhone,
    });
    setLoading(false);

    if (result.success) {
      setIsEditing(false);
      showToast('Profile updated successfully!', 'success');
    } else {
      showAlert({ title: 'Error', message: 'Failed to update profile. Please try again.', type: 'error' });
    }
  }, [editName, editPhone, updateProfile, showAlert, showToast]);

  const OptionItem = useCallback(({ icon, label, onPress, isLast }: { icon: string; label: string; onPress?: () => void; isLast?: boolean }) => (
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
  ), []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Customer Account</Text>

        {/* Premium User Profile Box */}
        <View style={styles.profileCard}>
          <View style={[styles.profileHeader, !isEditing && styles.noBottomMargin]}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                <Icon name="account" size={36} color={Colors.primary} />
              </View>
            </View>
            <View style={styles.profileMainInfo}>
              <Text style={styles.profileUserName} numberOfLines={1}>
                {profile?.full_name || ''}
              </Text>
              <View style={styles.membershipBadge}>
                <Icon name="phone-outline" size={12} color={Colors.success} />
                <Text style={styles.membershipText}>{profile?.phone || 'No phone set'}</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => setIsEditing(!isEditing)} 
              style={[styles.miniEditBtn, isEditing && styles.miniCancelBtn]}
            >
              <Icon name={isEditing ? "close" : "pencil-outline"} size={18} color={isEditing ? Colors.error : Colors.primary} />
            </TouchableOpacity>
          </View>

          {isEditing && (
            <View style={styles.enhancedEditForm}>
              <Input
                label="Full Name"
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                leftIcon="account-outline"
              />
              <Input
                label="Phone Number"
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                leftIcon="phone-outline"
              />
              <Button 
                title="Save Profile" 
                onPress={handleUpdateProfile} 
                loading={loading}
                style={styles.saveProfileBtn}
              />
            </View>
          )}
        </View>

        {/* Options Box */}
        <View style={[styles.box, styles.paddingVertical8]}>
          <OptionItem 
            icon="package-variant-closed" 
            label="Orders" 
            onPress={() => navigation.navigate('CustomerOrders')} 
          />
          <OptionItem 
            icon="map-marker-outline" 
            label="Addresses" 
            onPress={() => navigation.navigate('Addresses')} 
          />
          <OptionItem 
            icon="bell-outline" 
            label="Notifications" 
            onPress={() => navigation.navigate('Notifications')} 
          />
          <OptionItem 
            icon="heart-outline" 
            label="Favourites" 
            onPress={() => navigation.navigate('Favourites')} 
          />
          <OptionItem 
            icon="crown-outline" 
            label="Premium" 
            onPress={() => navigation.navigate('Premium')} 
          />
          <OptionItem 
            icon="headset" 
            label="Customer Support" 
            onPress={() => {
              // Explicit navigation to ensure correct stack resolution
              navigation.navigate('Account', { screen: 'CustomerSupport' });
            }} 
            isLast={true} 
          />
        </View>

        {/* Sign Out Box */}
        <View style={[styles.box, styles.paddingBottomLg]}>
          <View style={styles.signOutHeader}>
            <View style={styles.userCircle}>
              <Icon name="account" size={30} color={Colors.primary} />
            </View>
            <View style={styles.signOutText}>
              <Text style={styles.loggedInAs}>Logged in as</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{profile?.email}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.signOutBtnPremium} 
            onPress={handleSignOut}
          >
            <View style={styles.signOutBtnContent}>
              <Icon name="logout-variant" size={24} color={Colors.error} />
              <Text style={styles.signOutBtnText}>Sign Out from App</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.error + '50'} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Global AlertModal handles alerts now */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
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
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    elevation: 5,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profileMainInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileUserName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  membershipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
    textTransform: 'uppercase',
  },
  miniEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  miniCancelBtn: {
    backgroundColor: '#FFF1F2',
    borderColor: Colors.error + '20',
  },
  profileDetailsGrid: {
    gap: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 1,
  },
  enhancedEditForm: {
    gap: Spacing.sm,
  },
  formNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 4,
    marginBottom: 10,
    marginTop: -10, // Reduced from original gap
  },
  saveProfileBtn: {
    marginTop: Spacing.sm,
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
  noBottomMargin: {
    marginBottom: 0,
  },
  paddingVertical8: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  paddingBottomLg: {
    paddingBottom: Spacing.lg,
  },
});
