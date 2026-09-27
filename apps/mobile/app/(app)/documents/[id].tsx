import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../../src/lib/api";
import { formatDateTime, formatNumber } from "../../../src/lib/format";
import { radius, useTheme } from "../../../src/lib/theme";
import type { Document, DocumentPages } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";
import { Body, Button, Heading, Loading, Mono, Muted, Notice, Panel, ProcessingBadge, Screen, Title } from "../../../src/components/ui";

function findRange(text: string, needle: string): [number, number] | null {
  const hay = text.toLowerCase().replace(/\s+/g, " ");
  const n = needle.trim().toLowerCase().replace(/\s+/g, " ");
  for (const len of [n.length, 200, 120, 60, 30]) {
    const frag = n.slice(0, len);
    if (frag.length < 12) break;
    const idx = hay.indexOf(frag);
    if (idx >= 0) return [idx, idx + frag.length];
  }
  return null;
}

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
  const normalised = useMemo(() => (page ? page.text.replace(/\s+/g, " ") : ""), [page]);
  const range = useMemo(() => (q && page && current === initial ? findRange(page.text, q) : null), [q, page, current, initial]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: data?.doc.filename ?? "Document" }} />
      {error ? <Notice action={<Button title="Try again" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Title style={{ fontSize: 20 }} numberOfLines={2}>{data.doc.filename}</Title>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Muted style={{ textTransform: "uppercase" }}>{data.doc.document_type}</Muted>
              <Muted>{formatNumber(data.doc.content_length)} characters</Muted>
              {data.pages ? <Muted>{data.pages.total_pages} {data.pages.total_pages === 1 ? "page" : "pages"}</Muted> : null}
              <ProcessingBadge status={data.doc.processing_status} />
            </View>
            <Muted>{formatDateTime(data.doc.created_at)}</Muted>
          </View>
          <Button title="Use in a new verification" variant="secondary" onPress={() => router.push({ pathname: "/(app)/claims/new", params: { document: data.doc.id } })} />

          {data.doc.processing_status === "failed" ? (
            <Notice>Processing failed for this document, so its text could not be extracted. Upload a different copy to use it as evidence.</Notice>
          ) : !data.pages ? (
            <Notice tone="info">This document is still being processed. Pull to refresh in a moment.</Notice>
          ) : data.pages.pages.length === 0 ? (
            <Muted>No extracted text is available for this document.</Muted>
          ) : (
            <>
              {q && range && page ? (
                <Panel style={{ gap: 6, borderColor: t.partial }}>
                  <Heading>Relevant passage</Heading>
                  <Mono>page {page.page_number}</Mono>
                  <Body style={{ backgroundColor: t.partialSoft, borderRadius: 4, paddingHorizontal: 4 }}>{normalised.slice(range[0], range[1])}</Body>
                </Panel>
              ) : q && page && current === initial ? (
                <Notice tone="info">The referenced passage was not found verbatim on this page. The evidence text may have been edited before it was attached.</Notice>
              ) : null}

              {data.pages.total_pages > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {data.pages.pages.map((p) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: p.page_number === current }}
                      onPress={() => setCurrent(p.page_number)}
                      style={{ height: 36, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: "center", backgroundColor: p.page_number === current ? t.ink : t.surfaceMuted }}
                    >
                      <Text style={{ color: p.page_number === current ? t.onInk : t.ink, fontVariant: ["tabular-nums"] }}>{p.page_number}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              {page ? (
                <Panel style={{ gap: 8 }}>
                  <Mono>page {page.page_number} of {data.pages.total_pages}</Mono>
                  <Text style={{ fontSize: 15, lineHeight: 24, color: t.ink }} selectable>
                    {range ? (
                      <>
                        {normalised.slice(0, range[0])}
                        <Text style={{ backgroundColor: t.partialSoft }}>{normalised.slice(range[0], range[1])}</Text>
                        {normalised.slice(range[1])}
                      </>
                    ) : (
                      page.text
                    )}
                  </Text>
                </Panel>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
