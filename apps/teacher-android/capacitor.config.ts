import type { CapacitorConfig } from "@capacitor/cli";

/** Staging/production teacher panel. Override with TEACHER_APP_URL. */
const serverUrl = process.env.TEACHER_APP_URL ?? "https://khaneyeidea-production.up.railway.app/fa/teacher";

const config: CapacitorConfig = {
  appId: "academy.khaneyeidea.teacher",
  appName: "\u062f\u0628\u06cc\u0631 \u062e\u0627\u0646\u0647 \u0627\u06cc\u062f\u0647",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0b0c10",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0b0c10",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0c10",
    },
  },
};

export default config;