"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Wires native capabilities onto the hosted-hybrid web app. Renders nothing and
// is a no-op on the web — every Capacitor plugin is imported lazily and only
// after confirming we're running inside the native shell, so the web bundle is
// unaffected. Mounted once in the root layout.
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
      await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      if (platform === "android") {
        await StatusBar.setBackgroundColor({ color: "#1556c2" }).catch(
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

      // Push notifications — only for signed-in users (respect guests / iOS
      // prompt etiquette). The device token is stored server-side so the
      // backend can target this device via FCM/APNs.
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );
      const registration = await PushNotifications.addListener(
        "registration",
        async (token) => {
          const {
            data: { user: u },
          } = await supabase.auth.getUser();
          if (!u) return;
          await supabase.rpc("register_device_token", {
            p_token: token.value,
            p_platform: platform,
          });
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

      if (user) {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === "granted") {
          await PushNotifications.register().catch(() => {});
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
