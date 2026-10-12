import React, { useEffect, useMemo } from "react";

/**
 * /app-return -- hand a Google sign-in back to the Android app.
 *
 * Google refuses to sign in inside an app WebView ("disallowed_useragent"), so on
 * Android MainActivity.java sends the "Continue with Google" step to Chrome and rewrites
 * Base44's from_url to point here. After Google + Base44 finish, Chrome lands on
 * https://cu-connect.app/app-return?access_token=...&next=...
 *
 * app-params.js has already moved access_token out of the URL into localStorage by the
 * time this renders, so read it from there. Then open the app with an Android intent
 * link that only our package can receive; MainActivity.onNewIntent loads the live site
 * in the app's WebView with that token, which signs the user in inside the app.
 *
 * Chrome usually follows the automatic redirect. If it doesn't (Chrome can block an
 * app launch that wasn't started by a tap), the button does the same thing.
 */
const ANDROID_PACKAGE = "com.base69bae2515552e76ca1fbd6a0.app";
const SITE = "https://cu-connect.app";

function safeNext(raw) {
  try {
    const u = new URL(raw || "/", SITE);
    return u.origin === SITE ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

export default function AppReturn() {
  const params = new URLSearchParams(window.location.search);
  const next = safeNext(params.get("next"));
  const token = (() => {
    try { return window.localStorage.getItem("base44_access_token"); } catch { return null; }
  })();
  const isAndroid = /Android/i.test(navigator.userAgent);

  const intentUrl = useMemo(() => {
    if (!token) return null;
    const q = `access_token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
    const fallback = encodeURIComponent(`${SITE}${next}`);
    return `intent://auth?${q}#Intent;scheme=cuconnect;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
  }, [token, next]);

  useEffect(() => {
    if (intentUrl && isAndroid) window.location.href = intentUrl;
  }, [intentUrl, isAndroid]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-sm w-full">
        {token ? (
          <>
            <p className="text-foreground font-semibold text-lg mb-2">You're signed in</p>
            <p className="text-sm text-muted-foreground mb-6">
              {isAndroid ? "Tap below to go back to the CU Connect app." : "Continue to CU Connect."}
            </p>
            <a
              href={isAndroid ? intentUrl : next}
              className="block w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              {isAndroid ? "Open the CU Connect app" : "Continue"}
            </a>
            {isAndroid && (
              <a href={next} className="block mt-4 text-xs text-muted-foreground underline">
                Stay in the browser instead
              </a>
            )}
          </>
        ) : (
          <>
            <p className="text-foreground font-semibold text-lg mb-2">Sign-in didn't finish</p>
            <p className="text-sm text-muted-foreground mb-6">Go back to the CU Connect app and try again.</p>
            <a href="/" className="block w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
              Go to CU Connect
            </a>
          </>
        )}
      </div>
    </div>
  );
}
