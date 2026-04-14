import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
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
import { SearchScreen } from '../screens/customer/SearchScreen';
import { CategoryScreen } from '../screens/customer/CategoryScreen';
import { NotificationsScreen } from '../screens/customer/NotificationsScreen';
import { MapSelectionScreen } from '../screens/customer/MapSelectionScreen';
import { RefundsScreen } from '../screens/customer/RefundsScreen';
import { CustomerOffersScreen } from '../screens/customer/CustomerOffersScreen';
import { SupportScreen as CustomerSupportScreen } from '../screens/customer/SupportScreen';
import { PremiumScreen } from '../screens/customer/PremiumScreen';

const Tab = createBottomTabNavigator();
const HomeStackNav = createNativeStackNavigator();
const CartStackNav = createNativeStackNavigator();
const AccountStackNav = createNativeStackNavigator();
const OffersStackNav = createNativeStackNavigator();

const HomeStack = () => {
  return (
    <HomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <HomeStackNav.Screen name="HomeMain" component={HomeScreen} />
      <HomeStackNav.Screen name="StoreDetails" component={StoreDetailsScreen} />
      <HomeStackNav.Screen name="ProductDetail" component={ProductDetailScreen} />
      <HomeStackNav.Screen name="AddAddress" component={AddAddressScreen} />
      <HomeStackNav.Screen name="AddLiveLocation" component={AddLiveLocationScreen} />
      <HomeStackNav.Screen name="Search" component={SearchScreen} />
      <HomeStackNav.Screen name="Category" component={CategoryScreen} />
      <HomeStackNav.Screen name="MapSelection" component={MapSelectionScreen} />
      <HomeStackNav.Screen name="Notifications" component={NotificationsScreen} />
    </HomeStackNav.Navigator>
  );
};

const AccountStack = () => {
  return (
    <AccountStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AccountStackNav.Screen name="AccountMain" component={AccountScreen} />
      <AccountStackNav.Screen name="Favourites" component={FavouritesScreen} />
      <AccountStackNav.Screen name="CustomerOrders" component={CustomerOrdersScreen} />
      <AccountStackNav.Screen name="Addresses" component={AddressesScreen} />
      <AccountStackNav.Screen name="AddAddress" component={AddAddressScreen} />
      <AccountStackNav.Screen name="AddLiveLocation" component={AddLiveLocationScreen} />
      <AccountStackNav.Screen name="StoreDetails" component={StoreDetailsScreen} />
      <AccountStackNav.Screen name="ProductDetail" component={ProductDetailScreen} />
      <AccountStackNav.Screen name="Notifications" component={NotificationsScreen} />
      <AccountStackNav.Screen name="MapSelection" component={MapSelectionScreen} />
      <AccountStackNav.Screen name="Refunds" component={RefundsScreen} />
      <AccountStackNav.Screen name="CustomerSupport" component={CustomerSupportScreen} />
      <AccountStackNav.Screen name="Premium" component={PremiumScreen} />
    </AccountStackNav.Navigator>
  );
};

const CartStack = () => {
  return (
    <CartStackNav.Navigator screenOptions={{ headerShown: false }}>
      <CartStackNav.Screen name="CartMain" component={CartScreen} />
      <CartStackNav.Screen name="AddAddress" component={AddAddressScreen} />
      <CartStackNav.Screen name="AddLiveLocation" component={AddLiveLocationScreen} />
      <CartStackNav.Screen name="StoreDetails" component={StoreDetailsScreen} />
      <CartStackNav.Screen name="ProductDetail" component={ProductDetailScreen} />
      <CartStackNav.Screen name="MapSelection" component={MapSelectionScreen} />
    </CartStackNav.Navigator>
  );
};

const OffersStack = () => {
  return (
    <OffersStackNav.Navigator screenOptions={{ headerShown: false }}>
      <OffersStackNav.Screen name="OffersMain" component={CustomerOffersScreen} />
      <OffersStackNav.Screen name="StoreDetails" component={StoreDetailsScreen} />
      <OffersStackNav.Screen name="ProductDetail" component={ProductDetailScreen} />
    </OffersStackNav.Navigator>
  );
};

export const CustomerNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const routeName = getFocusedRouteNameFromRoute(route);
        const hideOnScreens = [
          'StoreDetails', 'ProductDetail', 'AddAddress', 'AddLiveLocation', 
          'Search', 'Category', 'MapSelection', 'Notifications', 
          'Favourites', 'CustomerOrders', 'Addresses', 'Refunds', 'CustomerSupport', 'Premium'
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
            if (route.name === 'Home') iconName = 'home-variant';
            else if (route.name === 'Offers') iconName = 'tag';
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
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Offers" component={OffersStack} />
      <Tab.Screen name="Cart" component={CartStack} />
      <Tab.Screen name="Account" component={AccountStack} />
    </Tab.Navigator>
  );
};
