import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { StoreScreen } from '../screens/business/StoreScreen';
import { OrdersScreen } from '../screens/business/OrdersScreen';
import { OffersScreen } from '../screens/business/OffersScreen';
import { BusinessAccountScreen } from '../screens/business/BusinessAccountScreen';
import { ManageProductsScreen } from '../screens/business/ManageProductsScreen';
import { Colors } from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { NotificationsScreen } from '../screens/business/NotificationsScreen';
import { DashboardScreen } from '../screens/business/DashboardScreen';
import { ProductFormScreen } from '../screens/business/ProductFormScreen';
import { StoreDetailsFormScreen } from '../screens/business/StoreDetailsFormScreen';
import { PaymentsScreen } from '../screens/business/PaymentsScreen';
import { SupportScreen } from '../screens/business/SupportScreen';
import { MapSelectionScreen } from '../screens/customer/MapSelectionScreen';

const Tab = createBottomTabNavigator();
const StoreStackNav = createNativeStackNavigator();
const AccountStackNav = createNativeStackNavigator();

const StoreStack = () => {
  return (
    <StoreStackNav.Navigator screenOptions={{ headerShown: false }}>
      <StoreStackNav.Screen name="StoreDashboard" component={StoreScreen} />
      <StoreStackNav.Screen name="ManageProducts" component={ManageProductsScreen} />
      <StoreStackNav.Screen name="ProductForm" component={ProductFormScreen} />
      <StoreStackNav.Screen name="StoreDetailsForm" component={StoreDetailsFormScreen} />
      <StoreStackNav.Screen name="MapSelection" component={MapSelectionScreen} />
    </StoreStackNav.Navigator>
  );
};

import { BusinessReturnsScreen } from '../screens/business/BusinessReturnsScreen';

const AccountStack = () => {
  return (
    <AccountStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AccountStackNav.Screen name="AccountMain" component={BusinessAccountScreen} />
      <AccountStackNav.Screen name="Notifications" component={NotificationsScreen} />
      <AccountStackNav.Screen name="Dashboard" component={DashboardScreen} />
      <AccountStackNav.Screen name="Payments" component={PaymentsScreen} />
      <AccountStackNav.Screen name="Returns" component={BusinessReturnsScreen} />
      <AccountStackNav.Screen name="Support" component={SupportScreen} />
    </AccountStackNav.Navigator>
  );
};

export const BusinessNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const routeName = getFocusedRouteNameFromRoute(route);
        const hideOnScreens = [
          'ManageProducts', 'ProductForm', 'StoreDetailsForm', 'MapSelection',
          'Notifications', 'Dashboard', 'Payments', 'Returns', 'Support'
        ];
        const isTabVisible = !hideOnScreens.includes(routeName as string);

        return {
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            display: isTabVisible ? 'flex' : 'none',
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 8,
            paddingTop: 2,
            backgroundColor: Colors.white,
            borderTopColor: Colors.border,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
          },
          tabBarIcon: ({ focused, size }) => {
            let iconName = '';
            if (route.name === 'Store') iconName = 'storefront';
            else if (route.name === 'Offers') iconName = 'tag';
            else if (route.name === 'Orders') iconName = 'clipboard-text-clock';
            else if (route.name === 'Account') iconName = 'account';

            return (
              <Icon 
                name={focused ? iconName : `${iconName}-outline`} 
                size={size} 
                color={focused ? Colors.primary : '#9CA3AF'} 
              />
            );
          },
        };
      }}
    >
      <Tab.Screen name="Store" component={StoreStack} />
      <Tab.Screen name="Offers" component={OffersScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Account" component={AccountStack} />
    </Tab.Navigator>
  );
};
