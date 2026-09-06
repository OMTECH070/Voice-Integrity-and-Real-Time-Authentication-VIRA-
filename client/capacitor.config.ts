import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vira.voiceintegrity",
  appName: "VIRA",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
