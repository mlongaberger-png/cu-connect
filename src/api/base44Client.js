import { createClient } from '@base44/sdk';
import { Capacitor } from '@capacitor/core';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Native builds (iOS/Android via Capacitor) are served from the app's own
// local bundle (capacitor://localhost / http://localhost), not from
// cu-connect.app like the web build is. Relative-path API/auth calls that
// work fine on web (same-origin) silently resolve against "localhost" on
// native and go nowhere -- this is what broke native login (see CU Connect
// TODO doc section 69/76: the native app installed and ran, but login did
// nothing, with no visible error). Force the real app domain when running
// natively; web behavior (relative serverUrl, appParams-derived appBaseUrl)
// is left exactly as it was.
const isNative = Capacitor.isNativePlatform();
const NATIVE_APP_BASE_URL = 'https://cu-connect.app';

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: isNative ? NATIVE_APP_BASE_URL : '',
  requiresAuth: true,
  appBaseUrl: isNative ? NATIVE_APP_BASE_URL : appBaseUrl
});
