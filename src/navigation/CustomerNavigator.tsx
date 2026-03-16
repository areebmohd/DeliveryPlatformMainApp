import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { StoreDetailsScreen } from '../screens/customer/StoreDetailsScreen';
import { CartScreen } from '../screens/customer/CartScreen';
import { AccountScreen } from '../screens/customer/AccountScreen';
import { Colors } from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { CustomerOrdersScreen } from '../screens/customer/CustomerOrdersScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="StoreDetails" component={StoreDetailsScreen} />
    </Stack.Navigator>
  );
};

export const CustomerNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.black,
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
          fontWeight: '800',
        },
        tabBarIcon: ({ focused, size }) => {
          let iconName = '';
          if (route.name === 'Home') iconName = 'home-variant';
          else if (route.name === 'Orders') iconName = 'clipboard-list';
          else if (route.name === 'Cart') iconName = 'cart';
          else if (route.name === 'Account') iconName = 'account';

          if (focused) {
            return (
              <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <Icon 
                  name={iconName} 
                  size={size + 1} 
                  color={Colors.black} 
                  style={{ position: 'absolute' }} 
                />
                <Icon 
                  name={iconName.endsWith('-outline') ? iconName.replace('-outline', '') : iconName} 
                  size={size} 
                  color={Colors.primary} 
                />
              </View>
            );
          }

          return <Icon name={iconName} size={size} color={Colors.textSecondary} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Orders" component={CustomerOrdersScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
};
