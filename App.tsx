import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { supabase } from './src/api/supabase';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { Colors } from './src/theme/colors';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { AlertProvider } from './src/context/AlertContext';
import { MainNavigator } from './src/navigation/MainNavigator';
import { useNotificationListener } from './src/hooks/useNotificationListener';
import { notificationService } from './src/utils/notificationService';

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AlertProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </AlertProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { session, profile, loading } = useAuth();
  const insets = useSafeAreaInsets();

  useNotificationListener();

  useEffect(() => {
    notificationService.requestPermissions();
    if (profile) {
      notificationService.saveToken(profile.id, profile.role);
    }
  }, [profile]);


  if (loading) {
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
        linking={{
          prefixes: ['com.mainapp://'],
          config: {
            screens: {
              ResetPassword: 'reset-password',
            },
          },
        }}
      >
        {session ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </View>
  );
}

export default App;
