import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { View, ActivityIndicator, StatusBar, Modal, Text, StyleSheet, Linking, TouchableOpacity, Platform, NativeModules } from 'react-native';
import { Colors, Spacing, borderRadius, Typography } from './src/theme/colors';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { GOOGLE_WEB_CLIENT_ID } from '@env';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { CartProvider } from './src/context/CartContext';
import { AlertProvider, useAlert } from './src/context/AlertContext';
import { BusinessStoreProvider } from './src/context/BusinessStoreContext';
import { MainNavigator } from './src/navigation/MainNavigator';
import { useNotificationListener } from './src/hooks/useNotificationListener';
import { notificationService } from './src/utils/notificationService';
import { supabase } from './src/api/supabase';

export const navigationRef = createNavigationContainerRef();

// IMPORTANT: Update this manually on every release to match versionCode in android/app/build.gradle
const CURRENT_VERSION_CODE = 10;

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AlertProvider>
          <CartProvider>
            <BusinessStoreProvider>
              <AppContent />
            </BusinessStoreProvider>
          </CartProvider>
        </AlertProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { session, profile, loading, isResettingPassword } = useAuth();
  const { showAlert } = useAlert();
  const [updateRequired, setUpdateRequired] = useState(false);
  const [apkUrl, setApkUrl] = useState('https://github.com/areebmohd/DeliveryPlatformWebsite/releases/download/v1.0.0/Zoro.apk');
  const [maintenanceAlertShown, setMaintenanceAlertShown] = useState(false);

  useNotificationListener();

  useEffect(() => {
    notificationService.requestPermissions();
    if (profile) {
      notificationService.saveToken(profile.id, profile.role);
    }
  }, [profile]);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  useEffect(() => {
    const checkAppConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('min_version_code, apk_url, maintenance_mode, maintenance_message')
          .eq('id', 1)
          .single();

        if (data && !error) {
          // Version Check (Android only)
          if (Platform.OS === 'android' && data.min_version_code > CURRENT_VERSION_CODE) {
            setApkUrl(data.apk_url);
            setUpdateRequired(true);
          }

          // Maintenance Alert for both Customer and Business when they open account / app
          if (data.maintenance_mode && profile && !maintenanceAlertShown) {
            setMaintenanceAlertShown(true);
            showAlert({
              title: 'System Under Maintenance',
              message: data.maintenance_message || 'Platform is currently undergoing scheduled maintenance. Ordering is temporarily disabled.',
              type: 'warning',
              primaryAction: {
                text: 'Got it',
                onPress: () => {},
              }
            });
          }
        }
      } catch (err) {
        console.log('Error checking app config:', err);
      }
    };

    if (profile) {
      checkAppConfig();
    }
  }, [profile, maintenanceAlertShown]);

  if (loading || (session && !profile && !isResettingPassword)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <NavigationContainer
        ref={navigationRef}
        linking={{
          prefixes: ['com.zorodelivery.app://', 'https://zorodelivery.vercel.app'],
          config: {
            screens: {
              Auth: 'auth',
              ResetPassword: 'reset-password',
              Home: {
                screens: {
                  StoreDetails: 'store/:storeId',
                  ProductDetail: 'product/:productId',
                }
              }
            },
          },
        }}
      >
        {session && profile && !isResettingPassword ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>

      {/* Non-dismissible Glassmorphic Update Prompt */}
      <Modal visible={updateRequired} transparent={true} animationType="fade" statusBarTranslucent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.iconContainer}>
              <Text style={styles.rocketIcon}>🚀</Text>
            </View>
            <Text style={styles.modalTitle}>Update Zoro App</Text>
            <Text style={styles.modalDescription}>
              A critical update is available. Please update the app to keep shopping and delivering with the latest features.
            </Text>
            <TouchableOpacity 
              activeOpacity={0.8}
              style={styles.updateBtn} 
              onPress={() => Linking.openURL(apkUrl)}
            >
              <Text style={styles.btnText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)', // Premium dark backdrop
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContainer: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
    elevation: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  rocketIcon: {
    fontSize: 32,
  },
  modalTitle: {
    ...Typography.title,
    fontSize: 22,
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  modalDescription: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  updateBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: borderRadius.md,
    width: '100%',
    alignItems: 'center',
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  btnText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '700',
  },
});

export default App;
