import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { StoreDetailsScreen } from '../screens/customer/StoreDetailsScreen';
import { CartScreen } from '../screens/customer/CartScreen';
import { AccountScreen } from '../screens/customer/AccountScreen';
import { FavouritesScreen } from '../screens/customer/FavouritesScreen';
import { Colors } from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { CustomerOrdersScreen } from '../screens/customer/CustomerOrdersScreen';
import { ProductDetailScreen } from '../screens/customer/ProductDetailScreen';
import { AddressesScreen } from '../screens/customer/AddressesScreen';
import { AddAddressScreen } from '../screens/customer/AddAddressScreen';
import { AddLiveLocationScreen } from '../screens/customer/AddLiveLocationScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="StoreDetails" component={StoreDetailsScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="AddAddress" component={AddAddressScreen} />
      <Stack.Screen name="AddLiveLocation" component={AddLiveLocationScreen} />
    </Stack.Navigator>
  );
};

const AccountStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccountMain" component={AccountScreen} />
      <Stack.Screen name="Favourites" component={FavouritesScreen} />
      <Stack.Screen name="CustomerOrders" component={CustomerOrdersScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="AddAddress" component={AddAddressScreen} />
      <Stack.Screen name="AddLiveLocation" component={AddLiveLocationScreen} />
      <Stack.Screen name="StoreDetails" component={StoreDetailsScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </Stack.Navigator>
  );
};

const CartStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CartMain" component={CartScreen} />
      <Stack.Screen name="AddAddress" component={AddAddressScreen} />
      <Stack.Screen name="AddLiveLocation" component={AddLiveLocationScreen} />
    </Stack.Navigator>
  );
};

export const CustomerNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
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
          if (route.name === 'Home') iconName = 'home-variant';
          else if (route.name === 'Cart') iconName = 'cart';
          else if (route.name === 'Account') iconName = 'account';

          return (
            <Icon 
              name={focused ? iconName : `${iconName}-outline`} 
              size={size} 
              color={focused ? Colors.primary : '#9CA3AF'} 
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Cart" component={CartStack} />
      <Tab.Screen name="Account" component={AccountStack} />
    </Tab.Navigator>
  );
};
