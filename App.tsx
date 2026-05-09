import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { Colors } from './src/theme/colors';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { GOOGLE_WEB_CLIENT_ID } from '@env';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { CartProvider } from './src/context/CartContext';
import { AlertProvider } from './src/context/AlertContext';
import { BusinessStoreProvider } from './src/context/BusinessStoreContext';
import { MainNavigator } from './src/navigation/MainNavigator';
import { useNotificationListener } from './src/hooks/useNotificationListener';
import { notificationService } from './src/utils/notificationService';

export const navigationRef = createNavigationContainerRef();

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
          prefixes: ['com.zorodelivery.app://'],
          config: {
            screens: {
              Login: 'login',
              ResetPassword: 'reset-password',
            },
          },
        }}
      >
        {session && profile && !isResettingPassword ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </View>
  );
}

export default App;
