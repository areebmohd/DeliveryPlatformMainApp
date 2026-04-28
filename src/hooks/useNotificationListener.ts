import { useEffect } from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../utils/notificationService';

export const useNotificationListener = () => {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.role) return;

    // Map role to target_group
    let targetGroup = 'customer';
    if (profile.role === 'store') targetGroup = 'business';
    else if (profile.role === 'rider') targetGroup = 'rider';

    console.log(`Subscribing to notifications for: ${targetGroup}`);

    const subscription = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `target_group=eq.${targetGroup}`,
        },
        (payload) => {
          console.log('New notification received:', payload);
          const { user_id, title, description, order_id, target_group } = payload.new;

          // If the notification is targeted to a specific user, FCM will deliver it.
          // We ignore it here to prevent duplicate push notifications.
          if (user_id) {
            return; 
          }

          // We only show local notifications for broadcasts (user_id is null) 
          // because the edge function blocks FCM for customer/business broadcasts.
          notificationService.showLocalNotification(title, description, {
            order_id,
            target_group,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [profile?.role]);
};
