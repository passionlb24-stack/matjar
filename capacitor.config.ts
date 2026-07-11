import type { CapacitorConfig } from "@capacitor/cli";

// Matjar ships as a hosted-hybrid Capacitor app: the native shell loads the
// live Next.js site (server.url) and layers native capabilities (push,
// geolocation, camera, share, deep links) on top via the Capacitor bridge.
// This keeps ONE codebase — the web app is the app — while still producing a
// real store-listed iOS/Android binary.
//
// For local development against a dev server, set CAP_SERVER_URL, e.g.
//   CAP_SERVER_URL=http://192.168.1.10:3000 npx cap sync
const serverUrl = process.env.CAP_SERVER_URL || "https://matjarlb.com";

const config: CapacitorConfig = {
  appId: "com.matjarlb.app",
  appName: "Matjar",
  // Fallback assets shown before the remote URL loads / when offline.
  webDir: "native-shell",
  backgroundColor: "#1556c2",
  server: {
    url: serverUrl,
    androidScheme: "https",
    // Allow the app to open the production origin; cleartext only if a
    // dev http:// URL is supplied.
    cleartext: serverUrl.startsWith("http://"),
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#1556c2",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
