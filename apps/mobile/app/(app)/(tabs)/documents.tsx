import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { DocumentCard } from "../../../src/components/cards";
import { UploadStatus } from "../../../src/components/UploadStatus";
import { Button, Fab, EmptyState, Notice, PageHeader, Screen, SectionHeader, SkeletonList } from "../../../src/components/ui";
import { api } from "../../../src/lib/api";
import { font, radius, useTheme } from "../../../src/lib/theme";
import type { Document } from "../../../src/lib/types";
import { useAsync, useRefreshOnFocus } from "../../../src/lib/useAsync";
import { useDocumentUpload } from "../../../src/lib/useDocumentUpload";

export default function Library() {
  const router = useRouter();
  const t = useTheme();
  const { data, error, loading, refreshing, refresh, reload, silentRefresh } = useAsync(() => api<Document[]>("/documents/?limit=50"));
  useRefreshOnFocus(silentRefresh);
  const { upload, busy, pickFile } = useDocumentUpload((doc) => {
    silentRefresh();
    router.push({ pathname: "/(app)/documents/[id]", params: { id: doc.id } });
  });

  return (
    <Screen top insideTabs refreshing={refreshing} onRefresh={refresh} fab={<Fab title="New check" icon="add" onPress={() => router.push("/(app)/claims/new")} />}>
      <PageHeader title="Library" subtitle="Sources you can attach to any claim." />
      <View style={{ gap: 20 }}>
        <View style={{ borderRadius: radius.panel, overflow: "hidden", minHeight: 168, justifyContent: "flex-end", boxShadow: t.shadow }}>
          <Image source={require("../../../assets/images/library.jpg")} contentFit="cover" transition={250} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <LinearGradient colors={["rgba(15,15,17,0.25)", "rgba(15,15,17,0.90)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ padding: 18, gap: 12 }}>
            <Text style={{ fontFamily: font.displaySemi, fontSize: 19, lineHeight: 24, color: "#FFFFFF" }}>Add a source once, cite it in every check.</Text>
            <Button title={busy ? "Working…" : "Upload a document"} icon="cloud-upload-outline" loading={busy} onPress={pickFile} textColor="#0F0F11" style={{ backgroundColor: "#FF6A3D", borderColor: "#FF6A3D", alignSelf: "flex-start" }} />
          </View>
        </View>
        <UploadStatus upload={upload} onRetry={pickFile} />

        {error ? <Notice title="Could not load your library" action={<Button title="Try again" icon="refresh" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
        {loading && !data ? <SkeletonList count={3} /> : null}
        {data && data.length === 0 ? <EmptyState icon="folder-open-outline" title="Your library is empty" body="Upload a PDF, TXT, MD or CSV file up to 50 MB. Pages are extracted so verdicts can cite them." /> : null}
        {data && data.length > 0 ? (
          <View>
            <SectionHeader title="Documents" count={data.length} />
            <View style={{ gap: 12 }}>
              {data.map((d) => (
                <DocumentCard key={d.id} d={d} onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: d.id } })} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
