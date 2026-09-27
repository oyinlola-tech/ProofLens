import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { api } from "../../../src/lib/api";
import { formatDate } from "../../../src/lib/format";
import type { Claim } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";
import { Body, Button, ClaimStatusBadge, EmptyState, Loading, Muted, Notice, Row, Screen } from "../../../src/components/ui";

export default function Claims() {
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload, silentRefresh } = useAsync(() => api<Claim[]>("/claims/?limit=50"));
  useFocusEffect(useCallback(() => { if (data) silentRefresh(); }, [data, silentRefresh]));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: 16 }}>
        <Button title="New verification" onPress={() => router.push("/(app)/claims/new")} />
        {error ? <Notice action={<Button title="Try again" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
        {loading && !data ? <Loading /> : null}
        {data && data.length === 0 ? <EmptyState title="No claims yet" body="A claim is the statement you want tested against evidence. Create one to begin." /> : null}
        {data?.map((c, i) => (
          <Row key={c.id} last={i === data.length - 1} onPress={() => router.push({ pathname: "/(app)/claims/[id]", params: { id: c.id } })}>
            <Body numberOfLines={3}>{c.text}</Body>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <ClaimStatusBadge status={c.status} />
              <Muted>{formatDate(c.created_at)}</Muted>
            </View>
          </Row>
        ))}
      </View>
    </Screen>
  );
}
