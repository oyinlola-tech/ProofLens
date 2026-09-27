import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { api } from "../../../src/lib/api";
import { formatDateTime } from "../../../src/lib/format";
import type { VerificationSummary } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";
import { Body, Button, EmptyState, Loading, Muted, Notice, Row, Screen, VerdictBadge } from "../../../src/components/ui";

export default function History() {
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload, silentRefresh } = useAsync(() => api<VerificationSummary[]>("/verification/?limit=50"));
  useFocusEffect(useCallback(() => { if (data) silentRefresh(); }, [data, silentRefresh]));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: 16 }}>
        <Muted>Every verification you have run, newest first. Each one keeps the evidence snapshot it used.</Muted>
        {error ? <Notice action={<Button title="Try again" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
        {loading && !data ? <Loading /> : null}
        {data && data.length === 0 ? (
          <EmptyState title="No verifications yet" body="Run your first verification and the verdict, confidence, and evidence will be kept here." action={<Button title="Start a verification" variant="secondary" onPress={() => router.push("/(app)/claims/new")} />} />
        ) : null}
        {data?.map((v, i) => (
          <Row key={v.id} last={i === data.length - 1} onPress={() => router.push({ pathname: "/(app)/verifications/[id]", params: { id: v.id } })}>
            <Body numberOfLines={3}>{v.claim_text}</Body>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <VerdictBadge verdict={v.verdict} />
              <Muted>{v.evidence_count} {v.evidence_count === 1 ? "source" : "sources"}</Muted>
              <Muted>{formatDateTime(v.completed_at ?? v.created_at)}</Muted>
            </View>
          </Row>
        ))}
      </View>
    </Screen>
  );
}
