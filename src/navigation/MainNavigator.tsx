import React from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerNavigator } from './CustomerNavigator';
import { BusinessNavigator } from './BusinessNavigator';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';

export const MainNavigator = () => {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Route based on user role
  if (profile?.role === 'store') {
    return <BusinessNavigator />;
  }

  return <CustomerNavigator />;
};
