import { ActionButton, color, space } from "@richii/ui";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<"camera" | "library">("camera");
  const [importError, setImportError] = useState<string | null>(null);
  const camera = useRef<CameraView>(null);

  useEffect(() => {
    let active = true;
    void ImagePicker.getPendingResultAsync().then((pending) => {
      if (
        active &&
        pending !== null &&
        "canceled" in pending &&
        !pending.canceled &&
        pending.assets[0] !== undefined
      ) {
        setPhotoSource("library");
        setPhotoUri(pending.assets[0].uri);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function capturePhoto() {
    const photo = await camera.current?.takePictureAsync({ quality: 0.75 });

    if (photo !== undefined) {
      setPhotoSource("camera");
      setPhotoUri(photo.uri);
    }
  }

  async function choosePhoto() {
    setImportError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ["images"],
        quality: 0.9,
        selectionLimit: 1,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset !== undefined) {
        setPhotoSource("library");
        setPhotoUri(asset.uri);
      }
    } catch {
      setImportError(
        "That photo could not be opened. Try another image or enter the tiles manually.",
      );
    }
  }

  if (permission === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={color.accent} />
        <Text style={styles.status}>Checking camera availability…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted && photoUri === null) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <Text style={styles.kicker}>CAMERA / PRIVATE BY DEFAULT</Text>
        <Text accessibilityRole="header" style={styles.permissionTitle}>
          Show us the tiles.{"\n"}Keep the photo here.
        </Text>
        <Text style={styles.permissionBody}>
          Richii asks for camera access only when you choose to scan. Captures stay on this device
          unless you explicitly choose to contribute an example later.
        </Text>
        <View style={styles.permissionActions}>
          <ActionButton
            label={permission.canAskAgain ? "Allow camera access" : "Camera access is blocked"}
            onPress={() => {
              void requestPermission();
            }}
            disabled={!permission.canAskAgain}
            variant="vermilion"
          />
          <ActionButton
            label="Enter tiles manually"
            onPress={() => router.replace("/manual")}
            variant="paper"
          />
          <ActionButton
            label="Choose an existing photo"
            onPress={() => {
              void choosePhoto();
            }}
            variant="paper"
          />
        </View>
        {importError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {importError}
          </Text>
        )}
      </SafeAreaView>
    );
  }

  if (photoUri !== null) {
    return (
      <SafeAreaView style={styles.captureScreen}>
        <Image
          accessibilityLabel="Captured mahjong hand"
          source={{ uri: photoUri }}
          style={styles.preview}
        />
        <View style={styles.reviewPanel}>
          <Text style={styles.reviewTitle}>
            {photoSource === "camera" ? "Capture ready for review" : "Photo ready for review"}
          </Text>
          <Text style={styles.reviewBody}>
            The offline physical-tile model is not installed in this build. Keep the capture beside
            the tile picker so you can enter the hand without switching back and forth.
          </Text>
          <View style={styles.reviewActions}>
            <ActionButton
              label={photoSource === "camera" ? "Retake" : "Choose another photo"}
              onPress={() => {
                if (photoSource === "camera") {
                  setPhotoUri(null);
                } else {
                  void choosePhoto();
                }
              }}
              variant="paper"
            />
            <ActionButton
              label="Enter tiles from this photo"
              onPress={() =>
                router.push({ pathname: "/manual", params: { referencePhoto: photoUri } })
              }
              variant="vermilion"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.captureScreen}>
      <CameraView ref={camera} facing="back" style={styles.camera}>
        <SafeAreaView style={styles.cameraChrome}>
          <View style={styles.cameraHeader}>
            <ActionButton label="Close" onPress={() => router.back()} variant="paper" />
            <Text style={styles.guideLabel}>ALIGN 14 TILES + INDICATORS</Text>
          </View>
          <View accessibilityLabel="Tile alignment guide" style={styles.guide}>
            <View style={styles.guideCornerTopLeft} />
            <View style={styles.guideCornerTopRight} />
            <View style={styles.guideCornerBottomLeft} />
            <View style={styles.guideCornerBottomRight} />
          </View>
          <View style={styles.shutterArea}>
            <Text style={styles.cameraHint}>Keep the winning tile slightly apart.</Text>
            <View style={styles.captureActions}>
              <ActionButton
                label="Capture hand"
                onPress={() => {
                  void capturePhoto();
                }}
                variant="vermilion"
              />
              <ActionButton
                label="Choose photo"
                onPress={() => {
                  void choosePhoto();
                }}
                variant="paper"
              />
            </View>
            {importError === null ? null : (
              <Text accessibilityLiveRegion="polite" style={styles.cameraError}>
                {importError}
              </Text>
            )}
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  cameraError: { color: color.white, fontFamily: "serif", fontSize: 14 },
  cameraChrome: {
    flex: 1,
    justifyContent: "space-between",
    padding: space.x4,
  },
  cameraHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cameraHint: {
    color: color.white,
    fontFamily: "serif",
    fontSize: 16,
    textShadowColor: color.ink,
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  captureScreen: {
    backgroundColor: color.ink,
    flex: 1,
  },
  captureActions: { flexDirection: "row", flexWrap: "wrap", gap: space.x3 },
  centered: {
    alignItems: "center",
    backgroundColor: color.canvas,
    flex: 1,
    gap: space.x3,
    justifyContent: "center",
  },
  error: { color: color.accent, fontFamily: "serif", fontSize: 14, marginTop: space.x4 },
  guide: {
    alignSelf: "center",
    aspectRatio: 2.8,
    maxHeight: 300,
    position: "relative",
    width: "92%",
  },
  guideCornerBottomLeft: {
    borderBottomColor: color.white,
    borderBottomWidth: 3,
    borderLeftColor: color.white,
    borderLeftWidth: 3,
    bottom: 0,
    height: 28,
    left: 0,
    position: "absolute",
    width: 28,
  },
  guideCornerBottomRight: {
    borderBottomColor: color.white,
    borderBottomWidth: 3,
    borderRightColor: color.white,
    borderRightWidth: 3,
    bottom: 0,
    height: 28,
    position: "absolute",
    right: 0,
    width: 28,
  },
  guideCornerTopLeft: {
    borderLeftColor: color.white,
    borderLeftWidth: 3,
    borderTopColor: color.white,
    borderTopWidth: 3,
    height: 28,
    left: 0,
    position: "absolute",
    top: 0,
    width: 28,
  },
  guideCornerTopRight: {
    borderRightColor: color.white,
    borderRightWidth: 3,
    borderTopColor: color.white,
    borderTopWidth: 3,
    height: 28,
    position: "absolute",
    right: 0,
    top: 0,
    width: 28,
  },
  guideLabel: {
    color: color.white,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  kicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  permissionActions: {
    alignItems: "flex-start",
    gap: space.x3,
  },
  permissionBody: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 28,
    marginBottom: space.x6,
    maxWidth: 660,
  },
  permissionScreen: {
    backgroundColor: color.canvas,
    flex: 1,
    justifyContent: "center",
    padding: space.x5,
  },
  permissionTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: -1.7,
    lineHeight: 50,
    marginBottom: space.x4,
    marginTop: space.x3,
  },
  preview: {
    flex: 1,
    resizeMode: "contain",
  },
  reviewActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x3,
  },
  reviewBody: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: space.x4,
  },
  reviewPanel: {
    backgroundColor: color.canvas,
    padding: space.x5,
  },
  reviewTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 23,
    fontWeight: "700",
    marginBottom: space.x2,
  },
  shutterArea: {
    alignItems: "center",
    gap: space.x3,
  },
  status: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 15,
  },
});
