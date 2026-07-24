// Web implementation of the expo-image-manipulator slice used for capture
// preprocessing: load the image, apply an optional resize on a canvas, and
// return a data-URL result. Only the resize action is honored; the recognizer
// needs nothing else.
export const SaveFormat = { JPEG: "jpeg", PNG: "png", WEBP: "webp" } as const;

export interface ResizeAction {
  readonly resize?: { readonly width?: number; readonly height?: number };
}

export interface ManipulateResult {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

interface ManipulateOptions {
  readonly compress?: number;
  readonly format?: (typeof SaveFormat)[keyof typeof SaveFormat];
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("image load failed")));
    image.src = uri;
  });
}

export async function manipulateAsync(
  uri: string,
  actions: readonly ResizeAction[] = [],
  options: ManipulateOptions = {},
): Promise<ManipulateResult> {
  const image = await loadImage(uri);
  const resize = actions.find((action) => action.resize !== undefined)?.resize;
  const ratio = image.height === 0 ? 1 : image.width / image.height;
  const width =
    resize?.width ?? (resize?.height !== undefined ? Math.round(resize.height * ratio) : image.width);
  const height =
    resize?.height ??
    (resize?.width !== undefined ? Math.round(resize.width / (ratio || 1)) : image.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) {
    return { height: image.height, uri, width: image.width };
  }
  context.drawImage(image, 0, 0, width, height);
  const mime = options.format === "png" ? "image/png" : "image/jpeg";
  return { height, uri: canvas.toDataURL(mime, options.compress ?? 0.9), width };
}
