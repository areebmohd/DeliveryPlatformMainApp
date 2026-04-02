import React, { useState } from 'react';
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
  const [editUpiId, setEditUpiId] = useState(profile?.upi_id || '');

  const { showAlert, showToast } = useAlert();

  const handleSignOut = () => {
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
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim() || !editPhone.trim() || !editUpiId.trim()) {
      showAlert({ title: 'Required Fields', message: 'Please fill all mandatory fields (Name, Phone, UPI ID).', type: 'warning' });
      return;
    }

    setLoading(true);
    const result = await updateProfile({
      full_name: editName,
      phone: editPhone,
      upi_id: editUpiId,
    });
    setLoading(false);

    if (result.success) {
      setIsEditing(false);
      showToast('Profile updated successfully!', 'success');
    } else {
      showAlert({ title: 'Error', message: 'Failed to update profile. Please try again.', type: 'error' });
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Customer Account</Text>

        {/* User Info Box */}
        <View style={styles.box}>
          <View style={styles.boxHeader}>
            <Text style={styles.boxTitle}>User Info</Text>
            {isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            <View style={styles.editForm}>
              <Input
                label="Full Name"
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
              />
              <Input
                label="Phone Number"
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
              <Input
                label="UPI ID"
                value={editUpiId}
                onChangeText={setEditUpiId}
                placeholder="example@upi"
                autoCapitalize="none"
              />
              <Text style={styles.inputNote}>* This UPI ID will be used for refunds only.</Text>
              <Button 
                title="Save Changes" 
                onPress={handleUpdateProfile} 
                loading={loading}
                style={styles.saveBtn}
              />
            </View>
          ) : (
            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{profile?.full_name || 'Not set'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{profile?.phone || 'Not set'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>UPI ID</Text>
                <Text style={styles.infoValue}>{profile?.upi_id || 'Not set'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profile?.email}</Text>
              </View>
              
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtnBottom}>
                <Icon name="pencil-outline" size={18} color={Colors.primary} />
                <Text style={styles.editBtnTextBottom}>Edit Profile Details</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Options Box */}
        <View style={styles.box}>
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
          <OptionItem icon="crown-outline" label="Premium" onPress={() => {}} />
          <OptionItem icon="cash-refund" label="Refunds" onPress={() => navigation.navigate('Refunds')} />
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
        <View style={styles.box}>
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
    padding: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
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
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  editBtnBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    padding: 14,
    borderRadius: 16,
    marginTop: Spacing.md,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary + '20',
  },
  editBtnTextBottom: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 16,
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
  infoValueDisabled: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 4,
  },
  editForm: {
    gap: Spacing.xs,
  },
  inputNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  saveBtn: {
    marginTop: Spacing.md,
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
