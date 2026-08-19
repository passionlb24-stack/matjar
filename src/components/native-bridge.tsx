"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  NATIVE_PUSH_ENABLED,
  checkNativePermission,
  readDeviceToken,
  registerNativeDevice,
  rememberDeviceToken,
} from "@/lib/native-push";

// Wires native capabilities onto the hosted-hybrid web app. Renders nothing and
// is a no-op on the web.
//
// Everything heavy is lazy-imported *below* the `isNativePlatform()` guard —
// the Capacitor plugins and, since it turned out to be the single largest thing
// this file pulled in, the Supabase browser client. This component is mounted in
// the root layout, so a static import here lands in the shared chunk that every
// route loads: 240 KB uncompressed / 53 KB brotli of Supabase was being shipped
// to every web visitor for a branch that can only run inside the app shell. The
// old comment here claimed the web bundle was unaffected; it was true of the
// plugins and false of Supabase.
//
// What this component deliberately does NOT do any more: ask for notification
// permission. See below.
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    const removers: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || cancelled) return;
      const platform = Capacitor.getPlatform();

      // Splash + status bar
      const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
      ]);
      await SplashScreen.hide().catch(() => {});
      // Light header → dark status-bar icons; blend the Android status bar with
      // the header background so the top of the app looks seamless.
      await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      if (platform === "android") {
        await StatusBar.setBackgroundColor({ color: "#fbfbf9" }).catch(
          () => {},
        );
      }

      // App lifecycle: Android hardware back + deep links
      const { App } = await import("@capacitor/app");
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      });
      removers.push(() => back.remove());

      const urlOpen = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          const path = `${u.pathname}${u.search}`;
          if (path && path !== "/") router.push(path);
        } catch {
          /* ignore malformed deep links */
        }
      });
      removers.push(() => urlOpen.remove());

      // ── Push ──────────────────────────────────────────────────────────────
      //
      // This block used to call `PushNotifications.requestPermissions()` right
      // here, for any signed-in user, on the first render after launch. On iOS
      // that system alert can be shown ONCE per install: a person who had just
      // opened the app, in the middle of doing something else, with no
      // explanation of what the notification would even be about, was handed
      // the only chance the app would ever get. The usual answer to a prompt
      // like that is "Don't Allow", and then it is over — permanently, from
      // inside the app.
      //
      // The ask now lives in `PushOptIn`, on a control that says what the
      // notification is for (the merchant's approval decision, the admin's
      // pending-store queue) and only fires the OS prompt on a tap.
      //
      // Two listeners still belong here, because they must exist before any
      // registration or tap can arrive, and a tap can arrive on any route:
      //
      //   `registration` — fires only as a consequence of a `register()` call,
      //   which is now only ever made from the explicit opt-in, or from the
      //   silent refresh below for someone already opted in. It does not fire
      //   on its own, so no token is stored without the user having agreed.
      //
      //   `pushNotificationActionPerformed` — routing a tapped notification.
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );

      const registration = await PushNotifications.addListener(
        "registration",
        async (token) => {
          // Lazy, and only on a code path that has already proven it is native.
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;
          const { error } = await supabase.rpc("register_device_token", {
            p_token: token.value,
            p_platform: platform,
          });
          if (error) return;
          // Remember it locally so the UI can tell "on" from "switched off",
          // and so sign-out knows which row to delete.
          rememberDeviceToken(token.value);
        },
      );
      removers.push(() => registration.remove());

      const tapped = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const url = action.notification.data?.url;
          if (typeof url === "string" && url.startsWith("/")) router.push(url);
        },
      );
      removers.push(() => tapped.remove());

      // Silent token refresh for someone who already opted in. FCM and APNs
      // both rotate tokens (reinstall, restore from backup, OS update), and a
      // rotated token means notifications simply stop arriving with nothing to
      // see. `register()` shows no prompt when permission is already granted,
      // so this asks the user for nothing.
      //
      // Guarded on a remembered token, not on the OS permission alone: someone
      // who granted the permission and then switched it off inside the app has
      // OS permission and no token, and re-registering them here would quietly
      // undo their choice on the next launch.
      if (NATIVE_PUSH_ENABLED && !cancelled && readDeviceToken()) {
        const perm = await checkNativePermission();
        if (perm === "granted") {
          await registerNativeDevice().catch(() => {});
        }
      }
    })();

    return () => {
      cancelled = true;
      removers.forEach((r) => r());
    };
  }, [router]);

  return null;
}
