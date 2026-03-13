import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StoreScreen } from '../screens/business/StoreScreen';
import { OrdersScreen } from '../screens/business/OrdersScreen';
import { BusinessAccountScreen } from '../screens/business/BusinessAccountScreen';
import { Colors } from '../theme/colors';

import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Tab = createBottomTabNavigator();

export const BusinessNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
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
      <Tab.Screen name="Store" component={StoreScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Account" component={BusinessAccountScreen} />
    </Tab.Navigator>
  );
};
