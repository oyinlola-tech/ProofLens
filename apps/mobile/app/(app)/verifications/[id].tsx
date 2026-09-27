import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { api, ApiError } from "../../../src/lib/api";
import { formatDateTime, formatPercent, truncate, VERDICT_DESCRIPTION, verdictColors } from "../../../src/lib/format";
import { radius, useTheme } from "../../../src/lib/theme";
import type { Document, EvidenceDetail, EvidenceReference, Finding, Verification } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";
import { Body, Button, Heading, Loading, Mono, Muted, Notice, Panel, Screen, VerdictBadge } from "../../../src/components/ui";

const FINDING_LABEL: Record<Finding["kind"], string> = {
  number_match: "Figure matches",
  number_mismatch: "Figure differs",
  date_match: "Date matches",
  date_mismatch: "Date differs",
  entity_mismatch: "Different entity",
  negation_conflict: "Negation conflict",
  qualifier_gap: "Stronger language than the source",
  exact_match: "Stated verbatim",
  low_relevance: "Evidence does not address the claim",
};

const ROLE_LABEL: Record<EvidenceReference["role"], string> = { supports: "Supports", contradicts: "Conflicts", context: "Context" };

function Chip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: t.surface }}>
      <Text style={{ fontSize: 12, color: t.inkSecondary }}>{label}</Text>
    </View>
  );
}

export default function VerificationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { data, error, loading, refreshing, refresh, reload } = useAsync(async () => {
    const v = await api<Verification>(`/verification/${id}`);
    const ids = Array.from(new Set(v.evidence_used.map((e) => e.source_document_id).filter((x): x is string => Boolean(x))));
    const docs = await Promise.all(
      ids.map((d) => api<Document>(`/documents/${d}`).catch((e) => (e instanceof ApiError && e.kind === "not_found" ? null : Promise.reject(e)))),
    );
    const names: Record<string, string> = {};
    ids.forEach((d, i) => { if (docs[i]) names[d] = docs[i]!.filename; });
    return { v, names };
  }, [id]);

  const v = data?.v;
  const c = verdictColors(t, v?.verdict ?? null);
  const supported = v?.verdict === "supported";
  const evidenceById = new Map<string, EvidenceDetail>((v?.evidence_used ?? []).map((e) => [e.id, e]));
  const referenced = new Set((v?.evidence_references ?? []).map((r) => r.evidence_id));
  const unreferenced = (v?.evidence_used ?? []).filter((e) => !referenced.has(e.id));

  const openSource = (documentId: string, page: number | null, highlight: string) =>
    router.push({ pathname: "/(app)/documents/[id]", params: { id: documentId, page: page ? String(page) : "1", q: highlight.slice(0, 300) } });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "Result" }} />
      {error ? <Notice action={<Button title="Try again" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
      {loading && !data ? <Loading /> : null}
      {v && data ? (
        <View style={{ gap: 22 }}>
          <View style={{ gap: 6 }}>
            <Muted>Your claim</Muted>
            <Text style={{ fontSize: 18, lineHeight: 26, fontWeight: "600", color: t.ink }}>&ldquo;{v.claim_text}&rdquo;</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/(app)/claims/[id]", params: { id: v.claim_id } })}>
              <Text style={{ color: t.inkSecondary, textDecorationLine: "underline" }}>Open the claim</Text>
            </Pressable>
            {v.claim_analysis ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                <Chip label={v.claim_analysis.assertion_strength === "absolute" ? "Absolute language" : v.claim_analysis.assertion_strength === "hedged" ? "Hedged language" : "Direct statement"} />
                {v.claim_analysis.causal ? <Chip label="Asserts causation" /> : null}
                {v.claim_analysis.negated ? <Chip label="Negated" /> : null}
                {v.claim_analysis.numbers.map((n) => <Chip key={`n-${n}`} label={n} />)}
                {v.claim_analysis.dates.map((d) => <Chip key={`d-${d}`} label={d} />)}
                {v.claim_analysis.entities.slice(0, 4).map((e) => <Chip key={`e-${e}`} label={e} />)}
              </View>
            ) : null}
          </View>

          {v.verdict === null ? (
            <Notice tone="info">This verification did not produce a verdict. Nothing was invented in its place. Return to the claim and try again.</Notice>
          ) : (
            <View style={{ backgroundColor: c.bg, borderRadius: radius.panel, padding: 18, gap: 10 }}>
              <VerdictBadge verdict={v.verdict} large />
              {v.confidence !== null ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={{ fontSize: 28, fontWeight: "700", color: c.fg, fontVariant: ["tabular-nums"] }}>{formatPercent(v.confidence)}</Text>
                  <Muted>confidence</Muted>
                </View>
              ) : (
                <Muted>Confidence unavailable</Muted>
              )}
              <Body>{v.reasoning || VERDICT_DESCRIPTION[v.verdict]}</Body>
              <Muted style={{ fontSize: 12 }}>Confidence is how strongly the supplied evidence settles this claim, not the probability that the claim is true.</Muted>
            </View>
          )}

          <Panel style={{ gap: 6 }}>
            <Heading>What the evidence says</Heading>
            {v.source_grounded_statement ? (
              <View style={{ borderLeftWidth: 2, borderLeftColor: t.accent, paddingLeft: 10 }}>
                <Body>{v.source_grounded_statement}</Body>
              </View>
            ) : v.verdict === "insufficient_evidence" ? (
              <Muted>The supplied evidence does not address this claim, so there is no source statement to report.</Muted>
            ) : (
              <Muted>No source grounded statement was produced for this verification.</Muted>
            )}
          </Panel>

          <View style={{ gap: 6 }}>
            <Heading>{supported ? "Why the claim is supported" : "Why the claim does not fully match"}</Heading>
            {v.why_claim_does_not_match ? (
              <Body>{v.why_claim_does_not_match}</Body>
            ) : supported && v.supported_parts ? (
              <Body>{v.supported_parts}</Body>
            ) : supported ? (
              <Body>The evidence directly supports the essential proposition of the claim.</Body>
            ) : (
              <Muted>No explanation was returned for this verification.</Muted>
            )}
          </View>

          {v.supported_parts && !supported ? (
            <View style={{ backgroundColor: t.supportedSoft, borderRadius: radius.panel, padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: t.supported }}>Supported portion</Text>
              <Body style={{ fontSize: 15, lineHeight: 22 }}>{v.supported_parts}</Body>
            </View>
          ) : null}

          {v.unsupported_parts ? (
            <View style={{ backgroundColor: t.partialSoft, borderRadius: radius.panel, padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: t.partial }}>Unsupported portion</Text>
              <Body style={{ fontSize: 15, lineHeight: 22 }}>{v.unsupported_parts}</Body>
            </View>
          ) : null}

          {v.source_limitations ? (
            <View style={{ gap: 6 }}>
              <Heading>What the evidence does not establish</Heading>
              <Body>{v.source_limitations}</Body>
            </View>
          ) : null}

          {v.conclusion ? (
            <Panel style={{ gap: 6, backgroundColor: t.surfaceMuted }}>
              <Heading>What you can conclude from this evidence</Heading>
              <Body>{v.conclusion}</Body>
            </Panel>
          ) : null}

          {v.findings.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Heading>Deterministic checks</Heading>
              <Muted>Figures, dates, entities, negation and qualifiers compared directly, independent of the model.</Muted>
              {[...v.findings.filter((f) => f.conflict), ...v.findings.filter((f) => !f.conflict)].map((f, i) => (
                <View key={`${f.kind}-${i}`} style={{ borderWidth: 1, borderColor: f.conflict ? t.contradicted : t.line, backgroundColor: f.conflict ? t.contradictedSoft : t.surface, borderRadius: radius.panel, padding: 12, gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: f.conflict ? t.contradicted : t.inkTertiary }}>{FINDING_LABEL[f.kind] ?? f.kind}</Text>
                  <Body style={{ fontSize: 14, lineHeight: 21 }}>{f.description}</Body>
                  {f.claim_value && f.evidence_value ? (
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                      <View style={{ flex: 1 }}><Muted style={{ fontSize: 12 }}>Claimed</Muted><Mono style={{ color: t.ink }}>{truncate(f.claim_value, 60)}</Mono></View>
                      <View style={{ flex: 1 }}><Muted style={{ fontSize: 12 }}>Source</Muted><Mono style={{ color: t.ink }}>{truncate(f.evidence_value, 60)}</Mono></View>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <Heading>Show me why</Heading>
            <Muted>The exact passages this conclusion rests on, with the source one tap away.</Muted>
            {v.evidence_used.length === 0 ? <Muted>No evidence was attached when this verification ran.</Muted> : null}
            {v.evidence_references.map((ref, i) => {
              const evidence = evidenceById.get(ref.evidence_id);
              const name = ref.document_id ? data.names[ref.document_id] : undefined;
              const highlight = ref.quote || evidence?.content || "";
              return (
                <Panel key={`${ref.evidence_id}-${i}`} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Text style={{ color: t.ink, fontWeight: "500", flexShrink: 1 }} numberOfLines={1}>{name ?? (ref.document_id ? "Document no longer available" : "Pasted evidence")}</Text>
                    {ref.page ? <Mono>page {ref.page}</Mono> : null}
                    <View style={{ borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: ref.role === "contradicts" ? t.contradictedSoft : ref.role === "supports" ? t.supportedSoft : t.surfaceMuted }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: ref.role === "contradicts" ? t.contradicted : ref.role === "supports" ? t.supported : t.inkSecondary }}>{ROLE_LABEL[ref.role]}</Text>
                    </View>
                  </View>
                  <View style={{ borderLeftWidth: 2, borderLeftColor: ref.role === "contradicts" ? t.contradicted : t.supported, paddingLeft: 10 }}>
                    <Body style={{ fontSize: 14, lineHeight: 21 }}>{ref.quote ? `“${truncate(ref.quote, 400)}”` : evidence ? truncate(evidence.content, 320) : "Passage text unavailable."}</Body>
                  </View>
                  {ref.quote && evidence && ref.quote.length < evidence.content.length ? <Muted style={{ fontSize: 12 }}>Quoted from the stored passage.</Muted> : null}
                  {ref.document_id && name ? <Button title="Open the source" variant="secondary" onPress={() => openSource(ref.document_id!, ref.page, highlight)} /> : null}
                </Panel>
              );
            })}
            {unreferenced.map((e) => {
              const name = e.source_document_id ? data.names[e.source_document_id] : undefined;
              return (
                <Panel key={e.id} style={{ gap: 6, borderStyle: "dashed" }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Text style={{ color: t.ink, fontWeight: "500", flexShrink: 1 }} numberOfLines={1}>{name ?? (e.source_document_id ? "Document no longer available" : "Pasted evidence")}</Text>
                    {e.source_page ? <Mono>page {e.source_page}</Mono> : null}
                    <Muted style={{ fontSize: 11 }}>Considered, not cited</Muted>
                  </View>
                  <View style={{ borderLeftWidth: 2, borderLeftColor: t.line, paddingLeft: 10 }}>
                    <Body style={{ fontSize: 14, lineHeight: 21, color: t.inkSecondary }}>{truncate(e.content, 240)}</Body>
                  </View>
                  {e.source_document_id && name ? <Button title="Open the source" variant="secondary" onPress={() => openSource(e.source_document_id!, e.source_page, e.content)} /> : null}
                </Panel>
              );
            })}
          </View>

          <Muted style={{ fontSize: 12 }}>
            {v.analysis?.mode === "ai"
              ? `Produced by deterministic checks and ${v.analysis.provider} (${v.analysis.model}) reasoning over the passages listed here only. Every reference was validated against the stored evidence.`
              : "Produced by deterministic checks over the passages listed here only. Model reasoning was not used for this result."}
          </Muted>
          <Muted style={{ fontSize: 12 }}>{v.completed_at ? `Completed ${formatDateTime(v.completed_at)}` : `Started ${formatDateTime(v.created_at)}`}</Muted>
          <Button title="Verify another claim" variant="ghost" onPress={() => router.push("/(app)/claims/new")} />
        </View>
      ) : null}
    </Screen>
  );
}
