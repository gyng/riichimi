import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

const fromHere = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// Web-only build. React Native primitives run through react-native-web; the
// Expo Router, native storage, camera, and asset modules are swapped for the web
// shims under `web/`. `.web.*` sources win resolution so the existing platform
// splits (storage, speech, celebration) pick their web halves automatically.
export default defineConfig({
  // The offline ONNX classifier is bundled as a URL asset, then handed to
  // onnxruntime-web at runtime (metro could not bundle it — the reason for Vite).
  assetsInclude: ["**/*.onnx"],
  base: process.env.VITE_BASE ?? "/",
  define: {
    __DEV__: "false",
    global: "globalThis",
    "process.env.EXPO_OS": JSON.stringify("web"),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
  },
  plugins: [
    react(),
    // Match the metro react-native-svg-transformer: `.svg` imports become
    // react-native-svg components (rendered to DOM svg by react-native-web).
    svgr({ include: "**/*.svg", svgrOptions: { native: true } }),
  ],
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: "react-native-web" },
      { find: /^expo-router$/, replacement: fromHere("./web/expo-router.tsx") },
      {
        find: /^react-native-safe-area-context$/,
        replacement: fromHere("./web/shims/safe-area.tsx"),
      },
      { find: /^expo-font$/, replacement: fromHere("./web/shims/expo-font.ts") },
      { find: /^expo-asset$/, replacement: fromHere("./web/shims/expo-asset.ts") },
      { find: /^expo-status-bar$/, replacement: fromHere("./web/shims/expo-status-bar.tsx") },
      { find: /^expo-camera$/, replacement: fromHere("./web/shims/expo-camera.tsx") },
      { find: /^expo-image-picker$/, replacement: fromHere("./web/shims/expo-image-picker.ts") },
      {
        find: /^expo-image-manipulator$/,
        replacement: fromHere("./web/shims/expo-image-manipulator.ts"),
      },
    ],
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".web.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".mjs",
      ".json",
    ],
  },
});
