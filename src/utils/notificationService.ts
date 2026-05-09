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
    PushNotification.configure({
      onRegister: () => {
        // Silent
      },
      onNotification: (notification) => {
        // Handle notification tap
        if (notification.userInteraction) {
          this.handleNotificationTap(notification.data);
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
      this.handleNotificationTap(remoteMessage.data);
    });

    // Handle foreground notifications (FCM)
    messaging().onMessage(async remoteMessage => {
      if (remoteMessage.notification) {
        this.showLocalNotification(
          remoteMessage.notification.title || 'New Notification',
          remoteMessage.notification.body || '',
          remoteMessage.data
        );
      }
    });

    // Handle killed state notification click (FCM)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
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
      () => { /* Silent */ }
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
    try {
      const token = await this.getFcmToken();
      if (!token) {
        console.warn('[NotificationService] Failed to retrieve FCM token');
        return;
      }

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
          { onConflict: 'token' }
        );

      if (error) {
        // Silent error
      } else {
        // Success
      }
    } catch {
      // Silent error
    }
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

  async sendNotification(params: {
    userId?: string;
    orderId?: string;
    title: string;
    description: string;
    targetGroup: 'customer' | 'business' | 'rider';
  }) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: params.userId,
          order_id: params.orderId,
          title: params.title,
          description: params.description,
          target_group: params.targetGroup,
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('[NotificationService] sendNotification failed:', error);
    }
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
