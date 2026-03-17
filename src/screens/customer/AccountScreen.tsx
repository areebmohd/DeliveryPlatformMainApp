import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { AlertModal } from '../../components/ui/AlertModal';
import { useState } from 'react';

export const AccountScreen = () => {
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    primaryAction?: any;
    showCancel?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const handleSignOut = () => {
    setAlertConfig({
      visible: true,
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      type: 'warning',
      showCancel: true,
      primaryAction: {
        text: 'Sign Out',
        onPress: signOut,
        variant: 'destructive',
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.userName}>{profile?.full_name || 'User'}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        
        <Button 
          title="Sign Out" 
          onPress={handleSignOut} 
          variant="outline"
          style={styles.signOutButton}
        />
      </View>

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
    backgroundColor: Colors.white,
  },
  content: {
    padding: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  email: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  signOutButton: {
    marginTop: 'auto',
  },
});
