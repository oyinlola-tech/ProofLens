import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { api } from "../../../src/lib/api";
import { formatDate, truncate } from "../../../src/lib/format";
import type { Claim, Document, VerificationSummary } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";
import { ClaimComposer } from "../../../src/components/ClaimComposer";
import { Body, Button, ClaimStatusBadge, EmptyState, Loading, Muted, Notice, ProcessingBadge, Row, Screen, SectionHeader, Title, VerdictBadge } from "../../../src/components/ui";

export default function Home() {
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload, silentRefresh } = useAsync(async () => {
    const [claims, verifications, documents] = await Promise.all([
      api<Claim[]>("/claims/?limit=6"),
      api<VerificationSummary[]>("/verification/?limit=5"),
      api<Document[]>("/documents/?limit=5"),
    ]);
    return { claims, verifications, documents };
  });
  useFocusEffect(useCallback(() => { if (data) silentRefresh(); }, [data, silentRefresh]));

  const analyzing = data?.claims.filter((c) => c.status === "analyzing") ?? [];
  const pendingDocs = data?.documents.filter((d) => d.processing_status === "processing" || d.processing_status === "uploaded") ?? [];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: 28 }}>
        <View style={{ gap: 12 }}>
          <Title>Start a verification</Title>
          <ClaimComposer compact />
        </View>

        {error ? <Notice action={<Button title="Try again" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
        {loading && !data ? <Loading /> : null}

        {analyzing.length > 0 || pendingDocs.length > 0 ? (
          <View>
            <SectionHeader title="In progress" />
            {analyzing.map((c) => (
              <Row key={c.id} onPress={() => router.push({ pathname: "/(app)/claims/[id]", params: { id: c.id } })}>
                <Body numberOfLines={2}>{c.text}</Body>
                <ClaimStatusBadge status={c.status} />
              </Row>
            ))}
            {pendingDocs.map((d, i) => (
              <Row key={d.id} last={i === pendingDocs.length - 1} onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: d.id } })}>
                <Body numberOfLines={1}>{d.filename}</Body>
                <ProcessingBadge status={d.processing_status} />
              </Row>
            ))}
          </View>
        ) : null}

        {data ? (
          <View>
            <SectionHeader title="Recent results" action="All" onAction={() => router.push("/(app)/(tabs)/history")} />
            {data.verifications.length === 0 ? (
              <EmptyState title="No results yet" body="Your first verdict will appear here with a link back to its evidence." />
            ) : (
              data.verifications.map((v, i) => (
                <Row key={v.id} last={i === data.verifications.length - 1} onPress={() => router.push({ pathname: "/(app)/verifications/[id]", params: { id: v.id } })}>
                  <Body numberOfLines={2}>{truncate(v.claim_text, 140)}</Body>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <VerdictBadge verdict={v.verdict} />
                    <Muted>{v.evidence_count} {v.evidence_count === 1 ? "source" : "sources"}</Muted>
                    <Muted>{formatDate(v.created_at)}</Muted>
                  </View>
                </Row>
              ))
            )}
          </View>
        ) : null}

        {data ? (
          <View>
            <SectionHeader title="Recent documents" action="All" onAction={() => router.push("/(app)/(tabs)/documents")} />
            {data.documents.length === 0 ? (
              <EmptyState title="No documents uploaded" body="Upload a PDF from a claim's evidence step. Processed documents can be reused across claims." />
            ) : (
              data.documents.map((d, i) => (
                <Row key={d.id} last={i === data.documents.length - 1} onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: d.id } })}>
                  <Body numberOfLines={1}>{d.filename}</Body>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <Muted style={{ textTransform: "uppercase" }}>{d.document_type}</Muted>
                    <ProcessingBadge status={d.processing_status} />
                  </View>
                </Row>
              ))
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
