import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
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
      // Native path: iOS/Android via @capacitor-firebase/messaging.
      // This plugin handles the APNs<->FCM token bridging on iOS internally,
      // so getToken() below always returns a real FCM token on both platforms.
      setIsSupported(true);
      checkNativePermission();
      registerNativeListeners();
      return () => {
        FirebaseMessaging.removeAllListeners();
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
      const status = await FirebaseMessaging.checkPermissions();
      const granted = status.receive === 'granted';
      setPermission(granted ? 'granted' : 'default');
      setIsSubscribed(granted);
    } catch (e) {
      console.error('Native permission check error:', e);
    }
  };

  const registerNativeListeners = () => {
    // Fires with a real FCM token — on iOS this is already the bridged token,
    // on Android it's the native FCM token. Same shape either way.
    FirebaseMessaging.addListener('tokenReceived', async ({ token }) => {
      try {
        await base44.functions.invoke('saveSubscription', {
          endpoint: `fcm:${token}`,
          platform: Capacitor.getPlatform(), // 'ios' | 'android'
          fcm_token: token,
        });
        setIsSubscribed(true);
        setPermission('granted');
      } catch (e) {
        console.error('Failed to save native push token:', e);
      }
    });

    // Foreground notification received while app is open
    FirebaseMessaging.addListener('notificationReceived', (event) => {
      console.log('Push received in foreground:', event);
    });

    // User tapped a notification — deep-link using the same `url` field
    // your backend already sends in the payload
    FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      const url = event.notification?.data?.url;
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
        const status = await FirebaseMessaging.requestPermissions();
        if (status.receive !== 'granted') {
          setPermission('denied');
          return;
        }
        // On iOS this also registers for remote notifications and bridges
        // the APNs token to FCM internally before firing 'tokenReceived' above.
        await FirebaseMessaging.getToken();
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
        await base44.functions.invoke('saveSubscription', { endpoint: '', remove: true, platform: Capacitor.getPlatform() }).catch(() => {});
        await FirebaseMessaging.deleteToken().catch(() => {});
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
