// Web shim for expo-asset. Vite resolves asset imports (png/ttf) to URL strings
// at build time, so an "asset module" already IS its served URL. We mirror only
// the slice the app uses: Asset.fromModule(m).uri / .localUri / downloadAsync().
interface WebAsset {
  readonly uri: string;
  readonly localUri: string;
  downloadAsync(): Promise<WebAsset>;
}

function webAsset(uri: string): WebAsset {
  const self: WebAsset = {
    uri,
    localUri: uri,
    downloadAsync: async () => self,
  };
  return self;
}

export const Asset = {
  fromModule(moduleRef: string | { readonly uri?: string }): WebAsset {
    const uri = typeof moduleRef === "string" ? moduleRef : (moduleRef.uri ?? "");
    return webAsset(uri);
  },
  async loadAsync(_moduleRef: unknown): Promise<void> {},
};
