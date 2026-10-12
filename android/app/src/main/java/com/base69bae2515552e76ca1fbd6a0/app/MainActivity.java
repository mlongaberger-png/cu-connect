package com.base69bae2515552e76ca1fbd6a0.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.Logger;
import java.lang.reflect.Method;
import java.util.HashSet;
import java.util.Set;

/**
 * After sign-in the app runs the live site (https://cu-connect.app, whitelisted in
 * capacitor.config.ts allowNavigation) inside this WebView. On iOS Capacitor injects its
 * native bridge JS into every page, so plugins (push, keyboard, badge) work there. On
 * Android, Capacitor 8 only injects the bridge into the app's own origin
 * (https://localhost), so on cu-connect.app window.Capacitor was the web-only stub:
 * isNativePlatform() was false, "Turn On Notifications" silently did nothing, and logcat
 * showed "window.Capacitor.triggerEvent is not a function" (found 2026-09-28, first Android
 * device test on a Pixel 10 Pro XL).
 *
 * Fix: register the same bridge script as a document-start script for the live origins.
 * Capacitor's message listener already accepts these origins (it uses the allowNavigation
 * list), so once the script is there the native plugins work exactly as on localhost.
 */
public class MainActivity extends BridgeActivity {

    private static final String[] LIVE_ORIGINS = { "https://cu-connect.app", "https://www.cu-connect.app" };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        injectBridgeIntoLiveSite();
        sendGoogleSignInToChrome();
    }

    // ---------------------------------------------------------------------------------------
    // Google sign-in (added 2026-10-12)
    //
    // Google blocks sign-in inside app WebViews ("disallowed_useragent"), so Google has to run
    // in Chrome. Before this fix Chrome kept the session: the user finished signing in and was
    // left on the website in Chrome instead of the app.
    //
    // 1. When the hosted login page's "Continue with Google" navigates to
    //    https://cu-connect.app/api/apps/auth/login?from_url=...&app_id=..., open that URL in
    //    Chrome instead, with from_url changed to https://cu-connect.app/app-return?next=<old>.
    // 2. After Google + Base44 finish, Chrome shows /app-return (src/pages/AppReturn.jsx), which
    //    opens intent://auth?access_token=...#Intent;scheme=cuconnect;package=<this app>.
    // 3. onNewIntent below loads https://cu-connect.app<next>?access_token=... in this WebView;
    //    app-params.js stores the token, so the user is signed in inside the app.
    // Microsoft and Apple are unchanged: they already sign in inside the WebView.
    // ---------------------------------------------------------------------------------------

    private static final String SITE = "https://cu-connect.app";

    private void sendGoogleSignInToChrome() {
        final Bridge bridge = getBridge();
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (isGoogleLoginStart(url)) {
                    openInBrowser(rewriteFromUrl(url));
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }

    private static boolean isGoogleLoginStart(Uri url) {
        if (url == null || !"https".equals(url.getScheme())) return false;
        String host = url.getHost();
        if (host == null || !(host.equals("cu-connect.app") || host.equals("www.cu-connect.app"))) return false;
        String path = url.getPath();
        // Google is Base44's default provider, so it has no provider segment in the path.
        return "/api/apps/auth/login".equals(path) || "/api/apps/auth/google/login".equals(path);
    }

    private static Uri rewriteFromUrl(Uri url) {
        String oldFrom = url.getQueryParameter("from_url");
        String next = "/";
        if (oldFrom != null) {
            Uri from = Uri.parse(oldFrom);
            if (from.getHost() != null && from.getHost().endsWith("cu-connect.app")) {
                String p = from.getEncodedPath() == null ? "/" : from.getEncodedPath();
                String q = from.getEncodedQuery();
                next = q == null ? p : p + "?" + q;
            }
        }
        String newFrom = SITE + "/app-return?next=" + Uri.encode(next);
        Uri.Builder b = url.buildUpon().clearQuery();
        for (String name : url.getQueryParameterNames()) {
            if ("from_url".equals(name)) continue;
            for (String v : url.getQueryParameters(name)) b.appendQueryParameter(name, v);
        }
        b.appendQueryParameter("from_url", newFrom);
        return b.build();
    }

    private void openInBrowser(Uri url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, url);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(i);
        } catch (Exception e) {
            Logger.error("CUConnect", "Could not open browser for Google sign-in", e);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAuthReturn(intent);
    }

    private void handleAuthReturn(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if (!"cuconnect".equals(data.getScheme()) || !"auth".equals(data.getHost())) return;
        String token = data.getQueryParameter("access_token");
        if (token == null || token.isEmpty()) return;
        String next = data.getQueryParameter("next");
        if (next == null || !next.startsWith("/") || next.startsWith("//")) next = "/";
        Uri target = Uri.parse(SITE + next).buildUpon().appendQueryParameter("access_token", token).build();
        final String targetUrl = target.toString();
        // Clear the token from the intent so a later re-delivery can't replay it.
        intent.setData(null);
        final WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView != null) webView.post(() -> webView.loadUrl(targetUrl));
    }

    private void injectBridgeIntoLiveSite() {
        try {
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                Logger.warn("CUConnect", "DOCUMENT_START_SCRIPT unsupported; native plugins unavailable on live site");
                return;
            }
            Bridge bridge = getBridge();
            // Bridge.getJSInjector() and JSInjector are not public API, so reach them by reflection.
            Method getInjector = Bridge.class.getDeclaredMethod("getJSInjector");
            getInjector.setAccessible(true);
            Object injector = getInjector.invoke(bridge);
            if (injector == null) return;
            Method getScript = injector.getClass().getDeclaredMethod("getScriptString");
            getScript.setAccessible(true);
            String script = (String) getScript.invoke(injector);

            Set<String> origins = new HashSet<>();
            for (String o : LIVE_ORIGINS) origins.add(o);
            WebViewCompat.addDocumentStartJavaScript(bridge.getWebView(), script, origins);
            Logger.info("CUConnect", "Capacitor bridge registered for live site origins");
        } catch (Exception e) {
            Logger.error("CUConnect", "Could not register Capacitor bridge for live site", e);
        }
    }
}
