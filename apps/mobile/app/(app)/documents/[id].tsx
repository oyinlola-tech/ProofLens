import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { documentIcon } from "../../../src/components/cards";
import { Button, Card, Eyebrow, IconTile, Mono, Muted, Notice, ProcessingBadge, Screen, SkeletonList, tap } from "../../../src/components/ui";
import { api } from "../../../src/lib/api";
import { DOCUMENT_TYPE_LABEL, formatDateTime, formatNumber } from "../../../src/lib/format";
import { findRange, normalise } from "../../../src/lib/passage";
import { font, radius, useTheme } from "../../../src/lib/theme";
import type { Document, DocumentPages } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";

export default function DocumentScreen() {
  const { id, page: pageParam, q } = useLocalSearchParams<{ id: string; page?: string; q?: string }>();
  const router = useRouter();
  const t = useTheme();
  const { data, error, loading, refreshing, refresh, reload } = useAsync(async () => {
    const doc = await api<Document>(`/documents/${id}`);
    const pages = doc.processing_status === "processed" ? await api<DocumentPages>(`/documents/${id}/pages`) : null;
    return { doc, pages };
  }, [id]);
  const initial = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const [current, setCurrent] = useState(initial);

  const page = data?.pages?.pages.find((p) => p.page_number === current) ?? data?.pages?.pages[0];
  const normalised = useMemo(() => (page ? normalise(page.text) : ""), [page]);
  const range = useMemo(() => (q && page && current === initial ? findRange(page.text, q) : null), [q, page, current, initial]);
  const total = data?.pages?.total_pages ?? 0;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={refresh}
      footer={data ? <Button title="Use in a new check" size="lg" icon="search" onPress={() => router.push({ pathname: "/(app)/claims/new", params: { document: data.doc.id } })} /> : undefined}
    >
      <Stack.Screen options={{ title: "Source" }} />
      {error ? <Notice title="Could not open this document" action={<Button title="Try again" icon="refresh" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
      {loading && !data ? <SkeletonList count={3} /> : null}
      {data ? (
        <View style={{ gap: 18 }}>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <IconTile icon={documentIcon(data.doc.document_type)} size={54} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text accessibilityRole="header" numberOfLines={2} style={{ fontFamily: font.displaySemi, fontSize: 20, lineHeight: 25, letterSpacing: -0.3, color: t.ink }}>{data.doc.filename}</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <ProcessingBadge status={data.doc.processing_status} />
                <Muted style={{ fontSize: 13 }}>
                  {DOCUMENT_TYPE_LABEL[data.doc.document_type] ?? "File"} · {total ? `${total} ${total === 1 ? "page" : "pages"} · ` : ""}{formatNumber(data.doc.content_length)} chars
                </Muted>
              </View>
            </View>
          </View>
          <Mono>Added {formatDateTime(data.doc.created_at)}</Mono>

          {data.doc.processing_status === "failed" ? (
            <Notice title="Processing failed">The text of this document could not be extracted. Upload a different copy to use it as evidence.</Notice>
          ) : !data.pages ? (
            <Notice tone="info" title="Still processing">Pull down to refresh in a moment.</Notice>
          ) : data.pages.pages.length === 0 ? (
            <Muted>No extracted text is available for this document.</Muted>
          ) : (
            <>
              {q && range && page ? (
                <View style={{ backgroundColor: t.partialSoft, borderRadius: radius.panel, padding: 16, gap: 8, borderWidth: 1, borderColor: t.partial }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="locate" size={17} color={t.partial} />
                    <Eyebrow style={{ color: t.partial, flex: 1 }}>Cited passage</Eyebrow>
                    <Mono style={{ color: t.partial }}>p. {page.page_number}</Mono>
                  </View>
                  <Text selectable style={{ fontFamily: font.medium, fontSize: 15.5, lineHeight: 24, color: t.ink }}>{normalised.slice(range[0], range[1])}</Text>
                </View>
              ) : q && page && current === initial ? (
                <Notice tone="info" title="Passage not found word for word">The evidence text may have been edited before it was attached.</Notice>
              ) : null}

              {total > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
                  {data.pages.pages.map((p) => {
                    const on = p.page_number === current;
                    return (
                      <Pressable
                        key={p.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Page ${p.page_number}`}
                        accessibilityState={{ selected: on }}
                        onPress={() => {
                          tap();
                          setCurrent(p.page_number);
                        }}
                        style={{ minWidth: 46, height: 44, paddingHorizontal: 14, borderRadius: radius.control, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.ink : t.surface, borderWidth: 1, borderColor: on ? t.ink : t.line }}
                      >
                        <Text style={{ fontFamily: font.monoMedium, fontSize: 14, color: on ? t.onInk : t.ink }}>{p.page_number}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {page ? (
                <Card style={{ gap: 12, backgroundColor: t.paper }}>
                  <Eyebrow>Page {page.page_number} of {total}</Eyebrow>
                  <Text style={{ fontFamily: font.body, fontSize: 16, lineHeight: 26, color: t.ink }} selectable>
                    {range ? (
                      <>
                        {normalised.slice(0, range[0])}
                        <Text style={{ backgroundColor: t.partialSoft, fontFamily: font.medium }}>{normalised.slice(range[0], range[1])}</Text>
                        {normalised.slice(range[1])}
                      </>
                    ) : (
                      page.text
                    )}
                  </Text>
                </Card>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
