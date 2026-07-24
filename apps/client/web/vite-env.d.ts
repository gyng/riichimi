// Minimal Vite client typings. We declare only `import.meta.env` here rather
// than referencing "vite/client", whose ambient `*.svg` (string) declaration
// would collide with the react-native-svg component typing in types/assets.d.ts.
interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
