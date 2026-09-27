import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { api } from "../../../src/lib/api";
import { formatDate, formatNumber } from "../../../src/lib/format";
import type { Document } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";
import { Body, Button, EmptyState, Loading, Muted, Notice, ProcessingBadge, Row, Screen } from "../../../src/components/ui";

export default function Documents() {
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload, silentRefresh } = useAsync(() => api<Document[]>("/documents/?limit=50"));
  useFocusEffect(useCallback(() => { if (data) silentRefresh(); }, [data, silentRefresh]));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: 16 }}>
        <Muted>Uploaded files and pasted passages. Processed documents can be attached as evidence to any claim.</Muted>
        {error ? <Notice action={<Button title="Try again" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
        {loading && !data ? <Loading /> : null}
        {data && data.length === 0 ? (
          <EmptyState title="No documents uploaded" body="Documents are added from a claim's evidence step." action={<Button title="Start a verification" variant="secondary" onPress={() => router.push("/(app)/claims/new")} />} />
        ) : null}
        {data?.map((d, i) => (
          <Row key={d.id} last={i === data.length - 1} onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: d.id } })}>
            <Body numberOfLines={2}>{d.filename}</Body>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Muted style={{ textTransform: "uppercase" }}>{d.document_type}</Muted>
              <Muted>{formatNumber(d.content_length)} chars</Muted>
              <ProcessingBadge status={d.processing_status} />
              <Muted>{formatDate(d.created_at)}</Muted>
            </View>
          </Row>
        ))}
      </View>
    </Screen>
  );
}
