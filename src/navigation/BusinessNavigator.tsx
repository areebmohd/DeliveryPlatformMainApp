import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreScreen } from '../screens/business/StoreScreen';
import { OrdersScreen } from '../screens/business/OrdersScreen';
import { BusinessAccountScreen } from '../screens/business/BusinessAccountScreen';
import { ManageProductsScreen } from '../screens/business/ManageProductsScreen';
import { Colors } from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { ProductFormScreen } from '../screens/business/ProductFormScreen';
import { StoreDetailsFormScreen } from '../screens/business/StoreDetailsFormScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const StoreStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StoreDashboard" component={StoreScreen} />
      <Stack.Screen name="ManageProducts" component={ManageProductsScreen} />
      <Stack.Screen name="ProductForm" component={ProductFormScreen} />
      <Stack.Screen name="StoreDetailsForm" component={StoreDetailsFormScreen} />
    </Stack.Navigator>
  );
};

export const BusinessNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 2,
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          let iconName = '';
          if (route.name === 'Store') iconName = 'storefront';
          else if (route.name === 'Orders') iconName = 'clipboard-text-clock';
          else if (route.name === 'Account') iconName = 'account';
          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Store" component={StoreStack} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Account" component={BusinessAccountScreen} />
    </Tab.Navigator>
  );
};
