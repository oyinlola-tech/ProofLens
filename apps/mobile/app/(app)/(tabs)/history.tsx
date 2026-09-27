import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ClaimCard, ResultCard } from "../../../src/components/cards";
import { Button, Fab, EmptyState, Muted, Notice, PageHeader, Screen, Segmented, SkeletonList, tap } from "../../../src/components/ui";
import { api } from "../../../src/lib/api";
import { VERDICT_LABEL, verdictColors } from "../../../src/lib/format";
import { font, radius, useTheme } from "../../../src/lib/theme";
import type { Claim, Verdict, VerificationSummary } from "../../../src/lib/types";
import { useAsync, useRefreshOnFocus } from "../../../src/lib/useAsync";

type View_ = "results" | "claims";
type Filter = "all" | Verdict;
const FILTERS: Filter[] = ["all", "supported", "partially_supported", "contradicted", "insufficient_evidence"];

export default function Activity() {
  const router = useRouter();
  const t = useTheme();
  const [view, setView] = useState<View_>("results");
  const [filter, setFilter] = useState<Filter>("all");
  const { data, error, loading, refreshing, refresh, reload, silentRefresh } = useAsync(async () => {
    const [verifications, claims] = await Promise.all([api<VerificationSummary[]>("/verification/?limit=50"), api<Claim[]>("/claims/?limit=50")]);
    return { verifications, claims };
  });
  useRefreshOnFocus(silentRefresh);

  // Newest first from the API, so the first verdict seen per claim is its latest.
  const latest = new Map<string, Verdict | null>();
  for (const v of data?.verifications ?? []) if (!latest.has(v.claim_id)) latest.set(v.claim_id, v.verdict);
  const results = data?.verifications.filter((v) => filter === "all" || v.verdict === filter) ?? [];
  const start = <Button title="Start a check" icon="add" onPress={() => router.push("/(app)/claims/new")} />;

  return (
    <Screen top insideTabs refreshing={refreshing} onRefresh={refresh} fab={<Fab title="New check" icon="add" onPress={() => router.push("/(app)/claims/new")} />}>
      <PageHeader title="Activity" subtitle="Every check you have run, newest first." />
      <View style={{ gap: 18 }}>
        <Segmented
          stretch
          value={view}
          onChange={setView}
          options={[
            { value: "results", label: "Results", icon: "ribbon-outline" },
            { value: "claims", label: "Claims", icon: "chatbox-ellipses-outline" },
          ]}
        />
        {error ? <Notice title="Could not load your activity" action={<Button title="Try again" icon="refresh" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
        {loading && !data ? <SkeletonList count={4} /> : null}

        {data && view === "results" ? (
          <>
            {data.verifications.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
                {FILTERS.map((f) => {
                  const on = filter === f;
                  const c = f === "all" ? { fg: t.ink, bg: t.surfaceMuted } : verdictColors(t, f);
                  const count = f === "all" ? data.verifications.length : data.verifications.filter((v) => v.verdict === f).length;
                  return (
                    <Pressable
                      key={f}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        tap();
                        setFilter(f);
                      }}
                      style={{ height: 38, paddingHorizontal: 14, borderRadius: radius.pill, flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: on ? (f === "all" ? t.ink : c.fg) : t.surface, borderWidth: 1, borderColor: on ? "transparent" : t.line }}
                    >
                      <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: on ? (f === "all" ? t.onInk : t.canvas) : t.inkSecondary }}>{f === "all" ? "All" : VERDICT_LABEL[f]}</Text>
                      <Text style={{ fontFamily: font.monoMedium, fontSize: 12, color: on ? (f === "all" ? t.onInk : t.canvas) : t.inkTertiary }}>{count}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {data.verifications.length === 0 ? (
              <EmptyState icon="ribbon-outline" title="No results yet" body="Run your first check and the verdict, confidence and evidence will be kept here." action={start} />
            ) : results.length === 0 ? (
              <Muted style={{ textAlign: "center", paddingVertical: 24 }}>No results with this verdict.</Muted>
            ) : (
              <View style={{ gap: 12 }}>
                {results.map((v) => (
                  <ResultCard key={v.id} v={v} onPress={() => router.push({ pathname: "/(app)/verifications/[id]", params: { id: v.id } })} />
                ))}
              </View>
            )}
          </>
        ) : null}

        {data && view === "claims" ? (
          data.claims.length === 0 ? (
            <EmptyState icon="chatbox-ellipses-outline" title="No claims yet" body="A claim is the statement you want tested against evidence. Write one to begin." action={start} />
          ) : (
            <View style={{ gap: 12 }}>
              {data.claims.map((c) => (
                <ClaimCard key={c.id} c={c} verdict={latest.get(c.id)} onPress={() => router.push({ pathname: "/(app)/claims/[id]", params: { id: c.id } })} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </Screen>
  );
}
