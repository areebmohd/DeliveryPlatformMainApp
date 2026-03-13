import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StoreScreen } from '../screens/business/StoreScreen';
import { OrdersScreen } from '../screens/business/OrdersScreen';
import { BusinessAccountScreen } from '../screens/business/BusinessAccountScreen';
import { ManageProductsScreen } from '../screens/business/ManageProductsScreen';
import { Colors } from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const StoreStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StoreDashboard" component={StoreScreen} />
      <Stack.Screen name="ManageProducts" component={ManageProductsScreen} />
    </Stack.Navigator>
  );
};

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
      <Tab.Screen name="Store" component={StoreStack} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Account" component={BusinessAccountScreen} />
    </Tab.Navigator>
  );
};
