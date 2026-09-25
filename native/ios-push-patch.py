from pathlib import Path

APP_DELEGATE = Path('ios/App/App/AppDelegate.swift')

if not APP_DELEGATE.exists():
    raise SystemExit(f'AppDelegate not found: {APP_DELEGATE}')

src = APP_DELEGATE.read_text(encoding='utf-8')

if 'import Capacitor' not in src:
    raise SystemExit('Generated AppDelegate.swift does not import Capacitor; refusing to patch blindly.')

marker = '.capacitorDidRegisterForRemoteNotifications'
if marker not in src:
    methods = r'''

    // Football Edge N1.1: bridge APNs registration callbacks to Capacitor PushNotifications.
    // Required by @capacitor/push-notifications on iOS.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
'''
    pos = src.rfind('\n}')
    if pos < 0:
        raise SystemExit('Could not find AppDelegate class closing brace; refusing to patch blindly.')
    src = src[:pos] + methods + src[pos:]
    APP_DELEGATE.write_text(src, encoding='utf-8')
    print('Applied APNs -> Capacitor AppDelegate bridge.')
else:
    print('APNs -> Capacitor AppDelegate bridge already present.')

check = APP_DELEGATE.read_text(encoding='utf-8')
required = [
    'capacitorDidRegisterForRemoteNotifications',
    'capacitorDidFailToRegisterForRemoteNotifications',
]
missing = [x for x in required if x not in check]
if missing:
    raise SystemExit(f'iOS push bridge validation failed; missing: {missing}')

print('iOS Push AppDelegate patch validation PASS.')
