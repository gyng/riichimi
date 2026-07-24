import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

// Web implementation of the expo-camera slice the scan flow uses. A live preview
// comes from getUserMedia into a <video>; takePictureAsync grabs the current
// frame through a canvas and returns it as an object URL. When no camera is
// reachable the scan screen still works through its upload and sample paths.
export interface CameraPermission {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
  readonly status: "granted" | "denied" | "undetermined";
}

const GRANTED: CameraPermission = { canAskAgain: true, granted: true, status: "granted" };
const UNDETERMINED: CameraPermission = {
  canAskAgain: true,
  granted: false,
  status: "undetermined",
};
const DENIED: CameraPermission = { canAskAgain: false, granted: false, status: "denied" };

function cameraReachable(): boolean {
  return typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia !== undefined;
}

async function queryPermission(): Promise<CameraPermission> {
  if (!cameraReachable()) {
    return DENIED;
  }
  try {
    const status = await navigator.permissions.query({ name: "camera" });
    if (status.state === "granted") {
      return GRANTED;
    }
    if (status.state === "denied") {
      return DENIED;
    }
    return UNDETERMINED;
  } catch {
    // Firefox and Safari do not expose "camera" to the Permissions API; fall back
    // to asking on demand rather than assuming the worst.
    return UNDETERMINED;
  }
}

export function useCameraPermissions(): readonly [
  CameraPermission | null,
  () => Promise<CameraPermission>,
] {
  const [permission, setPermission] = useState<CameraPermission | null>(null);

  useEffect(() => {
    let active = true;
    void queryPermission().then((next) => {
      if (active) {
        setPermission(next);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function request(): Promise<CameraPermission> {
    if (!cameraReachable()) {
      setPermission(DENIED);
      return DENIED;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      for (const track of stream.getTracks()) {
        track.stop();
      }
      setPermission(GRANTED);
      return GRANTED;
    } catch {
      setPermission(DENIED);
      return DENIED;
    }
  }

  return [permission, request];
}

export interface CameraViewHandle {
  takePictureAsync(options?: {
    readonly quality?: number;
  }): Promise<{ readonly uri: string } | undefined>;
}

export interface CameraViewProps {
  readonly facing?: "back" | "front";
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(function CameraView(
  { children, facing = "back", style },
  ref,
) {
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let active = true;
    async function open() {
      if (!cameraReachable()) {
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing === "front" ? "user" : "environment" },
        });
        if (!active) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }
        if (video.current !== null) {
          video.current.srcObject = stream;
          void video.current.play();
        }
      } catch {
        // The scan screen offers upload and sample-hand fallbacks when the live
        // preview cannot start.
      }
    }
    void open();
    return () => {
      active = false;
      if (stream !== null) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    };
  }, [facing]);

  useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync(options) {
        const element = video.current;
        if (element === null || element.videoWidth === 0) {
          return undefined;
        }
        const canvas = document.createElement("canvas");
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        const context = canvas.getContext("2d");
        if (context === null) {
          return undefined;
        }
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/jpeg", options?.quality ?? 0.75);
        });
        if (blob === null) {
          return undefined;
        }
        return { uri: URL.createObjectURL(blob) };
      },
    }),
    [],
  );

  return (
    <View style={style}>
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        style={{
          height: "100%",
          inset: 0,
          objectFit: "cover",
          position: "absolute",
          width: "100%",
        }}
      />
      {children}
    </View>
  );
});
