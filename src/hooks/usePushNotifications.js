import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState('default');

  useEffect(() => {
    // Web Push requires serviceWorker + PushManager + Notification APIs.
    // - Works on: Android Chrome, Desktop browsers, iOS Safari PWA (iOS 16.4+ added to Home Screen)
    // - Does NOT work in: iOS WKWebView (App Store wrapper), Chrome/Firefox on iOS
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
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
      const res = await base44.functions.invoke('getPushConfig', {});
      const publicKey = res.data?.publicKey;
      if (!publicKey) throw new Error('Could not get push config');

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = sub.toJSON();
      await base44.functions.invoke('saveSubscription', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });

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
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Remove from DB so server stops sending
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