import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { router } from "expo-router";
import { postAvatar } from "../../services/portfolioApi";
import { useAuth } from "../lib/auth";
import { usePrefs } from "../lib/prefs";
import { useTheme } from "../lib/theme";
import { usePortfolio } from "../lib/portfolio";

/** Square and small: it renders at 96px and the upload has a 2 MB ceiling. */
const AVATAR_SIZE = 512;

export default function AvatarScreen() {
  const theme = useTheme();
  const { t } = usePrefs();
  const { getAccessToken } = useAuth();
  const { refresh } = usePortfolio();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) setShot(photo.uri);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const upload = useCallback(async () => {
    if (!shot || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Resized on the device rather than the server: a modern phone camera
      // produces several megabytes, and sending that over mobile data to be
      // thrown away is rude to whoever is paying for it.
      const resized = await ImageManipulator.manipulateAsync(
        shot,
        [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const token = await getAccessToken();
      if (!token) throw new Error(t("sessionExpiredNotice"));

      const bytes = await (await fetch(resized.uri)).arrayBuffer();
      await postAvatar(token, bytes, "image/jpeg");
      await refresh();
      router.replace("/portfolio");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  }, [shot, busy, getAccessToken, refresh, t]);

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t("cameraNeeded")}
        </Text>
        <Text style={[styles.blurb, { color: theme.textMuted }]}>
          {t("cameraWhy")}
        </Text>
        <Pressable
          onPress={() => void requestPermission()}
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: theme.accentStrong }]}
        >
          <Text style={{ color: theme.onAccent, fontWeight: "700" }}>
            {t("allowCamera")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={styles.preview}>
        {shot ? (
          <Image source={{ uri: shot }} style={styles.frame} />
        ) : (
          // Front camera: this is a profile photo, not a document scan.
          <CameraView ref={cameraRef} facing="front" style={styles.frame} />
        )}
      </View>

      {error && (
        <Text style={[styles.error, { color: theme.down }]} role="alert">
          {error}
        </Text>
      )}

      <View style={styles.actions}>
        {shot ? (
          <>
            <Pressable
              onPress={() => setShot(null)}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.secondary, { borderColor: theme.border }]}
            >
              <Text style={{ color: theme.text, fontWeight: "600" }}>
                {t("retake")}
              </Text>
            </Pressable>
            <Pressable
              onPress={upload}
              disabled={busy}
              accessibilityRole="button"
              style={[
                styles.primary,
                { backgroundColor: busy ? theme.border : theme.accentStrong },
              ]}
            >
              <Text style={{ color: theme.onAccent, fontWeight: "700" }}>
                {busy ? t("working") : t("usePhoto")}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={capture}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("takePhoto")}
            style={[styles.shutter, { borderColor: theme.accent }]}
          >
            <View
              style={[styles.shutterCore, { backgroundColor: theme.accent }]}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  title: { fontSize: 19, fontWeight: "700", textAlign: "center" },
  blurb: { textAlign: "center", lineHeight: 20 },
  cta: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 26,
    paddingVertical: 13,
  },
  preview: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  error: { textAlign: "center" },
  actions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 12,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterCore: { width: 56, height: 56, borderRadius: 28 },
  primary: { borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  secondary: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
});
