package com.base69bae2515552e76ca1fbd6a0.app;

import android.os.Bundle;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
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
