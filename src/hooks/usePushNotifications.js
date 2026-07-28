import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { base44 } from '@/api/base44Client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const isNative = Capacitor.isNativePlatform();

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState('default');

  useEffect(() => {
    if (isNative) {
      // Native path: iOS/Android via Capacitor Push Notifications (APNs/FCM)
      setIsSupported(true);
      checkNativePermission();
      registerNativeListeners();
      return () => {
        PushNotifications.removeAllListeners();
      };
    }

    // Web path: browser Web Push API (desktop / Android Chrome PWA)
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkWebSubscription();
    }
  }, []);

  const checkNativePermission = async () => {
    try {
      const status = await PushNotifications.checkPermissions();
      setPermission(status.receive === 'granted' ? 'granted' : 'default');
      setIsSubscribed(status.receive === 'granted');
    } catch (e) {
      console.error('Native permission check error:', e);
    }
  };

  const registerNativeListeners = () => {
    // Fires once the OS hands us a real device token
    PushNotifications.addListener('registration', async (token) => {
      try {
        await base44.functions.invoke('saveSubscription', {
          endpoint: `fcm:${token.value}`,
          platform: Capacitor.getPlatform(), // 'ios' | 'android'
          fcm_token: token.value,
        });
        setIsSubscribed(true);
        setPermission('granted');
      } catch (e) {
        console.error('Failed to save native push token:', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Native push registration error:', err);
      setPermission('denied');
    });

    // Foreground notification received while app is open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received in foreground:', notification);
    });

    // User tapped a notification — deep-link using the same `url` field
    // your backend already sends in the payload
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = action.notification?.data?.url;
      if (url) window.location.href = url;
    });
  };

  const checkWebSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } else {
        setIsSubscribed(false);
      }
    } catch (e) {
      console.error('Check subscription error:', e);
      setIsSubscribed(false);
    }
  };

  const subscribe = async () => {
    setIsLoading(true);
    try {
      if (isNative) {
        const status = await PushNotifications.requestPermissions();
        if (status.receive !== 'granted') {
          setPermission('denied');
          return;
        }
        // Triggers the 'registration' listener above with the real token
        await PushNotifications.register();
        return;
      }

      // Web path (unchanged)
      const res = await base44.functions.invoke('getPushConfig', {});
      const publicKey = res.data?.publicKey;
      if (!publicKey) throw new Error('Could not get push config');

      await navigator.serviceWorker.register('/sw.js');
      const activeReg = await navigator.serviceWorker.ready;

      const sub = await activeReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = sub.toJSON();
      await base44.functions.invoke('saveSubscription', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        platform: 'web',
      });

      await checkWebSubscription();
      setIsSubscribed(true);
      setPermission('granted');
    } catch (e) {
      console.error('Subscribe error:', e);
      if (e.name === 'NotAllowedError') setPermission('denied');
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      if (isNative) {
        // Best-effort: mark inactive server-side; the OS-level token itself
        // stays valid until the app is uninstalled or re-registers.
        await base44.functions.invoke('saveSubscription', { endpoint: '', remove: true, platform: Capacitor.getPlatform() }).catch(() => {});
        setIsSubscribed(false);
        return;
      }

      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await base44.functions.invoke('saveSubscription', { endpoint: sub.endpoint, keys: {}, remove: true }).catch(() => {});
          await sub.unsubscribe();
        }
      }
      setIsSubscribed(false);
      setPermission(Notification.permission);
    } catch (e) {
      console.error('Unsubscribe error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe };
}
