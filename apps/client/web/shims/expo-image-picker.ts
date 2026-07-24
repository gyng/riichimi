// Web implementation of the expo-image-picker slice the scan flow uses. A native
// library picker becomes a file input; the chosen image is exposed as an object
// URL. There is no cross-launch "pending result" on web — the dialog resolves
// inline — so getPendingResultAsync always reports nothing pending.
export interface ImagePickerAsset {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly fileName?: string;
}

export type ImagePickerResult =
  | { readonly canceled: true; readonly assets: null }
  | { readonly canceled: false; readonly assets: readonly ImagePickerAsset[] };

export const MediaTypeOptions = { All: "All", Images: "Images", Videos: "Videos" } as const;

export async function requestMediaLibraryPermissionsAsync() {
  // The browser grants file access per-dialog; there is no standing permission.
  return { canAskAgain: true, expires: "never", granted: true, status: "granted" } as const;
}

export async function getPendingResultAsync(): Promise<ImagePickerResult | null> {
  return null;
}

export async function launchImageLibraryAsync(_options?: unknown): Promise<ImagePickerResult> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    let settled = false;
    const finish = (result: ImagePickerResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file === undefined) {
        finish({ assets: null, canceled: true });
        return;
      }
      finish({
        assets: [{ fileName: file.name, height: 0, uri: URL.createObjectURL(file), width: 0 }],
        canceled: false,
      });
    });
    // Browsers that support it fire `cancel` when the dialog is dismissed.
    input.addEventListener("cancel", () => finish({ assets: null, canceled: true }));
    input.click();
  });
}
