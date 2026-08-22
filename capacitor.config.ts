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

// Keep in sync with APP_UA_TOKEN in src/lib/app-mode.ts — that module's <head>
// script looks for this string to decide the page is running inside the shell.
// src/lib/__tests__/app-mode.test.ts fails if the two drift apart, because a
// drift breaks nothing visibly: the app just quietly goes back to looking like
// a website, which is the exact bug this whole mechanism exists to fix.
const APP_UA_TOKEN = "MatjarApp";

const config: CapacitorConfig = {
  appId: "com.matjarlb.app",
  appName: "Matjar",
  // ===== The app-mode signal =====
  //
  // This is the one thing that tells the hosted-hybrid page it is not in a
  // browser, and it rides on the user agent rather than on the Capacitor
  // bridge on purpose. `navigator.userAgent` is populated before the first
  // line of script the document runs; `window.Capacitor` is injected by the
  // native layer with no contract that it exists that early when the WebView
  // is pointed at a remote `server.url`. A signal that is late is a signal
  // that arrives after the footer has already painted.
  //
  // `appendUserAgent`, not `overrideUserAgent`: the stock Android/iOS WebView
  // UA still has to reach the server and Vercel Analytics intact.
  appendUserAgent: `${APP_UA_TOKEN}/1`,
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
