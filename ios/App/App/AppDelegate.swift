import UIKit
import Capacitor
import FirebaseCore
import WebKit
import AuthenticationServices

// Main.storyboard uses this instead of the stock CAPBridgeViewController so the app can
// register its own in-app plugin (below). @objc name keeps the storyboard lookup independent
// of the Swift module name (the target's product name has spaces and dots in it).
@objc(MainViewController)
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GoogleSignInBridge())
    }
}

/// Google sign-in on iOS.
///
/// Google refuses to sign in inside an app's WebView ("disallowed_useragent"), so it is left
/// out of capacitor.config's allowNavigation and Capacitor used to hand it to Safari -- the
/// user signed in there and was left on the website instead of the app (seen Oct 13, 2026).
///
/// Now, when the hosted login page starts Google sign-in (cu-connect.app/api/apps/auth/login),
/// this opens it in an ASWebAuthenticationSession -- Apple's sign-in sheet, which Google allows.
/// from_url is pointed at https://cu-connect.app/app-return?app=ios, which redirects to
/// cuconnect://auth?access_token=...; the session catches that, closes the sheet, and the app's
/// WebView loads the page the user came from with the token, which signs them in in-app.
/// Same idea as MainActivity.java on Android.
@objc(GoogleSignInBridge)
class GoogleSignInBridge: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    let identifier = "GoogleSignInBridge"
    let jsName = "GoogleSignInBridge"
    let pluginMethods: [CAPPluginMethod] = []

    private static let site = "https://cu-connect.app"
    private var session: ASWebAuthenticationSession?

    override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let url = navigationAction.request.url, Self.isGoogleLoginStart(url) else { return nil }
        if session != nil { return true } // a sheet is already open
        let (authURL, returnBase) = Self.rewriteFromUrl(url)
        start(authURL, returnBase: returnBase)
        return true
    }

    private static func isGoogleLoginStart(_ url: URL) -> Bool {
        guard url.scheme == "https", let host = url.host,
              host == "cu-connect.app" || host == "www.cu-connect.app" else { return false }
        // Google is Base44's default provider, so it has no provider segment in the path.
        return url.path == "/api/apps/auth/login" || url.path == "/api/apps/auth/google/login"
    }

    /// Points from_url at /app-return?app=ios and remembers where the user was so they land
    /// back on the same page (live site or the app's bundled copy) once signed in.
    private static func rewriteFromUrl(_ url: URL) -> (URL, String) {
        var next = "/"
        var returnBase = site
        if var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            let items = comps.queryItems ?? []
            if let oldFrom = items.first(where: { $0.name == "from_url" })?.value,
               let from = URLComponents(string: oldFrom), let fromHost = from.host {
                let isLiveSite = from.scheme == "https" && (fromHost == "cu-connect.app" || fromHost == "www.cu-connect.app")
                let isBundledApp = from.scheme == "capacitor" && fromHost == "localhost"
                if isBundledApp { returnBase = "capacitor://localhost" }
                if isLiveSite || isBundledApp {
                    let p = from.percentEncodedPath.isEmpty ? "/" : from.percentEncodedPath
                    next = from.percentEncodedQuery.map { p + "?" + $0 } ?? p
                }
            }
            var appReturn = URLComponents(string: site + "/app-return")!
            appReturn.queryItems = [URLQueryItem(name: "next", value: next), URLQueryItem(name: "app", value: "ios")]
            comps.queryItems = items.filter { $0.name != "from_url" } +
                [URLQueryItem(name: "from_url", value: appReturn.url!.absoluteString)]
            return (comps.url ?? url, returnBase)
        }
        return (url, returnBase)
    }

    private func start(_ authURL: URL, returnBase: String) {
        let s = ASWebAuthenticationSession(url: authURL, callbackURLScheme: "cuconnect") { [weak self] callback, _ in
            DispatchQueue.main.async {
                self?.session = nil
                // Cancelled or failed: stay on the login page so the user can pick another option.
                guard let callback = callback,
                      let comps = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                      comps.host == "auth",
                      let token = comps.queryItems?.first(where: { $0.name == "access_token" })?.value,
                      !token.isEmpty else { return }
                var next = comps.queryItems?.first(where: { $0.name == "next" })?.value ?? "/"
                if !next.hasPrefix("/") || next.hasPrefix("//") { next = "/" }
                guard var target = URLComponents(string: returnBase + next) else { return }
                target.queryItems = (target.queryItems ?? []) + [URLQueryItem(name: "access_token", value: token)]
                if let targetURL = target.url {
                    self?.bridge?.webView?.load(URLRequest(url: targetURL))
                }
            }
        }
        s.presentationContextProvider = self
        // Share Safari's cookies so Google remembers the account; no extra login each time.
        s.prefersEphemeralWebBrowserSession = false
        session = s
        if !s.start() { session = nil }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Required by @capacitor-firebase/messaging for FCM token generation
        // and APNs<->FCM token bridging.
        FirebaseApp.configure()
        return true
    }

    // Forwards the APNs device token to Capacitor's own notification center
    // event, which @capacitor-firebase/messaging listens for to set
    // Messaging.messaging().apnsToken. Without this, Messaging.token()
    // (native getToken()) waits forever for a token that never arrives --
    // this was the root cause of push registration silently hanging with
    // no error anywhere (see CU Connect TODO doc section 79/80).
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
