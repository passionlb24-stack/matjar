// Web Push (VAPID) config. The PUBLIC key is safe to ship to the browser; the
// PRIVATE key is a server secret set as the VAPID_PRIVATE_KEY env var on the
// host (sending is disabled until it's set). Regenerate with:
//   node -e "console.log(require('web-push').generateVAPIDKeys())"
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  "BKFlAAlpyuioZpKmVxEGRDvTiKhmRaJzjRIEgY6-KtBrkpZc7DlQaU4BdKys2Hk-GrIFXptHgUBk122QR4bf4qI";

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ?? "mailto:hello@matjarlb.com";

// Convert a base64url VAPID key to the Uint8Array the PushManager expects.
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
