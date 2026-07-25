// Reading a photo out of the device's library. The browser's file input is the
// picker; the chosen image is handed on as an object URL. A dialog resolves
// inline here, so nothing is ever left pending across a launch.
export interface ImagePickerAsset {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly fileName?: string;
}

export type ImagePickerResult =
  | { readonly canceled: true; readonly assets: null }
  | { readonly canceled: false; readonly assets: readonly ImagePickerAsset[] };

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
        window.removeEventListener("focus", onFocus);
        resolve(result);
      }
    };
    // Not every browser (notably Safari) fires the input's `cancel` event, so a
    // dismissed dialog would otherwise leave this promise pending forever. Focus
    // returns to the window when the dialog closes; if no file arrived shortly
    // after, treat it as a cancellation.
    function onFocus() {
      setTimeout(() => {
        if (!settled && (input.files?.length ?? 0) === 0) {
          finish({ assets: null, canceled: true });
        }
      }, 300);
    }
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
    input.addEventListener("cancel", () => finish({ assets: null, canceled: true }));
    window.addEventListener("focus", onFocus);
    input.click();
  });
}
