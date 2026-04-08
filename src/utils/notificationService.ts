import PushNotification, { Importance } from 'react-native-push-notification';
import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import { supabase } from '../api/supabase';
import { navigationRef } from '../../App';

class NotificationService {
  constructor() {
    this.configure();
    this.createDefaultChannels();
  }

  private configure() {
    const self = this;
    PushNotification.configure({
      onRegister: function (token) {
        console.log('TOKEN:', token);
      },
      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);
        
        // Handle notification tap
        if (notification.userInteraction) {
          self.handleNotificationTap(notification.data);
        }
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Handle background notification click (FCM)
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background state:', remoteMessage);
      this.handleNotificationTap(remoteMessage.data);
    });

    // Handle killed state notification click (FCM)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Notification caused app to open from quit state:', remoteMessage);
          this.handleNotificationTap(remoteMessage.data);
        }
      });
  }

  private createDefaultChannels() {
    PushNotification.createChannel(
      {
        channelId: "default-channel-id",
        channelName: "Default Channel",
        channelDescription: "A default channel",
        playSound: true,
        soundName: "default",
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created) => console.log(`createChannel returned '${created}'`)
    );
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      // 1. System notification permission (Android 13+)
      if (Platform.Version >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      // 2. Firebase permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      return enabled;
    }
    return true;
  }

  async getFcmToken() {
    try {
      if (Platform.OS === 'ios') {
        await messaging().registerDeviceForRemoteMessages();
      }
      const fcmToken = await messaging().getToken();
      return fcmToken;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  async saveToken(userId: string, role: string) {
    const token = await this.getFcmToken();
    if (!token) return;

    let targetGroup = 'customer';
    if (role === 'store') targetGroup = 'business';
    else if (role === 'rider') targetGroup = 'rider';

    const { error } = await supabase
      .from('fcm_tokens')
      .upsert(
        { 
          user_id: userId, 
          token: token, 
          target_group: targetGroup,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,token' }
      );

    if (error) console.error('Error saving FCM token to Supabase:', error);
    else console.log('FCM Token saved successfully');
  }

  showLocalNotification(title: string, message: string, data: any = {}) {
    PushNotification.localNotification({
      channelId: "default-channel-id",
      title: title,
      message: message,
      userInfo: data,
      playSound: true,
      soundName: "default",
    });
  }

  private handleNotificationTap(data: any) {
    if (!data) return;

    const { order_id, target_group } = data;
    if (!order_id) return;

    // Direct navigation using global ref
    if (navigationRef.isReady()) {
      if (target_group === 'business') {
        // Business app uses tabs, navigate to 'Orders' tab
        (navigationRef as any).navigate('Orders');
      } else {
        // Customer app uses a stack inside Account tab
        (navigationRef as any).navigate('Account', {
          screen: 'CustomerOrders',
          params: { orderId: order_id }
        });
      }
    } else {
      // If navigation is not ready, retry after a short delay
      setTimeout(() => this.handleNotificationTap(data), 500);
    }
  }
}

export const notificationService = new NotificationService();
