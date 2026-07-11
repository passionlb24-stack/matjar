// Thin helpers that use Capacitor native plugins when running inside the app
// shell, and fall back to standard web APIs in the browser. Every plugin is
// lazy-imported so the web bundle only pulls Capacitor in when actually needed,
// and nothing here executes on the server.

async function isNative(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export type Coords = { lat: number; lng: number };

/**
 * Get the device's current position. Uses the native Geolocation plugin on
 * device (better permission handling + accuracy), otherwise the Web API.
 * Rejects on denial/timeout so callers can show an error.
 */
export async function getCurrentPosition(): Promise<Coords> {
  if (await isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.requestPermissions();
    if (perm.location === "denied") throw new Error("denied");
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }

  return new Promise<Coords>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

/**
 * True when the native camera/gallery picker is available. Lets callers show a
 * native "take photo" affordance instead of a plain file input.
 */
export async function hasNativeCamera(): Promise<boolean> {
  return isNative();
}

/**
 * Pick or capture an image natively and return it as a File ready to upload
 * through the existing web upload path. `source` picks camera vs library.
 */
export async function pickNativeImage(
  source: "camera" | "photos" | "prompt" = "prompt",
): Promise<File> {
  const { Camera, CameraResultType, CameraSource } = await import(
    "@capacitor/camera"
  );
  const sourceMap = {
    camera: CameraSource.Camera,
    photos: CameraSource.Photos,
    prompt: CameraSource.Prompt,
  } as const;
  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: sourceMap[source],
  });
  const webPath = photo.webPath;
  if (!webPath) throw new Error("no-image");
  const res = await fetch(webPath);
  const blob = await res.blob();
  const ext = photo.format || "jpg";
  return new File([blob], `photo.${ext}`, {
    type: blob.type || `image/${ext}`,
  });
}

/**
 * Share a URL. Uses the native share sheet on device, the Web Share API when
 * available, and copies to the clipboard as a last resort. Returns the method
 * used so the UI can confirm (e.g. show "link copied").
 */
export async function share(data: {
  title?: string;
  text?: string;
  url: string;
}): Promise<"native" | "web" | "copied" | "failed"> {
  if (await isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share(data);
      return "native";
    } catch {
      return "failed";
    }
  }
  if (typeof navigator === "undefined") return "failed";
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "web";
    } catch {
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
