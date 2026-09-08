import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cornerstoneunited.cuconnect',
  appName: 'CU Connect',
  webDir: 'dist',
  // Native login goes through base44's hosted login page
  // (base44.auth.redirectToLogin() does a real top-level
  // `window.location.href = https://cu-connect.app/login?...` navigation,
  // see src/lib/AuthContext.jsx + @base44/sdk's auth module). Without this,
  // Capacitor's default cross-origin navigation policy kicks that
  // top-level navigation out of the app's WKWebView into the system
  // browser (Safari) -- the user completes login there, but the
  // post-login redirect target is `capacitor://localhost/...` (the app's
  // own internal scheme), which Safari has no handler for, so the user is
  // stranded browsing the live cu-connect.app site in Safari and never
  // returns to the native app. Whitelisting the host keeps the whole
  // login round-trip (including the redirect back to capacitor://localhost)
  // inside the app's own WebView instead. Found + fixed Sept 8, 2026 (CU
  // Connect TODO doc section 84) after the push-notification retest on
  // Build 5 revealed the user was testing inside this stranded browser
  // session the whole time, not the native app.
  server: {
    allowNavigation: ['cu-connect.app', '*.cu-connect.app']
  }
};

export default config;
