import type { SupabaseClient } from "@supabase/supabase-js";

// Native (FCM/APNs) push, for the Capacitor shell (MP-028).
//
// Everything Capacitor is lazy-imported, and the Supabase client is never
// imported here at all — it is passed in — so this module can be pulled into the
// root layout without dragging either onto a web visitor's first load.
//
// The iOS rule that shapes all of this: `requestPermissions()` may show the
// system alert exactly ONCE in the lifetime of an install. Deny it and the app
// can never ask again; the user has to go to Settings. So the call sites here
// are deliberately few, and none of them run on launch.

/**
 * The one-shot prompt must not be spent on a channel that cannot deliver.
 * Nothing in this repo reads `device_push_tokens` to send yet — the FCM HTTP v1
 * sender is still unbuilt (MOBILE_APP.md, "Backend sender"). Until it ships,
 * the native opt-in stays hidden and the prompt stays unspent.
 *
 * Set `NEXT_PUBLIC_NATIVE_PUSH_ENABLED=1` in the environment on the same deploy
 * that the sender goes live. Web Push is unaffected — it has worked since 0046
 * and is gated separately.
 */
export const NATIVE_PUSH_ENABLED =
  process.env.NEXT_PUBLIC_NATIVE_PUSH_ENABLED === "1";

/**
 * The device token this install last registered, remembered locally.
 *
 * It exists for two reasons. It is how we tell "granted at the OS, and switched
 * on in the app" apart from "granted at the OS, but the user switched it off in
 * the app" — two states that need opposite UI. And it is how sign-out knows
 * which row to delete: without it, the row outlives the session and a
 * notification addressed to the previous account lands on the next person to
 * use the phone.
 */
const TOKEN_KEY = "matjar.push.device-token";

export function readDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function rememberDeviceToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode / storage disabled — degrade to "off", never throw */
  }
}

export function forgetDeviceToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** True only inside the Capacitor shell. */
export async function isNativeApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** `ios` / `android` inside the shell, `web` everywhere else. */
export async function nativePlatform(): Promise<string> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}

/**
 * What the OS currently thinks, without asking it anything. `unsupported` means
 * the plugin is not there at all — never confuse it with `denied`, which is a
 * decision the user made and can still reverse in Settings.
 */
export type OsPushState = "unsupported" | "prompt" | "granted" | "denied";

export async function checkNativePermission(): Promise<OsPushState> {
  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );
    const { receive } = await PushNotifications.checkPermissions();
    if (receive === "granted") return "granted";
    if (receive === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/**
 * Show the OS prompt. Only ever called from a user's explicit tap on a control
 * that has already said, in words, what the notification is for.
 */
export async function requestNativePermission(): Promise<OsPushState> {
  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );
    const { receive } = await PushNotifications.requestPermissions();
    if (receive === "granted") return "granted";
    if (receive === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/**
 * Ask APNs/FCM for a token. Fires the `registration` listener that
 * `NativeBridge` installed, which is what actually writes the row.
 *
 * Safe to call when permission is already granted — it shows no prompt — which
 * is how a rotated token gets refreshed on launch.
 */
export async function registerNativeDevice(): Promise<void> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.register();
}

/** Tell the OS to stop: deletes the FCM token on Android, unregisters APNs. */
export async function unregisterNativeDevice(): Promise<void> {
  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );
    await PushNotifications.unregister();
  } catch {
    /* best effort — the server-side row is the thing that stops delivery */
  }
}

/**
 * Remove this device's token row, then forget it locally.
 *
 * Order matters: the RLS delete policy is `user_id = auth.uid()`, so this has to
 * happen while the session is still alive. Call it *before* `signOut()`, never
 * after.
 *
 * Returns true when the row is gone (or was never there). False means the row
 * survived — the caller is signing out anyway, but the stale row is now a real
 * mis-delivery risk and worth logging.
 */
export async function deleteDeviceTokenRow(
  supabase: SupabaseClient,
): Promise<boolean> {
  const token = readDeviceToken();
  if (!token) return true;
  try {
    const { error } = await supabase
      .from("device_push_tokens")
      .delete()
      .eq("token", token);
    if (error) return false;
    forgetDeviceToken();
    return true;
  } catch {
    return false;
  }
}

/**
 * Full teardown for sign-out: stop the OS registration and drop the row, so the
 * next person to sign in on this phone cannot receive the previous account's
 * notifications.
 */
export async function releaseDeviceOnSignOut(
  supabase: SupabaseClient,
): Promise<void> {
  if (!(await isNativeApp())) return;
  const removed = await deleteDeviceTokenRow(supabase);
  if (!removed) {
    console.error(
      "[push] could not delete this device's push token on sign-out; it may still point at the previous account",
    );
  }
  await unregisterNativeDevice();
  // Clear it locally even if the delete failed, so the UI does not claim to be
  // on for an account that is no longer signed in.
  forgetDeviceToken();
}
