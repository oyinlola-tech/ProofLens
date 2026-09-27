import { ActivityIndicator, Text, View } from "react-native";
import { font, radius, useTheme } from "../lib/theme";
import type { UploadState } from "../lib/useDocumentUpload";
import { Button, Muted, Notice } from "./ui";

/** Shows what is happening to a picked file. Renders nothing while idle. */
export function UploadStatus({ upload, onRetry }: { upload: UploadState; onRetry: () => void }) {
  const t = useTheme();
  if (upload.kind === "idle") return null;
  if (upload.kind === "failed") {
    return (
      <Notice title={`Could not use ${upload.name}`} action={<Button title="Choose another file" icon="document-attach-outline" variant="secondary" onPress={onRetry} />}>
        {upload.message}
      </Notice>
    );
  }
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: t.accentSoft, borderRadius: radius.control + 2, padding: 14 }}>
      <ActivityIndicator color={t.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.semi, fontSize: 14.5, color: t.ink }}>{upload.name}</Text>
        <Muted style={{ fontSize: 13 }}>{upload.kind === "uploading" ? "Uploading… large files can take a moment" : "Extracting pages and text…"}</Muted>
      </View>
    </View>
  );
}
