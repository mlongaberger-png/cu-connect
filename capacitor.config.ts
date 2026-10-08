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
  // 2026-09-28: also keep Microsoft and Apple sign-in inside the app. Both providers allow
  // their web sign-in inside an app WebView, so whitelisting them means the whole round trip
  // (provider -> Base44 callback -> cu-connect.app) stays in-app with its cookies, instead of
  // being kicked out to Chrome/Safari where the user got stranded on the website (seen on the
  // first Android test). Base44's own domains are listed in case its OAuth callback runs there.
  // Google is deliberately NOT listed: Google refuses sign-in inside WebViews
  // ("disallowed_useragent"), so it must use the system browser plus an App Link back to the
  // app -- see the Android launch plan doc.
  server: {
    allowNavigation: [
      'cu-connect.app', '*.cu-connect.app',
      'base44.com', '*.base44.com', 'base44.app', '*.base44.app',
      'login.microsoftonline.com', 'login.live.com', 'account.live.com',
      'appleid.apple.com',
    ]
  },
  // Without @capacitor/keyboard configured, iOS WKWebView falls back to its default
  // 'native' keyboard-resize behavior, which resizes the WebView's own content area
  // (via contentInset) whenever the keyboard shows/hides -- on top of, and independently
  // from, the app's own 100dvh + env(safe-area-inset-*) layout (see src/index.css /
  // AppLayout.jsx), which already handles the viewport itself. Two resize mechanisms
  // fighting over the same viewport is a well-documented Capacitor/WKWebView failure
  // mode: the WebView's internal viewport can be left in a resized/offset state after
  // the keyboard dismisses, which reads as the whole page having shifted and not
  // recovering. That matches what was found live 2026-09-08: after backing out of the
  // Messages Thread reply view (whose Composer's Textarea would have had the keyboard
  // up), the Messages page stayed shifted left -- header clipped, bottom nav pushed
  // half off-screen -- for the rest of the session, through further navigation.
  // 'none' turns off Capacitor's native resize entirely and leaves the already-dvh/
  // safe-area-driven layout to respond to the keyboard on its own, which is the
  // documented fix for apps built this way. Requires a native rebuild (`npx cap sync
  // ios` + an Xcode archive) to take effect -- this config change alone does nothing
  // until that's run.
  // 2026-09-25: switched back from 'none' to 'native'. With 'none' the keyboard simply
  // covers the bottom of every page, which broke pages we don't control -- Base44's hosted
  // sign-in page (cu-connect.app/login) had its Email field hidden under the keyboard. With
  // 'native' iOS shrinks the WebView above the keyboard (standard iPhone behavior), so any
  // page fits. Our own layout follows automatically (100dvh), and useKeyboard.js reports
  // height 0 on native so nothing double-counts the keyboard. The Sept 8 horizontal-shift
  // bug that motivated 'none' has since had its own fixes (ChatCanvas swipe preventDefault,
  // AppLayout scroll reset); watch for a recurrence after Build 12.
  plugins: {
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
