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

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <AlertProvider>
            <AppContent />
          </AlertProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();


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
